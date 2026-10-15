'use strict';

import { expect } from 'chai';
import { mock as nodeMock } from 'node:test';
import { rejects } from 'node:assert/strict';
import MailMessage from 'nodemailer/lib/mailer/mail-message';
import * as nodemailer from 'nodemailer';
import * as mocked from '../src/nodemailer-mock';
import { messages } from '../src/lib/messages';

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
    it('should create real transports through the supplied nodemailer instance', async () => {
      const calls: unknown[][] = [];
      let verifyCalls = 0;
      let closeCalls = 0;
      const suppliedMailer = {
        ...nodemailer,
        createTransport: (...args: unknown[]) => {
          calls.push(args);
          return nodemailer.createTransport({
            name: 'supplied transport',
            version: '1.0.0',
            send: () => { throw new Error('Unexpected real send'); },
            verify: async () => { verifyCalls++; return true; },
            close: () => { closeCalls++; },
          });
        },
      };
      const testMock = mocked.getMockFor(suppliedMailer);
      const config = { jsonTransport: true };
      const defaults = { from: 'sender@example.com' };
      const transport = testMock.createTransport(config, defaults);
      expect(calls).to.deep.equal([[config, defaults]]);
      testMock.mock.setMockedVerify(false);
      testMock.mock.setMockedClose(false);
      expect(await transport.verify()).to.equal(true);
      transport.close();
      expect(verifyCalls).to.equal(1);
      expect(closeCalls).to.equal(1);
    });

    it('should let you create a mock using the real nodemailer using getMockFor(nodemailer)', async () => {
      // it's the real one...
      expect(nodemailer).to.not.have.property('mock');
      // load the mock using the real one
      const testMock = mocked.getMockFor(nodemailer);
      expect(typeof testMock).to.not.equal('undefined');
      // it's the mock one...
      expect(testMock).to.have.property('mock');
    });

    it('should let you create a mock using getMockFor but with defaults', async () => {
      const testMock = mocked.getMockFor();
      expect(typeof testMock).to.not.equal('undefined');
      // it's the mock one...
      expect(testMock).to.have.property('mock');
      await testMock.createTransport().sendMail({ subject: 'Default module' });
      expect(testMock.mock.getSentMail()[0].subject).to.equal('Default module');
    });
  });

  describe('nodemailer functionality', () => {
    it('should enable previously registered plugins and disable them on reset', async () => {
      const testMock = mocked.getMockFor(nodemailer);
      const transport = testMock.createTransport();
      let runs = 0;
      const plugin = (_mail: MailMessage, done: () => void) => { runs++; done(); };
      transport.use('compile', plugin);
      await transport.sendMail({});
      expect(runs).to.equal(0);
      testMock.mock.setUnmockedUsePlugins(true);
      await transport.sendMail({});
      expect(runs).to.equal(1);
      testMock.mock.setUnmockedUsePlugins(false);
      await transport.sendMail({});
      expect(runs).to.equal(1);
      testMock.mock.setUnmockedUsePlugins(true);
      await transport.sendMail({});
      expect(runs).to.equal(2);
      testMock.mock.reset();
      await transport.sendMail({});
      expect(runs).to.equal(2);
      expect(transport.mock.getPlugins().compile).to.deep.equal([plugin]);
    });

    it('should stop plugins registered while enabled after reset', async () => {
      const testMock = mocked.getMockFor(nodemailer);
      const transport = testMock.createTransport();
      let runs = 0;
      testMock.mock.setUnmockedUsePlugins(true);
      transport.use('compile', (_mail, done) => { runs++; done(); });
      await transport.sendMail({});
      expect(runs).to.equal(1);
      testMock.mock.reset();
      await transport.sendMail({});
      expect(runs).to.equal(1);
    });

    it('should not report successful verification alongside an error', (done) => {
      const testMock = mocked.getMockFor(nodemailer);
      testMock.mock.setShouldFail(true);
      testMock.createTransport().verify((error, success) => {
        try {
          expect(error).to.equal(testMock.mock.getFailResponse());
          expect(success).to.equal(undefined);
          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it('should preserve exceptions thrown by a failure check in the callback API', (done) => {
      const testMock = mocked.getMockFor(nodemailer);
      const original = new TypeError('Failure check bug');
      testMock.mock.setShouldFailCheck(() => { throw original; });
      testMock.createTransport().sendMail({}, (error, info) => {
        try {
          expect(error).to.equal(original);
          expect(info.response).to.equal(original);
          expect(testMock.mock.getSentMail()).to.have.length(0);
          done();
        } catch (error) {
          done(error);
        }
      });
    });

    it('should preserve exceptions thrown by a failure check in the promise API', async () => {
      const testMock = mocked.getMockFor(nodemailer);
      const original = new TypeError('Failure check bug');
      testMock.mock.setShouldFailCheck(() => { throw original; });
      let caught: unknown;
      try {
        await testMock.createTransport().sendMail({});
      } catch (error) {
        caught = error;
      }
      expect(caught).to.equal(original);
      expect(testMock.mock.getSentMail()).to.have.length(0);
    });

    it('should reject even when a failure check throws a falsy value', async () => {
      const testMock = mocked.getMockFor(nodemailer);
      const transport = testMock.createTransport();
      for (const value of [undefined, null, false, 0, '']) {
        testMock.mock.setShouldFailCheck(() => { throw value; });
        await rejects(transport.sendMail({}), (error: unknown) => {
          return error instanceof Error && error.cause === value;
        });
      }
      expect(testMock.mock.getSentMail()).to.have.length(0);
    });

    it('should run built-in compile plugins without registering user plugins', async () => {
      const testMock = mocked.getMockFor(nodemailer);
      await testMock.createTransport().sendMail({
        attachDataUrls: true,
        html: '<img src="data:image/png;base64,aGVsbG8=">',
      });
      const mail = testMock.mock.getSentMail()[0];
      expect(mail.html).to.contain('cid:');
      expect(mail.attachments).to.have.length(1);
      expect(mail.attachments?.[0].content?.toString()).to.equal('hello');
    });

    it('should retain access restrictions from transport configuration', async () => {
      const testMock = mocked.getMockFor(nodemailer);
      const transport = testMock.createTransport({ disableFileAccess: true, disableUrlAccess: true });
      await transport.sendMail({ disableFileAccess: false, disableUrlAccess: false });
      expect(testMock.mock.getSentMail()[0]).to.include({ disableFileAccess: true, disableUrlAccess: true });
    });

    it('should cancel scheduled idle changes on reset', () => {
      nodeMock.timers.enable({ apis: ['setTimeout'] });
      try {
        const testMock = mocked.getMockFor(nodemailer);
        const first = testMock.createTransport();
        let idleEvents = 0;
        first.on('idle', () => { idleEvents++; });
        testMock.mock.scheduleIsIdle(true, 10);
        testMock.mock.reset();
        const second = testMock.createTransport();
        nodeMock.timers.tick(10);
        expect(first.isIdle()).to.equal(false);
        expect(second.isIdle()).to.equal(false);
        expect(idleEvents).to.equal(0);
        testMock.mock.scheduleIsIdle(true, 20);
        nodeMock.timers.tick(20);
        expect(first.isIdle()).to.equal(true);
        expect(second.isIdle()).to.equal(true);
        expect(idleEvents).to.equal(1);
      } finally {
        nodeMock.timers.reset();
      }
    });

    it('should create a transport without options', async () => {
      const testMock = mocked.getMockFor(nodemailer);
      const transport = testMock.createTransport();
      const info = await transport.sendMail({ subject: 'No transport options' });
      expect(info.response).to.equal(messages.success_response);
      expect(testMock.mock.getSentMail()).to.have.length(1);
      expect(testMock.mock.getSentMail()[0]).to.include({ subject: 'No transport options' });
    });

    it('should accept SMTP connection URLs', async () => {
      const testMock = mocked.getMockFor(nodemailer);
      const transport = testMock.createTransport('smtp://localhost:2525');
      await transport.sendMail({ subject: 'URL transport' });
      expect(transport.options).to.include({ host: 'localhost', port: 2525 });
      expect(testMock.mock.getSentMail()[0].subject).to.equal('URL transport');
    });

    it('should apply message defaults and allow per-message overrides', async () => {
      const testMock = mocked.getMockFor(nodemailer);
      const defaults = { from: 'sender@example.com', subject: 'Default subject' };
      const transport = testMock.createTransport({ jsonTransport: true }, defaults);
      await transport.sendMail({ to: 'recipient@example.com' });
      await transport.sendMail({ to: 'recipient@example.com', subject: 'Override' });
      expect(testMock.mock.getSentMail().map(({ from, to, subject }) => ({ from, to, subject }))).to.deep.equal([
        { ...defaults, to: 'recipient@example.com' },
        { ...defaults, to: 'recipient@example.com', subject: 'Override' },
      ]);
      expect(defaults).to.deep.equal({ from: 'sender@example.com', subject: 'Default subject' });
    });

    it('should restore mocked close behavior on reset', () => {
      const testMock = mocked.getMockFor(nodemailer);
      let realCloseCalls = 0;
      const transport = testMock.createTransport({
        name: 'close regression',
        version: '1.0.0',
        send: () => { throw new Error('Unexpected real send'); },
        close: () => { realCloseCalls++; },
      });
      testMock.mock.setMockedClose(false);
      transport.close();
      expect(realCloseCalls).to.equal(1);
      testMock.mock.reset();
      expect(testMock.mock.isMockedClose()).to.equal(true);
      transport.close();
      expect(realCloseCalls).to.equal(1);
      expect(testMock.mock.getCloseCallCount()).to.equal(1);
      expect(transport.mock.getCloseCallCount()).to.equal(2);
    });

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
      expect(typeof plugin[0]).to.equal('function');

      await pluginsNotUsed.sendMail({
        subject: 'test',
      });

      expect(hasPluginRun).to.equal(false);

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
      expect(typeof plugin2[0]).to.equal('function');

      expect(hasPluginRun).to.equal(true);
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
          expect(info && info.response).to.equal(messages.success_response);
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
          expect(info && info.response).to.equal(messages.success_response);
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
        expect(info && info.response).to.equal(messages.success_response);
        // Check that our email was put into the sentMail cache
        const sentMail = mocked.mock.getSentMail();
        // expect(sentMail).not.be.empty();
        expect(sentMail.length).to.equal(1);
        expect(sentMail[0].subject).to.equal(email.subject);
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
          expect(err1).to.equal(mocked.mock.getFailResponse());
          expect(info1 && info1.response).to.equal(mocked.mock.getFailResponse());

          // Send an email that should succeed
          transporter.sendMail(
            {
              subject: 'Subject',
            },
            (err2, info2) => {
              expect(err2).equal(null);
              expect(info2 && info2.response).to.equal(messages.success_response);
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
          expect(err1).equal(mocked.mock.getFailResponse());
          expect(info1 && info1.response).to.equal(mocked.mock.getFailResponse());

          // Send another email that should fail
          transporter.sendMail(
            {
              subject: 'Subject 2',
            },
            (err2, info2) => {
              expect(err2).equal(mocked.mock.getFailResponse());
              expect(info2 && info2.response).to.equal(mocked.mock.getFailResponse());

              // tell the mock to succeed when sending
              mocked.mock.setShouldFail(false);

              // Send an email that should succeed
              transporter.sendMail(
                {
                  subject: 'Subject 3',
                },
                (err3, info3) => {
                  expect(err3).equal(null);
                  expect(info3 && info3.response).to.equal(
                    messages.success_response
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
          expect(err1).equal(mocked.mock.getFailResponse());
          expect(info1 && info1.response).to.equal(mocked.mock.getFailResponse());

          // Send an email that should succeed
          transporter.sendMail(
            {
              subject: 'Subject',
            },
            (err2, info2) => {
              expect(err2).equal(null);
              expect(info2 && info2.response).to.equal(messages.success_response);
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
          expect(info && info.response).to.equal(customSuccess);
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
          expect(info && info.response).to.equal(customError);
          done();
        }
      );
    });

    it('should return verify success using the mocked nodemailer transport', (done) => {
      transporter.verify((err, success) => {
        expect(err).equal(null);
        expect(success).to.equal(true);
        done();
      });
    });

    it('should return verify failure using the mocked nodemailer transport', (done) => {
      mocked.mock.setShouldFailOnce();
      transporter.verify((err) => {
        expect(err).not.equal(null);
        expect(err).to.deep.equal(mocked.mock.getFailResponse());
        done();
      });
    });

    it('should return verify error using the real nodemailer transport', (done) => {
      mocked.mock.setMockedVerify(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transporter.verify((err: any) => {
        expect(err).not.equal(null);
        expect(err.code).to.equal('ECONNECTION');
        expect(err.command).to.equal('CONN');
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
          expect(info && info.response).to.equal(messages.success_response);
          expect(info.response).to.equal(messages.success_response);
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
        expect(info.response).to.equal(messages.success_response);
        // Check that our email was put into the sentMail cache
        const sentMail = mocked.mock.getSentMail();
        // expect(sentMail).not.be.empty();
        expect(sentMail.length).to.equal(1);
        expect(sentMail[0].subject).to.equal(email.subject);
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
              expect(info.response).to.equal(messages.success_response);
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
                  expect(info.response).to.equal(messages.success_response);
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
              expect(info.response).to.equal(messages.success_response);
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
          expect(info.response).to.equal(customSuccess);
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
          expect(err).to.equal(customError);
          done();
        });
    });

    it('should return verify success using the mocked nodemailer transport', (done) => {
      const promise = transporter.verify();
      if (promise instanceof Promise) {
        promise.then((success) => {
          expect(success).to.equal(true);
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
          expect(err).to.deep.equal(mocked.mock.getFailResponse());
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
          expect(err.code).to.equal('ECONNECTION');
          expect(err.command).to.equal('CONN');
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
      expect(info && info.response).to.equal(messages.success_response);
      expect(info.response).to.equal(messages.success_response);
    });

    it('should have the sent email available in the mock.getSentMail()', async () => {
      // Look for this value in the sentmail cache
      const email = {
        subject: 'Check for this value',
      };
      // Send an email that should succeed
      const info = await transporter.sendMail(email);
      expect(info && info.response).to.equal(messages.success_response);
      // Check that our email was put into the sentMail cache
      const sentMail = mocked.mock.getSentMail();
      // expect(sentMail).not.be.empty();
      expect(sentMail.length).to.equal(1);
      expect(sentMail[0].subject).to.equal(email.subject);
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
        expect(info.response).to.equal(messages.success_response);
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
      expect(info.response).to.equal(messages.success_response);
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
        expect(info.response).to.equal(messages.success_response);
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
      expect(info.response).to.equal(customSuccess);
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
        expect(err).to.equal(customError);
      }
    });

    it('should return verify success using the mocked nodemailer transport', async () => {
      const success = await transporter.verify();
      expect(success).to.equal(true);
    });

    it('should return verify failure using the mocked nodemailer transport', async () => {
      mocked.mock.setShouldFailOnce();
      try {
        await transporter.verify();
        throw new Error(); // this should not happen
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        expect(err).not.equal(null);
        expect(err).to.deep.equal(mocked.mock.getFailResponse());
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
        expect(err.code).to.equal('ECONNECTION');
        expect(err.command).to.equal('CONN');
      }
    });
  });
});
