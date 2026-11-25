import { beforeEach, expect, test, vi } from 'vitest';
import { mock } from 'nodemailer-mock';

vi.mock('nodemailer', () => import('nodemailer-mock'));
const { sendEmail } = await import('../mailer-test.mjs');

beforeEach(() => mock.reset());

test('records an email sent by the application', async () => {
  await sendEmail();

  const sent = mock.getSentMail();
  expect(sent).toHaveLength(1);
  expect(sent[0].to).toBe('recipient@example.test');
});
