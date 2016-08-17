'use strict'

const debug = require('debug')('nodemailer-mock')
const messages = require('./messages')

const NodemailerMock = function(){

  let successResponse = messages.success_response
  let failResponse = messages.fail_response

  let sentMail = []

  let shouldFail = false
  let shouldFailOnce = false

  const createTransport = function(options){
    debug('createTransport', options)
    return {
      sendMail: function(email, callback) {
        debug('transport.sendMail', email)
        if (shouldFail){
          if (shouldFailOnce){
            shouldFail = shouldFailOnce = false
          }
          const failure = messages.info
          failure.response = failResponse
          debug('transport.sendMail', 'FAIL')
          return callback(failResponse, failure)
        }

        sentMail.push(email)

        const success = messages.info
        success.response = successResponse
        debug('transport.sendMail', 'SUCCESS')
        return callback(null, success)
      },

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
      shouldFailOnce: function(){
        shouldFail = shouldFailOnce = true
      },
      shouldFail: function(isFail){
        shouldFail = isFail
      },
      successResponse: function(response){
        successResponse = response
      },
      failResponse: function(response){
        failResponse = response
      },
      sentMail: function(){
        return sentMail
      },
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