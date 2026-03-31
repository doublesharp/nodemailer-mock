import { describe, it, beforeEach, expect, vi } from 'vitest';

// Mock nodemailer with nodemailer-mock before any imports that use it
vi.mock('nodemailer', async () => {
  return await import('../../dist/nodemailer-mock.js');
});

// Import the mock to access mock utilities
const nodemailermock = await import('../../dist/nodemailer-mock.js');

describe('Vitest JavaScript', () => {
  beforeEach(() => {
    nodemailermock.mock.reset();
  });

  it('Send an email using the mocked nodemailer + vitest', async () => {
    // Use the mocked nodemailer directly (as a consumer would in their app)
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.createTransport({});
    await transport.sendMail({ to: 'justin@to.com', from: 'justin@from.com' });

    // check the mock for our sent emails
    const sentEmails = nodemailermock.mock.getSentMail();
    // there should be one
    expect(sentEmails.length).toBe(1);
    // and it should match the to address
    expect(sentEmails[0].to).toBe('justin@to.com');
  });
});
