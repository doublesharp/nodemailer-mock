'use strict';

const should = require('should');
const messages = require('../lib/messages');
const nodemailer = require('../');

const transport = nodemailer.createTransport({
  host: '127.0.0.1',
  port: -100,
});

describe('Testing nodemailer-mock...', () => {
  beforeEach(() => {
    // Reset the mock to default values after each test
    nodemailer.mock.reset();
  });

  it('should succeed for email sending', (done) => {
    // Send an email that should succeed
    transport.sendMail('Email', (err, info) => {
      should(err).equal(null);
      info.response.should.equal(messages.success_response);
      done();
    });
  });

  it('should have the sent email available in the mock.sentMail()', (done) => {
    // Look for this value in the sentmail cache
    const email = 'Check for this value';
    // Send an email that should succeed
    transport.sendMail(email, (err, info) => {
      should(err).equal(null);
      info.response.should.equal(messages.success_response);
      // Check that our email was put into the sentMail cache
      const sentMail = nodemailer.mock.sentMail();
      should(sentMail).not.be.empty();
      sentMail.length.should.equal(1);
      sentMail[0].should.equal(email);
      done();
    });
  });

  it('should fail once then succeed for email sending', (done) => {
    // Tell the mock to fail once then succeed
    // (for testing retries, or so you dont have to reset a test)
    nodemailer.mock.shouldFailOnce();

    // Send an email that should fail
    transport.sendMail('Email', (err1, info1) => {
      should(err1).equal(messages.fail_response);
      info1.response.should.equal(messages.fail_response);

      // Send an email that should succeed
      transport.sendMail('Email', (err2, info2) => {
        should(err2).equal(null);
        info2.response.should.equal(messages.success_response);
        done();
      });
    });
  });

  it('should fail more than once if not reset', (done) => {
    // tell the mock to fail when sending until we tell it to succeed
    nodemailer.mock.shouldFail(true);

    // Send an email that should fail
    transport.sendMail('Email 1', (err1, info1) => {
      should(err1).equal(messages.fail_response);
      info1.response.should.equal(messages.fail_response);

      // Send another email that should fail
      transport.sendMail('Email 2', (err2, info2) => {
        should(err2).equal(messages.fail_response);
        info2.response.should.equal(messages.fail_response);

        // tell the mock to succeed when sending
        nodemailer.mock.shouldFail(false);

        // Send an email that should succeed
        transport.sendMail('Email 3', (err3, info3) => {
          should(err3).equal(null);
          info3.response.should.equal(messages.success_response);
          done();
        });
      });
    });
  });

  it('should have a custom success message', (done) => {
    // This is the success message we want it to return
    const customSuccess = 'This is a custom success';
    nodemailer.mock.successResponse(customSuccess);

    // Send an email that should succeed
    transport.sendMail('Email', (err, info) => {
      should(err).equal(null);
      info.response.should.equal(customSuccess);
      done();
    });
  });

  it('should have a custom error message', (done) => {
    // This is the error message we want it to return
    const customError = 'This is a custom error';
    nodemailer.mock.failResponse(customError);

    // Tell the mock to fail once then succeed
    // (for testing retries, or so you dont have to reset a test)
    nodemailer.mock.shouldFailOnce();

    // Send an email that should fail
    transport.sendMail('Email', (err, info) => {
      should(err).equal(customError);
      info.response.should.equal(customError);
      done();
    });
  });

  it('should return verify success using the mocked nodemailer transport', (done) => {
    transport.verify((err, success) => {
      should(err).equal(null);
      success.should.equal(messages.success_response);
      done();
    });
  });

  it('should return verify failure using the mocked nodemailer transport', (done) => {
    nodemailer.mock.shouldFailOnce();
    transport.verify((err) => {
      should(err).not.equal(null);
      err.should.be.exactly(messages.fail_response);
      done();
    });
  });

  it('should return verify error using the real nodemailer transport', (done) => {
    nodemailer.mock.mockedVerify(false);
    transport.verify((err) => {
      should(err).not.equal(null);
      err.code.should.equal('ECONNECTION');
      err.command.should.equal('CONN');
      done();
    });
  });
});
