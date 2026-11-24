import { strict as assert } from 'node:assert';
import { Readable } from 'node:stream';
import Mail from 'nodemailer/lib/mailer';
import { getMockFor } from '../src/nodemailer-mock';

const local = { path: __filename };
const remote = { href: 'https://example.test/blocked' };
const both = { ...local, ...remote };
const unrestricted = Object.freeze({ disableFileAccess: false, disableUrlAccess: false });
const restricted = { disableFileAccess: true, disableUrlAccess: true };

describe('message content access policy', () => {
  it('preflights every rendered content field before compile plugins', async () => {
    const mailer = getMockFor();
    mailer.mock.setUnmockedUsePlugins(true);
    const transport = mailer.createTransport({ jsonTransport: true }, restricted);
    transport.use('compile', () => assert.fail('Compile plugins must not run on denied content'));
    for (const field of ['raw', 'text', 'html', 'watchHtml', 'amp', 'icalEvent', 'alternatives', 'attachments']) {
      for (const [descriptor, code] of [[{ ...local, content: undefined }, 'EFILEACCESS'],
        [{ ...remote, content: '' }, 'EURLACCESS']] as const) {
        const value = ['alternatives', 'attachments'].includes(field) ? [descriptor] : descriptor;
        await assert.rejects(transport.sendMail({ ...unrestricted, [field]: value }), { code });
      }
    }
    await assert.rejects(transport.sendMail({ raw: { content: local } } as unknown as Mail.Options),
      { code: 'EFILEACCESS' });
    await assert.rejects(transport.sendMail({ attachments: [{ raw: { content: remote } }] } as unknown as Mail.Options),
      { code: 'EURLACCESS' });
  });

  it('enforces configured URL and file flags independently on dual descriptors', async () => {
    for (const [flag, code] of [['disableFileAccess', 'EFILEACCESS'], ['disableUrlAccess', 'EURLACCESS']]) {
      for (const mode of [{ streamTransport: true }, { jsonTransport: true }, {}]) {
        const mailer = getMockFor(undefined, { validateContent: true });
        const transport = mailer.createTransport({ ...mode, [flag]: true });
        await assert.rejects(transport.sendMail(Object.freeze({ ...unrestricted, attachments: [both] })), { code });
      }
    }
  });

  it('preflights attachDataUrls before upstream can read HTML on ordinary sends', async () => {
    for (const source of ['message', 'defaults', 'transport']) {
      const mailer = getMockFor();
      const transport = mailer.createTransport({ attachDataUrls: source === 'transport' },
        { ...restricted, attachDataUrls: source === 'defaults' });
      for (const [html, code] of [[local, 'EFILEACCESS'], [remote, 'EURLACCESS']] as const) {
        const options = Object.freeze({ ...unrestricted, html, ...(source === 'message' ? { attachDataUrls: true } : {}) });
        await new Promise<void>((resolve, reject) => transport.sendMail(options, (error) => {
          try { assert.equal((error as NodeJS.ErrnoException)?.code, code); resolve(); }
          catch (failure) { reject(failure); }
        }));
      }
    }
  });

  it('keeps preexisting restrictions when compile or stream plugins clear the flags', async () => {
    for (const step of ['compile', 'stream']) {
      const mailer = getMockFor(undefined, { validateContent: true });
      mailer.mock.setUnmockedUsePlugins(true);
      const transport = mailer.createTransport({}, restricted);
      transport.use(step, (mail, done) => {
        Object.assign(mail.data, unrestricted, { raw: { content: '', ...local } });
        done();
      });
      await assert.rejects(transport.sendMail({ text: 'body' }), { code: 'EFILEACCESS' });
      assert.deepEqual(mailer.mock.getSentMail(), []);
    }
  });

  it('checks plugin-added descriptors even after successful MIME compilation', async () => {
    const mailer = getMockFor();
    mailer.mock.setUnmockedUsePlugins(true);
    const transport = mailer.createTransport({ jsonTransport: true });
    transport.use('stream', (mail, done) => {
      mail.data.disableUrlAccess = false;
      mail.data.alternatives = [{ content: remote }] as unknown as Mail.Options['alternatives'];
      done();
    });
    const options = Object.freeze({ disableUrlAccess: true, text: 'body' });
    await assert.rejects(transport.sendMail(options), { code: 'EURLACCESS' });
    assert.deepEqual(options, { disableUrlAccess: true, text: 'body' });
  });

  it('classifies normalized paths, URL objects, and non-HTTP hrefs for URL policy', async () => {
    const transport = getMockFor().createTransport({ jsonTransport: true, disableUrlAccess: true });
    for (const text of [{ path: ' \thttp:example.test/fixture' }, { path: new URL('https://example.test') },
      { path: new String('http://example.test/boxed') }, { href: new URL('https://example.test') },
      { href: new String('https://example.test/boxed') }, { href: 'file:///fixture' }]) {
      await assert.rejects(transport.sendMail({ text } as unknown as Mail.Options), { code: 'EURLACCESS' });
    }
  });

  it('allows inline content, streams, and data URIs under restrictions', async () => {
    const stream = Object.assign(Readable.from(['inline']), both);
    const transport = getMockFor().createTransport({ jsonTransport: true }, restricted);
    const info = await transport.sendMail({
      text: stream, html: { path: 'data:text/html,inline' }, attachments: [{ href: 'data:text/plain,inline' }],
    });
    const json = JSON.parse(info.message as string);
    assert.equal(json.text, 'inline');
    assert.equal(json.html, 'inline');
    assert.equal(Buffer.from(json.attachments[0].content, 'base64').toString(), 'inline');
  });

  it('does not add false access flags to ordinary sent mail records', async () => {
    const mailer = getMockFor();
    await mailer.createTransport().sendMail({ subject: 'plain' });
    const sent = mailer.mock.getSentMail()[0];
    assert.equal('disableFileAccess' in sent, false);
    assert.equal('disableUrlAccess' in sent, false);
  });
});
