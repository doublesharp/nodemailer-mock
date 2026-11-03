# nodemailer-mock

[![nodemailer-mock](https://img.shields.io/npm/v/nodemailer-mock.svg)](https://www.npmjs.com/package/nodemailer-mock)
[![Code Coverage Badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fdoublesharp.github.io%2Fnodemailer-mock%2Fcoverage-badge.json)](https://doublesharp.github.io/nodemailer-mock/coverage/)
![Downloads](https://img.shields.io/npm/dt/nodemailer-mock.svg)

Mock [`nodemailer`](https://www.npmjs.com/package/nodemailer) in Node.js tests.
Inspect sent messages and simulate failures without sending email.

[Changelog](CHANGELOG.md) · [Contributing](https://github.com/doublesharp/nodemailer-mock/blob/main/CONTRIBUTING.md)

Supports Nodemailer 6 through 10. See the `peerDependencies` in
[`package.json`](package.json). Use a Node.js version supported
by your installed Nodemailer version. Nodemailer 10 bundles TypeScript declarations;
for supported versions without bundled declarations, install a matching
`@types/nodemailer` version in TypeScript projects.

The exported `MockSentMessageInfo` type describes the mock's result, including its
legacy placeholder envelope and the `Error` returned in `info.response` for failed sends.
Opt into `RealisticMockSentMessageInfo` with the factory configuration below.
To annotate a mock transporter, use `NodemailerMockTransporter` or
`Transporter<MockSentMessageInfo>` to preserve the mock's result type. Standard
Nodemailer plugins and failure checks work with the mock.

## Install

Nodemailer is a peer dependency. If your application already installs it, keep its
existing dependency and add only `nodemailer-mock` as a development dependency. For
a new test project, install both:

```
npm install nodemailer nodemailer-mock --save-dev
```

```
pnpm add -D nodemailer nodemailer-mock
```

```
yarn add -D nodemailer nodemailer-mock
```

## Module loading

Use `require('nodemailer-mock')` in CommonJS or
`import nodemailermock from 'nodemailer-mock'` in ESM. The default mock is shared
within the loaded module. Reset it between tests or create an independent mock:

```javascript
const { getMockFor } = require('nodemailer-mock');
const nodemailermock = getMockFor(require('nodemailer'));
```

`getMockFor(nodemailer)` returns a new mock with its own state and uses the supplied
Nodemailer module to create underlying transports. The optional second argument
configures realistic results and a deterministic message ID generator. Replace
`nodemailer` before loading application code that imports it. With Jest, use the
real module from `jest.requireActual('nodemailer')` in the manual mock shown below.

## Mock API

Use the mock with [`Jest`](https://www.npmjs.com/package/jest),
[`Mocha`](https://www.npmjs.com/package/mocha),
[`Vitest`](https://www.npmjs.com/package/vitest), or
[`node:test`](https://nodejs.org/api/test.html). Test helpers are available under
the mocked module's `.mock` property.

### `createTransport(transportOptions?, defaults?)`

Returns a mocked Nodemailer transporter. You can omit the options, supply a
transport or options object, including a custom transport with its own result
type, or use an SMTP URL. The second argument sets message defaults.
Values passed to `sendMail()` override them.

```javascript
const nodemailermock = require('nodemailer-mock');
const transport = nodemailermock.createTransport({}, {
  from: 'sender@example.test',
  subject: 'Default subject',
});
```

`sendMail()` supports callbacks and Promises and records successful messages without
sending them through the underlying transport. Returned `info` values are mock
placeholders, including `envelope`, `accepted`, `rejected`, and `pending`; they do
not report actual recipient delivery. Inspect `mock.getSentMail()` for message
content. A failed callback may receive mock result information, while the Promise
rejects with the error.

`verify()` and `close()` are mocked by default. Setting `setMockedVerify(false)` or
`setMockedClose(false)` delegates to the underlying transport when one is available.
Real verification can connect to the configured mail server.

### Realistic results and queued outcomes

Legacy results remain the default. Create a separate mock with
`responseMode: 'realistic'` to derive its envelope and accepted recipients from
the compiled message. The result uses the message's `messageId`, or the configured generator
when one is supplied. These values describe the simulation, not actual delivery.

```javascript
import nodemailer from 'nodemailer';
import { getMockFor } from 'nodemailer-mock';

const mailer = getMockFor(nodemailer, {
  responseMode: 'realistic',
  messageIdGenerator: () => '<test-message@example.test>',
});
const transport = mailer.createTransport();
const info = await transport.sendMail({
  from: 'sender@example.test',
  to: 'recipient@example.test',
  text: 'A deterministic test message',
});
console.log(info.envelope.to); // ['recipient@example.test']
console.log(info.messageId); // '<test-message@example.test>'
```

TypeScript infers `RealisticMockSentMessageInfo` for this configuration. The
existing `MockSentMessageInfo` and default factory return types retain their
legacy envelope string.

Use `setSentMessageInfo()` to configure result fields for successful sends. Use
`queueResult()` to simulate individual failures or successes, including partial
recipient acceptance:

```javascript
mailer.mock.setSentMessageInfo({ response: '250 simulated success' });
mailer.mock.queueResult({ error: new Error('Simulated temporary failure') });
mailer.mock.queueResult({ info: {
  accepted: ['accepted@example.test'],
  rejected: ['rejected@example.test'],
} });
```

Each send reserves its queued outcome when it starts, so asynchronous plugins
cannot reorder the queue. A queued outcome takes precedence over failure flags
and failure checks for that send and does not consume a one-time failure flag.
`verify()` does not consume the queue. Queued result fields override persistent
result fields. `reset()` clears both kinds of override while preserving the
factory's response mode and message ID generator.

### Offline test accounts

`createTestAccount()` returns a deterministic account with reserved `.test`
endpoints. It supports Promises and asynchronous callbacks, including the optional
API URL argument. It never requests credentials from Ethereal. Each factory has
its own account, and `mock.setTestAccount(account)` replaces it until reset.

`getTestMessageUrl(info)` reads Ethereal's trailing `STATUS` and `MSGID` response
fields and builds a URL using the configured account's `web` address. It returns
`false` for ordinary mock responses. The resulting URL identifies a simulated
message; no inbox or hosted preview is created.

```javascript
const mailer = require('nodemailer-mock').getMockFor();
const account = await mailer.createTestAccount();
mailer.mock.setTestAccount({ ...account, web: 'https://preview.example.test' });
mailer.mock.setSentMessageInfo({ response: '250 OK [STATUS=sent MSGID=test-123]' });
const info = await mailer.createTransport().sendMail({ text: 'Preview test' });
console.log(mailer.getTestMessageUrl(info));
// https://preview.example.test/message/test-123
```

### Message output and content validation

Transport options `streamTransport: true` and `jsonTransport: true` now produce
`info.message` through Nodemailer's offline transports. Stream output is a
Readable, or a Buffer with `buffer: true`. JSON output is a string, or a normalized
object with `skipEncoding: true`. Use `responseMode: 'realistic'` for a typed
envelope; legacy envelope and result defaults still apply otherwise.

MIME output includes enabled user plugins, raw content, attachments, and DKIM
signing. JSON output follows Nodemailer's normalization and does not contain MIME
stream transforms or DKIM signatures. Buffered output includes `messageSize` in
bytes. Timings and other SMTP metadata can be supplied through
`setSentMessageInfo()` or `queueResult()`, including `rejectedErrors`, `ehlo`,
`envelopeTime`, and `messageTime`. The mock does not measure SMTP round trips.

```javascript
const mailer = require('nodemailer-mock').getMockFor(undefined, {
  responseMode: 'realistic',
  validateContent: true,
});
const transport = mailer.createTransport({ streamTransport: true, buffer: true });
const info = await transport.sendMail({
  from: 'sender@example.test', to: 'recipient@example.test', text: 'MIME test',
});
console.log(info.message.toString());
```

For ordinary mocked transports, `validateContent: true` builds and consumes the
message before reporting success, then discards the output. This catches missing
files, blocked file/URL access, and failing body or attachment streams. Rendering
can read files and fetch URLs. Transport and message `disableFileAccess` and
`disableUrlAccess` options apply. Content streams are consumed once.

Stream output without validation follows Nodemailer's streaming behavior. The
send can resolve before a content error occurs; the caller must consume the
returned stream and handle its errors. With validation, the mock buffers the
content first and returns a new Readable after validation succeeds. Ordinary
sends without output or validation keep the existing behavior of recording
options without reading content.

### Delivery simulation

Set factory option `simulateDelivery: true` to enable the following behavior.
No SMTP server, provider API, or OAuth endpoint is contacted by the simulation.

- With transport option `pool: true`, sends use a FIFO scheduler with
  `maxConnections`, `maxMessages`, `rateLimit`, and `rateDelta`. `isIdle()` reports
  immediate capacity. The transporter emits an initial `idle` event and another
  when capacity returns. Rate limits use shared windows starting at dispatch.
- For pooled transports, `close()` rejects queued and future sends with
  `EPOOLCLOSED`, lets active sends finish, and emits `clear` after they drain.
  `idleTimeout` can clear retained
  logical connections; its simulation default is `0`, disabled. `maxMessages`
  renews logical slots without opening connections.
- A queued error with `code: 'ECONNECTION'` and `command: 'CONN'` marks an explicit
  disconnect before sending. The pool retries using the next queued outcome, up
  to `maxRequeues`, which defaults to `5`. Set `0` to disable or `-1` for unlimited
  retries. Other failures are not retried by the pool.
- OAuth2 calls the provider registered with `set('oauth2_provision_cb', callback)`
  or `auth.provisionCallback`. Expiring tokens are cached by credentials and
  provider. Token generation emits `token`. A queued `EAUTH` triggers one renewal
  with `renew: true` and consumes the next outcome. Refresh-token and service-account
  configurations without a provider generate deterministic offline tokens.
- Per-message authentication applies to non-pooled transports. Pooled transports
  use their configured authentication. `smtpCapabilities` supplies simulated
  `info.ehlo` values. REQUIRETLS requests fail with `ETLS` unless the transport has
  `secure: true` and capabilities include `REQUIRETLS`. TLS negotiation itself is
  not performed. DSN options remain available in the recorded message; no delivery
  notifications are generated.
- Successful result overrides with no accepted recipients and at least one
  rejected recipient fail with `EENVELOPE`. Partial acceptance still succeeds.

```javascript
const mailer = require('nodemailer-mock').getMockFor(undefined, {
  responseMode: 'realistic', simulateDelivery: true, smtpCapabilities: ['DSN'],
});
const transport = mailer.createTransport({ pool: true, maxConnections: 2 });
await transport.sendMail({ from: 'sender@example.test', to: 'recipient@example.test' });
transport.close();
```

`reset()` cancels simulated pool timers, rejects waiting sends with `ERESET`,
reopens retained pools, and clears token caches and account overrides. Sends that
started earlier still settle, but cannot record mail, emit token or capacity
events into the new state, or consume newly queued outcomes. Full transporter
cleanup removes the public registry while held transporters remain reusable and
participate in later resets. Manual idle controls continue to apply to ordinary
mocks; simulated pools compute their own idle state.

### `NodemailerMock.mock` functions

- `reset: (options?: { clearTransporters?: boolean }) => void`
  - clears sent mail and the aggregate close count; restores failure settings, responses, mocked verify/close behavior, and disabled user plugins
  - creates a fresh default failure `Error` and clears configured result overrides and queued outcomes
  - cancels pending idle changes scheduled with `scheduleIsIdle()`
  - sends started before reset still settle for their callers but cannot populate the new sent-mail history
  - by default, retains created transporters, their registered plugins, their individual close counts, and their current idle states
  - `reset({ clearTransporters: true })` also clears the registry, removes their event listeners, and resets their individual close counts and idle states
  - full cleanup does not close real transports; a held transporter can still be reused explicitly
- `getTransporters: () => NodemailerMockTransporter[]`
  - returns the transporters created by this mock, including those created before `reset()`
- `getSentMail: () => Mail.Options[]`
  - returns successfully sent message options, including applied defaults and plugin changes, since the last reset
- `getCloseCallCount: () => number`
  - returns the total number of `transporter.close()` calls across this mock's transporters
- `setShouldFailOnce: (isSet?: boolean) => void`
  - sets a one-time failure for the next mocked send or verification; defaults to `true` when omitted
  - passing `false` clears the one-time and persistent failure flags
- `isShouldFailOnce: () => boolean`
  - returns whether the one-time failure flag is set
- `setShouldFail: (isFail: boolean) => void`
  - controls forced failures for subsequent mocked sends or verification calls
    - `true` enables forced failures
    - `false` clears forced and one-time failures; per-message checks still apply
- `isShouldFail: () => boolean`
  - returns whether persistent forced failures are enabled
- `setShouldFailCheck: (check: CheckMailMessageOrNull) => void`
  - sets a function that decides whether `transporter.sendMail()` or `transport.send()` should fail for a message
    - `true` fails the send
    - `false` leaves the normal failure flags in effect
  - receives a Nodemailer mail message; inspect fields such as `mail.data.to`
  - runs before the normal failure flags; a failure here does not consume a one-time failure
  - pass `null` to clear the check; it is not called by `verify()`
  - use the exported `CheckMailMessageOrNull` type; checks may use standard Nodemailer `MailMessage` types
  - thrown `Error` objects are returned unchanged; other thrown values are wrapped in an `Error` with the original `cause`
- `getShouldFailCheck: () => CheckMailMessageOrNull`
  - returns the function used to check the `MailMessage` or `null` if it is not set
- `setMockedVerify: (isMocked: boolean) => void`
  - controls whether `transport.verify()` is mocked; defaults to `true`
    - `true` returns a mocked callback or Promise result
    - `false` delegates to the underlying Nodemailer transport when available
- `isMockedVerify: () => boolean`
  - returns whether verification is mocked
- `setMockedClose: (isMocked: boolean) => void`
  - controls whether `transporter.close()` is mocked; defaults to `true`
- `isMockedClose: () => boolean`
  - returns `true` for mocked close calls and `false` for calls delegated to the underlying transport when available
- `setSuccessResponse: (response: string) => void`
  - set the success message that is returned in the callback for `transporter.sendMail()` or `transport.send()`
- `getSuccessResponse: () => string`
  - returns the success message value
- `setFailResponse: (error: Error) => void`
  - set the `Error` that is returned in the callback for `transporter.sendMail()` or `transport.send()`
- `getFailResponse: () => Error`
  - returns this instance's fail `Error`; default errors are independent across instances and resets
- `setSentMessageInfo(info)`
  - sets typed partial result fields for successful sends until reset; accepts the envelope type for the configured response mode
- `queueResult({ error } | { info? })`
  - appends a failure or successful partial result for the next send; `{}` queues a success with the configured defaults
- `setTestAccount(account)`
  - sets the offline account returned by `createTestAccount()` until reset
- `scheduleIsIdle: (isIdle: boolean, timeout: number) => void`
  - after `timeout` milliseconds, update the idle state of all transporters created by this mock
- `setIsIdle: (isIdle: boolean) => void`
  - update the idle state of all currently created transporters; `true` also emits their `idle` events
- `setUnmockedUsePlugins: (isUnmockUsePlugins: boolean) => void` default `false`
  - run registered user plugins when `true`; skip their execution when `false`
  - Nodemailer's built-in processing still runs
  - checked when each plugin runs, so it also applies to plugins already registered; `reset()` disables them
- `isUnmockedUsePlugins: () => boolean`
  - returns whether user plugins are enabled

### `NodemailerMockTransporter.mock` functions

- `getPlugins: () => { [key: string]: NodemailerMockPlugin[] }`
  - returns the plugins that have been added via `transporter.use()` as arrays, keyed by step
- `getCloseCallCount: () => number`
  - returns this transporter's `close()` call count; `reset()` retains it and `reset({ clearTransporters: true })` clears it
- `setIdle(isIdle: boolean): void`
  - sets the value returned by `transporter.isIdle()` and emits an `idle` event when `isIdle` is `true`

## Usage

Create a transporter, then call `sendMail()` or `verify()` with callbacks,
Promises, or async/await.

### Set up a test

```javascript
const nodemailermock = require('nodemailer-mock');
const transport = nodemailermock.createTransport();

// the email you want to send
const email = {
  from: 'sender@example.test',
  to: 'recipient@example.test',
  subject: 'Test message',
  text: 'Hello from a test',
};
```

### Callbacks

```javascript
// send with nodestyle callback
transport.sendMail(email, function(err, info) {
  if (err) {
    return console.log('Error!', err, info);
  }
  return console.log('Success!', info);
});

// verify with nodestyle callback
transport.verify(function(err, success) {
  if (err) {
    return console.log('Error!', err);
  }
  return console.log('Success!', success);
});
```

### Promises

```javascript
// send with promises
transport.sendMail(email)
  .then(function(info) {
    console.log('Success!', info);
  })
  .catch(function(err) {
    console.log('Error!', err);
  });

// verify with promises
transport.verify()
  .then(function(success) {
    console.log('Success!', success);
  })
  .catch(function(err) {
    console.log('Error!', err);
  });
```

### Async/await

Use this inside an async function after the setup above.

```javascript
// send an email with async/await
try {
  const info = await transport.sendMail(email);
  console.log("Success!", info);
} catch (err) {
  console.log("Error!", err);
}

// verify with async/await
try {
  const success = await transport.verify();
  console.log("Success!", success);
} catch (err) {
  console.log("Error!", err);
}
```

## Example tests

The [examples directory](https://github.com/doublesharp/nodemailer-mock/tree/main/examples)
contains runnable Jest, Mocha, Vitest, and `node:test` tests. It is available in the
repository and excluded from the npm package. From a repository checkout, run
`pnpm install --frozen-lockfile`, then `pnpm run examples` to run all four runners.
Individual commands are `pnpm run example:jest`, `pnpm run example:mocha`,
`pnpm run example:node-test`, and `pnpm run example:vitest`.

The Jest, Mocha, and `node:test` snippets below use this CommonJS application module
at the project root. The Vitest example mocks ESM imports directly.

```javascript
// ./my-module.js
const nodemailer = require('nodemailer');

exports.sendEmail = async () => {
  const transport = nodemailer.createTransport();
  return transport.sendMail({
    from: 'sender@example.test',
    to: 'recipient@example.test',
    subject: 'Test message',
    text: 'Hello from a test',
  });
};
```

### Example using Jest

For a CommonJS Jest project, create `./__mocks__/nodemailer.js` beside
`node_modules`, within Jest's configured roots:

```javascript
// ./__mocks__/nodemailer.js
const nodemailer = jest.requireActual('nodemailer');
module.exports = require('nodemailer-mock').getMockFor(nodemailer);
```

Jest automatically uses this manual mock for the `nodemailer` package. Load the
application in the test and reset the mock's state between tests:

```javascript
// ./__tests__/my-test.js
const { mock } = require('nodemailer');
const { sendEmail } = require('../my-module');

beforeEach(() => mock.reset());

test('Sends an email using mocked Nodemailer', async () => {
  await sendEmail();
  expect(mock.getSentMail()).toHaveLength(1);
  expect(mock.getSentMail()[0].to).toBe('recipient@example.test');
});
```

With Jest configured to transform TypeScript to CommonJS, the equivalent test uses
a type assertion to access the mock helpers. The real Nodemailer type has no
`mock` property:

```typescript
// ./__tests__/my-test.ts
import { beforeEach, expect, test } from '@jest/globals';
import * as nodemailer from 'nodemailer';
import type { NodemailerMock } from 'nodemailer-mock';

const { mock } = nodemailer as unknown as NodemailerMock;
const { sendEmail } = require('../my-module');

beforeEach(() => mock.reset());

test('Sends an email using mocked Nodemailer and TypeScript', async () => {
  await sendEmail();
  expect(mock.getSentMail()).toHaveLength(1);
  expect(mock.getSentMail()[0].to).toBe('recipient@example.test');
});
```

### Example using Mocha

This CommonJS example temporarily intercepts `require('nodemailer')`. Install the
hook before loading the application, clear its cached module, and restore the
loader after the suite. This hook does not intercept native ESM imports.

```javascript
// ./test/my-test.js
const assert = require('node:assert/strict');
const Module = require('node:module');
const nodemailermock = require('nodemailer-mock');
const originalLoad = Module._load;
const applicationPath = require.resolve('../my-module');
let app;

describe('Tests that send email', () => {
  before(() => {
    Module._load = function (request, parent, isMain) {
      if (request === 'nodemailer') return nodemailermock;
      return originalLoad.call(this, request, parent, isMain);
    };
    delete require.cache[applicationPath];
    app = require(applicationPath);
  });

  beforeEach(() => nodemailermock.mock.reset());

  after(() => {
    Module._load = originalLoad;
    delete require.cache[applicationPath];
    nodemailermock.mock.reset();
  });

  it('records a successful email', async () => {
    await app.sendEmail();
    const sentMail = nodemailermock.mock.getSentMail();
    assert.equal(sentMail.length, 1);
    assert.equal(sentMail[0].to, 'recipient@example.test');
  });

  it('rejects a failed email without recording it', async () => {
    const error = new Error('My custom error');
    nodemailermock.mock.setShouldFailOnce();
    nodemailermock.mock.setFailResponse(error);
    await assert.rejects(app.sendEmail(), (received) => received === error);
    assert.equal(nodemailermock.mock.getSentMail().length, 0);
  });
});
```

### Example using Vitest

Use Vitest's `vi.mock()` to replace `nodemailer` with `nodemailer-mock`:

```javascript
/**
 * Vitest Test
 * ./test/my-test.test.mjs
 **/
import { describe, it, beforeEach, expect, vi } from "vitest";
import nodemailermock from "nodemailer-mock";

// Mock nodemailer with nodemailer-mock
vi.mock("nodemailer", () => {
  return import("nodemailer-mock");
});

describe("Tests that send email", () => {
  beforeEach(() => {
    nodemailermock.mock.reset();
  });

  it("should send an email using nodemailer-mock", async () => {
    // import the module under test after mocking
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({});
    await transport.sendMail({ to: "justin@to.com", from: "justin@from.com" });

    // check the mock for our sent emails
    const sentEmails = nodemailermock.mock.getSentMail();
    // there should be one
    expect(sentEmails.length).toBe(1);
    // and it should match the to address
    expect(sentEmails[0].to).toBe("justin@to.com");
  });
});
```

### Example using node:test

Node.js's built-in test runner, [`node:test`](https://nodejs.org/api/test.html),
supports module mocking with the `--experimental-test-module-mocks` flag. The
example selects mock options based on the Node.js version. See the
[CI matrix](https://github.com/doublesharp/nodemailer-mock/blob/main/.github/workflows/ci.yml)
for the versions tested by this project, and choose a version supported by your
installed Nodemailer release.

```javascript
/**
 * node:test Test
 * ./test/my-test.mjs
 *
 * Run with: node --experimental-test-module-mocks --test ./test/my-test.mjs
 **/
import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// Register the mock *before* importing modules that use nodemailer
const nodemailermock = await import("nodemailer-mock");
const namedExports = Object.fromEntries(
  Object.entries(nodemailermock).filter(
    ([name]) => !["default", "__esModule", "module.exports"].includes(name),
  ),
);
const moduleMockOptions = Number.parseInt(process.versions.node, 10) >= 24
  ? { exports: { ...namedExports, default: { ...namedExports } } }
  : { namedExports, defaultExport: { ...namedExports } };

// CommonJS and ESM can resolve to different entry points. Mock each one.
const require = createRequire(import.meta.url);
const entries = [
  import.meta.resolve("nodemailer"),
  pathToFileURL(require.resolve("nodemailer")).href,
];
for (const entry of new Set(entries)) {
  mock.module(entry, moduleMockOptions);
}

// Now import the module under test
const myModule = await import("../my-module.js");

describe("Tests that send email", () => {
  beforeEach(() => {
    nodemailermock.mock.reset();
  });

  it("should send an email using nodemailer-mock", async () => {
    await myModule.sendEmail();

    // check the mock for our sent emails
    const sentEmails = nodemailermock.mock.getSentMail();
    // there should be one
    assert.equal(sentEmails.length, 1);
    // and it should match the to address
    assert.equal(sentEmails[0].to, "recipient@example.test");
  });
});
```
