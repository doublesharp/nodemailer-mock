import nodemailer from 'nodemailer';
import type { Transport } from 'nodemailer';
import * as namespace from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import MailMessage from 'nodemailer/lib/mailer/mail-message';
import { getMockFor, type MockSentMessageInfo } from '../../dist/nodemailer-mock';

const mock = getMockFor(nodemailer);
getMockFor(namespace);
mock.createTransport('smtp://localhost:2525');
const transport = mock.createTransport({}, { from: 'sender@example.com' });
const result: Promise<MockSentMessageInfo> = transport.sendMail({ subject: 'Typed mail' });
void result;
transport.use('compile', (mail, done) => {
  mail.data.subject = 'Plugin subject';
  done();
});
mock.mock.setShouldFailCheck((mail) => mail.data.subject === 'Fail');
const standardPlugin: Mail.PluginFunction = (mail, done) => {
  mail.data.subject = 'Standard plugin';
  done();
};
transport.use('compile', standardPlugin);
const standardFailureCheck = (mail: MailMessage) => mail.data.subject === 'Fail';
mock.mock.setShouldFailCheck(standardFailureCheck);

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
