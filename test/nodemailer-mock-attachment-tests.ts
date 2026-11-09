import { strict as assert } from 'node:assert';
import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';
import { mock as nodeMock } from 'node:test';
import * as library from '../src/nodemailer-mock';

describe('remote attachment mocking', () => {
  const modes = [
    { name: 'ordinary', transport: {}, settings: {} },
    { name: 'JSON', transport: { jsonTransport: true }, settings: {} },
    { name: 'buffered MIME', transport: { streamTransport: true, buffer: true }, settings: {} },
    { name: 'streamed MIME', transport: { streamTransport: true }, settings: {} },
    { name: 'validation', transport: {}, settings: { validateContent: true } },
  ];
  let requests: number;

  beforeEach(() => {
    requests = 0;
    const block = () => { requests++; throw new Error('Unexpected attachment request'); };
    nodeMock.method(http, 'request', block);
    nodeMock.method(https, 'request', block);
  });
  afterEach(() => nodeMock.restoreAll());

  async function output(info: library.MockSentMessageInfo): Promise<string> {
    if (info.message instanceof Readable) {
      let result = '';
      for await (const chunk of info.message) result += chunk.toString();
      return result;
    }
    return info.message?.toString() ?? '';
  }

  for (const key of ['href', 'path']) {
    for (const protocol of ['http', 'https']) {
      for (const mode of modes) {
        it(`mocks ${protocol} ${key} with ${mode.name} and preserves recorded attachments`, async () => {
          const attachment = Object.freeze({ filename: 'document.pdf', contentType: 'application/pdf',
            [key]: `${protocol}://example.test/document.pdf`, cid: 'document' });
          const attachments = Object.freeze([attachment]);
          const mailer = library.getMockFor(undefined, mode.settings);
          const info = await mailer.createTransport(mode.transport).sendMail({
            attachments: attachments as unknown as typeof attachment[],
          });
          const message = await output(info);
          assert.equal(requests, 0);
          assert.equal(mailer.mock.getSentMail()[0].attachments, attachments);
          assert.equal(mailer.mock.getSentMail()[0].attachments![0], attachment);
          if (mode.name === 'JSON') {
            const rendered = JSON.parse(message).attachments[0];
            assert.equal(rendered.content, '');
            assert.equal(rendered.filename, 'document.pdf');
            assert.equal(rendered.contentType, 'application/pdf');
            assert.equal(rendered.cid, 'document');
            assert.equal(rendered.href, undefined);
            assert.equal(rendered.path, undefined);
          } else if (mode.name.includes('MIME')) {
            assert.match(message, /Content-Type: application\/pdf/);
            assert.match(message, /filename=document.pdf/);
            assert.match(message, /Content-ID: <document>/);
          }
        });
      }
    }
  }

  it('uses fixture bytes once per remote attachment and retains local content', async () => {
    for (const transport of [{ jsonTransport: true }, { streamTransport: true, buffer: true }]) {
      const seen: unknown[] = [];
      const mailer = library.getMockFor(undefined, {
        resolveRemoteAttachment: async (attachment) => { seen.push(attachment); return Buffer.from('fixture bytes'); },
      });
      const remote = { href: 'https://example.test/report.pdf?token=test', contentType: 'application/pdf' };
      const local = { filename: 'local.txt', content: Buffer.from('local bytes') };
      const info = await mailer.createTransport(transport).sendMail({ attachments: [remote, local] });
      const message = await output(info);
      assert.deepEqual(seen, [remote]);
      assert.equal(requests, 0);
      assert.equal(mailer.mock.getSentMail()[0].attachments![0], remote);
      if ('jsonTransport' in transport) {
        const attachments = JSON.parse(message).attachments;
        assert.equal(attachments[0].filename, 'report.pdf');
        assert.equal(Buffer.from(attachments[0].content, 'base64').toString(), 'fixture bytes');
        assert.equal(Buffer.from(attachments[1].content, 'base64').toString(), 'local bytes');
      } else {
        assert.match(message, /Zml4dHVyZSBieXRlcw==/);
        assert.match(message, /filename=report.pdf/);
        assert.match(message, /bG9jYWwgYnl0ZXM=/);
      }
    }
  });

  it('mocks remote attachments added by enabled compile plugins', async () => {
    const mailer = library.getMockFor(undefined, { resolveRemoteAttachment: () => 'plugin fixture' });
    mailer.mock.setUnmockedUsePlugins(true);
    const transport = mailer.createTransport({ jsonTransport: true });
    const attachment = { path: 'https://example.test/plugin.txt' };
    transport.use('compile', (mail, done) => { mail.data.attachments = [attachment]; done(); });
    const info = await transport.sendMail({});
    assert.equal(Buffer.from(JSON.parse(await output(info)).attachments[0].content, 'base64').toString(),
      'plugin fixture');
    assert.equal(mailer.mock.getSentMail()[0].attachments![0], attachment);
    assert.equal(requests, 0);
  });

  it('passes original attachments to stream plugins and failure checks', async () => {
    const attachment = { href: 'https://example.test/report.pdf' };
    const mailer = library.getMockFor();
    mailer.mock.setUnmockedUsePlugins(true);
    const transport = mailer.createTransport({ streamTransport: true, buffer: true });
    transport.use('stream', (mail, done) => { assert.equal(mail.data.attachments![0], attachment); done(); });
    mailer.mock.setShouldFailCheck((mail) => { assert.equal(mail!.data.attachments![0], attachment); return false; });
    await transport.sendMail({ attachments: [attachment] });
    assert.equal(requests, 0);
  });

  it('propagates resolver errors through callbacks and promises without recording success', async () => {
    const error = new Error('Fixture unavailable');
    const mailer = library.getMockFor(undefined, { resolveRemoteAttachment: () => { throw error; } });
    const transport = mailer.createTransport({ jsonTransport: true });
    const message = { attachments: [{ href: 'https://example.test/report.pdf' }] };
    await assert.rejects(transport.sendMail(message), (actual) => actual === error);
    await new Promise<void>((resolve, reject) => transport.sendMail(message, (actual) => {
      try { assert.equal(actual, error); resolve(); } catch (failure) { reject(failure); }
    }));
    assert.deepEqual(mailer.mock.getSentMail(), []);
    assert.equal(requests, 0);
  });

  it('requires explicit opt-in to fetch remote attachments', async () => {
    const mailer = library.getMockFor(undefined, { allowRemoteAttachments: true,
      resolveRemoteAttachment: () => { throw new Error('Resolver must be bypassed'); } });
    await assert.rejects(mailer.createTransport({ jsonTransport: true }).sendMail({
      attachments: [{ href: 'https://example.test/report.pdf' }],
    }), /Unexpected attachment request/);
    assert.equal(requests, 1);
  });

  it('keeps explicit URL access restrictions as send errors', async () => {
    for (const transport of [{ jsonTransport: true }, { streamTransport: true, buffer: true }]) {
      for (const allowRemoteAttachments of [false, true]) {
        await assert.rejects(library.getMockFor(undefined, { allowRemoteAttachments })
          .createTransport(transport).sendMail({
            disableUrlAccess: true, attachments: [{ href: 'https://example.test/report.pdf' }],
          }), { code: 'EURLACCESS' });
      }
    }
    await library.getMockFor().createTransport().sendMail({
      disableUrlAccess: true, attachments: [{ href: 'https://example.test/unread.pdf' }],
    });
    assert.equal(requests, 0);
  });

  it('fetches real content only after opt-in, using a local HTTP server', async () => {
    nodeMock.restoreAll();
    const server = http.createServer((_request, response) => { requests++; response.end('local fixture'); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address() as { port: number };
      const mailer = library.getMockFor(undefined, { allowRemoteAttachments: true });
      for (const options of [{ jsonTransport: true }, { streamTransport: true, buffer: true }]) {
        const info = await mailer.createTransport(options).sendMail({
          attachments: [{ filename: 'fixture.txt', href: `http://127.0.0.1:${address.port}/fixture.txt` }],
        });
        const message = await output(info);
        if ('jsonTransport' in options) {
          assert.equal(Buffer.from(JSON.parse(message).attachments[0].content, 'base64').toString(), 'local fixture');
        } else {
          assert.match(message, /bG9jYWwgZml4dHVyZQ==/);
        }
      }
      assert.equal(requests, 2);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('uses attachment defaults with callbacks and object JSON output', async () => {
    const attachment = { filename: false as const, path: 'HTTPS://example.test/report.pdf', encoding: 'base64' };
    const mailer = library.getMockFor(undefined, { resolveRemoteAttachment: () => 'UTF-8 fixture' });
    const transport = mailer.createTransport({ jsonTransport: true, skipEncoding: true },
      { attachments: [attachment] });
    await new Promise<void>((resolve, reject) => transport.sendMail({}, (error, info) => {
      if (error) return reject(error);
      try {
        const result = info.message as { attachments: { filename: string; contentType: string; content: string }[] };
        assert.equal(result.attachments[0].contentType, 'application/pdf');
        assert.equal(result.attachments[0].filename, 'attachment-1.pdf');
        assert.equal(attachment.filename, false);
        assert.equal(Buffer.from(result.attachments[0].content, 'base64').toString(), 'UTF-8 fixture');
        assert.equal(mailer.mock.getSentMail()[0].attachments![0], attachment);
        resolve();
      } catch (failure) { reject(failure); }
    }));
    assert.equal(requests, 0);
  });

  it('does not resolve fixtures for ordinary sends or change data URI attachments', async () => {
    const mailer = library.getMockFor(undefined, {
      resolveRemoteAttachment: () => { throw new Error('No fixture should be read'); },
    });
    await mailer.createTransport().sendMail({ attachments: [{ href: 'https://example.test/report.pdf' }] });
    const info = await mailer.createTransport({ jsonTransport: true }).sendMail({
      attachments: [{ path: 'data:text/plain;base64,ZGF0YSBieXRlcw==' }],
    });
    const attachment = JSON.parse(await output(info)).attachments[0];
    assert.equal(Buffer.from(attachment.content, 'base64').toString(), 'data bytes');
    assert.equal(requests, 0);
  });

  it('keeps a local attachment path ahead of an unused remote href', async () => {
    await assert.rejects(library.getMockFor().createTransport({ streamTransport: true, buffer: true }).sendMail({
      attachments: [{ path: '/missing/issue-35-local-attachment', href: 'https://example.test/unused.pdf' }],
    }), { code: 'ENOENT' });
    assert.equal(requests, 0);
  });

  it('mocks JSON attachments added by stream plugins and tolerates removed attachments', async () => {
    for (const remove of [false, true]) {
      const mailer = library.getMockFor();
      mailer.mock.setUnmockedUsePlugins(true);
      const transport = mailer.createTransport({ jsonTransport: true });
      const added = { href: 'https://example.test/added.txt' };
      transport.use('stream', (mail, done) => {
        if (remove) delete mail.data.attachments;
        else mail.data.attachments!.push(added);
        done();
      });
      const info = await transport.sendMail({ attachments: [{ href: 'https://example.test/original.txt' }] });
      const rendered = JSON.parse(await output(info)).attachments;
      assert.equal(rendered?.length ?? 0, remove ? 0 : 2);
      if (!remove) {
        assert.equal(rendered[1].content, '');
        assert.equal(mailer.mock.getSentMail()[0].attachments![1], added);
      }
    }
    assert.equal(requests, 0);
  });

  it('isolates concurrent fixture resolution and fences a reset during resolution', async () => {
    let resume!: (content: string) => void;
    const mailer = library.getMockFor(undefined, {
      resolveRemoteAttachment: (attachment) => attachment.filename === 'old.txt'
        ? new Promise<string>((resolve) => { resume = resolve; }) : Promise.resolve('new fixture'),
    });
    const transport = mailer.createTransport({ jsonTransport: true });
    const old = transport.sendMail({ attachments: [{ filename: 'old.txt', href: 'https://example.test/old.txt' }] });
    mailer.mock.reset();
    const current = await transport.sendMail({
      attachments: [{ filename: 'new.txt', href: 'https://example.test/new.txt' }],
    });
    resume('old fixture');
    const previous = await old;
    assert.equal(Buffer.from(JSON.parse(await output(current)).attachments[0].content, 'base64').toString(), 'new fixture');
    assert.equal(Buffer.from(JSON.parse(await output(previous)).attachments[0].content, 'base64').toString(), 'old fixture');
    assert.deepEqual(mailer.mock.getSentMail().map((mail) => mail.attachments![0].filename), ['new.txt']);
    assert.equal(requests, 0);
  });
});
