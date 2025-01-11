# nodemailer-mock

[![nodemailer-mock](https://img.shields.io/npm/v/nodemailer-mock.svg)](https://www.npmjs.com/package/nodemailer-mock)
![Code Coverage Badge](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/doublesharp/bc53be57c56fa0c0fc80a29164cc22fc/raw/nodemailer-mock__heads_master.json)
![Downloads](https://img.shields.io/npm/dt/nodemailer-mock.svg)

Easy as pie [`nodemailer`](https://www.npmjs.com/package/nodemailer) mock for unit testing your Node.js applications.

# install

```
npm install nodemailer-mock --save-dev
```

```
yarn add -D nodemailer-mock
```

# module loading

Depending on your mock configuration `nodemailer-mock` may, or may not, have access to `nodemailer` when it is loaded. For example, using `mockery` you can replace `nodemailer` with `require('nodemailer-mock')`, however in `jest` you will need to inject `nodemailer` using `module.exports = require('nodemailer-mock').getMockFor(require('nodemailer'));`

# mock api

Use with test suites like [`jest`](https://www.npmjs.com/package/jest) and [`mocha`](https://www.npmjs.com/package/mocha). There are some special methods available on the mocked module to help with testing. They are under the `.mock` key of the mocked [`nodemailer`](https://www.npmjs.com/package/nodemailer).

## `NodemailerMock.mock` functions

- `reset: () => void`
  - resets the mock class to default values
- `getSentMail: () => Mail.Options[]`
  - returns an array of sent emails during your tests, since the last reset
- `getCloseCallCount: () => number`
  - get the number of times the `transporter.close()` was called across all instances
- `setShouldFailOnce: (isSet?: boolean) => void`
  - should the mock return an error on the next call to `transporter.sendMail()` or `transport.send()`
- `isShouldFailOnce: () => boolean`
  - returns status of `setShouldFailOnce(?)`
- `setShouldFail: (isFail?: boolean) => void`
  - indicate if errors should be returned for subsequent calls to `transporter.sendMail()` or `transport.send()`
    - if `true`, return error
    - if `false`, return success
- `isShouldFail: () => boolean`
  - returns status of `setShouldFail()`
- `setShouldFailCheck: (check: CheckMailMessageOrNull) => void`
  - indicate if the specific email passed to the function should fail the call to `transporter.sendMail()` or `transport.send()`
    - if function returns `true`, return error
    - if function returns `false`, return success
  - use `type CheckMailMessageOrNull = ((email: MailMessage) => boolean) | null`
- `getShouldFailCheck: () => CheckMailMessageOrNull`
  - returns the function used to check the `MailMessage` or `null` if it is not set
- `setMockedVerify: (isMocked: boolean) => void`
  - determine if a call to `transport.verify()` should be mocked or passed through to `nodemailer`, defaults to `true`.
    - if `true`, use a mocked callback
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
  - schedule a status change for calls to `transporter.isIdle()` instances
- `setIsIdle: (isIdle: boolean) => void`
  - set the status that is returned by calls to all `transporter.isIdle()` instances
- `setUnmockedUsePlugins: (isUnmockUsePlugins: boolean) => void` default `false`
  - should the plugins added via `transporter.use()` be run outside the mock?
- `isUnmockedUsePlugins: () => boolean`
  - returns the status of `setUnmockedUsePlugins(?)`

## `NodemailerMockTransporter.mock` functions

- `getPlugins: () => { [key: string]: Mail.PluginFunction<Mail.Options>[] }`
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
const email = ... // <-- your email here
```

**use nodestyle callbacks**

```javascript
// send with nodestyle callback
transport.sendMail(email, function(err, info) {
  if (err) {
    return console.log('Error!', err, info);
  }
  return console.log('Success!', info);
}

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
  });
  .catch(function(err) {
    console.log('Error!', err);
  });
```

**use async/await**

```javascript
// send an email with async / wait
try {
  const info = await transport.sendMail(email);
} catch (err) {
  console.log("Error!", err);
}

// verify with async / wait
try {
  const info = await transport.verify();
} catch (err) {
  console.log("Error!", err);
}
```

# example tests using mocked module

To use `nodemailer-mock` in your tests you will need to mock `nodemailer` with it. There are working examples using [`jest`](https://www.npmjs.com/package/jest) and [`mocha`](https://www.npmjs.com/package/mocha) in the [`./examples/`](https://github.com/doublesharp/nodemailer-mock/tree/master/examples) folder of the project. The `jest` code is in `./examples/__mocks__` and `./examples/__tests__`, and the `mocha` tests are in `./examples/test`. Run the examples with `npm run example:jest` and `npm run example:mocha`. Both JavaScript and TypeScript example tests are provided.

## example using jest

To mock `nodemailer` using `jest` create a file called `./__mocks__/nodemailer.js` that exports the mocked module:

```javascript
/**
 * Jest Mock
 * ./__mocks__/nodemailer.js
 **/
// load the real nodemailer
const nodemailer = require("nodemailer");
// pass it in when creating the mock using getMockFor()
const nodemailermock = require("nodemailer-mock").getMockFor(nodemailer);
// export the mocked module
module.exports = nodemailermock;
```

Once the mock file is created all calls to `nodemailer` from your tests will return the mocked module. To access to mock functions, just load it in your test file.

```javascript
/**
 * Jest Test
 * ./__tests__/my-test.js
 **/
const { mock } = require("nodemailer");

test("Send an email using the mocked nodemailer", async () => {
  /* ... run your tests that send emails here */

  // check the mock for our sent emails
  const sentEmails = mock.getSentMail();
  // there should be one
  expect(sentEmails.length).toBe(1);
  // and it should match the to address
  expect(sentEmails[0].to).toBe("justin@to.com");
});
```

Using typescript you can coerce the NodemailerMock type.

```typescript
/**
 * Jest Test
 * ./__tests__/my-test.js
 **/
import { expect, test } from "@jest/globals";
// 'nodemailer' is automatically mocked in ./__mocks__/nodemailer.js
import * as nodemailer from "nodemailer";
import { NodemailerMock } from "nodemailer-mock";
const { mock } = nodemailer as unknown as NodemailerMock;

test("Send an email using the mocked nodemailer + typescript", async () => {
  /* ... run your tests that send emails here */

  // check the mock for our sent emails
  const sentEmails = mock.getSentMail();
  // there should be one
  expect(sentEmails.length).toBe(1);
  // and it should match the to address
  expect(sentEmails[0].to).toBe("justin@to.com");
});
```

## example using mocha and mockery

Here is an example of using a mocked `nodemailer` class in a [`mocha`](https://www.npmjs.com/package/mocha) test using [`mockery`](https://www.npmjs.com/package/mockery). Make sure that any modules that `require()`'s a mocked module must be called AFTER the module is mocked or node will use the unmocked version from the module cache. Note that this example uses `async/await`. See the module tests for additional example code.

```javascript
/**
 * Mocha Test / Mockery Mock
 * ./test/my-test.js
 **/
const { expect } = require('chai');
const mockery = require('mockery');
const nodemailermock = require('nodemailer-mock');

describe('Tests that send email',  async () {

  /* This could be an app, Express, etc. It should be
  instantiated *after* nodemailer is mocked. */
  let app = null;

  before(async () {
    // Enable mockery to mock objects
    mockery.enable({
      warnOnUnregistered: false,
    });

    /* Once mocked, any code that calls require('nodemailer')
    will get our nodemailermock */
    mockery.registerMock('nodemailer', nodemailermock)

    /*
    ##################
    ### IMPORTANT! ###
    ##################
    */
    /* Make sure anything that uses nodemailer is loaded here,
    after it is mocked just above... */
    const moduleThatRequiresNodemailer = require('module-that-requires-nodemailer');

  });

  afterEach(async () {
    // Reset the mock back to the defaults after each test
    nodemailermock.mock.reset();
  });

  after(async () {
    // Remove our mocked nodemailer and disable mockery
    mockery.deregisterAll();
    mockery.disable();
  });

  it('should send an email using nodemailer-mock', async () {
    // call a service that uses nodemailer
    const response = ... // <-- your email code here

    // a fake test for something on our response
    expect(response.value).to.equal('value');

    // get the array of emails we sent
    const sentMail = nodemailermock.mock.getSentMail();

    // we should have sent one email
    expect(sentMail.length).to.equal(1);

    // check the email for something
    expect(sentMail[0].property).to.equal('foobar');
  });

  it('should fail to send an email using nodemailer-mock', async () {
    // tell the mock class to return an error
    const err = new Error('My custom error');
    nodemailermock.mock.setShouldFailOnce();
    nodemailermock.mock.setFailResponse(err);

    // call a service that uses nodemailer
    var response = ... // <-- your code here

    // a fake test for something on our response
    expect(response.error).to.equal(err);
  });

  /* this will not work with jest as all nodemailers are mocked */
  it('should verify using the real nodemailer transport', async () {
    // tell the mock class to pass verify requests to nodemailer
    nodemailermock.mock.setMockedVerify(false);

    // call a service that uses nodemailer
    var response = ... // <-- your code here

    /* calls to transport.verify() will be passed through,
       transporter.send() is still mocked */
  });
});
```
