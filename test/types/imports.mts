import nodemailer from 'nodemailer';
import type { Transport } from 'nodemailer';
import * as namespace from 'nodemailer';
import Mail from 'nodemailer/lib/mailer/index.js';
import MailMessage from 'nodemailer/lib/mailer/mail-message.js';
import { getMockFor, type MockSentMessageInfo } from '../../dist/nodemailer-mock.js';

const mock = getMockFor(nodemailer);
getMockFor(namespace);
const plugin: Mail.PluginFunction = (_mail, done) => done();
mock.createTransport().use('compile', plugin);
mock.mock.setShouldFailCheck((mail: MailMessage) => mail.data.subject === 'Fail');
const result: MockSentMessageInfo = await mock.createTransport().sendMail({ subject: 'ESM' });
void result;

class CustomTransport implements Transport<{ id: number }> {
  name = 'custom';
  version = '1.0.0';

  send(
    _email: MailMessage<{ id: number }>,
    callback: (err: Error | null, info: { id: number }) => void
  ): void {
    callback(null, { id: 1 });
  }
}

const customTransport = new CustomTransport();
nodemailer.createTransport(customTransport);
const customResult: Promise<MockSentMessageInfo> = mock.createTransport(customTransport).sendMail({ subject: 'custom' });
void customResult;
