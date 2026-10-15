// eslint-disable-next-line @typescript-eslint/no-require-imports
import defaultExport = require('nodemailer-mock');
const { getMockFor } = defaultExport;

import nodemailer, { type Transport } from 'nodemailer';
import type { MockSentMessageInfo } from 'nodemailer-mock';
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
