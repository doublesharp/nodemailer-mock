'use strict';

const debug = require('debug')('nodemailer-mock');
const nodemailer = require('nodemailer');
const messages = require('./lib/messages');

// this mocks the functionality of nodemailer
const NodemailerMock = (function NodemailerMock() {
  // the real nodemailer transport
  let transport = null;
  let mockedVerify = true;
  // our response messages
  let successResponse = messages.success_response;
  let failResponse = messages.fail_response;
  // Sent mail cache
  let sentMail = [];
  // Should the callback be a success or failure?
  let shouldFail = false;
  let shouldFailOnce = false;

  // Determine if the test should return success or failure
  const determineResponseSuccess = function determineResponseSuccess() {
    return new Promise((resolve, reject) => {
      // determine if we want to return an error
      if (shouldFail) {
        // if this is a one time failure, reset the status
        if (shouldFailOnce) {
          shouldFail = shouldFailOnce = false;
        }
        return reject();
      }
      return resolve();
    });
  };

  const createTransport = function createTransport(options) {
    // indicate that we are creating a transport
    debug('createTransport', options);

    transport = nodemailer.createTransport(options);

    return {
      // this will mock the nodemailer.transport.sendMail()
      sendMail: (email, callback) => {
        // indicate that sendMail() has been called
        debug('transport.sendMail', email);
        // start with a basic info object
        const info = messages.info;
        determineResponseSuccess()
        .then(() => {
          // Resolve/Success
          // add the email to our cache
          sentMail.push(email);
          // update the response
          info.response = successResponse;
          // indicate that we are sending success
          debug('transport.sendMail', 'SUCCESS', info);
          // return success
          return callback(null, info);
        })
        .catch(() => {
          // Reject/Failure
          // update the response
          info.response = failResponse;
          // indicate that we are sending an error
          debug('transport.sendMail', 'FAIL', failResponse, info);
          // return the error
          return callback(failResponse, info);
        });
      },

      verify: (callback) => {
        // should we mock the verify request?
        if (mockedVerify) {
          return determineResponseSuccess()
          .then(() => callback(null, successResponse))
          .catch(() => callback(failResponse));
        }
        // use the real nodemailer transport to verify
        return transport.verify(callback);
      },
      // the options this transport was created with
      mock: {
        options,
      },
    };
  };

  return {
    // Our mocked transport
    createTransport,
    // Test helper methods
    mock: {
      /**
       * determine if sendMail() should return errors once then succeed
       * @return void
       */
      shouldFailOnce: () => {
        shouldFail = shouldFailOnce = true;
      },

      /**
       * determine if sendMail() should return errors
       * @param  boolean true will return errors, false will return successes
       * @return void
       */
      shouldFail: (isFail) => {
        shouldFail = isFail;
      },

      /**
       * determine if transport.verify() should be mocked or not
       * @param  {Boolean} isMocked if the function should be mocked
       * @return void
       */
      mockedVerify: (isMocked) => {
        mockedVerify = isMocked;
      },

      /**
       * set the response messages for successes
       * @param  String|Object response
       * @return void
       */
      successResponse: (response) => {
        successResponse = response;
      },

      /**
       * set the response messages for failures
       * @param  String|Object response
       * @return void
       */
      failResponse: (response) => {
        failResponse = response;
      },

      /**
       * get an array of sent emails
       * @return Object[] an array of emails
       */
      sentMail: () => sentMail,

      /**
       * reset mock values to defaults
       * @return void
       */
      reset: () => {
        sentMail = [];
        shouldFail = shouldFailOnce = false;
        successResponse = messages.success_response;
        failResponse = messages.fail_response;
      },
    },
  };
}());

module.exports = NodemailerMock;
