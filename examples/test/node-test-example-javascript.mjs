'use strict';

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// We need to register the mock *before* importing any modules that use nodemailer.
// Use node --experimental-test-module-mocks to enable this feature.
const nodemailermock = await import('../../dist/nodemailer-mock.js');
const namedExports = Object.fromEntries(
  Object.entries(nodemailermock).filter(
    ([name]) => name !== '__esModule' && name !== 'module.exports',
  ),
);
const moduleMockOptions = Number.parseInt(process.versions.node, 10) >= 24
  ? { exports: namedExports }
  : { namedExports };
mock.module('nodemailer', moduleMockOptions);

const mailerTest = await import('../mailer-test.js');

describe('node:test JavaScript', () => {
  beforeEach(() => {
    nodemailermock.mock.reset();
  });

  it('Send an email using the mocked nodemailer + node:test', async () => {
    // send the email
    await mailerTest.send();
    // check the mock for our sent emails
    const sentEmails = nodemailermock.mock.getSentMail();
    // there should be one
    assert.equal(sentEmails.length, 1);
    // and it should match the to address
    assert.equal(sentEmails[0].to, 'justin@to.com');
  });
});
