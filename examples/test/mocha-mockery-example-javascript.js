/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

const mockery = require('mockery');
const { expect } = require('chai');
const nodemailermock = require('../../dist/nodemailer-mock');
const { mock } = nodemailermock;

describe('Mocha + Mockery JavaScript', function () {
  // we need to mock nodemailer *before* we require() any modules that load it
  before(async () => {
    // Enable mockery to mock objects
    mockery.enable({
      warnOnUnregistered: false,
      useCleanCache: true,
    });

    // mock here
    mockery.registerMock('nodemailer', nodemailermock);
    mock.reset();
  });

  // run a test
  it('Send an email using the mocked nodemailer + javascript', async () => {
    // load the module to test, it will use the mocked nodemailer internally
    const mailer = require('../mailer-test');
    // send the email
    await mailer.send();
    // check the mock for our sent emails
    const sentEmails = mock.getSentMail();
    // there should be one
    expect(sentEmails.length).to.equal(1);
    // and it should match the to address
    expect(sentEmails[0].to).to.equal('justin@to.com');
  });
});
