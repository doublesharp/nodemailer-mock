import MailMessage from 'nodemailer/lib/mailer/mail-message';
import { messages, MockInfo, MockResponseMode, RealisticMockSentMessageInfo } from './messages';

/** Copy mutable result fields at both configuration and delivery boundaries. */
export function copyInfo<Mode extends MockResponseMode>(info: Partial<MockInfo<Mode>>): Partial<MockInfo<Mode>> {
  const copy = { ...info };
  for (const field of ['accepted', 'rejected', 'pending'] as const) {
    if (copy[field]) copy[field] = [...copy[field]];
  }
  if (copy.envelope && typeof copy.envelope === 'object') {
    copy.envelope = { ...copy.envelope, to: [...copy.envelope.to] };
  }
  return copy;
}

export function createInfo<Mode extends MockResponseMode>(
  email: MailMessage<MockInfo<Mode>>,
  mode: MockResponseMode,
  response: string
): MockInfo<Mode> {
  let info: MockInfo<MockResponseMode> = messages.info();
  if (mode === 'realistic') {
    const envelope = email.message?.getEnvelope() ?? { from: '', to: [] };
    info = {
      messageId: email.message?.messageId() ?? info.messageId,
      envelope: { from: envelope.from || '', to: [...envelope.to] },
      accepted: [...envelope.to], rejected: [], pending: [], response,
    } satisfies RealisticMockSentMessageInfo;
  }
  return { ...info, response } as MockInfo<Mode>;
}
