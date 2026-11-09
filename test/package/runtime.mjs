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


// Current documented features must also work from the packed public entry point.
const features = getMockFor(nodemailer, { responseMode: 'realistic', simulateDelivery: true, validateContent: true,
  smtpCapabilities: ['DSN'] });
assert.equal(typeof commonjs.createTestAccount, 'function');
assert.equal(typeof defaultExport.getTestMessageUrl, 'function');
const testAccount = await features.createTestAccount();
assert.ok(testAccount.smtp.host.endsWith('.test'));
features.mock.setTestAccount({ ...testAccount, web: 'https://preview.test' });
assert.equal(features.getTestMessageUrl({ response: '250 [STATUS=sent MSGID=123]' }), 'https://preview.test/message/123');
const output = await features.createTransport({ streamTransport: true, buffer: true }).sendMail({
  from: 'from@test', to: 'to@test', text: 'compiled MIME', messageId: '<package@test>',
});
assert.ok(Buffer.isBuffer(output.message));
assert.match(output.message.toString(), /compiled MIME/);
assert.equal(output.messageSize, output.message.length);
const jsonOutput = await features.createTransport({ jsonTransport: true }).sendMail({ text: 'JSON content' });
assert.equal(JSON.parse(jsonOutput.message).text, 'JSON content');
await assert.rejects(features.createTransport({ disableFileAccess: true }).sendMail({
  attachments: [{ path: '/missing/consumer-file' }],
}), /File access rejected/);
features.mock.setSentMessageInfo({ ehlo: ['DSN'], envelopeTime: 1, rejectedErrors: [new Error('refused')] });
assert.deepEqual((await features.createTransport().sendMail({})).ehlo, ['DSN']);
const pool = features.createTransport({ pool: true, maxConnections: 1 });
assert.equal(pool.isIdle(), true);
await pool.sendMail({});
pool.close();
await assert.rejects(pool.sendMail({}), { code: 'EPOOLCLOSED' });
features.mock.reset();
let oauthCalls = 0;
const oauth = features.createTransport({ auth: { type: 'OAuth2', user: 'oauth@test' } });
oauth.set('oauth2_provision_cb', (_user, _renew, done) => { oauthCalls++; done(null, 'offline-token'); });
await oauth.sendMail({});
assert.equal(oauthCalls, 1);
console.log('Packaged runtime: offline helpers, rendering, validation, result metadata, pool and OAuth passed');

// URL attachments must stay offline in every supported Nodemailer major.
for (const owner of [commonjs, defaultExport]) {
  for (const options of [{ jsonTransport: true }, { streamTransport: true, buffer: true }]) {
    const attachment = Object.freeze({ filename: 'report.pdf', path: 'https://example.invalid/report.pdf' });
    const offline = owner.getMockFor(nodemailer);
    await offline.createTransport(options).sendMail({ attachments: [attachment] });
    assert.equal(offline.mock.getSentMail()[0].attachments[0], attachment);
    await assert.rejects(offline.createTransport({ ...options, disableUrlAccess: true }).sendMail({
      attachments: [{ href: 'http://127.0.0.1:1/must-not-request' }],
    }), /Url access rejected/);
    const fixtures = owner.getMockFor(nodemailer, { resolveRemoteAttachment: () => Buffer.from('fixture bytes') });
    const fixture = await fixtures.createTransport(options).sendMail({ attachments: [attachment] });
    if (options.jsonTransport) {
      assert.equal(Buffer.from(JSON.parse(fixture.message).attachments[0].content, 'base64').toString(), 'fixture bytes');
    } else {
      assert.match(fixture.message.toString(), /Zml4dHVyZSBieXRlcw==/);
    }
  }
}
console.log('Packaged runtime: offline remote attachments, fixtures and original options passed');
