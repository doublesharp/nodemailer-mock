# nodemailer-mock

[![nodemailer-mock](https://img.shields.io/npm/v/nodemailer-mock.svg)](https://www.npmjs.com/package/nodemailer-mock)
![Build Status](https://jenkins.doublesharp.com/badges/build/nodemailer-mock.svg)
![Code Coverage](https://jenkins.doublesharp.com/badges/coverage/nodemailer-mock.svg)
[![Code Climate](https://codeclimate.com/github/doublesharp/nodemailer-mock/badges/gpa.svg)](https://codeclimate.com/github/doublesharp/nodemailer-mock)
[![Issue Count](https://codeclimate.com/github/doublesharp/nodemailer-mock/badges/issue_count.svg)](https://codeclimate.com/github/doublesharp/nodemailer-mock)
![Dependency Status](https://david-dm.org/doublesharp/nodemailer-mock.svg)
![Dev Dependency Status](https://david-dm.org/doublesharp/nodemailer-mock/dev-status.svg)
![Downloads](https://img.shields.io/npm/dt/nodemailer-mock.svg)

Mocked nodemailer module for unit testing.

# install

```
npm install nodemailer-mock --save-dev
```

# mock api
There are some special methods available on the mocked module to help with testing.

* `nodemailerMock.mock.reset()`
  * resets the mock class to default values
* `nodemailerMock.mock.sentMail()`
  * returns an array of sent emails
* `nodemailerMock.mock.shouldFailOnce()`
  * will return an error on the next call to `transport.sendMail()`
* `nodemailerMock.mock.shouldFail(true|false)`
  * indicate if errors should be returned for subsequent calls to `transport.sendMail()`
    * if `true`, return error
    * if `false`, return success
* `nodemailerMock.mock.mockedVerify(true|false)`
  * determine if a call to `transport.verify()` should be mocked or passed through to `nodemailer`
    * if `true`, use a mocked callback
    * if `false`, pass through to a real `nodemailer` transport
* `nodemailerMock.mock.successResponse(success)`
  * set the success message that is returned in the callback for `transport.sendMail()`
* `nodemailerMock.mock.failResponse(err)`
  * set the err that is returned in the callback for `transport.sendMail()`

# usage
The mocked module behaves in a similar fashion to other transports provided by `nodemailer`.

```
'use strict'

const nodemailerMock = require('nodemailer-mock')
const transport = nodemailerMock.createTransport()

// send an email
const email = //... the email you want to send
transport.sendMail(email, function(err, info){
  if (err){
    console.log('Error!', err, info)
  } else {
    console.log('Success!', info)
  }
}

// verify a transport
transport.verify(function(err, success){
  if (err){
    console.log('Error!', err)
  } else {
    console.log('Success!', success)
  }
})
```

# example using mocha and mockery
Here is an example of using a mocked `nodemailer` class in a `mocha` test using `mockery`

```
'use strict'

const should = require('should')
const mockery = require('mockery')
const nodemailerMock = require('nodemailer-mock')

describe('Tests that send email', function(){

  // This could be an app, Express, etc. It should be instantiated *after* nodemailer is mocked.
  let app = null

  before(function(){

    // Enable mockery to mock objects
    mockery.enable({
      warnOnUnregistered: false
    })
    
    // Once mocked, any code that calls require('nodemailer') will get our nodemailerMock
    mockery.registerMock('nodemailer', nodemailerMock)
    
    // Make sure anything that uses nodemailer is loaded here, after it is mocked...

  })
  
  afterEach(function(){

    // Reset the mock back to the defaults after each test
    nodemailerMock.mock.reset()

  })
  
  after(function(){

    // Remove our mocked nodemailer and disable mockery
    mockery.deregisterAll()
    mockery.disable()

  })
  
  it('should send an email using nodemailer-mock', function(done){

    // call a service that uses nodemailer
    var response = ... // <-- your code here
    
    // a fake test for something on our response
    response.value.should.be.exactly('value')
    
    // get the array of emails we sent
    const sentMail = nodemailerMock.mock.sentMail()
    
    // we should have sent one email
    sentMail.length.should.be.exactly(1)
    
    // check the email for something
    sentMail[0].property.should.be.exactly('foobar')
    
    done()

  })
  
  it('should fail to send an email using nodemailer-mock', function(done){

    // tell the mock class to return an error
    const err = 'My custom error'
    nodemailerMock.mock.shouldFailOnce()
    nodemailerMock.mock.failResponse(err)
  
    // call a service that uses nodemailer
    var response = ... // <-- your code here
    
    // a fake test for something on our response
    response.error.should.be.exactly(err)
    
    done()
    
  })
  
  it('should verify using the real nodemailer transport', function(done){

    // tell the mock class to pass verify requests to nodemailer
    nodemailerMock.mock.mockedVerify(false)
  
    // call a service that uses nodemailer
    var response = ... // <-- your code here
    
    /* calls to transport.verify() will be passed through, 
       transport.sendMail() is still mocked */
    
    done()
    
  })

})
```
