import { expect, test } from '@jest/globals';

// 'nodemailer' is automatically mocked in ./__mocks__/nodemailer.js
import * as nodemailer from 'nodemailer';
import { NodemailerMock } from '../../dist/nodemailer-mock';
const { mock } = nodemailer as unknown as NodemailerMock;

test('Send an email using the mocked nodemailer + typescript', async () => {
  // load the module to test, it will use the mocked nodemailer internally
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mailer: any = await import('../mailer-test');
  // send the email
  await mailer.send();
  // check the mock for our sent emails
  const sentEmails = mock.getSentMail();
  // there should be one
  expect(sentEmails.length).toBe(1);
  // and it should match the to address
  expect(sentEmails[0].to).toBe('justin@to.com');
});
