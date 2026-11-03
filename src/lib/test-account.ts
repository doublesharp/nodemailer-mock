import type * as Nodemailer from 'nodemailer';

type AccountCallback = (error: Error | null, account: Nodemailer.TestAccount) => void;

function defaultAccount(): Nodemailer.TestAccount {
  return {
    user: 'nodemailer-mock@example.test',
    pass: 'nodemailer-mock-password',
    smtp: { host: 'smtp.example.test', port: 587, secure: false },
    imap: { host: 'imap.example.test', port: 993, secure: true },
    pop3: { host: 'pop3.example.test', port: 995, secure: true },
    web: 'https://ethereal.example.test',
  };
}

function copyAccount(account: Nodemailer.TestAccount): Nodemailer.TestAccount {
  return { ...account, smtp: { ...account.smtp }, imap: { ...account.imap }, pop3: { ...account.pop3 } };
}

/** Deterministic, offline equivalents of Nodemailer's Ethereal account helpers. */
export class MockTestAccounts {
  private account: Nodemailer.TestAccount = defaultAccount();

  createTestAccount: typeof Nodemailer.createTestAccount = ((
    apiUrl?: string | false | null | AccountCallback,
    callback?: AccountCallback,
  ): void | Promise<Nodemailer.TestAccount> => {
    const done = typeof apiUrl === 'function' ? apiUrl : callback;
    const account = copyAccount(this.account);
    if (done) {
      process.nextTick(() => done(null, account));
      return;
    }
    return Promise.resolve(account);
  }) as typeof Nodemailer.createTestAccount;

  getTestMessageUrl = (info?: { response?: unknown } | null): string | false => {
    const response = info?.response;
    if (typeof response !== 'string' && !Buffer.isBuffer(response)) return false;
    const text = response.toString();
    if (text.length < 3 || !text.endsWith(']')) return false;
    // Locate the last bracket group in linear time, including adversarial responses.
    const open = text.indexOf('[', text.lastIndexOf(']', text.length - 2) + 1);
    if (open < 0 || open >= text.length - 2) return false;
    const properties = new Map<string, string>();
    for (const match of text.slice(open + 1, -1).matchAll(/\b([A-Z0-9]+)=([^\s]+)/g)) {
      properties.set(match[1], match[2]);
    }
    return properties.has('STATUS') && properties.has('MSGID')
      ? `${this.account.web}/message/${properties.get('MSGID')}`
      : false;
  };

  setAccount(account: Nodemailer.TestAccount): void {
    this.account = copyAccount(account);
  }

  reset(): void {
    this.account = defaultAccount();
  }
}
