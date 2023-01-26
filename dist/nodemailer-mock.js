var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "debug", "nodemailer", "nodemailer", "nodemailer/lib/mailer", "./lib/messages"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getMockFor = exports.nodemailer = exports.mock = exports.createTransport = exports.mocked = exports.NodemailerMockMail = exports.NodemailerMockTransport = void 0;
    const debug_1 = __importDefault(require("debug"));
    const Nodemailer = __importStar(require("nodemailer"));
    const nodemailer_1 = require("nodemailer");
    const mailer_1 = __importDefault(require("nodemailer/lib/mailer"));
    const messages_1 = require("./lib/messages");
    const debug = (0, debug_1.default)('nodemailer-mock');
    class NodemailerMocked {
        constructor(mailer) {
            this._mockedVerify = true;
            this._mockedClose = true;
            // our response messages
            this._successResponse = messages_1.messages.success_response;
            this._failResponse = messages_1.messages.fail_response;
            this._transporters = [];
            // Sent mail cache
            this._sentMail = [];
            this._closeCount = 0;
            // Should the callback be a success or failure?
            this._shouldFail = false;
            this._shouldFailOnce = false;
            this._shouldFailCheck = null;
            this._shouldUsePlugins = false;
            this.createTransport = (transport, options) => {
                // indicate that we are creating a transport
                debug('createTransport', options);
                const _transport = new NodemailerMockTransport(this, {
                    addSentMail: (mail) => this._sentMail.push(mail),
                    incrementCloseCallCount: () => this._closeCount++,
                }, transport, options);
                const _transporter = new NodemailerMockMail(this, _transport);
                _transport.nodemailer = _transporter;
                this._transporters.push(_transporter);
                return _transporter;
            };
            this.mock = {
                /**
                 * reset mock values to defaults
                 */
                reset: () => {
                    this._sentMail = [];
                    this._closeCount = 0;
                    this._shouldFail = this._shouldFailOnce = false;
                    this._successResponse = messages_1.messages.success_response;
                    this._failResponse = messages_1.messages.fail_response;
                    this._mockedVerify = true;
                    this._shouldFailCheck = null;
                    this._shouldUsePlugins = false;
                },
                /**
                 * the transporters that have been created by this mock
                 * @returns {Object[]} an array of transporters
                 */
                getTransporters: () => this._transporters,
                /**
                 * get an array of sent emails
                 * @return {Object[]} an array of emails
                 */
                getSentMail: () => this._sentMail,
                /**
                 * get the number of times close() has been called
                 * @return {number} the number of times close() has been called
                 */
                getCloseCallCount: () => this._closeCount,
                /**
                 * determine if sendMail() should return errors once then succeed
                 */
                setShouldFailOnce: (isSet) => (this._shouldFail = this._shouldFailOnce =
                    typeof isSet !== 'undefined' ? isSet : true),
                /**
                 * determine if nodemailer should return errors once then succeed
                 * @return {boolean} true if sendMail() should return errors once then succeed
                 */
                isShouldFailOnce: () => this._shouldFailOnce,
                /**
                 * determine if sendMail() should return errors
                 * @param  {boolean} isFail true will return errors, false will return successes
                 */
                setShouldFail: (isFail) => {
                    this._shouldFail = isFail;
                    if (!isFail) {
                        this._shouldFailOnce = false;
                    }
                },
                /**
                 * determine if sendMail() should return errors
                 * @return {boolean} true if sendMail() should return errors
                 */
                isShouldFail: () => this._shouldFail,
                /**
                 * determine if transport.verify() should be mocked or not
                 * @param  {boolean} isMocked if the function should be mocked
                 */
                setMockedVerify: (isMocked) => (this._mockedVerify = isMocked),
                /**
                 * determine if transport.verify() should be mocked or not
                 * @return {boolean} true if the function should be mocked
                 */
                isMockedVerify: () => this._mockedVerify,
                /**
                 * determine if transport.close() should be mocked or not
                 * @param  {boolean} isMocked if the function should be mocked
                 * @return {void}
                 */
                setMockedClose: (isMocked) => (this._mockedClose = isMocked),
                /**
                 * determine if transport.close() will be mocked or not
                 * @return {boolean} true if the function will be mocked
                 */
                isMockedClose: () => this._mockedClose,
                /**
                 * set the response messages for successes
                 * @param  {string} success
                 */
                setSuccessResponse: (success) => (this._successResponse = success),
                /**
                 * get the response messages for successes
                 * @return {string} success
                 */
                getSuccessResponse: () => this._successResponse,
                /**
                 * set the response messages for failures
                 * @param  {Error} failure
                 */
                setFailResponse: (failure) => (this._failResponse = failure),
                /**
                 * get the response messages for failures
                 * @return {Error} failure
                 */
                getFailResponse: () => this._failResponse,
                /**
                 * set the check function that returns true if a message send should fail
                 * @param  {CheckMailMessageOrNull} check
                 */
                setShouldFailCheck: (check) => {
                    this._shouldFailCheck = check;
                },
                /**
                 * get the check function that returns true if a message send should fail
                 * @return {CheckMailMessageOrNull} check
                 * @return {boolean} true if the message should fail
                 */
                getShouldFailCheck: () => this._shouldFailCheck,
                /**
                 * schedule the mocked transports to be idle
                 * @param timeout the time in ms to wait before setting the transport to idle
                 */
                scheduleIsIdle: (isIdle, timeout) => {
                    setTimeout(() => {
                        // iterate over all transporters and set them to idle
                        return this._transporters.forEach((transporter) => transporter.mock.setIdle(isIdle));
                    }, timeout);
                },
                /**
                 * set the mocked transports to be idle
                 * @param isIdle true if the transport should be idle
                 * @return {void}
                 */
                setIsIdle: (isIdle) => {
                    // iterate over all transporters and set them to idle
                    return this._transporters.forEach((transporter) => transporter.mock.setIdle(isIdle));
                },
                /**
                 * set if plugins should be used
                 * @param {boolean} shouldUsePlugins
                 * @return {void}
                 */
                setUnmockedUsePlugins: (shouldUsePlugins) => (this._shouldUsePlugins = shouldUsePlugins),
                /**
                 * get if plugins should be used
                 * @return {boolean} true if plugins should be used
                 */
                isUnmockedUsePlugins: () => this._shouldUsePlugins,
            };
            this.nodemailer = mailer;
            // legacy aliases
            Object.assign(this.mock, {
                shouldFailOnce: this.mock.setShouldFailOnce,
                shouldFail: this.mock.setShouldFail,
                mockedVerify: this.mock.setMockedVerify,
                successResponse: this.mock.setSuccessResponse,
                failResponse: this.mock.setFailResponse,
                sentMail: this.mock.getSentMail,
                shouldFailCheck: this.mock.setShouldFailCheck,
            });
        }
    }
    class NodemailerMockTransport {
        constructor(nodemailermock, handlers, transport, options) {
            this.name = 'Nodemailer Mock Transport';
            this.version = '0.0.0';
            this._isIdle = false;
            this._closeCallCount = 0;
            this.nodemailermock = nodemailermock;
            this.handlers = handlers;
            // in some mocks the real nodemailer won't be available
            /* istanbul ignore else  */
            if (typeof nodemailer_1.createTransport === 'function') {
                this.realmailer = (0, nodemailer_1.createTransport)(transport, options);
            }
        }
        /**
         * send an email through this transport
         * @param  {Object}   email
         * @param  {Function} callback
         * @return {void}
         */
        send(email, callback) {
            // indicate that sendMail() has been called
            debug('transporter.send', email);
            // start with a basic info object
            const info = messages_1.messages.info();
            const { mock: parent } = this.nodemailermock;
            this.determineResponseSuccess(email)
                .then(() => {
                // Resolve/Success
                // add the email to our cache
                this.handlers.addSentMail(email.data);
                // update the response
                info.response = parent.getSuccessResponse();
                // indicate that we are sending success
                debug('transporter.send', 'SUCCESS', info);
                // return success
                return callback && callback(null, info);
            })
                .catch(() => {
                // Reject/Failure
                // update the response
                info.response = parent.getFailResponse();
                // indicate that we are sending an error
                debug('transporter.send', 'FAIL', info.response, info);
                // return the error
                return callback && callback(info.response, info);
            });
        }
        verify(callback) {
            const { mock: parent } = this.nodemailermock;
            // should we mock the verify request?
            const isPromise = !callback && typeof Promise === 'function';
            if (!this.realmailer || parent.isMockedVerify()) {
                if (!isPromise) {
                    this.determineResponseSuccess()
                        .then(() => callback && callback(null, true))
                        .catch(() => callback && callback(parent.getFailResponse(), true));
                    return;
                }
                return this.determineResponseSuccess()
                    .then(() => Promise.resolve(true))
                    .catch(() => Promise.reject(parent.getFailResponse()));
            }
            // use the real nodemailer transport to verify
            return typeof callback !== 'undefined'
                ? this.realmailer.verify(callback)
                : this.realmailer.verify();
        }
        isIdle() {
            return this._isIdle;
        }
        close() {
            this._closeCallCount += 1;
            this.handlers.incrementCloseCallCount();
            debug('transport.close()', this._closeCallCount, this.nodemailermock.mock.getCloseCallCount());
            const { mock: parent } = this.nodemailermock;
            if (this.realmailer && !parent.isMockedClose()) {
                this.realmailer.close();
            }
        }
        async determineResponseSuccess(email) {
            const { mock: parent } = this.nodemailermock;
            // if shouldFailCheck defined use it
            const _shouldFailCheck = parent.getShouldFailCheck();
            if (email && _shouldFailCheck && _shouldFailCheck(email)) {
                throw new Error('nodemailer-mock fail response');
            }
            // determine if we want to return an error
            if (parent.isShouldFail()) {
                // if this is a one time failure, reset the status
                if (parent.isShouldFailOnce()) {
                    parent.setShouldFail(false);
                    parent.setShouldFailOnce(false);
                }
                throw new Error('nodemailer-mock fail response');
            }
            return true;
        }
    }
    exports.NodemailerMockTransport = NodemailerMockTransport;
    class NodemailerMockMail extends mailer_1.default {
        constructor(nodemailermock, transport) {
            super(transport);
            // transport plugins
            this._userPluginsDefault = {
                compile: [],
                stream: [],
            };
            this._userPlugins = new Map(Object.entries(this._userPluginsDefault));
            this.nodemailermock = nodemailermock;
            this.transporter = transport;
            this.mock = {
                /**
                 * get a dictionary of plugins used by this transport
                 * @return {{ [key: string]: Mail.PluginFunction<Mail.Options>[] }} plugins keyed by the step id
                 */
                getPlugins: () => Object.fromEntries(this._userPlugins),
                getCloseCallCount: () => {
                    return this.transporter._closeCallCount;
                },
                setIdle: (isIdle) => {
                    if (isIdle) {
                        this.transporter._isIdle = true;
                        this.emit('idle');
                    }
                    else {
                        this.transporter._isIdle = false;
                    }
                },
            };
        }
        use(step, plugin) {
            const stepId = (step || '').toString();
            let plugins = this._userPlugins.get(stepId);
            if (typeof plugins !== 'undefined') {
                plugins.push(plugin);
            }
            else {
                plugins = [plugin];
            }
            this._userPlugins.set(stepId, plugins);
            if (this.nodemailermock.mock.isUnmockedUsePlugins()) {
                return super.use(step, plugin);
            }
            return this;
        }
    }
    exports.NodemailerMockMail = NodemailerMockMail;
    // export the mock instance
    exports.mocked = new NodemailerMocked(Nodemailer);
    exports.default = exports.mocked;
    // expose the mock functions
    exports.createTransport = exports.mocked.createTransport, exports.mock = exports.mocked.mock, exports.nodemailer = exports.mocked.nodemailer;
    // use this to pass in a real nodemailer instance
    const getMockFor = (nodemailer) => {
        return new NodemailerMocked(nodemailer);
    };
    exports.getMockFor = getMockFor;
});
