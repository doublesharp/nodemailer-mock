import nodemailer from 'nodemailer';
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
