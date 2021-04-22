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

* `nodemailerMock.mock.reset()`
  * resets the mock class to default values
* `nodemailerMock.mock.getSentMail()`
  * returns an array of sent emails during your tests, since the last reset
* `nodemailerMock.mock.setShouldFailOnce()`
  * will return an error on the next call to `transport.sendMail()`
* `nodemailerMock.mock.setShouldFail({boolean} shouldFail)`
  * indicate if errors should be returned for subsequent calls to `transport.sendMail()`
    * if `true`, return error
    * if `false`, return success
* `nodemailerMock.mock.setShouldFailCheck({Function} (email)=>{})`
  * indicate if the specific email passed to the function should fail the call to `transport.sendMail()`
    * if function returns `true`, return error
    * if function returns `false`, return success
* `nodemailerMock.mock.setMockedVerify({boolean} isMocked)`
  * determine if a call to `transport.verify()` should be mocked or passed through to `nodemailer`
    * if `true`, use a mocked callback
    * if `false`, pass through to a real `nodemailer` transport
* `nodemailerMock.mock.setSuccessResponse({Mixed} success)`
  * set the success message that is returned in the callback for `transport.sendMail()`
* `nodemailerMock.mock.setFailResponse({Error} err)`
  * set the `Error` that is returned in the callback for `transport.sendMail()`

>_Note that the `.mock` methods in previous versions are aliased to the new names._

>_Version 1.5+ returns an `Error` object on error rather than a string._

# usage
The mocked module behaves in a similar fashion to other transports provided by `nodemailer`.

**setup test**
```javascript
const nodemailerMock = require('nodemailer-mock');
const transport = nodemailerMock.createTransport();

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
  console.log('Error!', err);
}

// verify with async / wait
try {
  const info = await transport.verify();
} catch (err) {
  console.log('Error!', err);
}
```
# example tests using mocked module

To use `nodemailer-mock` in your tests you will need to mock `nodemailer` with it. There are working examples using [`jest`](https://www.npmjs.com/package/jest) and [`jest`](https://www.npmjs.com/package/mocha) in the [`./examples/`](https://github.com/doublesharp/nodemailer-mock/tree/master/examples) folder of the project. The `jest` code is in `./examples/__mocks__` and `./examples/__tests__`, and the `mocha` tests are in `./examples/test`. You will need to `npm i -D jest` and/or `npm i -D mockery` to run the examples, and with a shortcut of `npm run example:jest` and `npm run example:mocha`.

## example using jest

To mock `nodemailer` using `jest` create a file called `./__mocks__/nodemailer.js` that exports the mocked module:

```javascript
/** 
 * Jest Mock
 * ./__mocks__/nodemailer.js 
 **/
// load the real nodemailer
const nodemailer = require('nodemailer');
// pass it in when creating the mock using getMockFor()
const nodemailerMock = require('nodemailer-mock').getMockFor(nodemailer);
// export the mocked module
module.exports = nodemailerMock;
```

Once the mock file is created all calls to `nodemailer` from your tests will return the mocked module. To access to mock functions, just load it in your test file.

```javascript
/** 
 * Jest Test
 * ./__tests__/my-test.js 
 **/
const { mock } = require('nodemailer');

test('Send an email using the mocked nodemailer', async () => {
  /* ... run your tests that send emails here */

  // check the mock for our sent emails
  const sentEmails = mock.getSentMail();
  // there should be one
  expect(sentEmails.length).toBe(1);
  // and it should match the to address
  expect(sentEmails[0].to).toBe('justin@to.com');
});
```

## example using mocha and mockery
Here is an example of using a mocked `nodemailer` class in a [`mocha`](https://www.npmjs.com/package/mocha) test using [`mockery`](https://www.npmjs.com/package/mockery). Make sure that any modules that `require()`'s a mocked module must be called AFTER the module is mocked or node will use the unmocked version from the module cache. Note that this example uses `async/await`. See the module tests for additional example code.

```javascript
/** 
 * Mocha Test / Mockery Mock
 * ./test/my-test.js 
 **/
const should = require('should');
const mockery = require('mockery');
const nodemailerMock = require('nodemailer-mock');

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
    will get our nodemailerMock */
    mockery.registerMock('nodemailer', nodemailerMock)
    
    /*
    ##################
    ### IMPORTANT! ###
    ##################
    */
    /* Make sure anything that uses nodemailer is loaded here, 
    after it is mocked just above... */
    const someModuleThatRequiresNodemailer = require('some-module-that-requires-nodemailer');

  });
  
  afterEach(async () {
    // Reset the mock back to the defaults after each test
    nodemailerMock.mock.reset();
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
    response.value.should.be.exactly('value');
    
    // get the array of emails we sent
    const sentMail = nodemailerMock.mock.getSentMail();
    
    // we should have sent one email
    sentMail.length.should.be.exactly(1);
    
    // check the email for something
    sentMail[0].property.should.be.exactly('foobar');
  });
  
  it('should fail to send an email using nodemailer-mock', async () {
    // tell the mock class to return an error
    const err = new Error('My custom error');
    nodemailerMock.mock.setShouldFailOnce();
    nodemailerMock.mock.setFailResponse(err);
  
    // call a service that uses nodemailer
    var response = ... // <-- your code here
    
    // a fake test for something on our response
    response.error.should.be.exactly(err);
  });
  
  /* this will not work with jest as all nodemailers are mocked */
  it('should verify using the real nodemailer transport', async () {
    // tell the mock class to pass verify requests to nodemailer
    nodemailerMock.mock.setMockedVerify(false);
  
    // call a service that uses nodemailer
    var response = ... // <-- your code here
    
    /* calls to transport.verify() will be passed through, 
       transport.sendMail() is still mocked */
  });
});
```
