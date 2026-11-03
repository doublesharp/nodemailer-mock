import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import * as Nodemailer from 'nodemailer';
import { MockTestAccounts } from '../src/lib/test-account';

const configuredAccount = (): Nodemailer.TestAccount => ({
  user: 'configured@example.test',
  pass: 'configured-password',
  smtp: { host: 'smtp.example.test', port: 587, secure: false },
  imap: { host: 'imap.example.test', port: 993, secure: true },
  pop3: { host: 'pop3.example.test', port: 995, secure: true },
  web: 'https://mail.example.test',
});

describe('offline test account helpers', () => {
  it('returns deterministic accounts with reserved endpoints through promise signatures', async () => {
    const helper = new MockTestAccounts();
    const createTestAccount: typeof Nodemailer.createTestAccount = helper.createTestAccount;
    const account = await createTestAccount();
    for (const apiUrl of ['https://unused.invalid', false, null, undefined]) {
      assert.deepEqual(await createTestAccount(apiUrl), account);
    }
    assert.equal(typeof account.user, 'string');
    assert.equal(typeof account.pass, 'string');
    for (const service of [account.smtp, account.imap, account.pop3]) {
      assert.match(service.host, /\.test$/);
      assert.equal(typeof service.port, 'number');
      assert.equal(typeof service.secure, 'boolean');
    }
    assert.match(new URL(account.web).hostname, /\.test$/);
    assert.deepEqual(await new MockTestAccounts().createTestAccount(), account);
  });

  it('supports asynchronous callback signatures with ignored API URLs', async () => {
    const helper = new MockTestAccounts();
    for (const apiUrl of ['https://unused.invalid', false, null, undefined]) {
      let synchronous = true;
      await new Promise<void>((resolve, reject) => {
        const result = helper.createTestAccount(apiUrl, (error, account) => {
          try {
            assert.equal(synchronous, false);
            assert.equal(error, null);
            assert.match(account.smtp.host, /\.test$/);
            resolve();
          } catch (failure) { reject(failure); }
        });
        assert.equal(result, undefined);
        synchronous = false;
      });
    }
    await new Promise<void>((resolve, reject) => helper.createTestAccount((error, account) => {
      try {
        assert.equal(error, null);
        assert.equal(typeof account.user, 'string');
        resolve();
      } catch (failure) { reject(failure); }
    }));
  });

  it('copies configured account services and every returned account', async () => {
    const helper = new MockTestAccounts();
    const account = configuredAccount();
    const expected = configuredAccount();
    helper.setAccount(account);
    account.user = 'mutated';
    account.smtp.host = 'mutated';
    account.imap.host = 'mutated';
    account.pop3.host = 'mutated';
    const returned = await helper.createTestAccount();
    assert.deepEqual(returned, expected);
    returned.web = 'https://mutated.test';
    returned.smtp.host = 'mutated';
    returned.imap.host = 'mutated';
    returned.pop3.host = 'mutated';
    await new Promise<void>((resolve, reject) => helper.createTestAccount((error, result) => {
      try {
        assert.equal(error, null);
        assert.deepEqual(result, expected);
        result.smtp.host = 'mutated callback';
        resolve();
      } catch (failure) { reject(failure); }
    }));
    assert.deepEqual(await helper.createTestAccount(), expected);
  });

  it('isolates account configuration between instances and resets to deterministic defaults', async () => {
    const first = new MockTestAccounts();
    const second = new MockTestAccounts();
    const initial = await first.createTestAccount();
    first.setAccount(configuredAccount());
    assert.deepEqual(await second.createTestAccount(), initial);
    assert.equal(first.getTestMessageUrl({ response: '250 OK [STATUS=OK MSGID=abc]' }),
      'https://mail.example.test/message/abc');
    first.reset();
    assert.deepEqual(await first.createTestAccount(), initial);
    assert.equal(first.getTestMessageUrl({ response: '250 OK [STATUS=OK MSGID=abc]' }),
      `${initial.web}/message/abc`);
  });

  it('extracts STATUS and MSGID properties from the trailing bracket group', () => {
    const helper = new MockTestAccounts();
    helper.setAccount(configuredAccount());
    const getTestMessageUrl = helper.getTestMessageUrl;
    for (const response of [
      '250 OK [STATUS=OK MSGID=abc]',
      '250 [ignored] OK [MSGID=abc STATUS=OK]',
      '250 OK [STATUS=OTHER EXTRA=value MSGID=abc]',
      '250 OK [STATUS=OK MSGID=old MSGID=abc]',
      Buffer.from('250 OK [STATUS=OK MSGID=abc]'),
    ]) {
      assert.equal(getTestMessageUrl({ response }), 'https://mail.example.test/message/abc');
    }
  });

  it('returns false for malformed, missing, and error responses', () => {
    const helper = new MockTestAccounts();
    for (const info of [null, undefined, {}, { response: '' }, { response: new Error('failed') },
      { response: 123 }, { response: { toString: () => '250 [STATUS=OK MSGID=abc]' } }]) {
      assert.equal(helper.getTestMessageUrl(info), false);
    }
    for (const response of [
      '250 success', '250 []', '250 [STATUS=OK]', '250 [MSGID=abc]',
      '250 [status=OK MSGID=abc]', '250 [STATUS= MSGID=abc]', '250 [STATUS=OK MSGID=]',
      '250 [STATUS=OK MSGID=abc] trailing', '250 [STATUS=OK MSGID=abc]]',
      `[${'['.repeat(100_000)}]`,
      `[${'A'.repeat(100_000)}]`,
    ]) {
      assert.equal(helper.getTestMessageUrl({ response }), false);
    }
  });

  it('lets callback exceptions escape once without invoking the callback again', () => {
    const script = `
      const assert = require('node:assert/strict');
      const { MockTestAccounts } = require(${JSON.stringify(require.resolve('../src/lib/test-account'))});
      let calls = 0;
      const thrown = new Error('callback failure');
      process.once('uncaughtException', (error) => {
        assert.equal(error, thrown);
        setImmediate(() => { assert.equal(calls, 1); process.exit(0); });
      });
      new MockTestAccounts().createTestAccount(() => { calls++; throw thrown; });
      setTimeout(() => process.exit(2), 1000);
    `;
    const child = spawnSync(process.execPath, ['-r', require.resolve('ts-node/register'), '-e', script], {
      encoding: 'utf8',
    });
    assert.equal(child.status, 0, child.stderr || child.stdout);
  });
});
