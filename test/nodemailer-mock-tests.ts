'use strict';

import { expect, should } from 'chai';
import MailMessage from 'nodemailer/lib/mailer/mail-message';
import * as nodemailer from 'nodemailer';
import * as mocked from '../src/nodemailer-mock';
import { messages } from '../src/lib/messages';

should();

const transporter = mocked.createTransport({
  name: 'test',
  version: '0.0.1',
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
      const testMock = mocked.getMockFor(nodemailer);
      'undefined'.should.not.equal(typeof testMock);
      // it's the mock one...
      testMock.should.have.property('mock');
    });

    it('should let you create a mock using getMockFor but with defaults', async () => {
      const testMock = mocked.getMockFor();
      'undefined'.should.not.equal(typeof testMock);
      // it's the mock one...
      testMock.should.have.property('mock');
    });
  });

  describe('nodemailer functionality', () => {
    it('should allow plugins to be added', async () => {
      // const mail = new MailMessage(transport, { subject: 'test' });
      // try to add a plugin, twice for coverage;
      let hasPluginRun = false;

      const plugin1 = (
        mail: MailMessage,
        callback: (err?: Error | null | undefined) => void
      ): void => {
        hasPluginRun = true;
        return callback();
      };

      const pluginsNotUsed = mocked.createTransport({
        name: 'test',
        version: '0.0.1',
      });

      pluginsNotUsed.use('compile', plugin1);
      const transporters = mocked.mock.getTransporters();
      const transporter = transporters[transporters.length - 1];
      const plugins = transporter.mock.getPlugins();
      const { compile: plugin } = plugins;
      'function'.should.equal(typeof plugin[0]);

      await pluginsNotUsed.sendMail({
        subject: 'test',
      });

      hasPluginRun.should.equal(false);

      // add it under a new key
      pluginsNotUsed.use('compile2', plugin1);
      pluginsNotUsed.use('', plugin1);

      mocked.mock.setUnmockedUsePlugins(true);

      const pluginUsed = mocked.createTransport({
        name: 'test used',
        version: '0.0.1',
      });
      pluginUsed.use('compile', plugin1);
      await pluginUsed.sendMail({
        subject: 'test',
      });

      const transporters2 = mocked.mock.getTransporters();
      const transporter2 = transporters2[transporters2.length - 1];
      const plugins2 = transporter2.mock.getPlugins();
      const { compile: plugin2 } = plugins2;
      'function'.should.equal(typeof plugin2[0]);

      hasPluginRun.should.equal(true);
    });

    it('should emulate transporter.isIdle() set status', (done) => {
      expect(transporter.isIdle()).equal(false);
      let isTesting = true;
      transporter.on('idle', () => {
        expect(transporter.isIdle()).equal(true);
        (function loop() {
          if (!transporter.isIdle()) {
            if (isTesting) {
              isTesting = false;
              done();
            }
          } else {
            setTimeout(loop, 10);
          }
        })();
      });
      mocked.mock.setIsIdle(true);
      expect(transporter.isIdle()).equal(true);
      mocked.mock.setIsIdle(false);
      setTimeout(() => {
        if (isTesting) {
          isTesting = false;
          done('transporter did not become busy');
        }
      }, 1000);
    });

    it('should emulate transporter.isIdle() scheduled status', (done) => {
      expect(transporter.isIdle()).equal(false);
      let isTesting = true;
      transporter.on('idle', () => {
        expect(transporter.isIdle()).equal(true);
        (function loop() {
          if (!transporter.isIdle()) {
            if (isTesting) {
              isTesting = false;
              done();
            }
          } else {
            setTimeout(loop, 10);
          }
        })();
      });
      mocked.mock.scheduleIsIdle(true, 10);
      expect(transporter.isIdle()).equal(false);
      mocked.mock.scheduleIsIdle(false, 50);
      setTimeout(() => {
        if (isTesting) {
          isTesting = false;
          done('transporter did not become busy');
        }
      }, 1000);
    });

    it('should emulate transporter.close() call', () => {
      mocked.mock.reset();
      expect(mocked.mock.getCloseCallCount()).equal(0);
      transporter.close();
      expect(mocked.mock.getCloseCallCount()).equal(1);
      mocked.mock.reset();
      expect(mocked.mock.getCloseCallCount()).equal(0);
      mocked.mock.setMockedClose(false);
      transporter.close();
      expect(mocked.mock.getCloseCallCount()).equal(1);
      expect(transporter.mock.getCloseCallCount()).equal(2);
    });
  });

  describe('nodestyle callback api', () => {
    it('should succeed for email sending', (done) => {
      // Send an email that should succeed
      transporter.sendMail(
        {
          subject: 'Subject',
        },
        (err, info) => {
          expect(err).equal(null);
          messages.success_response.should.equal(info && info.response);
          done();
        }
      );
    });

    it('should succeed for email sending via transporter.send', (done) => {
      const message = new MailMessage(transporter, {
        subject: 'Subject',
      });
      // Send an email that should succeed
      transporter.transporter.send(
        message,
        (err, info: nodemailer.SentMessageInfo) => {
          expect(err).equal(null);
          messages.success_response.should.equal(info && info.response);
          done();
        }
      );
    });

    it('should have the sent email available in the mock.getSentMail()', (done) => {
      // Look for this value in the sentmail cache
      const email = { subject: 'Check for this value' };
      // Send an email that should succeed
      transporter.sendMail(email, (err, info) => {
        expect(err).equal(null);
        messages.success_response.should.equal(info && info.response);
        // Check that our email was put into the sentMail cache
        const sentMail = mocked.mock.getSentMail();
        // expect(sentMail).not.be.empty();
        sentMail.length.should.equal(1);
        sentMail[0].subject?.should.equal(email.subject);
        done();
      });
    });

    it('should fail once then succeed for email sending', (done) => {
      // Tell the mock to fail once then succeed
      // (for testing retries, or so you dont have to reset a test)
      mocked.mock.setShouldFailOnce();

      // Send an email that should fail
      transporter.sendMail(
        {
          subject: 'Subject',
        },
        (err1, info1) => {
          messages.fail_response.should.equal(err1);
          messages.fail_response.should.equal(info1 && info1.response);

          // Send an email that should succeed
          transporter.sendMail(
            {
              subject: 'Subject',
            },
            (err2, info2) => {
              expect(err2).equal(null);
              messages.success_response.should.equal(info2 && info2.response);
              done();
            }
          );
        }
      );
    });

    it('should fail more than once if not reset', (done) => {
      // tell the mock to fail when sending until we tell it to succeed
      mocked.mock.setShouldFail(true);

      // Send an email that should fail
      transporter.sendMail(
        {
          subject: 'Subject 1',
        },
        (err1, info1) => {
          expect(err1).equal(messages.fail_response);
          messages.fail_response.should.equal(info1 && info1.response);

          // Send another email that should fail
          transporter.sendMail(
            {
              subject: 'Subject 2',
            },
            (err2, info2) => {
              expect(err2).equal(messages.fail_response);
              messages.fail_response.should.equal(info2 && info2.response);

              // tell the mock to succeed when sending
              mocked.mock.setShouldFail(false);

              // Send an email that should succeed
              transporter.sendMail(
                {
                  subject: 'Subject 3',
                },
                (err3, info3) => {
                  expect(err3).equal(null);
                  messages.success_response.should.equal(
                    info3 && info3.response
                  );
                  done();
                }
              );
            }
          );
        }
      );
    });

    it('should fail if shouldFailCheck returns true for message', (done) => {
      // Tell the mock to fail once then succeed
      // (for testing retries, or so you dont have to reset a test)
      mocked.mock.setShouldFailCheck((email) => {
        return email.data.subject === 'FailMe';
      });

      // Send an email that should fail
      transporter.sendMail(
        {
          subject: 'FailMe',
        },
        (err1, info1) => {
          expect(err1).equal(messages.fail_response);
          messages.fail_response.should.equal(info1 && info1.response);

          // Send an email that should succeed
          transporter.sendMail(
            {
              subject: 'Subject',
            },
            (err2, info2) => {
              expect(err2).equal(null);
              messages.success_response.should.equal(info2 && info2.response);
              done();
            }
          );
        }
      );
    });

    it('should have a custom success message', (done) => {
      // This is the success message we want it to return
      const customSuccess = 'This is a custom success';
      mocked.mock.setSuccessResponse(customSuccess);

      // Send an email that should succeed
      transporter.sendMail(
        {
          subject: 'Subject',
        },
        (err, info) => {
          expect(err).equal(null);
          customSuccess.should.equal(info && info.response);
          done();
        }
      );
    });

    it('should have a custom error message', (done) => {
      // This is the error message we want it to return
      const customError = new Error('This is a custom error');
      mocked.mock.setFailResponse(customError);

      // Tell the mock to fail once then succeed
      // (for testing retries, or so you dont have to reset a test)
      mocked.mock.setShouldFailOnce();

      // Send an email that should fail
      transporter.sendMail(
        {
          subject: 'Subject',
        },
        (err, info) => {
          expect(err).equal(customError);
          customError.should.equal(info && info.response);
          done();
        }
      );
    });

    it('should return verify success using the mocked nodemailer transport', (done) => {
      transporter.verify((err, success) => {
        expect(err).equal(null);
        success.should.equal(true);
        done();
      });
    });

    it('should return verify failure using the mocked nodemailer transport', (done) => {
      mocked.mock.setShouldFailOnce();
      transporter.verify((err) => {
        expect(err).not.equal(null);
        messages.fail_response.should.deep.equal(err);
        done();
      });
    });

    it('should return verify error using the real nodemailer transport', (done) => {
      mocked.mock.setMockedVerify(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transporter.verify((err: any) => {
        expect(err).not.equal(null);
        err.code.should.equal('ECONNECTION');
        err.command.should.equal('CONN');
        done();
      });
    });
  });

  describe('promise api', () => {
    it('should succeed for email sending', (done) => {
      transporter
        .sendMail({
          subject: 'Subject',
        })
        .then((info) => {
          messages.success_response.should.equal(info && info.response);
          info.response.should.equal(messages.success_response);
          done();
        });
    });

    it('should have the sent email available in the mock.getSentMail()', (done) => {
      // Look for this value in the sentmail cache
      const email = {
        subject: 'Check for this value',
      };

      // Send an email that should succeed
      transporter.sendMail(email).then((info) => {
        info.response.should.equal(messages.success_response);
        // Check that our email was put into the sentMail cache
        const sentMail = mocked.mock.getSentMail();
        // expect(sentMail).not.be.empty();
        sentMail.length.should.equal(1);
        sentMail[0].subject?.should.equal(email.subject);
        done();
      });
    });

    it('should fail once then succeed for email sending', (done) => {
      // Tell the mock to fail once then succeed
      // (for testing retries, or so you dont have to reset a test)
      mocked.mock.setShouldFailOnce();

      // Send an email that should fail
      transporter
        .sendMail({
          subject: 'Subject',
        })
        .catch((err) => {
          expect(err.message).equal('nodemailer-mock failure');
          transporter
            .sendMail({
              subject: 'Subject',
            })
            .then((info) => {
              info.response.should.equal(messages.success_response);
              done();
            });
        });
    });

    it('should fail more than once if not reset', (done) => {
      // tell the mock to fail when sending until we tell it to succeed
      mocked.mock.setShouldFail(true);

      // Send an email that should fail
      transporter
        .sendMail({
          subject: 'Subject 1',
        })
        .catch((err1) => {
          expect(err1.message).equal('nodemailer-mock failure');
          transporter
            .sendMail({
              subject: 'Subject 2',
            })
            .catch((err2) => {
              expect(err2.message).equal('nodemailer-mock failure');
              mocked.mock.setShouldFail(false);
              transporter
                .sendMail({
                  subject: 'Subject 3',
                })
                .then((info) => {
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
        return email.data.subject === 'FailMe';
      });

      // Send an email that should fail
      transporter
        .sendMail({
          subject: 'FailMe',
        })
        .catch((err) => {
          expect(err.message).equal('nodemailer-mock failure');
          transporter
            .sendMail({
              subject: 'Subject',
            })
            .then((info) => {
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
      transporter
        .sendMail({
          subject: 'Subject',
        })
        .then((info) => {
          info.response.should.equal(customSuccess);
          done();
        });
    });

    it('should have a custom error message', (done) => {
      // This is the error message we want it to return
      const customError = new Error('This is a custom error');
      mocked.mock.setFailResponse(customError);

      // Tell the mock to fail once then succeed
      // (for testing retries, or so you dont have to reset a test)
      mocked.mock.setShouldFailOnce();

      // Send an email that should fail
      transporter
        .sendMail({
          subject: 'Subject',
        })
        .catch((err) => {
          err.should.equal(customError);
          done();
        });
    });

    it('should return verify success using the mocked nodemailer transport', (done) => {
      const promise = transporter.verify();
      if (promise instanceof Promise) {
        promise.then((success) => {
          success.should.equal(true);
          return done();
        });
      } else {
        done('Promise not returned');
      }
    });

    it('should return verify failure using the mocked nodemailer transport', (done) => {
      mocked.mock.setShouldFailOnce();
      const promise = transporter.verify();
      if (promise instanceof Promise) {
        promise.catch((err) => {
          expect(err).not.equal(null);
          err.should.deep.equal(messages.fail_response);
          done();
        });
      } else {
        done('Promise not returned');
      }
    });

    it('should return verify error using the real nodemailer transport', (done) => {
      mocked.mock.setMockedVerify(false);
      const promise = transporter.verify();
      if (promise instanceof Promise) {
        promise.catch((err) => {
          // expect(err).not.equal(null);
          err.code.should.equal('ECONNECTION');
          err.command.should.equal('CONN');
          done();
        });
      } else {
        done('Promise not returned');
      }
    });
  });

  describe('async/await api', () => {
    it('should succeed for email sending', async () => {
      const info = await transporter.sendMail({
        subject: 'Subject',
      });
      messages.success_response.should.equal(info && info.response);
      info.response.should.equal(messages.success_response);
    });

    it('should have the sent email available in the mock.getSentMail()', async () => {
      // Look for this value in the sentmail cache
      const email = {
        subject: 'Check for this value',
      };
      // Send an email that should succeed
      const info = await transporter.sendMail(email);
      messages.success_response.should.equal(info && info.response);
      // Check that our email was put into the sentMail cache
      const sentMail = mocked.mock.getSentMail();
      // expect(sentMail).not.be.empty();
      sentMail.length.should.equal(1);
      sentMail[0].subject?.should.equal(email.subject);
    });

    it('should fail once then succeed for email sending', async () => {
      // Tell the mock to fail once then succeed
      // (for testing retries, or so you dont have to reset a test)
      mocked.mock.setShouldFailOnce();

      // Send an email that should fail
      try {
        await transporter.sendMail({
          subject: 'Subject',
        });
        throw new Error(); // this should not happen
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        expect(err.message).equal('nodemailer-mock failure');
      }

      // This email should succeed
      try {
        const info = await transporter.sendMail({
          subject: 'Subject',
        });
        info.response.should.equal(messages.success_response);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        expect(err.message).equal(null);
      }
    });

    it('should fail more than once if not reset', async () => {
      // tell the mock to fail when sending until we tell it to succeed
      mocked.mock.setShouldFail(true);

      // Send an email that should fail
      try {
        await transporter.sendMail({
          subject: 'Subject 1',
        });
        throw new Error(); // this should not happen
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        expect(err.message).equal('nodemailer-mock failure');
      }
      try {
        await transporter.sendMail({
          subject: 'Subject 2',
        });
        throw new Error(); // this should not happen
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        expect(err.message).equal('nodemailer-mock failure');
      }

      mocked.mock.setShouldFail(false);
      const info = await transporter.sendMail({
        subject: 'Subject 3',
      });
      info.response.should.equal(messages.success_response);
    });

    it('should fail if shouldFailCheck returns true for message', async () => {
      // Tell the mock to fail once then succeed
      // (for testing retries, or so you dont have to reset a test)
      mocked.mock.setShouldFailCheck((email) => {
        return email.data.subject === 'FailMe';
      });

      // Send an email that should fail
      try {
        await transporter.sendMail({
          subject: 'FailMe',
        });
        throw new Error(); // this should not happen
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        expect(err.message).equal('nodemailer-mock failure');
      }

      // This email should succeed
      try {
        const info = await transporter.sendMail({
          subject: 'Subject',
        });
        info.response.should.equal(messages.success_response);
      } catch (err) {
        expect(err).equal(null);
      }
    });

    it('should have a custom success message', async () => {
      // This is the success message we want it to return
      const customSuccess = 'This is a custom success';
      mocked.mock.setSuccessResponse(customSuccess);

      // Send an email that should succeed
      const info = await transporter.sendMail({
        subject: 'Subject',
      });
      info.response.should.equal(customSuccess);
    });

    it('should have a custom error message', async () => {
      // This is the error message we want it to return
      const customError = new Error('This is a custom error');
      mocked.mock.setFailResponse(customError);

      // Tell the mock to fail once then succeed
      // (for testing retries, or so you dont have to reset a test)
      mocked.mock.setShouldFailOnce();

      // Send an email that should fail
      try {
        await transporter.sendMail({
          subject: 'Subject',
        });
        throw new Error(); // this should not happen
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        err.should.equal(customError);
      }
    });

    it('should return verify success using the mocked nodemailer transport', async () => {
      const success = await transporter.verify();
      success.should.equal(true);
    });

    it('should return verify failure using the mocked nodemailer transport', async () => {
      mocked.mock.setShouldFailOnce();
      try {
        await transporter.verify();
        throw new Error(); // this should not happen
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        expect(err).not.equal(null);
        err.should.deep.equal(messages.fail_response);
      }
    });

    it('should return verify error using the real nodemailer transport', async () => {
      mocked.mock.setMockedVerify(false);
      try {
        await transporter.verify();
        throw new Error(); // this should not happen
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        expect(err).not.equal(null);
        err.code.should.equal('ECONNECTION');
        err.command.should.equal('CONN');
      }
    });
  });
});
