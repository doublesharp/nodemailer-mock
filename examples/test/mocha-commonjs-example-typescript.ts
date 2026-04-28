import { expect } from 'chai';
import Module = require('module');
import * as nodemailermock from '../../dist/nodemailer-mock';
const { mock } = nodemailermock;

type LoadFunction = (
  this: unknown,
  request: string,
  parent: NodeModule | null,
  isMain: boolean
) => unknown;

const moduleLoader = Module as unknown as { _load: LoadFunction };
const originalLoad = moduleLoader._load;

const clearMailerCache = () => {
  const mailerPath = require.resolve('../mailer-test');
  delete require.cache[mailerPath];
};

describe('Mocha + CommonJS TypeScript', function () {
  // we need to mock nodemailer *before* we require() any modules that load it
  before(async () => {
    moduleLoader._load = function (this: unknown, request, parent, isMain) {
      if (request === 'nodemailer') {
        return nodemailermock;
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    clearMailerCache();
    mock.reset();
  });

  after(() => {
    moduleLoader._load = originalLoad;
    clearMailerCache();
  });

  // run a test
  it('Send an email using the mocked nodemailer + typescript', async () => {
    // load the module to test, it will use the mocked nodemailer internally
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mailer: any = await import('../mailer-test');
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
