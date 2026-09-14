# nodemailer-mock

[![nodemailer-mock](https://img.shields.io/npm/v/nodemailer-mock.svg)](https://www.npmjs.com/package/nodemailer-mock)
[![Code Coverage Badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fdoublesharp.github.io%2Fnodemailer-mock%2Fcoverage-badge.json)](https://doublesharp.github.io/nodemailer-mock/coverage/)
![Downloads](https://img.shields.io/npm/dt/nodemailer-mock.svg)

Easy as pie [`nodemailer`](https://www.npmjs.com/package/nodemailer) mock for unit testing your Node.js applications.

[Changelog](CHANGELOG.md) · [Contributing](https://github.com/doublesharp/nodemailer-mock/blob/main/CONTRIBUTING.md) ·
[Release runplan](https://github.com/doublesharp/nodemailer-mock/blob/main/docs/RELEASING.md)

This release supports Nodemailer 6, 7, 8, 9, and 10, as declared in
[`package.json`](package.json)'s `peerDependencies`. Use a Node.js version supported
by your installed Nodemailer version. Nodemailer 10 bundles TypeScript declarations;
for supported versions without bundled declarations, install a matching
`@types/nodemailer` version in TypeScript projects.

The exported `MockSentMessageInfo` type describes the mock's result, including its
placeholder envelope and the `Error` returned in `info.response` for failed sends.
For explicit mock transporter annotations, use `NodemailerMockTransporter` or
`Transporter<MockSentMessageInfo>` to preserve the mock's result type. Standard
Nodemailer plugins and failure checks can be passed to the mock.

# install

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

# module loading

Use `require('nodemailer-mock')` in CommonJS or
`import nodemailermock from 'nodemailer-mock'` in ESM. The default mock is shared
within the loaded module. Reset it between tests or create an independent mock:

```javascript
const { getMockFor } = require('nodemailer-mock');
const nodemailermock = getMockFor(require('nodemailer'));
```

`getMockFor(nodemailer)` returns a new mock with its own state and uses the supplied
Nodemailer module to create underlying transports. Replace `nodemailer` before
loading application code that imports it. With Jest, inject the real module from
`jest.requireActual('nodemailer')` in the manual mock shown below.

# mock api

Use with test suites like [`jest`](https://www.npmjs.com/package/jest), [`mocha`](https://www.npmjs.com/package/mocha), [`vitest`](https://www.npmjs.com/package/vitest), and [`node:test`](https://nodejs.org/api/test.html). There are some special methods available on the mocked module to help with testing. They are under the `.mock` key of the mocked [`nodemailer`](https://www.npmjs.com/package/nodemailer).

## `createTransport(transportOptions?, defaults?)`

Returns a mocked Nodemailer transporter. You can omit the options, supply a
transport/options object, or use an SMTP URL. The second argument provides message
defaults; values passed to `sendMail()` override them.

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

## `NodemailerMock.mock` functions

- `reset: () => void`
  - clears sent mail and the aggregate close count; restores failure settings, responses, mocked verify/close behavior, and disabled user plugins
  - cancels pending idle changes scheduled with `scheduleIsIdle()`
  - retains created transporters, their registered plugins, their individual close counts, and their current idle states
- `getTransporters: () => NodemailerMockTransporter[]`
  - returns the transporters created by this mock, including those created before `reset()`
- `getSentMail: () => Mail.Options[]`
  - returns successfully sent message options, including applied defaults and plugin changes, since the last reset
- `getCloseCallCount: () => number`
  - get the number of times the `transporter.close()` was called across all instances
- `setShouldFailOnce: (isSet?: boolean) => void`
  - sets a one-time failure for the next mocked send or verification; defaults to `true` when omitted
  - passing `false` clears the one-time and persistent failure flags
- `isShouldFailOnce: () => boolean`
  - returns status of `setShouldFailOnce(?)`
- `setShouldFail: (isFail: boolean) => void`
  - indicate if errors should be returned for subsequent mocked send or verification calls
    - `true` enables forced failures
    - `false` clears forced and one-time failures; per-message checks still apply
- `isShouldFail: () => boolean`
  - returns status of `setShouldFail()`
- `setShouldFailCheck: (check: CheckMailMessageOrNull) => void`
  - indicate if the specific email passed to the function should fail the call to `transporter.sendMail()` or `transport.send()`
    - if function returns `true`, return error
    - if function returns `false`, the normal failure flags still apply
  - receives a Nodemailer mail message; inspect fields such as `mail.data.to`
  - runs before the normal failure flags; a failure here does not consume a one-time failure
  - pass `null` to clear the check; it is not called by `verify()`
  - use the exported `CheckMailMessageOrNull` type; checks may use standard Nodemailer `MailMessage` types
  - thrown `Error` objects are returned unchanged; other thrown values are wrapped in an `Error` with the original `cause`
- `getShouldFailCheck: () => CheckMailMessageOrNull`
  - returns the function used to check the `MailMessage` or `null` if it is not set
- `setMockedVerify: (isMocked: boolean) => void`
  - determine if a call to `transport.verify()` should be mocked or passed through to `nodemailer`, defaults to `true`.
    - if `true`, return a mocked callback or Promise result
    - if `false`, pass through to a real `nodemailer` transport
- `isMockedVerify: () => boolean`
  - returns status of `setMockedVerify(?)`
- `setMockedClose: (isMocked: boolean) => void`
  - determine if calls to `transporter.close()` should be passed through to the underlying transport, defaults to `true`.
- `isMockedClose: () => boolean`
  - when the result is `true` the underlying transport is not used, when `false` the call is passed through.
- `setSuccessResponse: (response: string) => void`
  - set the success message that is returned in the callback for `transporter.sendMail()` or `transport.send()`
- `getSuccessResponse: () => string`
  - returns the success message value
- `setFailResponse: (error: Error) => void`
  - set the `Error` that is returned in the callback for `transporter.sendMail()` or `transport.send()`
- `getFailResponse: () => Error`
  - returns the fail `Error` value
- `scheduleIsIdle: (isIdle: boolean, timeout: number) => void`
  - after `timeout` milliseconds, update the idle state of all transporters created by this mock
- `setIsIdle: (isIdle: boolean) => void`
  - update the idle state of all currently created transporters; `true` also emits their `idle` events
- `setUnmockedUsePlugins: (isUnmockUsePlugins: boolean) => void` default `false`
  - run registered user plugins when `true`; skip their execution when `false`
  - Nodemailer's built-in processing still runs
  - checked when each plugin runs, so it also applies to plugins already registered; `reset()` disables them
- `isUnmockedUsePlugins: () => boolean`
  - returns the status of `setUnmockedUsePlugins(?)`

## `NodemailerMockTransporter.mock` functions

- `getPlugins: () => { [key: string]: NodemailerMockPlugin[] }`
  - returns the plugins that have been added via `transporter.use()` as arrays, keyed by step
- `getCloseCallCount: () => number`
  - get the number of times `close()` has been called on this transporter. this number is not reset with the mock.
- `setIdle(isIdle: boolean): void`
  - sets the idle state of `transporter.isIdle()` and emits an `idle` event when the `isIdle` argument is `true`.

# usage

The mocked module behaves in a similar fashion to other transports provided by `nodemailer`.

**setup test**

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

**use nodestyle callbacks**

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

**use promises**

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

**use async/await**

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

# example tests using mocked module

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

## example using jest

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

## example using mocha

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

## example using vitest

To mock `nodemailer` using [`vitest`](https://www.npmjs.com/package/vitest), use `vi.mock()` to replace `nodemailer` with `nodemailer-mock`:

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

## example using node:test

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
