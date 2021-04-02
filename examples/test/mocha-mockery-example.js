'use strict';

const mockery = require('mockery');
const should = require('should');
const nodemailerMock = require('../../nodemailer-mock');
const { mock } = nodemailerMock;

describe('Mocha + Mockery Test', function () {
  // we need to mock nodemailer *before* we require() any modules that load it
  before(async () => {
    // Enable mockery to mock objects
    mockery.enable({
      warnOnUnregistered: false,
      useCleanCache: true,
    });

    // mock here
    mockery.registerMock('nodemailer', nodemailerMock);
  });

  // run a test
  it('Send an email using the mocked nodemailer', async () => {
    // load the module to test, it will use the mocked nodemailer internally
    const mailer = require('../mailer-test');
    // send the email
    await mailer.send();
    // check the mock for our sent emails
    const sentEmails = mock.getSentMail();
    // there should be one
    should(sentEmails.length).equal(1);
    // and it should match the to address
    should(sentEmails[0].to).equal('justin@to.com');
  });
});
