# nodemailer-mock

[![nodemailer-mock](https://img.shields.io/npm/v/nodemailer-mock.svg)](https://www.npmjs.com/package/nodemailer-mock)
![Build Status](https://jenkins.doublesharp.com/badges/build/nodemailer-mock.svg)
![Code Coverage](https://jenkins.doublesharp.com/badges/coverage/nodemailer-mock.svg)
[![Dependency Status](https://david-dm.org/doublesharp/nodemailer-mock.svg)](https://david-dm.org/doublesharp/nodemailer-mock)
[![Dev Dependency Status](https://david-dm.org/doublesharp/nodemailer-mock/dev-status.svg)](https://david-dm.org/doublesharp/nodemailer-mock?type=dev)
![Downloads](https://img.shields.io/npm/dt/nodemailer-mock.svg)

Mocked nodemailer module for unit testing.

# install


```
npm install nodemailer-mock --save-dev
```

```
yarn add -D nodemailer-mock
```

# mock api
There are some special methods available on the mocked module to help with testing. They are under the `.mock` key of the mocked `nodemailer`.

* `nodemailerMock.mock.reset()`
  * resets the mock class to default values
* `nodemailerMock.mock.getSentMail()`
  * returns an array of sent emails
* `nodemailerMock.mock.setShouldFailOnce()`
  * will return an error on the next call to `transport.sendMail()`
* `nodemailerMock.mock.setShouldFail(true|false)`
  * indicate if errors should be returned for subsequent calls to `transport.sendMail()`
    * if `true`, return error
    * if `false`, return success
* `nodemailerMock.mock.setShouldFailCheck(function(email))`
  * indicate if the specific email should fail the call to `transport.sendMail()`
    * if function returns `true`, return error
    * if function returns `false`, return success
* `nodemailerMock.mock.setMockedVerify(true|false)`
  * determine if a call to `transport.verify()` should be mocked or passed through to `nodemailer`
    * if `true`, use a mocked callback
    * if `false`, pass through to a real `nodemailer` transport
* `nodemailerMock.mock.setSuccessResponse(success)`
  * set the success message that is returned in the callback for `transport.sendMail()`
* `nodemailerMock.mock.setFailResponse(err)`
  * set the err that is returned in the callback for `transport.sendMail()`

>_Note that the `.mock` methods in previous versions are aliased to the new names._

# usage
The mocked module behaves in a similar fashion to other transports provided by `nodemailer`.

**setup test**
```
const nodemailerMock = require('nodemailer-mock');
const transport = nodemailerMock.createTransport();

// the email you want to send
const email = ... // <-- your email here
```

**use nodestyle callbacks**
```
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
```
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
```
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

# example using mocha and mockery
Here is an example of using a mocked `nodemailer` class in a `mocha` test using `mockery`. Make sure that any modules that `require()`'s a mocked module must be called AFTER the module is mocked or node will use the unmocked version from the module cache. Note that this example uses `async/await`. See the module tests for additional example code.

```
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
    const err = 'My custom error';
    nodemailerMock.mock.setShouldFailOnce();
    nodemailerMock.mock.setFailResponse(err);
  
    // call a service that uses nodemailer
    var response = ... // <-- your code here
    
    // a fake test for something on our response
    response.error.should.be.exactly(err);
  });
  
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
