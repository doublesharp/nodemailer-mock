import { strict as assert } from 'node:assert';
import { setTimeout as delay } from 'node:timers/promises';
import * as nodemailer from 'nodemailer';
import MailMessage from 'nodemailer/lib/mailer/mail-message';
import { getMockFor, MockSentMessageInfo } from '../src/nodemailer-mock';
import { messages } from '../src/lib/messages';

describe('runtime isolation and response simulation', () => {
  it('isolates default errors across instances, public defaults, and reset', () => {
    const first = getMockFor();
    const second = getMockFor();
    const original = first.mock.getFailResponse();
    Object.assign(original, { message: 'changed', code: 'X', cause: 'changed' });
    assert.equal(second.mock.getFailResponse().message, 'nodemailer-mock failure');
    first.mock.reset();
    assert.notEqual(first.mock.getFailResponse(), original);
    assert.equal(first.mock.getFailResponse().message, 'nodemailer-mock failure');
    assert.equal('code' in first.mock.getFailResponse(), false);
    assert.equal('cause' in first.mock.getFailResponse(), false);
    const saved = messages.fail_response.message;
    try {
      messages.fail_response.message = 'public mutation';
      assert.equal(getMockFor().mock.getFailResponse().message, 'nodemailer-mock failure');
    } finally { messages.fail_response.message = saved; }
  });

  it('preserves a supplied failure identity until reset', async () => {
    const instance = getMockFor();
    const error = new Error('custom');
    instance.mock.setFailResponse(error);
    instance.mock.setShouldFail(true);
    await assert.rejects(instance.createTransport().sendMail({}), (actual) => actual === error);
    instance.mock.reset();
    assert.notEqual(instance.mock.getFailResponse(), error);
  });

  for (const step of ['compile', 'stream']) {
    for (const callback of [false, true]) {
      it(`fences reset across delayed ${step} plugins with ${callback ? 'callbacks' : 'promises'}`, async () => {
        const instance = getMockFor(nodemailer);
        const transport = instance.createTransport();
        let resume!: () => void;
        instance.mock.setUnmockedUsePlugins(true);
        transport.use(step, (_mail, done) => { resume = done; });
        const pending = callback
          ? new Promise((resolve, reject) => transport.sendMail({ subject: 'old' }, (error, info) =>
            error ? reject(error) : resolve(info)))
          : transport.sendMail({ subject: 'old' });
        assert.equal(typeof resume, 'function');
        instance.mock.reset();
        resume();
        await pending;
        assert.deepEqual(instance.mock.getSentMail(), []);
        await transport.sendMail({ subject: 'new' });
        assert.deepEqual(instance.mock.getSentMail().map((mail) => mail.subject), ['new']);
      });
    }
  }

  it('fences direct transport sends across the completion microtask', async () => {
    const instance = getMockFor();
    const transport = instance.createTransport();
    const email = { data: { subject: 'old direct' } } as MailMessage<MockSentMessageInfo>;
    const pending = new Promise((resolve, reject) => transport.transporter.send(email, (error, info) =>
      error ? reject(error) : resolve(info)));
    instance.mock.reset();
    await pending;
    assert.deepEqual(instance.mock.getSentMail(), []);
  });

  it('clears retained listeners and local state only with explicit full cleanup', async () => {
    const instance = getMockFor();
    const transport = instance.createTransport();
    let idle = 0;
    transport.on('idle', () => idle++);
    transport.close();
    transport.mock.setIdle(true);
    instance.mock.reset();
    assert.equal(transport.mock.getCloseCallCount(), 1);
    assert.equal(transport.isIdle(), true);
    assert.equal(instance.mock.getTransporters().length, 1);
    instance.mock.scheduleIsIdle(true, 5);
    instance.mock.reset({ clearTransporters: true });
    assert.deepEqual(instance.mock.getTransporters(), []);
    assert.equal(transport.mock.getCloseCallCount(), 0);
    assert.equal(transport.isIdle(), false);
    transport.mock.setIdle(true);
    await delay(15);
    assert.equal(idle, 1);
    await transport.sendMail({ subject: 'reused' });
    assert.equal(instance.mock.getSentMail()[0].subject, 'reused');
  });

  it('builds opt-in realistic results from compiled recipients and message ID', async () => {
    const instance = getMockFor(nodemailer, { responseMode: 'realistic' });
    const transport = instance.createTransport({}, { from: 'Sender <from@example.com>' });
    instance.mock.setUnmockedUsePlugins(true);
    transport.use('compile', (mail, done) => { mail.data.cc = 'cc@example.com'; done(); });
    const info = await transport.sendMail({ to: 'To <to@example.com>', bcc: 'bcc@example.com', messageId: '<chosen@test>' });
    assert.deepEqual(info.envelope, { from: 'from@example.com', to: ['to@example.com', 'cc@example.com', 'bcc@example.com'] });
    assert.deepEqual(info.accepted, info.envelope.to);
    assert.deepEqual(info.rejected, []);
    assert.deepEqual(info.pending, []);
    assert.equal(info.messageId, '<chosen@test>');
  });

  it('preserves legacy fields by default and accepts deterministic IDs', async () => {
    const instance = getMockFor(undefined, { messageIdGenerator: () => 'deterministic' });
    const info = await instance.createTransport().sendMail({});
    assert.deepEqual(info, { ...messages.info(), messageId: 'deterministic' });
    instance.mock.reset();
    assert.equal((await instance.createTransport().sendMail({})).messageId, 'deterministic');
  });

  it('applies persistent and FIFO overrides without mutating supplied options', async () => {
    const instance = getMockFor(undefined, { responseMode: 'realistic', messageIdGenerator: () => 'fixed' });
    const transport = instance.createTransport();
    const configured = Object.freeze({ accepted: Object.freeze(['configured']) as unknown as string[], response: 'saved' });
    instance.mock.setSentMessageInfo(configured);
    instance.mock.queueResult({ info: { accepted: ['queued'], messageId: 'queued-id' } });
    const first = await transport.sendMail({});
    assert.deepEqual(first.accepted, ['queued']);
    assert.equal(first.messageId, 'queued-id');
    assert.equal(first.response, 'saved');
    const second = await transport.sendMail({});
    second.accepted.push('mutated');
    assert.deepEqual((await transport.sendMail({})).accepted, ['configured']);
    instance.mock.queueResult({ error: new Error('discarded') });
    instance.mock.reset();
    const reset = await transport.sendMail({});
    assert.deepEqual(reset.envelope, { from: '', to: [] });
    assert.deepEqual(reset.accepted, []);
    assert.equal(reset.response, 'nodemailer-mock success');
    assert.equal(reset.messageId, 'fixed');
  });

  it('reserves outcomes in invocation order despite plugin completion order', async () => {
    const instance = getMockFor();
    const transport = instance.createTransport();
    const callbacks: (() => void)[] = [];
    instance.mock.setUnmockedUsePlugins(true);
    transport.use('compile', (_mail, done) => { callbacks.push(done); });
    instance.mock.queueResult({ info: { response: 'first' } });
    instance.mock.queueResult({ info: { response: 'second' } });
    const first = transport.sendMail({});
    const second = transport.sendMail({});
    callbacks[1]();
    assert.equal((await second).response, 'second');
    callbacks[0]();
    assert.equal((await first).response, 'first');
  });

  it('queue outcomes bypass checks and preserve fail-once and Error identity', async () => {
    const instance = getMockFor();
    const transport = instance.createTransport();
    const error = new Error('queued');
    instance.mock.queueResult({});
    instance.mock.queueResult({ error });
    assert.equal(await transport.verify(), true);
    instance.mock.setShouldFailOnce();
    instance.mock.setShouldFailCheck(() => { throw new Error('check should be bypassed'); });
    await transport.sendMail({});
    await assert.rejects(transport.sendMail({}), (actual) => actual === error);
    assert.equal(instance.mock.isShouldFailOnce(), true);
    instance.mock.setShouldFailCheck(null);
    await assert.rejects(transport.sendMail({}), (actual) => actual === instance.mock.getFailResponse());
    await transport.sendMail({});
  });

  it('returns realistic fields on callback failures while preserving the queued Error', async () => {
    const instance = getMockFor(undefined, { responseMode: 'realistic', messageIdGenerator: () => 'failed-id' });
    const error = new Error('failed');
    instance.mock.queueResult({ error });
    await new Promise<void>((resolve, reject) => instance.createTransport().sendMail({ to: 'to@example.com' },
      (actual, info) => {
        try {
          assert.equal(actual, error);
          assert.equal(info.response, error);
          assert.deepEqual(info.envelope, { from: '', to: ['to@example.com'] });
          assert.equal(info.messageId, 'failed-id');
          resolve();
        } catch (failure) { reject(failure); }
      }));
  });


  it('settles generator failures once through promises and callbacks', async () => {
    let calls = 0;
    const error = new Error('generator');
    const instance = getMockFor(undefined, { messageIdGenerator: () => { calls++; throw error; } });
    const transport = instance.createTransport();
    await assert.rejects(transport.sendMail({}), (actual) => actual === error);
    assert.equal(calls, 1);
    await new Promise<void>((resolve, reject) => transport.sendMail({}, (actual) => {
      try { assert.equal(actual, error); resolve(); } catch (failure) { reject(failure); }
    }));
    assert.equal(calls, 2);
    assert.deepEqual(instance.mock.getSentMail(), []);
  });

  it('copies configured and queued envelope and recipient arrays', async () => {
    const instance = getMockFor(undefined, { responseMode: 'realistic' });
    const configured = { envelope: { from: 'configured', to: ['configured'] }, rejected: ['rejected'], pending: ['pending'] };
    instance.mock.setSentMessageInfo(configured);
    configured.envelope.to.push('later');
    configured.rejected.push('later');
    const queued = { info: { envelope: { from: 'queued', to: ['queued'] }, pending: ['queued'] } };
    instance.mock.queueResult(queued);
    queued.info.envelope.to.push('later');
    queued.info.pending.push('later');
    const transport = instance.createTransport();
    const first = await transport.sendMail({});
    assert.deepEqual(first.envelope, { from: 'queued', to: ['queued'] });
    assert.deepEqual(first.pending, ['queued']);
    const second = await transport.sendMail({});
    assert.deepEqual(second.envelope, { from: 'configured', to: ['configured'] });
    assert.deepEqual(second.rejected, ['rejected']);
    second.envelope.to.push('mutated result');
    assert.deepEqual((await transport.sendMail({})).envelope.to, ['configured']);
  });

  it('provides an empty realistic envelope for direct uncompiled sends', async () => {
    const instance = getMockFor(undefined, { responseMode: 'realistic' });
    const transport = instance.createTransport();
    const info = await new Promise((resolve, reject) => transport.transporter.send(
      { data: {} } as MailMessage, (error, result) => error ? reject(error) : resolve(result)));
    assert.deepEqual((info as { envelope: unknown }).envelope, { from: '', to: [] });
  });

  it('honors explicit envelope and stream plugin message IDs', async () => {
    const instance = getMockFor(undefined, { responseMode: 'realistic' });
    const transport = instance.createTransport();
    instance.mock.setUnmockedUsePlugins(true);
    transport.use('stream', (mail, done) => {
      mail.message?.setHeader('Message-ID', '<stream@test>');
      done();
    });
    const info = await transport.sendMail({
      to: 'ignored@test', envelope: { from: 'bounce@test', to: ['actual@test'] },
    });
    assert.deepEqual(info.envelope, { from: 'bounce@test', to: ['actual@test'] });
    assert.deepEqual(info.accepted, ['actual@test']);
    assert.equal(info.messageId, '<stream@test>');
  });


  it('preserves a selected send error even if the ID generator throws', async () => {
    const error = new Error('selected');
    const instance = getMockFor(undefined, { messageIdGenerator: () => { throw new Error('generator'); } });
    instance.mock.queueResult({ error });
    await assert.rejects(instance.createTransport().sendMail({}), (actual) => actual === error);
  });

  it('orders queued, persistent, and base response overrides', async () => {
    const instance = getMockFor();
    const transport = instance.createTransport();
    instance.mock.setSuccessResponse('base');
    assert.equal(instance.mock.getSuccessResponse(), 'base');
    assert.equal((await transport.sendMail({})).response, 'base');
    instance.mock.setSentMessageInfo({ response: 'persistent' });
    instance.mock.queueResult({ info: { response: 'queued' } });
    assert.equal((await transport.sendMail({})).response, 'queued');
    assert.equal((await transport.sendMail({})).response, 'persistent');
    assert.equal(instance.mock.getSuccessResponse(), 'base');
  });

});
