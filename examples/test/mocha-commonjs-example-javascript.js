'use strict';

const Module = require('module');
const { expect } = require('chai');
const nodemailermock = require('../../dist/nodemailer-mock');
const { mock } = nodemailermock;
const originalLoad = Module._load;

describe('Mocha + CommonJS JavaScript', function () {
  // we need to mock nodemailer *before* we require() any modules that load it
  before(async () => {
    Module._load = function (request, parent, isMain) {
      if (request === 'nodemailer') {
        return nodemailermock;
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    delete require.cache[require.resolve('../mailer-test')];
    mock.reset();
  });

  after(() => {
    Module._load = originalLoad;
    delete require.cache[require.resolve('../mailer-test')];
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
