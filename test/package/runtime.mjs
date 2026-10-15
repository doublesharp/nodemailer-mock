import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import defaultExport, { createTransport, getMockFor, mock, mocked } from 'nodemailer-mock';
import nodemailer from 'nodemailer';
import { messages } from 'nodemailer-mock/lib/messages';

const require = createRequire(import.meta.url);
const commonjs = require('nodemailer-mock');
assert.equal(defaultExport, commonjs);
assert.equal(defaultExport.getMockFor, getMockFor);
assert.equal(defaultExport.mock, mock);
assert.equal(commonjs.mocked, mocked);
assert.equal(commonjs.createTransport, createTransport);
assert.ok(import.meta.resolve('nodemailer-mock').endsWith('/nodemailer-mock.mjs'));
mock.reset();
await commonjs.createTransport().sendMail({ subject: 'shared singleton' });
assert.equal(mock.getSentMail()[0].subject, 'shared singleton');
mock.reset();

const instance = getMockFor(nodemailer);
const custom = {
  name: 'consumer transport',
  version: '1.0.0',
  send() { throw new Error('Real delivery must not run'); },
};
const transport = instance.createTransport(custom, { from: 'sender@example.com', subject: 'default' });
let compileCalls = 0;
let streamCalls = 0;
instance.mock.setUnmockedUsePlugins(true);
transport.use('compile', (mail, done) => { compileCalls++; mail.data.subject += ' compiled'; done(); });
transport.use('stream', (_mail, done) => { streamCalls++; done(); });
const first = await transport.sendMail({ to: 'receiver@example.com' });
assert.equal(first.response, messages.success_response);
assert.equal(first.envelope, 'envelope');
assert.deepEqual(first.accepted, ['accepted']);
assert.equal(instance.mock.getSentMail()[0].from, 'sender@example.com');
assert.equal(instance.mock.getSentMail()[0].subject, 'default compiled');
await new Promise((resolve, reject) => transport.sendMail({ subject: 'callback' }, (error, info) => {
  try {
    assert.equal(error, null);
    assert.equal(info.response, messages.success_response);
    resolve();
  } catch (failure) { reject(failure); }
}));
assert.equal(compileCalls, 2);
assert.equal(streamCalls, 2);
assert.equal(instance.mock.getSentMail()[1].subject, 'callback compiled');
assert.equal(await transport.verify(), true);
await new Promise((resolve, reject) => transport.verify((error, success) => {
  try { assert.equal(error, null); assert.equal(success, true); resolve(); } catch (failure) { reject(failure); }
}));
const failure = new Error('configured consumer failure');
instance.mock.setFailResponse(failure);
instance.mock.setShouldFail(true);
await assert.rejects(transport.sendMail({}), (error) => error === failure);
await new Promise((resolve, reject) => transport.sendMail({}, (error) => {
  try { assert.equal(error, failure); resolve(); } catch (unexpected) { reject(unexpected); }
}));
assert.equal(instance.mock.getSentMail().length, 2);

for (const step of ['compile', 'stream']) {
  const pluginMock = getMockFor(nodemailer);
  pluginMock.mock.setUnmockedUsePlugins(true);
  const pluginTransport = pluginMock.createTransport();
  const pluginError = new Error(`${step} failed`);
  pluginTransport.use(step, (_mail, done) => done(pluginError));
  await assert.rejects(pluginTransport.sendMail({}), (error) => error === pluginError);
  await new Promise((resolve, reject) => pluginTransport.sendMail({}, (error) => {
    try { assert.equal(error, pluginError); resolve(); } catch (unexpected) { reject(unexpected); }
  }));
  assert.equal(pluginMock.mock.getSentMail().length, 0);
}
// Verify new runtime APIs from the archive against every supported peer major.
const realistic = getMockFor(nodemailer, { responseMode: 'realistic' });
const realisticTransport = realistic.createTransport({}, { from: 'sender@example.com' });
const realisticInfo = await realisticTransport.sendMail({
  to: ['first@example.com', 'second@example.com'], messageId: '<realistic@example.com>',
});
assert.deepEqual(realisticInfo.envelope, {
  from: 'sender@example.com', to: ['first@example.com', 'second@example.com'],
});
assert.deepEqual(realisticInfo.accepted, realisticInfo.envelope.to);
assert.deepEqual(realisticInfo.rejected, []);
assert.equal(realisticInfo.messageId, '<realistic@example.com>');
realistic.mock.setSentMessageInfo({ response: 'configured' });
const queuedError = new Error('queued failure');
realistic.mock.queueResult({ error: queuedError });
realistic.mock.queueResult({ info: { accepted: ['first@example.com'], rejected: ['second@example.com'] } });
await assert.rejects(realisticTransport.sendMail({}), (error) => error === queuedError);
const partial = await realisticTransport.sendMail({});
assert.equal(partial.response, 'configured');
assert.deepEqual(partial.accepted, ['first@example.com']);
assert.deepEqual(partial.rejected, ['second@example.com']);
const oldSend = realisticTransport.sendMail({ subject: 'before reset' });
realistic.mock.reset();
await oldSend;
assert.deepEqual(realistic.mock.getSentMail(), []);
assert.notEqual(realistic.mock.getFailResponse(), getMockFor(nodemailer).mock.getFailResponse());
let oldIdleEvents = 0;
realisticTransport.on('idle', () => oldIdleEvents++);
realisticTransport.close();
realistic.mock.reset({ clearTransporters: true });
assert.deepEqual(realistic.mock.getTransporters(), []);
assert.equal(realisticTransport.mock.getCloseCallCount(), 0);
realisticTransport.mock.setIdle(true);
assert.equal(oldIdleEvents, 0);
await realisticTransport.sendMail({ subject: 'reused' });
assert.equal(realistic.mock.getSentMail()[0].subject, 'reused');
console.log('Packaged runtime: legacy/realistic results, queues, reset isolation, cleanup and public imports passed');
