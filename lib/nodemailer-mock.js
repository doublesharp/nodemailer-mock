'use strict'

const debug = require('debug')('nodemailer-mock')
const messages = require('./messages')

// this mocks the functionality of nodemailer
const NodemailerMock = function(){

  let successResponse = messages.success_response
  let failResponse = messages.fail_response

  let sentMail = []

  let shouldFail = false
  let shouldFailOnce = false

  const createTransport = function(options){

    // indicate that we are creating a transport
    debug('createTransport', options)

    return {
      
      // this will mock the nodemailer.transport.sendMail()
      sendMail: function(email, callback) {

        // indicate that sendMail() has been called
        debug('transport.sendMail', email)

        // determine if we want to return an error
        if (shouldFail){

          // if this is a one time failure, reset the status
          if (shouldFailOnce){

            shouldFail = shouldFailOnce = false

          }

          // start with a basic info object
          const failure = messages.info
          
          // update the response
          failure.response = failResponse

          // indicate that we are sending an error
          debug('transport.sendMail', 'FAIL', failResponse, failure)

          // return the error
          return callback(failResponse, failure)

        }

        // add the email to our cache
        sentMail.push(email)

        // start with a basic info object
        const success = messages.info

        // update the response
        success.response = successResponse

        // indicate that we are sending success
        debug('transport.sendMail', 'SUCCESS', success)

        // return success
        return callback(null, success)

      },

      // the options this transport was created with
      mock: {

      	options: options

      }

    }

  }

  return {

    // Our mocked transport
    createTransport: createTransport,

    // Test helper methods
    mock: {

      /**
       * determine if sendMail() should return errors once then succeed
       * @return void
       */
      shouldFailOnce: function(){
        shouldFail = shouldFailOnce = true
      },

      /**
       * determine if sendMail() should return errors
       * @param  boolean true will return errors, false will return successes
       * @return void
       */
      shouldFail: function(isFail){
        shouldFail = isFail
      },

      /**
       * set the response messages for successes
       * @param  String|Object response
       * @return void
       */
      successResponse: function(response){
        successResponse = response
      },

      /**
       * set the response messages for failures
       * @param  String|Object response
       * @return void
       */
      failResponse: function(response){
        failResponse = response
      },

      /**
       * get an array of sent emails
       * @return Object[] an array of emails
       */
      sentMail: function(){
        return sentMail
      },

      /**
       * reset mock values to defaults
       * @return void
       */
      reset: function(){

        sentMail = []
        shouldFail = shouldFailOnce = false
        successResponse = messages.success_response
        failResponse = messages.fail_response

      }

    }

  }

}()

module.exports = NodemailerMock