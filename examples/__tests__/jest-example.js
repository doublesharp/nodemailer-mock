'use strict';

// 'nodemailer' is automatically mocked in ./__mocks__/nodemailer.js

// get the mock utilities from the mocked nodemailer
const { mock } = require('nodemailer');

test('Send an email using the mocked nodemailer', async () => {
  // load the module to test, it will use the mocked nodemailer internally
  const mailer = require('../mailer-test');
  // send the email
  await mailer.send();
  // check the mock for our sent emails
  const sentEmails = mock.getSentMail();
  // there should be one
  expect(sentEmails.length).toBe(1);
  // and it should match the to address
  expect(sentEmails[0].to).toBe('justin@to.com');
});
