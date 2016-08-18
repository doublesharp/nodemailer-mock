'use strict'

const should = require('should')
const messages = require('../lib/messages')
const nodemailer = require('../')
const transport = nodemailer.createTransport({})

describe('Testing nodemailer-mock...', function(){

  beforeEach(function(){

    // Reset the mock to default values after each test
    nodemailer.mock.reset()

  })

  it('should succeed for email sending', function(done){

    // Send an email that should succeed
    transport.sendMail('Email', function(err, info){

      should(err).be.exactly(null)
      info.response.should.be.exactly(messages.success_response)

      done()

    })

  })

  it('should have the sent email available in the mock.sentMail()', function(done){

    // Look for this value in the sentmail cache
    const email = 'Check for this value'

    // Send an email that should succeed
    transport.sendMail(email, function(err, info){

      should(err).be.exactly(null)
      info.response.should.be.exactly(messages.success_response)

      // Check that our email was put into the sentMail cache
      const sentMail = nodemailer.mock.sentMail()
      should(sentMail).not.be.empty()
      sentMail.length.should.be.exactly(1)
      sentMail[0].should.be.exactly(email)

      done()

    })

  })

  it('should fail once then succeed for email sending', function(done){

    // Tell the mock to fail once then succeed (for testing retries, or so you dont have to reset a test)
    nodemailer.mock.shouldFailOnce()

    // Send an email that should fail
    transport.sendMail('Email', function(err, info){

      should(err).be.exactly(messages.fail_response)
      info.response.should.be.exactly(messages.fail_response)

      // Send an email that should succeed
      transport.sendMail('Email', function(err, info){

        should(err).be.exactly(null)
        info.response.should.be.exactly(messages.success_response)

        done()

      })

    })

  })

  it('should fail more than once if not reset', function(done){

    // tell the mock to fail when sending until we tell it to succeed
    nodemailer.mock.shouldFail(true)

    // Send an email that should fail
    transport.sendMail('Email 1', function(err, info){

      should(err).be.exactly(messages.fail_response)
      info.response.should.be.exactly(messages.fail_response)

      // Send another email that should fail
      transport.sendMail('Email 2', function(err, info){

        should(err).be.exactly(messages.fail_response)
        info.response.should.be.exactly(messages.fail_response)

        // tell the mock to succeed when sending
        nodemailer.mock.shouldFail(false)

        // Send an email that should succeed
        transport.sendMail('Email 3', function(err, info){

          should(err).be.exactly(null)
          info.response.should.be.exactly(messages.success_response)

          done()

        })

      })

    })

  })

  it('should have a custom success message', function(done){

    // This is the success message we want it to return
    const customSuccess = 'This is a custom success'
    nodemailer.mock.successResponse(customSuccess)

    // Send an email that should succeed
    transport.sendMail('Email', function(err, info){
    
      should(err).be.exactly(null)
      info.response.should.be.exactly(customSuccess)

      done()
    
    })

  })

  it('should have a custom error message', function(done){

    // This is the error message we want it to return
    const customError = 'This is a custom error'
    nodemailer.mock.failResponse(customError)

    // Tell the mock to fail once then succeed (for testing retries, or so you dont have to reset a test)
    nodemailer.mock.shouldFailOnce()

    // Send an email that should fail
    transport.sendMail('Email', function(err, info){

      should(err).be.exactly(customError)
      info.response.should.be.exactly(customError)

      done()

    })

  })
  
})