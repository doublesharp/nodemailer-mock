'use strict';

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// We need to register the mock *before* importing any modules that use nodemailer.
// Use node --experimental-test-module-mocks to enable this feature.
const nodemailermock = await import('../../dist/nodemailer-mock.js');
const namedExports = Object.fromEntries(
  Object.entries(nodemailermock).filter(
    ([name]) => !['default', '__esModule', 'module.exports'].includes(name),
  ),
);
const moduleMockOptions = Number.parseInt(process.versions.node, 10) >= 24
  ? { exports: { ...namedExports, default: { ...namedExports } } }
  : { namedExports, defaultExport: { ...namedExports } };
// Nodemailer 10 resolves ESM imports and CommonJS requires to different files.
const require = createRequire(import.meta.url);
const entries = [import.meta.resolve('nodemailer'), pathToFileURL(require.resolve('nodemailer')).href];
for (const entry of new Set(entries)) {
  mock.module(entry, moduleMockOptions);
}

const mailerTest = await import('../mailer-test.js');
const nodemailer = await import('nodemailer');

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

  it('Send an email through the mocked ESM entry point', async () => {
    await nodemailer.createTransport().sendMail({ to: 'esm@example.com' });
    assert.equal(nodemailermock.mock.getSentMail().length, 1);
    assert.equal(nodemailermock.mock.getSentMail()[0].to, 'esm@example.com');
  });
});
