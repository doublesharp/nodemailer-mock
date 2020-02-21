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
  const _userPlugins = {
    compile: [],
    stream: [],
  };

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
        return reject(new Error('nodemailer-mock fail response'));
      }
      return resolve();
    });
  };

  // return an object with the expected functions
  const createTransport = function createTransport(options) {
    // indicate that we are creating a transport
    debug('createTransport', options);

    transport = nodemailer.createTransport(options);

    return {
      // this will mock the nodemailer.transport.sendMail()
      sendMail: (email, callback) => {
        // indicate that sendMail() has been called
        debug('transport.sendMail', email);
        // support either callback or promise api
        const isPromise = !callback && typeof Promise === 'function';
        // start with a basic info object
        const info = messages.info();
        return determineResponseSuccess()
            .then(() => {
              // Resolve/Success
              // add the email to our cache
              sentMail.push(email);
              // update the response
              info.response = successResponse;
              // indicate that we are sending success
              debug('transport.sendMail', 'SUCCESS', info);
              // return success
              if (isPromise) {
                return Promise.resolve(info);
              }
              return callback(null, info);
            })
            .catch(() => {
              // Reject/Failure
              // update the response
              info.response = failResponse;
              // indicate that we are sending an error
              debug('transport.sendMail', 'FAIL', failResponse, info);
              // return the error
              if (isPromise) {
                return Promise.reject(failResponse);
              }
              return callback(failResponse, info);
            });
      },

      verify: (callback) => {
        // should we mock the verify request?
        if (mockedVerify) {
          // support either callback or promise api
          const isPromise = !callback && typeof Promise === 'function';

          return determineResponseSuccess()
              .then(() => isPromise ? Promise.resolve(successResponse) : callback(null, successResponse))
              .catch(() => isPromise ? Promise.reject(failResponse) : callback(failResponse));
        }
        // use the real nodemailer transport to verify
        return transport.verify(callback);
      },

      use: (step, plugin) => {
        step = (step || '').toString();
        if (!Object.prototype.hasOwnProperty.call(_userPlugins, step)) {
          _userPlugins[step] = [plugin];
        } else {
          _userPlugins[step].push(plugin);
        }

        return;
      },
      // the options this transport was created with
      mock: {
        options,
      },
    };
  };

  // these functions provide test functionality
  const mock = {
    /**
     * determine if sendMail() should return errors once then succeed
     */
    setShouldFailOnce: () => {
      shouldFail = shouldFailOnce = true;
    },

    /**
     * determine if sendMail() should return errors
     * @param  {boolean} isFail true will return errors, false will return successes
     */
    setShouldFail: (isFail) => {
      shouldFail = isFail;
    },

    /**
     * determine if transport.verify() should be mocked or not
     * @param  {boolean} isMocked if the function should be mocked
     */
    setMockedVerify: (isMocked) => {
      mockedVerify = isMocked;
    },

    /**
     * set the response messages for successes
     * @param  {Mixed} response
     */
    setSuccessResponse: (response) => {
      successResponse = response;
    },

    /**
     * set the response messages for failures
     * @param  {Error} error
     */
    setFailResponse: (error) => {
      failResponse = error;
    },

    /**
     * get an array of sent emails
     * @return {Object[]} an array of emails
     */
    getSentMail: () => sentMail,

    /**
     * reset mock values to defaults
     */
    reset: () => {
      sentMail = [];
      shouldFail = shouldFailOnce = false;
      successResponse = messages.success_response;
      failResponse = messages.fail_response;
      mockedVerify = true;
    },
  };

  // legacy aliases
  Object.assign(mock, {
    shouldFailOnce: mock.setShouldFailOnce,
    shouldFail: mock.setShouldFail,
    mockedVerify: mock.setMockedVerify,
    successResponse: mock.setSuccessResponse,
    failResponse: mock.setFailResponse,
    sentMail: mock.getSentMail,
  });

  return {
    // Our mocked transport
    createTransport,
    // Test helper methods
    mock,
  };
}());

module.exports = NodemailerMock;
