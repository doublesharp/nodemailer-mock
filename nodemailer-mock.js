'use strict';

const debug = require('debug')('nodemailer-mock');
const realmailer = require('nodemailer');
const messages = require('./lib/messages');

// alias old function names to new function names
const setLegacyAliases = (mock) => {
  // legacy aliases
  Object.assign(mock, {
    shouldFailOnce: mock.setShouldFailOnce,
    shouldFail: mock.setShouldFail,
    mockedVerify: mock.setMockedVerify,
    successResponse: mock.setSuccessResponse,
    failResponse: mock.setFailResponse,
    sentMail: mock.getSentMail,
    shouldFailCheck: mock.shouldFailCheck,
  });
};

function NodemailerMock(nodemailer) {
  // the real nodemailer transport
  let transport = null;
  let _mockedVerify = true;

  // our response messages
  let _successResponse = messages.success_response;
  let _failResponse = messages.fail_response;

  // transport plugins
  const _userPluginsDefault = {
    compile: [],
    stream: [],
  };
  let _userPlugins = { ..._userPluginsDefault };
  // Sent mail cache
  let _sentMail = [];

  // Should the callback be a success or failure?
  let _shouldFail = false;
  let _shouldFailOnce = false;
  let _shouldFailCheck = null;

  // Determine if the test should return success or failure
  const determineResponseSuccess = function determineResponseSuccess(email) {
    return new Promise((resolve, reject) => {
      // if shouldFailCheck defined use it
      if (email && _shouldFailCheck && _shouldFailCheck(email)) {
        return reject(new Error('nodemailer-mock fail response'));
      }
      // determine if we want to return an error
      if (_shouldFail) {
        // if this is a one time failure, reset the status
        if (_shouldFailOnce) {
          _shouldFail = _shouldFailOnce = false;
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
    // in some mocks the real nodemailer won't be available
    /* istanbul ignore else  */
    if (typeof nodemailer.createTransport === 'function') {
      transport = nodemailer.createTransport(options);
    }

    return {
      // this will mock the nodemailer.transport.sendMail()
      sendMail: (email, callback) => {
        // indicate that sendMail() has been called
        debug('transport.sendMail', email);
        // support either callback or promise api
        const isPromise = !callback && typeof Promise === 'function';
        // start with a basic info object
        const info = messages.info();
        return determineResponseSuccess(email)
          .then(() => {
            // Resolve/Success
            // add the email to our cache
            _sentMail.push(email);
            // update the response
            info.response = _successResponse;
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
            info.response = _failResponse;
            // indicate that we are sending an error
            debug('transport.sendMail', 'FAIL', _failResponse, info);
            // return the error
            if (isPromise) {
              return Promise.reject(_failResponse);
            }
            return callback(_failResponse, info);
          });
      },

      verify: (callback) => {
        // should we mock the verify request?
        if (!transport || _mockedVerify) {
          // support either callback or promise api
          const isPromise = !callback && typeof Promise === 'function';

          return determineResponseSuccess()
            .then(() =>
              isPromise
                ? Promise.resolve(_successResponse)
                : callback(null, _successResponse)
            )
            .catch(() =>
              isPromise
                ? Promise.reject(_failResponse)
                : callback(_failResponse)
            );
        }
        // use the real nodemailer transport to verify
        return transport.verify(callback);
      },

      use: (step, plugin) => {
        const stepId = (step || '').toString();
        if (!Object.prototype.hasOwnProperty.call(_userPlugins, stepId)) {
          _userPlugins[stepId] = [plugin];
        } else {
          _userPlugins[stepId].push(plugin);
        }

        return;
      },
      // the options this transport was created with
      mock: {
        options,

        /**
         * get a dictionary of plugins used by this transport
         * @return {Object} plugins keyed by the step id
         */
        getPlugins: () => _userPlugins,
      },
    };
  };

  // these functions provide test functionality
  const mock = {
    /**
     * determine if sendMail() should return errors once then succeed
     */
    setShouldFailOnce: () => (_shouldFail = _shouldFailOnce = true),
    /**
     * determine if sendMail() should return errors
     * @param  {boolean} isFail true will return errors, false will return successes
     */
    setShouldFail: (isFail) => (_shouldFail = isFail),
    /**
     * determine if transport.verify() should be mocked or not
     * @param  {boolean} isMocked if the function should be mocked
     */
    setMockedVerify: (isMocked) => (_mockedVerify = isMocked),
    /**
     * set the response messages for successes
     * @param  {Mixed} response
     */
    setSuccessResponse: (response) => (_successResponse = response),
    /**
     * set the response messages for failures
     * @param  {Error} error
     */
    setFailResponse: (error) => (_failResponse = error),
    /**
     * set the check function that returns true if a message send should fail
     * @param  {function} check
     * * */
    setShouldFailCheck: (check) => (_shouldFailCheck = check),
    /**
     * get an array of sent emails
     * @return {Object[]} an array of emails
     */
    getSentMail: () => _sentMail,

    /**
     * reset mock values to defaults
     */
    reset: () => {
      _userPlugins = { ..._userPluginsDefault };
      _sentMail = [];
      _shouldFail = _shouldFailOnce = false;
      _successResponse = messages.success_response;
      _failResponse = messages.fail_response;
      _mockedVerify = true;
      _shouldFailCheck = null;
    },
  };

  setLegacyAliases(mock);

  return {
    // Our mocked transport
    createTransport,
    // Test helper methods
    mock,
    // Will the real nodemailer please stand up
    nodemailer,
  };
}

// this mocks the functionality of nodemailer
module.exports = NodemailerMock(realmailer);

// use this to pass in a real nodemailer instance
module.exports.getMockFor = (nodemailer = realmailer) =>
  NodemailerMock(nodemailer);
