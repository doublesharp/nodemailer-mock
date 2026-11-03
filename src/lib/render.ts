import { Readable } from 'node:stream';
import MailMessage from 'nodemailer/lib/mailer/mail-message';
import StreamTransport from 'nodemailer/lib/stream-transport';
import JSONTransport from 'nodemailer/lib/json-transport';

export interface RenderOptions {
  streamTransport?: boolean;
  jsonTransport?: boolean;
  buffer?: boolean;
  skipEncoding?: boolean;
  newline?: string;
  validateContent?: boolean;
}

export interface RenderResult {
  message?: Buffer | Readable | string | object;
  messageSize?: number;
}

// JSONTransport.normalize rewrites addresses, bodies and attachment objects in place.
function copyData<T>(value: T, copies = new WeakMap<object, object>()): T {
  if (Buffer.isBuffer(value)) return Buffer.from(value) as T;
  if (!value || typeof value !== 'object') return value;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return value;
  if (copies.has(value)) return copies.get(value) as T;
  const copy = Array.isArray(value) ? [] : Object.create(prototype);
  copies.set(value, copy);
  for (const key of Object.keys(value)) {
    Object.defineProperty(copy, key, { value: copyData((value as Record<string, unknown>)[key], copies),
      enumerable: true, writable: true, configurable: true });
  }
  return copy as T;
}

async function validateRaw<T>(mail: MailMessage<T>): Promise<void> {
  const raw = mail.data.raw;
  if (raw === undefined || raw === null) return;
  // Older peers do not enforce the access flags in MailMessage.resolveContent.
  const source = (typeof raw === 'object' && 'content' in raw ? raw.content : raw) as
    { pipe?: unknown; path?: string; href?: string };
  if (source && typeof source === 'object' && typeof source.pipe !== 'function') {
    const path = source.href || source.path;
    if (path && !/^data:/i.test(path)) {
      const url = Boolean(source.href) || /^https?:\/\//i.test(path);
      if (url ? mail.data.disableUrlAccess : mail.data.disableFileAccess) {
        throw Object.assign(new Error(`${url ? 'Url' : 'File'} access rejected for ${path}`),
          { code: url ? 'EURLACCESS' : 'EFILEACCESS' });
      }
    }
  }
  const value = await new Promise<Buffer | string>((resolve, reject) => {
    mail.resolveContent(mail.data, 'raw', (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
  mail.data.raw = Buffer.isBuffer(value) ? value : Buffer.from(value);
}

/** Render the existing compiled message using Nodemailer's offline transports. */
export async function renderMessage<T>(mail: MailMessage<T>, options: RenderOptions): Promise<RenderResult> {
  if (!options.streamTransport && options.jsonTransport) {
    const isolated = Object.assign(Object.create(Object.getPrototypeOf(mail)), mail,
      { data: copyData(mail.data) }) as MailMessage<T>;
    if (options.validateContent) await validateRaw(isolated);
    const transport = new JSONTransport({ jsonTransport: true, skipEncoding: options.skipEncoding });
    const info = await new Promise<JSONTransport.SentMessageInfo>((resolve, reject) => {
      transport.send(isolated as unknown as MailMessage<JSONTransport.SentMessageInfo>, (error, result) => {
        if (error) reject(error);
        else resolve(result!);
      });
    });
    return { message: info.message,
      ...(typeof info.message === 'string' ? { messageSize: Buffer.byteLength(info.message) } : {}) };
  }
  if (!options.streamTransport && !options.validateContent) return {};

  const transport = new StreamTransport({ streamTransport: true,
    buffer: options.buffer || options.validateContent, newline: options.newline });
  const info = await new Promise<StreamTransport.SentMessageInfo>((resolve, reject) => {
    transport.send(mail as unknown as MailMessage<StreamTransport.SentMessageInfo>, (error, result) => {
      if (error) reject(error);
      else resolve(result!);
    });
  });
  const message = info.message;
  if (!Buffer.isBuffer(message)) return { message };
  if (!options.streamTransport) return { messageSize: message.length };
  return {
    message: options.buffer ? message : Readable.from(message),
    messageSize: message.length,
  };
}
