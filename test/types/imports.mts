import nodemailer from 'nodemailer';
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
