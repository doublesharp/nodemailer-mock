import Mail from 'nodemailer/lib/mailer';
import MailMessage from 'nodemailer/lib/mailer/mail-message';
import { detectMimeType } from 'nodemailer/lib/mime-funcs';

export interface RemoteAttachmentOptions {
  /** Fetch remote attachments through Nodemailer instead of substituting test content. */
  allowRemoteAttachments?: boolean;
  /** Supply bytes for HTTP(S) attachments. The default is an empty Buffer. */
  resolveRemoteAttachment?: (attachment: Readonly<Mail.Attachment>) => string | Buffer | Promise<string | Buffer>;
}

interface PreparedAttachments {
  original: Mail.Options;
  replacements: Map<Mail.Attachment, Mail.Attachment>;
}

/** Isolate content used for rendering from the attachment options recorded by the mock. */
export class MockAttachments {
  private readonly prepared = new WeakMap<object, PreparedAttachments>();

  constructor(private readonly options: RemoteAttachmentOptions, private readonly rendersContent: boolean) {}

  prepare<T>(mail: MailMessage<T>): Promise<void> | undefined {
    const attachments = mail.data.attachments;
    if (!attachments) return;
    const remote = attachments.flatMap((attachment) => {
      const url = attachment.path || attachment.href;
      return typeof url === 'string' && /^https?:\/\//i.test(url) ? [{ attachment, url }] : [];
    });
    if (!remote.length) return;
    // Older JSON transports resolve content without enforcing this message policy.
    if (mail.data.disableUrlAccess) {
      if (this.rendersContent) return Promise.reject(Object.assign(
        new Error(`Url access rejected for ${remote[0].url}`), { code: 'EURLACCESS' }));
      return;
    }
    if (this.options.allowRemoteAttachments) return;
    return this.substitute(mail, attachments, remote);
  }

  private async substitute<T>(mail: MailMessage<T>, attachments: Mail.Attachment[],
    remote: { attachment: Mail.Attachment; url: string }[]): Promise<void> {
    const replacements = this.prepared.get(mail)?.replacements ?? new Map<Mail.Attachment, Mail.Attachment>();
    for (const { attachment, url } of remote) {
      if (replacements.has(attachment)) continue;
      const content = this.rendersContent && this.options.resolveRemoteAttachment
        ? await this.options.resolveRemoteAttachment({ ...attachment }) : Buffer.alloc(0);
      const replacement: Mail.Attachment = {
        ...attachment,
        filename: attachment.filename ?? url.split('/').pop()!.split('?').shift(),
        contentType: attachment.contentType || detectMimeType(attachment.filename || url),
        content: Buffer.from(content),
      };
      // URL and encoding fields would make Nodemailer resolve or decode the fixture again.
      delete replacement.href;
      delete replacement.path;
      delete replacement.encoding;
      replacements.set(attachment, replacement);
    }
    this.prepared.set(mail, { original: mail.data, replacements });
    mail.data = { ...mail.data,
      attachments: attachments.map((attachment) => replacements.get(attachment) ?? attachment) };
  }

  restore<T>(mail: MailMessage<T>): void {
    const prepared = this.prepared.get(mail);
    if (prepared) mail.data = prepared.original;
  }

  async forRendering<T>(mail: MailMessage<T>): Promise<MailMessage<T>> {
    const prepared = this.prepared.get(mail);
    const isolated = Object.assign(Object.create(Object.getPrototypeOf(mail)), mail) as MailMessage<T>;
    if (prepared) this.prepared.set(isolated, prepared);
    // Stream plugins may have changed JSON attachment data after MIME compilation.
    await this.prepare(isolated);
    return isolated;
  }
}
