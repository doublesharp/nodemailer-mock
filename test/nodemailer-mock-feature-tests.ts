import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { mock as nodeMock } from 'node:test';
import { setImmediate as immediate } from 'node:timers/promises';
import * as library from '../src/nodemailer-mock';

const message = { from: 'sender@test', to: 'recipient@test', text: 'hello', messageId: '<fixed@test>' };

describe('documented Nodemailer features through the public mock', () => {
  it('exposes isolated offline helpers on instances and the shared module', async () => {
    const instance = library.getMockFor();
    const original = await instance.createTestAccount();
    instance.mock.setTestAccount({ ...original, web: 'https://preview.test', user: 'configured' });
    assert.equal((await instance.createTestAccount()).user, 'configured');
    assert.equal((await library.createTestAccount()).user, original.user);
    assert.equal(instance.getTestMessageUrl({ response: '250 OK [STATUS=sent MSGID=123]' }),
      'https://preview.test/message/123');
    instance.mock.reset();
    assert.equal((await instance.createTestAccount()).user, original.user);
    assert.equal(library.getTestMessageUrl({ response: '250 OK' }), false);
  });

  it('returns MIME buffers and JSON output without executing custom delivery', async () => {
    const instance = library.getMockFor(undefined, { responseMode: 'realistic' });
    const stream = await instance.createTransport({ streamTransport: true, buffer: true }).sendMail(message);
    assert.ok(Buffer.isBuffer(stream.message));
    assert.match(stream.message.toString(), /Message-ID: <fixed@test>/i);
    assert.equal(stream.messageSize, stream.message.length);
    const json = await instance.createTransport({ jsonTransport: true }).sendMail(message);
    assert.equal(JSON.parse(json.message as string).text, 'hello');
    const raw = await instance.createTransport({ streamTransport: true }).sendMail(message);
    assert.ok(raw.message instanceof Readable);
    let data = '';
    for await (const chunk of raw.message) data += chunk.toString();
    assert.match(data, /hello/);
  });

  it('validates message content only when requested and keeps failures out of history', async () => {
    const invalid = { ...message, attachments: [{ path: '/tmp/nodemailer-mock-feature-missing-file' }] };
    const ordinary = library.getMockFor();
    await ordinary.createTransport().sendMail(invalid);
    const validating = library.getMockFor(undefined, { validateContent: true });
    await assert.rejects(validating.createTransport().sendMail(invalid), { code: 'ENOENT' });
    await assert.rejects(validating.createTransport({ disableFileAccess: true }).sendMail(invalid));
    await assert.rejects(validating.createTransport({ disableUrlAccess: true }).sendMail({ ...message,
      attachments: [{ path: 'https://example.test/blocked' }] }));
    assert.deepEqual(validating.mock.getSentMail(), []);
    const info = await validating.createTransport().sendMail(message);
    assert.ok(info.messageSize! > 0);
    assert.equal(info.message, undefined);
  });

  it('copies optional SMTP response fields while preserving error identity', async () => {
    const instance = library.getMockFor(undefined, { responseMode: 'realistic' });
    const error = Object.assign(new Error('recipient refused'), { responseCode: 550, recipient: 'rejected@test' });
    const fields = { rejectedErrors: [error], ehlo: ['DSN'], message: Buffer.from('payload'),
      envelopeTime: 1, messageTime: 2, messageSize: 3 };
    instance.mock.setSentMessageInfo(fields);
    fields.ehlo.push('later');
    fields.rejectedErrors.push(new Error('later'));
    fields.message.fill(0);
    const transport = instance.createTransport();
    const first = await transport.sendMail(message);
    assert.deepEqual(first.ehlo, ['DSN']);
    assert.deepEqual(first.rejectedErrors, [error]);
    assert.equal(first.message?.toString(), 'payload');
    (first.message as Buffer).fill(0);
    first.ehlo!.push('changed');
    const second = await transport.sendMail(message);
    assert.equal(second.message?.toString(), 'payload');
    assert.deepEqual(second.ehlo, ['DSN']);
    instance.mock.reset();
    assert.equal((await transport.sendMail(message)).message, undefined);
  });

  it('isolates nested object result overrides at configuration and delivery boundaries', async () => {
    const instance = library.getMockFor();
    const transport = instance.createTransport();
    const original = { nested: { recipients: ['original@test'] } };
    instance.mock.setSentMessageInfo({ message: original });
    original.nested.recipients.push('changed@test');
    const first = await transport.sendMail(message);
    assert.deepEqual(first.message, { nested: { recipients: ['original@test'] } });
    (first.message as typeof original).nested.recipients.push('returned@test');
    assert.deepEqual((await transport.sendMail(message)).message, { nested: { recipients: ['original@test'] } });
    const queued = { nested: { value: 'queued' } };
    instance.mock.queueResult({ info: { message: queued } });
    queued.nested.value = 'changed';
    assert.deepEqual((await transport.sendMail(message)).message, { nested: { value: 'queued' } });
  });

  it('preserves string and readable result overrides without trying to clone streams', async () => {
    const instance = library.getMockFor();
    const transport = instance.createTransport();
    instance.mock.setSentMessageInfo({ message: 'string output' });
    assert.equal((await transport.sendMail(message)).message, 'string output');
    const stream = Readable.from(['stream output']);
    instance.mock.queueResult({ info: { message: stream } });
    assert.equal((await transport.sendMail(message)).message, stream);
    let content = '';
    for await (const chunk of stream) content += chunk;
    assert.equal(content, 'stream output');
    assert.equal((await transport.sendMail(message)).message, 'string output');
  });

  it('forgets collected simulation transports when resetting', () => {
    const instance = library.getMockFor(undefined, { simulateDelivery: true });
    instance.createTransport();
    instance.mock.reset({ clearTransporters: true });
    // Model the result of collection without depending on when the runtime runs GC.
    const deref = nodeMock.method(WeakRef.prototype, 'deref', () => undefined);
    try {
      instance.mock.reset();
      assert.equal(deref.mock.callCount(), 1);
      instance.mock.reset();
      assert.equal(deref.mock.callCount(), 1);
      assert.deepEqual(instance.mock.getTransporters(), []);
    } finally {
      deref.mock.restore();
    }
  });

  it('uses input options when an injected mailer factory returns no real transport', async () => {
    const module = { ...library.nodemailer, createTransport: () => undefined } as unknown as library.NodemailerType;
    const instance = library.getMockFor(module, { simulateDelivery: true });
    const pooled = instance.createTransport({ pool: true, maxConnections: 1 });
    const pending = pooled.sendMail(message);
    assert.equal(pooled.isIdle(), false);
    await pending;
    assert.equal(pooled.isIdle(), true);
    pooled.close();
    await assert.rejects(pooled.sendMail(message), { code: 'EPOOLCLOSED' });
    const url = instance.createTransport('smtp://example.test');
    assert.equal(typeof (await url.sendMail(message)).messageId, 'string');
    assert.equal(await url.verify(), true);
  });

  it('simulates OAuth provision, token events, and one renewal after EAUTH', async () => {
    const instance = library.getMockFor(undefined, { simulateDelivery: true });
    const transport = instance.createTransport({ auth: { type: 'OAuth2', user: 'user@test' } });
    const calls: boolean[] = [];
    const tokens: string[] = [];
    transport.on('token', (token) => tokens.push(token.accessToken));
    transport.set('oauth2_provision_cb', (_user: string, renew: boolean,
      done: (error: Error | null, token?: string, expires?: number) => void) => {
      calls.push(renew);
      done(null, renew ? 'renewed' : 'initial', Date.now() + 60000);
    });
    instance.mock.queueResult({ error: Object.assign(new Error('expired'), { code: 'EAUTH' }) });
    await transport.sendMail(message);
    assert.deepEqual(calls, [false, true]);
    assert.deepEqual(tokens, ['initial', 'renewed']);
    instance.mock.reset();
    await transport.sendMail(message);
    assert.deepEqual(calls, [false, true, false]);
  });

  it('keeps a second OAuth failure and never runs providers in ordinary mode', async () => {
    const instance = library.getMockFor(undefined, { simulateDelivery: true });
    const transport = instance.createTransport({ auth: { type: 'OAuth2', user: 'user@test',
      provisionCallback: (_user: string, _renew: boolean, done: (error: Error | null, token?: string) => void) =>
        done(null, 'test') } });
    const error = Object.assign(new Error('still invalid'), { code: 'EAUTH' });
    instance.mock.queueResult({ error });
    instance.mock.queueResult({ error });
    await assert.rejects(transport.sendMail(message), (received) => received === error);
    const ordinary = library.getMockFor().createTransport({ auth: { type: 'OAuth2', user: 'user@test',
      provisionCallback: () => { throw new Error('provider must not run'); } } });
    await ordinary.sendMail(message);
  });

  it('uses per-message OAuth credentials only on non-pooled transports', async () => {
    const instance = library.getMockFor(undefined, { simulateDelivery: true });
    const transport = instance.createTransport({ auth: { type: 'OAuth2', user: 'transport@test', accessToken: 'supplied' } });
    const auth = { type: 'OAuth2', user: 'message@test' };
    await assert.rejects(transport.sendMail({ ...message, auth }), { code: 'EAUTH' });
    const pooled = instance.createTransport({ pool: true,
      auth: { type: 'OAuth2', user: 'transport@test', accessToken: 'supplied' } });
    await pooled.sendMail({ ...message, auth });
    pooled.close();
  });

  it('limits pool capacity, preserves queued outcomes, and rejects sends after close', async () => {
    const instance = library.getMockFor(undefined, { simulateDelivery: true });
    const transport = instance.createTransport({ pool: true, maxConnections: 1 });
    assert.equal(transport.isIdle(), true);
    instance.mock.queueResult({ info: { response: 'first' } });
    instance.mock.queueResult({ info: { response: 'second' } });
    const first = transport.sendMail(message);
    const second = transport.sendMail(message);
    assert.equal(transport.isIdle(), false);
    assert.equal((await first).response, 'first');
    assert.equal((await second).response, 'second');
    await immediate();
    assert.equal(transport.isIdle(), true);
    let cleared = 0;
    transport.on('clear', () => cleared++);
    transport.close();
    await immediate();
    assert.equal(cleared, 1);
    await assert.rejects(transport.sendMail(message), { code: 'EPOOLCLOSED' });
    instance.mock.reset();
    assert.equal(transport.isIdle(), true);
    await transport.sendMail(message);
    transport.close();
  });

  it('requeues explicit pre-send disconnects using the next outcome', async () => {
    const instance = library.getMockFor(undefined, { simulateDelivery: true });
    const transport = instance.createTransport({ pool: true, maxRequeues: 1 });
    instance.mock.queueResult({ error: Object.assign(new Error('disconnect'), { code: 'ECONNECTION', command: 'CONN' }) });
    instance.mock.queueResult({ info: { response: 'retried' } });
    assert.equal((await transport.sendMail(message)).response, 'retried');
    assert.equal(instance.mock.getSentMail().length, 1);
    transport.close();
  });

  it('lets timers close or reset a pool during persistent unlimited retries', function() {
    this.timeout(15000);
    for (const action of ['close', 'reset']) {
      const child = spawnSync(process.execPath, ['-r', require.resolve('ts-node/register'), '-e', `
        const assert = require('node:assert/strict');
        const { getMockFor } = require('./src/nodemailer-mock');
        (async () => {
          const instance = getMockFor(undefined, { simulateDelivery: true });
          const transport = instance.createTransport({ pool: true, maxConnections: 1, maxRequeues: -1 });
          let attempts = 0;
          instance.mock.setFailResponse(Object.assign(new Error('disconnect'), {
            code: 'ECONNECTION', command: 'CONN',
          }));
          const cancel = () => {
            if (${JSON.stringify(action)} === 'reset') instance.mock.reset();
            else transport.close();
          };
          instance.mock.setShouldFailCheck(() => {
            if (++attempts === 2) setTimeout(cancel, 0);
            return true;
          });
          const sending = transport.sendMail({ to: 'recipient@test', text: 'retry' });
          await assert.rejects(sending, { code: ${JSON.stringify(action === 'reset' ? 'ERESET' : 'EPOOLCLOSED')} });
          assert.ok(attempts > 1);
          if (${JSON.stringify(action)} === 'reset') {
            await transport.sendMail({ to: 'recipient@test', text: 'reused' });
            assert.equal(instance.mock.getSentMail().length, 1);
          }
          transport.close();
        })().catch((error) => { console.error(error); process.exitCode = 1; });
      `], { cwd: resolve(__dirname, '..'), encoding: 'utf8', timeout: 5000 });
      assert.equal(child.error, undefined, `${action}: ${child.error?.message ?? child.stderr}`);
      assert.equal(child.status, 0, child.stderr);
    }
  });

  it('simulates SMTP capability checks and all-recipient refusal only when enabled', async () => {
    const instance = library.getMockFor(undefined, { simulateDelivery: true, responseMode: 'realistic',
      smtpCapabilities: ['DSN'] });
    const transport = instance.createTransport({ secure: true });
    await assert.rejects(transport.sendMail({ ...message, requireTLSExtensionEnabled: true }), { code: 'ETLS' });
    instance.mock.queueResult({ info: { accepted: [], rejected: ['recipient@test'],
      rejectedErrors: [Object.assign(new Error('refused'), { responseCode: 550 })] } });
    await assert.rejects(transport.sendMail(message), { code: 'EENVELOPE' });
    const info = await transport.sendMail({ ...message, dsn: { notify: ['success', 'failure'] } });
    assert.deepEqual(info.ehlo, ['DSN']);
    assert.deepEqual(instance.mock.getSentMail()[0].dsn, { notify: ['success', 'failure'] });
    const secure = library.getMockFor(undefined, { simulateDelivery: true, smtpCapabilities: ['REQUIRETLS'] });
    await secure.createTransport({ secure: true }).sendMail({ ...message, requireTLSExtensionEnabled: true });
    await assert.rejects(secure.createTransport().sendMail({ ...message, requireTLSExtensionEnabled: true }),
      { code: 'ETLS' });
  });
  it('fences delayed OAuth retries and token events across reset', async () => {
    const instance = library.getMockFor(undefined, { simulateDelivery: true });
    const transport = instance.createTransport({ auth: { type: 'OAuth2', user: 'user@test' } });
    let resume!: () => void;
    let calls = 0;
    const events: unknown[] = [];
    transport.on('token', (token) => events.push(token));
    transport.set('oauth2_provision_cb', (_user: string, _renew: boolean,
      done: (error: Error | null, token?: string, expires?: number) => void) => {
      calls++;
      if (calls === 1) resume = () => done(null, 'old', Date.now() + 60000);
      else done(null, 'new', Date.now() + 60000);
    });
    const failure = Object.assign(new Error('old authentication failure'), { code: 'EAUTH' });
    instance.mock.queueResult({ error: failure });
    const old = transport.sendMail(message);
    instance.mock.reset();
    instance.mock.queueResult({ info: { response: 'new outcome' } });
    resume();
    await assert.rejects(old, (error) => error === failure);
    assert.deepEqual(events, []);
    assert.equal((await transport.sendMail(message)).response, 'new outcome');
    assert.equal(calls, 2);
  });

  it('keeps a delayed renewal from consuming outcomes queued after reset', async () => {
    const instance = library.getMockFor(undefined, { simulateDelivery: true });
    const transport = instance.createTransport({ auth: { type: 'OAuth2', user: 'user@test', accessToken: 'supplied' } });
    const events: unknown[] = [];
    transport.on('token', (token) => events.push(token));
    let finish!: () => void;
    let entered!: () => void;
    const renewing = new Promise<void>((resolve) => { entered = resolve; });
    transport.set('oauth2_provision_cb', (_user: string, renew: boolean,
      done: (error: Error | null, token?: string, expires?: number) => void) => {
      assert.equal(renew, true);
      finish = () => done(null, 'old renewal', Date.now() + 60000);
      entered();
    });
    const failure = Object.assign(new Error('old token rejected'), { code: 'EAUTH' });
    instance.mock.queueResult({ error: failure });
    const old = assert.rejects(transport.sendMail(message), (error) => error === failure);
    await renewing;
    instance.mock.reset();
    instance.mock.queueResult({ info: { response: 'new outcome' } });
    finish();
    await old;
    assert.deepEqual(events, []);
    assert.deepEqual(instance.mock.getSentMail(), []);
    assert.equal((await transport.sendMail(message)).response, 'new outcome');
  });

  it('rejects REQUIRETLS when simulated server capabilities were not configured', async () => {
    const instance = library.getMockFor(undefined, { simulateDelivery: true });
    const transport = instance.createTransport({ secure: true });
    await assert.rejects(transport.sendMail({ ...message, requireTLSExtensionEnabled: true }), { code: 'ETLS' });
    assert.deepEqual(instance.mock.getSentMail(), []);
  });

  it('does not let a delayed old plugin occupy reset pool capacity', async () => {
    const instance = library.getMockFor(undefined, { simulateDelivery: true });
    const transport = instance.createTransport({ pool: true, maxConnections: 1 });
    instance.mock.setUnmockedUsePlugins(true);
    let resume!: () => void;
    transport.use('compile', (_mail, done) => { resume = done; });
    const old = transport.sendMail(message);
    instance.mock.reset();
    let idle = 0;
    transport.on('idle', () => idle++);
    resume();
    assert.equal(transport.isIdle(), true);
    await old;
    await immediate();
    assert.equal(idle, 0);
    assert.deepEqual(instance.mock.getSentMail(), []);
    transport.close();
  });

  it('resets reused transporters after they leave the public registry', async () => {
    const instance = library.getMockFor(undefined, { simulateDelivery: true });
    const transport = instance.createTransport({ pool: true, rateLimit: 1, rateDelta: 60000 });
    instance.mock.reset({ clearTransporters: true });
    await transport.sendMail(message);
    const queued = transport.sendMail(message);
    const rejected = assert.rejects(queued, { code: 'ERESET' });
    instance.mock.reset();
    await rejected;
    await transport.sendMail(message);
    transport.close();
  });

  it('keeps rendered MIME IDs aligned with generated and overridden result IDs', async () => {
    const instance = library.getMockFor(undefined, { responseMode: 'realistic',
      messageIdGenerator: () => '<generated@test>' });
    const transport = instance.createTransport({ streamTransport: true, buffer: true });
    const first = await transport.sendMail(message);
    assert.match(first.message!.toString(), /Message-ID: <generated@test>/i);
    assert.equal(first.messageId, '<generated@test>');
    instance.mock.queueResult({ info: { messageId: '<queued@test>' } });
    const second = await transport.sendMail(message);
    assert.match(second.message!.toString(), /Message-ID: <queued@test>/i);
  });

  it('starts a documented idle pull loop without a manual kick', async () => {
    const instance = library.getMockFor(undefined, { simulateDelivery: true });
    const transport = instance.createTransport({ pool: true, maxConnections: 1 });
    const queue = [{ ...message, subject: 'first' }, { ...message, subject: 'second' }];
    const pending: Promise<unknown>[] = [];
    transport.on('idle', () => {
      while (transport.isIdle() && queue.length) pending.push(transport.sendMail(queue.shift()!));
    });
    await immediate();
    await Promise.all(pending);
    assert.equal(queue.length, 0);
    assert.deepEqual(instance.mock.getSentMail().map((mail) => mail.subject), ['first', 'second']);
    transport.close();
  });

});
