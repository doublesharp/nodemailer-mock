import defaultExport, { getMockFor } from 'nodemailer-mock';

import nodemailer, { type Transport } from 'nodemailer';
import type { MockSentMessageInfo, RealisticMockSentMessageInfo, MockOptions } from 'nodemailer-mock';
import { messages } from 'nodemailer-mock/lib/messages';

const custom: Transport<{ id: number }> = {
  name: 'typed consumer',
  version: '1.0.0',
  send(_mail, callback) { callback(null, { id: 42 }); },
};
nodemailer.createTransport(custom);
const instance = getMockFor(nodemailer);
const transport = instance.createTransport(custom, { from: 'sender@example.com' });
const result: Promise<MockSentMessageInfo> = transport.sendMail({ to: 'receiver@example.com' });
const defaultResult: Promise<MockSentMessageInfo> = defaultExport.createTransport(custom).sendMail({});
transport.sendMail({}, (error, info) => {
  const typedError: Error | null = error;
  const typedInfo: MockSentMessageInfo = info;
  void [typedError, typedInfo];
});
transport.use('compile', (mail, done) => {
  mail.data.subject = 'plugin';
  done();
});
transport.verify((error, success) => { void [error, success]; });
const verified: Promise<true> = transport.verify();
// The custom transport's private result must not replace the mock's result.
// @ts-expect-error The mock still returns MockSentMessageInfo.
const customResult: Promise<{ id: number }> = transport.sendMail({});
void [result, defaultResult, verified, customResult, messages];

const realistic = getMockFor(nodemailer, { responseMode: 'realistic', messageIdGenerator: () => '<fixed@test>' });
const realisticTransport = realistic.createTransport(custom);
const realisticResult: Promise<RealisticMockSentMessageInfo> = realisticTransport.sendMail({});
realisticTransport.sendMail({}, (_error, info) => {
  const recipients: string[] = info.envelope.to;
  void recipients;
});
realistic.mock.setSentMessageInfo({ envelope: { from: 'from@test', to: ['to@test'] } });
realistic.mock.queueResult({ info: { rejected: ['to@test'] } });
realistic.mock.queueResult({ error: new Error('queued') });
realistic.mock.reset({ clearTransporters: true });
// @ts-expect-error A realistic envelope is an object, while legacy remains a string.
const legacyFromRealistic: Promise<MockSentMessageInfo> = realisticTransport.sendMail({});
// @ts-expect-error The realistic mode rejects legacy string envelopes.
realistic.mock.setSentMessageInfo({ envelope: 'legacy' });
void [realisticResult, legacyFromRealistic];

// @ts-expect-error Typed realistic options require the runtime discriminator.
const missingMode: MockOptions<'realistic'> = { messageIdGenerator: () => '<fixed@test>' };
// @ts-expect-error An explicitly realistic factory cannot omit its options.
getMockFor<'realistic'>();
// @ts-expect-error An explicitly realistic constructor cannot omit its options.
new defaultExport.NodemailerMocked<'realistic'>();
void missingMode;
