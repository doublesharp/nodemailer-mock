import * as mockery from 'mockery';
import { expect } from 'chai';
import * as nodemailermock from '../../dist/nodemailer-mock';
const { mock } = nodemailermock;

describe('Mocha + Mockery TypeScript', function () {
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
