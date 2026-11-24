import type Mail from 'nodemailer/lib/mailer';

export interface AccessPolicy {
  disableFileAccess?: boolean;
  disableUrlAccess?: boolean;
}

export function mergeAccessPolicy(...sources: (AccessPolicy | undefined)[]): Required<AccessPolicy> {
  return {
    disableFileAccess: sources.some((source) => Boolean(source?.disableFileAccess)),
    disableUrlAccess: sources.some((source) => Boolean(source?.disableUrlAccess)),
  };
}

export function enforcedAccessPolicy(policy: AccessPolicy): AccessPolicy {
  return {
    ...(policy.disableFileAccess ? { disableFileAccess: true } : {}),
    ...(policy.disableUrlAccess ? { disableUrlAccess: true } : {}),
  };
}

function trimUrlPrefix(input: string): string {
  let start = 0;
  while (start < input.length) {
    const code = input.charCodeAt(start);
    if (code > 0x20 && code !== 0x00a0 && code !== 0xfeff) break;
    start++;
  }
  return input.slice(start);
}

export function unwrapString(source: unknown): string | undefined {
  if (typeof source === 'string') return source;
  if (source instanceof String) return source.valueOf();
  if (source instanceof URL) return source.href;
}

export function parseRemoteUrl(source: unknown): URL | undefined {
  const value = unwrapString(source);
  if (value === undefined) return;
  try {
    const url = new URL(trimUrlPrefix(value));
    if (url.protocol === 'http:' || url.protocol === 'https:') return url;
  } catch {
    // Local paths and incomplete URLs are not remote HTTP(S) sources.
  }
}

interface Descriptor {
  pipe?: unknown;
  href?: unknown;
  path?: unknown;
  content?: unknown;
}

function descriptor(value: unknown): Descriptor | undefined {
  if (value && typeof value === 'object' && typeof (value as Descriptor).pipe !== 'function') return value;
}

function isDataUri(value: unknown): boolean {
  return /^data:/i.test(String(value));
}

function assertDescriptorAccess(policy: AccessPolicy, { href, path }: Descriptor): void {
  const hrefValue = unwrapString(href);
  if (policy.disableUrlAccess && hrefValue && !isDataUri(hrefValue)) {
    throw Object.assign(new Error('Url access rejected for message content'), { code: 'EURLACCESS' });
  }
  const pathValue = unwrapString(path) ?? path;
  if (!pathValue || isDataUri(pathValue)) return;
  if (parseRemoteUrl(pathValue)) {
    if (policy.disableUrlAccess) {
      throw Object.assign(new Error('Url access rejected for message content'), { code: 'EURLACCESS' });
    }
  } else if (policy.disableFileAccess) {
    throw Object.assign(new Error('File access rejected for message content'), { code: 'EFILEACCESS' });
  }
}

export function assertContentAccess(policy: AccessPolicy, ...values: unknown[]): void {
  if (!policy.disableFileAccess && !policy.disableUrlAccess) return;
  for (const value of values) {
    const outer = descriptor(value);
    if (!outer) continue;
    assertDescriptorAccess(policy, outer);
    const nested = descriptor(outer.content);
    if (nested) assertDescriptorAccess(policy, nested);
  }
}

export function assertMessageAccess(policy: AccessPolicy, data: Mail.Options): void {
  assertContentAccess(policy, data.raw, data.text, data.html, data.watchHtml, data.amp, data.icalEvent);
  for (const part of [...data.alternatives ?? [], ...data.attachments ?? []]) {
    assertContentAccess(policy, part, part.raw);
  }
}
