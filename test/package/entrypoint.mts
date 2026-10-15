import defaultExport, { getMockFor, mock, type MockSentMessageInfo } from 'nodemailer-mock';
import { messages } from 'nodemailer-mock/lib/messages';

const instance = defaultExport.getMockFor();
const sameMock: typeof mock = defaultExport.mock;
const result: MockSentMessageInfo = await instance.createTransport().sendMail({ subject: 'ESM types' });
getMockFor();
void [sameMock, result, messages];
