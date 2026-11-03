import { strict as assert } from 'node:assert';
import { generateKeyPairSync } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import * as nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import { renderMessage, RenderOptions, RenderResult } from '../src/lib/render';

function render(data: Mail.Options, options: RenderOptions, configure?: (mail: Mail<RenderResult>) => void) {
  const transport = nodemailer.createTransport<RenderResult>({
    name: 'offline renderer test', version: '1.0.0',
    send(mail, done) {
      renderMessage(mail, options).then((info) => done(null, info), (error) => done(error, {}));
    },
  });
  configure?.(transport);
  return transport.sendMail({ from: 'from@example.com', to: 'to@example.com', ...data });
}

async function contents(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

describe('offline MIME and JSON rendering', () => {
  it('skips content work when neither output nor validation is requested', async () => {
    assert.deepEqual(await render({ attachments: [{ path: '/missing/no-content-work' }] }, {}), {});
  });

  it('returns MIME buffers with Bcc, headers, attachments and Windows line endings', async () => {
    const info = await render({
      bcc: 'hidden@example.com', headers: { 'X-Render': 'yes' }, text: 'hello\nworld',
      attachments: [{ filename: 'data.txt', content: Buffer.from('attachment data') }],
    }, { streamTransport: true, buffer: true, newline: 'windows' });
    assert.ok(Buffer.isBuffer(info.message));
    const message = info.message.toString();
    assert.match(message, /Bcc: hidden@example.com/);
    assert.match(message, /X-Render: yes/);
    assert.match(message, /YXR0YWNobWVudCBkYXRh/);
    assert.equal(message.replace(/\r\n/g, '').includes('\n'), false);
    assert.equal(info.messageSize, info.message.length);
  });

  it('preserves MIME transforms and returns streams using Unix line endings', async () => {
    const info = await render({ text: 'ORIGINAL' }, { streamTransport: true, newline: 'unix' }, (mail) => {
      mail.use('stream', (message, done) => {
        message.message.transform(() => new Transform({
          transform(chunk, _encoding, callback) {
            callback(null, chunk.toString().replace('ORIGINAL', 'TRANSFORMED'));
          },
        }));
        done();
      });
    });
    assert.ok(info.message instanceof Readable);
    assert.equal(info.messageSize, undefined);
    const message = (await contents(info.message)).toString();
    assert.match(message, /TRANSFORMED/);
    assert.equal(message.includes('\r\n'), false);
  });

  it('preserves raw messages', async () => {
    const raw = 'From: raw@example.com\r\nSubject: raw\r\n\r\nraw body\r\n';
    const info = await render({ raw }, { streamTransport: true, buffer: true });
    assert.ok(Buffer.isBuffer(info.message));
    assert.equal(info.message.toString(), raw);
  });

  for (const skipEncoding of [false, true]) {
    it(`uses native JSON normalization with skipEncoding=${skipEncoding}`, async () => {
      const info = await render({ text: Readable.from(['body']), attachments: [
        { filename: 'data.txt', content: Buffer.from('attachment') },
      ] }, { jsonTransport: true, skipEncoding });
      assert.equal(typeof info.message, skipEncoding ? 'object' : 'string');
      const message = typeof info.message === 'string' ? JSON.parse(info.message) : info.message;
      assert.equal(message.text, 'body');
      assert.equal(message.attachments[0].content, Buffer.from('attachment').toString('base64'));
      assert.equal(message.attachments[0].encoding, 'base64');
      assert.equal(message.envelope, undefined);
    });
  }

  for (const options of [
    { validateContent: true }, { streamTransport: true, validateContent: true },
    { streamTransport: true, buffer: true }, { jsonTransport: true, validateContent: true },
  ]) {
    it(`rejects missing files before resolving ${JSON.stringify(options)}`, async () => {
      await assert.rejects(render({ attachments: [{ path: '/missing/render-test-attachment' }] }, options), /ENOENT/);
    });

    it(`rejects disabled file access ${JSON.stringify(options)}`, async () => {
      await assert.rejects(render({ disableFileAccess: true, attachments: [{ path: __filename }] }, options),
        /File access rejected/);
    });

    it(`rejects disabled URL access without requesting it ${JSON.stringify(options)}`, async () => {
      await assert.rejects(render({ disableUrlAccess: true,
        attachments: [{ href: 'http://127.0.0.1:1/must-not-request' }] }, options), /Url access rejected/);
    });

    it(`rejects content stream failures before resolving ${JSON.stringify(options)}`, async () => {
      const error = new Error('attachment stream failed');
      const content = new Readable({ read() { this.destroy(error); } });
      await assert.rejects(render({ attachments: [{ content }] }, options), /attachment stream failed/);
    });
  }

  it('normalizes JSON on isolated data without rewriting recorded options', async () => {
    class Metadata { value = 'custom'; }
    const metadata = new Metadata();
    const error = new Error('retained');
    const raw = Readable.from(['unused raw']);
    let original!: Mail.Options & { metadata?: Metadata; error?: Error };
    const attachment = { content: Buffer.from('attachment'), filename: 'data.txt' };
    const info = await render({ from: 'Sender <sender@example.com>', text: 'body', raw,
      attachments: [attachment], metadata, error } as Mail.Options,
    { jsonTransport: true, skipEncoding: true }, (transport) => {
      transport.use('stream', (mail, done) => { original = mail.data; done(); });
    });
    assert.equal(original.from, 'Sender <sender@example.com>');
    assert.equal(original.text, 'body');
    assert.equal(original.raw, raw);
    assert.equal(original.attachments![0], attachment);
    assert.ok(Buffer.isBuffer(attachment.content));
    assert.equal(attachment.content.toString(), 'attachment');
    assert.equal('contentType' in attachment, false);
    const normalized = info.message as Mail.Options & { metadata: Metadata; error: Error };
    assert.notEqual(normalized, original);
    assert.notEqual(normalized.attachments, original.attachments);
    assert.notEqual(normalized.attachments![0], attachment);
    assert.equal(normalized.metadata, metadata);
    assert.equal(normalized.error, error);
    assert.equal(normalized.raw, raw);
  });

  it('preserves cycles and shared references while isolating JSON metadata', async () => {
    const shared = { value: 'original' };
    const metadata = { left: shared, right: shared, self: undefined as unknown };
    metadata.self = metadata;
    const info = await render({ metadata } as Mail.Options, { jsonTransport: true, skipEncoding: true });
    const output = (info.message as { metadata: typeof metadata }).metadata;
    assert.notEqual(output, metadata);
    assert.equal(output.self, output);
    assert.equal(output.left, output.right);
    assert.notEqual(output.left, shared);
    output.left.value = 'returned';
    assert.equal(shared.value, 'original');
  });

  it('validates wrapped raw strings and returns their bytes without rewriting the input', async () => {
    const raw = { content: 'Subject: wrapped raw\r\n\r\nraw body' };
    const info = await render({ raw } as Mail.Options,
      { jsonTransport: true, skipEncoding: true, validateContent: true });
    const output = info.message as Mail.Options;
    assert.ok(Buffer.isBuffer(output.raw));
    assert.equal(output.raw.toString(), raw.content);
    assert.equal(raw.content, 'Subject: wrapped raw\r\n\r\nraw body');
  });

  it('rejects missing raw files when validating JSON output', async () => {
    await assert.rejects(render({ raw: { path: '/missing/raw-json-render-file' } },
      { jsonTransport: true, validateContent: true }), /ENOENT/);
  });

  it('rejects failing raw streams when validating JSON output', async () => {
    const raw = new Readable({ read() { this.destroy(new Error('raw stream failed')); } });
    await assert.rejects(render({ raw }, { jsonTransport: true, validateContent: true }), /raw stream failed/);
  });

  it('applies file access restrictions to raw JSON validation', async () => {
    await assert.rejects(render({ disableFileAccess: true, raw: { path: __filename } },
      { jsonTransport: true, validateContent: true }), /File access rejected/);
  });

  it('applies URL access restrictions to raw JSON validation without making requests', async () => {
    await assert.rejects(render({ disableUrlAccess: true, raw: { href: 'http://127.0.0.1:1/blocked' } },
      { jsonTransport: true, validateContent: true }), /Url access rejected/);
  });

  it('consumes raw JSON validation streams exactly once and retains original options', async () => {
    let reads = 0;
    const raw = new Readable({ read() { reads++; this.push('Subject: once\r\n\r\nbody'); this.push(null); } });
    let original!: Mail.Options;
    const info = await render({ raw }, { jsonTransport: true, skipEncoding: true, validateContent: true },
      (transport) => transport.use('stream', (mail, done) => { original = mail.data; done(); }));
    assert.equal(reads, 1);
    assert.equal(original.raw, raw);
    const output = info.message as Mail.Options;
    assert.ok(Buffer.isBuffer(output.raw));
    assert.equal(output.raw.toString(), 'Subject: once\r\n\r\nbody');
  });

  it('keeps native late stream errors when validation is disabled', async () => {
    const info = await render({ attachments: [{ path: '/missing/late-render-attachment' }] },
      { streamTransport: true });
    assert.ok(info.message instanceof Readable);
    await assert.rejects(contents(info.message), /ENOENT/);
  });

  it('validates one-shot streams once and discards the output', async () => {
    let reads = 0;
    const content = new Readable({ read() { reads++; this.push('valid'); this.push(null); } });
    const info = await render({ attachments: [{ content, filename: 'once.txt' }] }, { validateContent: true });
    assert.equal(info.message, undefined);
    assert.ok(info.messageSize! > 0);
    assert.equal(reads, 1);
  });

  it('returns a readable copy after validating streamed output', async () => {
    const info = await render({ text: 'validated content' }, { streamTransport: true, validateContent: true });
    assert.ok(info.message instanceof Readable);
    const message = await contents(info.message);
    assert.match(message.toString(), /validated content/);
    assert.equal(info.messageSize, message.length);
  });

  it('includes real DKIM signing on the already compiled message', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' } });
    const info = await render({ text: 'signed body', dkim: {
      domainName: 'example.com', keySelector: 'test', privateKey,
    } }, { streamTransport: true, buffer: true });
    assert.ok(Buffer.isBuffer(info.message));
    assert.match(info.message.toString(), /DKIM-Signature: v=1;/);
    assert.match(info.message.toString(), /d=example.com;/);
    assert.match(info.message.toString(), /s=test;/);
    assert.match(info.message.toString(), /bh=[A-Za-z0-9+/]+=*/);
  });
});
