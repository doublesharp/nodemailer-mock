'use strict';

const should = require('should');
const messages = require('../lib/messages');
const nodemailer = require('nodemailer');
const mocked = require('../');

const transport = mocked.createTransport({
  host: '127.0.0.1',
  port: -100,
});

describe('Testing nodemailer-mock...', () => {
  beforeEach(() => {
    // Reset the mock to default values after each test
    mocked.mock.reset();
  });

  describe('module loading', () => {
    it('should let you create a mock using the real nodemailer using getMockFor(nodemailer)', async () => {
      // it's the real one...
      nodemailer.should.not.have.property('mock');
      // load the mock using the real one
      const testMock = require('../').getMockFor(nodemailer);
      should(typeof testMock).not.equal('undefined');
      // it's the mock one...
      testMock.should.have.property('mock');
    });

    it('should let you create a mock using getMockFor but with defaults', async () => {
      const testMock = require('../').getMockFor();
      should(typeof testMock).not.equal('undefined');
      // it's the mock one...
      testMock.should.have.property('mock');
    });
  });

  describe('nodemailer functionality', () => {
    it('should allow plugins to be added', async () => {
      // try to add a plugin, twice for coverage;
      transport.use('plugin-name', { foo: 'bar' });
      let { 'plugin-name': plugins } = transport.mock.getPlugins();
      let [plugin] = plugins;
      should(plugin).not.equal(undefined);
      plugin.should.have.property('foo');
      plugin.foo.should.equal('bar');

      transport.use('plugin-name', { foo: 'rab' });
      plugins = transport.mock.getPlugins()['plugin-name'];
      [, plugin] = plugins;
      plugin.foo.should.equal('rab');

      // allow for falsey step arg
      transport.use(false, { foo: 'false' });
      plugins = transport.mock.getPlugins()[''];
      [plugin] = plugins;
      plugin.foo.should.equal('false');

      // make sure they get cleared
      mocked.mock.reset();
      plugins = transport.mock.getPlugins()[''];
      should(plugins).equal(undefined);
    });
  });

  describe('nodestyle callback api', () => {
    it('should succeed for email sending', (done) => {
      // Send an email that should succeed
      transport.sendMail('Email', (err, info) => {
        should(err).equal(null);
        info.response.should.equal(messages.success_response);
        done();
      });
    });

    it('should have the sent email available in the mock.getSentMail()', (done) => {
      // Look for this value in the sentmail cache
      const email = 'Check for this value';
      // Send an email that should succeed
      transport.sendMail(email, (err, info) => {
        should(err).equal(null);
        info.response.should.equal(messages.success_response);
        // Check that our email was put into the sentMail cache
        const sentMail = mocked.mock.getSentMail();
        should(sentMail).not.be.empty();
        sentMail.length.should.equal(1);
        sentMail[0].should.equal(email);
        done();
      });
    });

    it('should fail once then succeed for email sending', (done) => {
      // Tell the mock to fail once then succeed
      // (for testing retries, or so you dont have to reset a test)
      mocked.mock.setShouldFailOnce();

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
      mocked.mock.setShouldFail(true);

      // Send an email that should fail
      transport.sendMail('Email 1', (err1, info1) => {
        should(err1).equal(messages.fail_response);
        info1.response.should.equal(messages.fail_response);

        // Send another email that should fail
        transport.sendMail('Email 2', (err2, info2) => {
          should(err2).equal(messages.fail_response);
          info2.response.should.equal(messages.fail_response);

          // tell the mock to succeed when sending
          mocked.mock.setShouldFail(false);

          // Send an email that should succeed
          transport.sendMail('Email 3', (err3, info3) => {
            should(err3).equal(null);
            info3.response.should.equal(messages.success_response);
            done();
          });
        });
      });
    });

    it('should fail if shouldFailCheck returns true for message', (done) => {
      // Tell the mock to fail once then succeed
      // (for testing retries, or so you dont have to reset a test)
      mocked.mock.setShouldFailCheck((email) => {
        return email === 'FailMe';
      });

      // Send an email that should fail
      transport.sendMail('FailMe', (err1, info1) => {
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

    it('should have a custom success message', (done) => {
      // This is the success message we want it to return
      const customSuccess = 'This is a custom success';
      mocked.mock.setSuccessResponse(customSuccess);

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
      mocked.mock.setFailResponse(customError);

      // Tell the mock to fail once then succeed
      // (for testing retries, or so you dont have to reset a test)
      mocked.mock.setShouldFailOnce();

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
      mocked.mock.setShouldFailOnce();
      transport.verify((err) => {
        should(err).not.equal(null);
        err.should.be.exactly(messages.fail_response);
        done();
      });
    });

    it('should return verify error using the real nodemailer transport', (done) => {
      mocked.mock.setMockedVerify(false);
      transport.verify((err) => {
        should(err).not.equal(null);
        err.code.should.equal('ECONNECTION');
        err.command.should.equal('CONN');
        done();
      });
    });
  });

  describe('promise api', () => {
    it('should succeed for email sending', (done) => {
      transport.sendMail('Email').then((info) => {
        info.response.should.equal(messages.success_response);
        done();
      });
    });

    it('should have the sent email available in the mock.getSentMail()', (done) => {
      // Look for this value in the sentmail cache
      const email = 'Check for this value';
      // Send an email that should succeed
      transport.sendMail(email).then((info) => {
        info.response.should.equal(messages.success_response);
        // Check that our email was put into the sentMail cache
        const sentMail = mocked.mock.getSentMail();
        should(sentMail).not.be.empty();
        sentMail.length.should.equal(1);
        sentMail[0].should.equal(email);
        done();
      });
    });

    it('should fail once then succeed for email sending', (done) => {
      // Tell the mock to fail once then succeed
      // (for testing retries, or so you dont have to reset a test)
      mocked.mock.setShouldFailOnce();

      // Send an email that should fail
      transport.sendMail('Email').catch((err) => {
        should(err.message).equal('nodemailer-mock failure');
        transport.sendMail('Email').then((info) => {
          info.response.should.equal(messages.success_response);
          done();
        });
      });
    });

    it('should fail more than once if not reset', (done) => {
      // tell the mock to fail when sending until we tell it to succeed
      mocked.mock.setShouldFail(true);

      // Send an email that should fail
      transport.sendMail('Email 1').catch((err1) => {
        should(err1.message).equal('nodemailer-mock failure');
        transport.sendMail('Email 2').catch((err2) => {
          should(err2.message).equal('nodemailer-mock failure');
          mocked.mock.setShouldFail(false);
          transport.sendMail('Email 3').then((info) => {
            info.response.should.equal(messages.success_response);
            done();
          });
        });
      });
    });

    it('should fail if shouldFailCheck returns true for message', (done) => {
      // Tell the mock to fail once then succeed
      // (for testing retries, or so you dont have to reset a test)
      mocked.mock.setShouldFailCheck((email) => {
        return email === 'FailMe';
      });

      // Send an email that should fail
      transport.sendMail('FailMe').catch((err) => {
        should(err.message).equal('nodemailer-mock failure');
        transport.sendMail('Email').then((info) => {
          info.response.should.equal(messages.success_response);
          done();
        });
      });
    });

    it('should have a custom success message', (done) => {
      // This is the success message we want it to return
      const customSuccess = 'This is a custom success';
      mocked.mock.setSuccessResponse(customSuccess);

      // Send an email that should succeed
      transport.sendMail('Email').then((info) => {
        info.response.should.equal(customSuccess);
        done();
      });
    });

    it('should have a custom error message', (done) => {
      // This is the error message we want it to return
      const customError = 'This is a custom error';
      mocked.mock.setFailResponse(customError);

      // Tell the mock to fail once then succeed
      // (for testing retries, or so you dont have to reset a test)
      mocked.mock.setShouldFailOnce();

      // Send an email that should fail
      transport.sendMail('Email').catch((err) => {
        err.should.equal(customError);
        done();
      });
    });

    it('should return verify success using the mocked nodemailer transport', (done) => {
      transport.verify().then((success) => {
        success.should.equal(messages.success_response);
        done();
      });
    });

    it('should return verify failure using the mocked nodemailer transport', (done) => {
      mocked.mock.setShouldFailOnce();
      transport.verify().catch((err) => {
        should(err).not.equal(null);
        err.should.be.exactly(messages.fail_response);
        done();
      });
    });

    it('should return verify error using the real nodemailer transport', (done) => {
      mocked.mock.setMockedVerify(false);
      transport.verify().catch((err) => {
        should(err).not.equal(null);
        err.code.should.equal('ECONNECTION');
        err.command.should.equal('CONN');
        done();
      });
    });
  });

  describe('async/await api', () => {
    it('should succeed for email sending', async () => {
      const info = await transport.sendMail('Email');
      info.response.should.equal(messages.success_response);
    });

    it('should have the sent email available in the mock.getSentMail()', async () => {
      // Look for this value in the sentmail cache
      const email = 'Check for this value';
      // Send an email that should succeed
      const info = await transport.sendMail(email);
      info.response.should.equal(messages.success_response);
      // Check that our email was put into the sentMail cache
      const sentMail = mocked.mock.getSentMail();
      should(sentMail).not.be.empty();
      sentMail.length.should.equal(1);
      sentMail[0].should.equal(email);
    });

    it('should fail once then succeed for email sending', async () => {
      // Tell the mock to fail once then succeed
      // (for testing retries, or so you dont have to reset a test)
      mocked.mock.setShouldFailOnce();

      // Send an email that should fail
      try {
        await transport.sendMail('Email');
        throw new Error(); // this should not happen
      } catch (err) {
        should(err.message).equal('nodemailer-mock failure');
      }

      // This email should succeed
      try {
        const info = await transport.sendMail('Email');
        info.response.should.equal(messages.success_response);
      } catch (err) {
        should(err.message).equal(null);
      }
    });

    it('should fail more than once if not reset', async () => {
      // tell the mock to fail when sending until we tell it to succeed
      mocked.mock.setShouldFail(true);

      // Send an email that should fail
      try {
        await transport.sendMail('Email 1');
        throw new Error(); // this should not happen
      } catch (err) {
        should(err.message).equal('nodemailer-mock failure');
      }
      try {
        await transport.sendMail('Email 2');
        throw new Error(); // this should not happen
      } catch (err) {
        should(err.message).equal('nodemailer-mock failure');
      }

      mocked.mock.setShouldFail(false);
      const info = await transport.sendMail('Email 3');
      info.response.should.equal(messages.success_response);
    });

    it('should fail if shouldFailCheck returns true for message', async () => {
      // Tell the mock to fail once then succeed
      // (for testing retries, or so you dont have to reset a test)
      mocked.mock.setShouldFailCheck((email) => {
        return email === 'FailMe';
      });

      // Send an email that should fail
      try {
        await transport.sendMail('FailMe');
        throw new Error(); // this should not happen
      } catch (err) {
        should(err.message).equal('nodemailer-mock failure');
      }

      // This email should succeed
      try {
        const info = await transport.sendMail('Email');
        info.response.should.equal(messages.success_response);
      } catch (err) {
        should(err).equal(null);
      }
    });

    it('should have a custom success message', async () => {
      // This is the success message we want it to return
      const customSuccess = 'This is a custom success';
      mocked.mock.setSuccessResponse(customSuccess);

      // Send an email that should succeed
      const info = await transport.sendMail('Email');
      info.response.should.equal(customSuccess);
    });

    it('should have a custom error message', async () => {
      // This is the error message we want it to return
      const customError = 'This is a custom error';
      mocked.mock.setFailResponse(customError);

      // Tell the mock to fail once then succeed
      // (for testing retries, or so you dont have to reset a test)
      mocked.mock.setShouldFailOnce();

      // Send an email that should fail
      try {
        await transport.sendMail('Email');
        throw new Error(); // this should not happen
      } catch (err) {
        err.should.equal(customError);
      }
    });

    it('should return verify success using the mocked nodemailer transport', async () => {
      const success = await transport.verify();
      success.should.equal(messages.success_response);
    });

    it('should return verify failure using the mocked nodemailer transport', async () => {
      mocked.mock.setShouldFailOnce();
      try {
        await transport.verify();
        throw new Error(); // this should not happen
      } catch (err) {
        should(err).not.equal(null);
        err.should.be.exactly(messages.fail_response);
      }
    });

    it('should return verify error using the real nodemailer transport', async () => {
      mocked.mock.setMockedVerify(false);
      try {
        await transport.verify();
        throw new Error(); // this should not happen
      } catch (err) {
        should(err).not.equal(null);
        err.code.should.equal('ECONNECTION');
        err.command.should.equal('CONN');
      }
    });
  });
});
