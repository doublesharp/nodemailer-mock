import Debug from 'debug';
import * as Nodemailer from 'nodemailer';
import {
  createTransport as baseCreateTransport,
  Transport,
  Transporter,
  SentMessageInfo,
} from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import MailMessage from 'nodemailer/lib/mailer/mail-message';

import { messages } from './lib/messages';

const debug = Debug('nodemailer-mock');

export type CheckMailMessageOrNull = ((email: MailMessage) => boolean) | null;
export type NodemailerType = typeof Nodemailer;

export interface NodemailerMockTransporter
  extends Transporter<SentMessageInfo> {
  nodemailermock: NodemailerMocked;
  mock: {
    getPlugins: () => {
      [key: string]: Mail.PluginFunction<Mail.Options>[];
    };
    getCloseCallCount: () => number;
    setIdle(isIdle: boolean): void;
  };

  sendMail(
    mailOptions: Mail.Options,
    callback: (err: Error | null, info: SentMessageInfo) => void
  ): void;
  sendMail(mailOptions: Mail.Options): Promise<SentMessageInfo>;
}

export interface NodemailerMock {
  nodemailer: NodemailerType | undefined;
  createTransport: (
    transport?: Transport | Mail.Options | { [key: string]: unknown },
    options?: Mail.Options
  ) => NodemailerMockTransporter;
  mock: {
    reset: () => void;
    getTransporters: () => NodemailerMockTransporter[];
    getSentMail: () => Mail.Options[];
    getCloseCallCount: () => number;
    setShouldFailOnce: (isSet?: boolean) => void;
    isShouldFailOnce: () => boolean;
    setShouldFail: (isFail: boolean) => void;
    isShouldFail: () => boolean;
    setMockedVerify: (isMocked: boolean) => void;
    isMockedVerify: () => boolean;
    setMockedClose: (isMocked: boolean) => void;
    isMockedClose: () => boolean;
    setSuccessResponse: (response: string) => void;
    getSuccessResponse: () => string;
    setFailResponse: (error: Error) => void;
    getFailResponse: () => Error;
    setShouldFailCheck: (check: CheckMailMessageOrNull) => void;
    getShouldFailCheck: () => CheckMailMessageOrNull;
    scheduleIsIdle: (isIdle: boolean, timeout: number) => void;
    setIsIdle: (isIdle: boolean) => void;
    setUnmockedUsePlugins: (isUnmockUsePlugins: boolean) => void;
    isUnmockedUsePlugins: () => boolean;
  };
}

class NodemailerMocked implements NodemailerMock {
  public nodemailer: NodemailerType | undefined;

  private _mockedVerify = true;
  private _mockedClose = true;

  // our response messages
  private _successResponse = messages.success_response;
  private _failResponse = messages.fail_response;

  private _transporters: NodemailerMockTransporter[] = [];

  // Sent mail cache
  private _sentMail: Mail.Options[] = [];
  private _closeCount = 0;

  // Should the callback be a success or failure?
  private _shouldFail = false;
  private _shouldFailOnce = false;
  private _shouldFailCheck: CheckMailMessageOrNull = null;
  private _shouldUsePlugins = false;

  constructor(mailer?: NodemailerType) {
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

  public createTransport = (
    transport?: Transport | Mail.Options | { [key: string]: unknown },
    options?: Mail.Options
  ): NodemailerMockTransporter => {
    // indicate that we are creating a transport
    debug('createTransport', options);
    const _transport = new NodemailerMockTransport(
      this,
      {
        addSentMail: (mail) => this._sentMail.push(mail),
        incrementCloseCallCount: () => this._closeCount++,
      },
      transport,
      options
    );
    const _transporter = new NodemailerMockMail(this, _transport);
    _transport.nodemailer = _transporter;
    this._transporters.push(_transporter);
    return _transporter;
  };

  public mock = {
    /**
     * reset mock values to defaults
     */
    reset: () => {
      this._sentMail = [];
      this._closeCount = 0;
      this._shouldFail = this._shouldFailOnce = false;
      this._successResponse = messages.success_response;
      this._failResponse = messages.fail_response;
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
    setShouldFailOnce: (isSet?: boolean) =>
      (this._shouldFail = this._shouldFailOnce =
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
    setShouldFail: (isFail: boolean) => {
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
    setMockedVerify: (isMocked: boolean) => (this._mockedVerify = isMocked),
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
    setMockedClose: (isMocked: boolean) => (this._mockedClose = isMocked),
    /**
     * determine if transport.close() will be mocked or not
     * @return {boolean} true if the function will be mocked
     */
    isMockedClose: () => this._mockedClose,
    /**
     * set the response messages for successes
     * @param  {string} success
     */
    setSuccessResponse: (success: string) => (this._successResponse = success),
    /**
     * get the response messages for successes
     * @return {string} success
     */
    getSuccessResponse: () => this._successResponse,
    /**
     * set the response messages for failures
     * @param  {Error} failure
     */
    setFailResponse: (failure: Error) => (this._failResponse = failure),
    /**
     * get the response messages for failures
     * @return {Error} failure
     */
    getFailResponse: () => this._failResponse,
    /**
     * set the check function that returns true if a message send should fail
     * @param  {CheckMailMessageOrNull} check
     */
    setShouldFailCheck: (check: CheckMailMessageOrNull) => {
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
    scheduleIsIdle: (isIdle: boolean, timeout: number) => {
      setTimeout(() => {
        // iterate over all transporters and set them to idle
        return this._transporters.forEach((transporter) =>
          transporter.mock.setIdle(isIdle)
        );
      }, timeout);
    },
    /**
     * set the mocked transports to be idle
     * @param isIdle true if the transport should be idle
     * @return {void}
     */
    setIsIdle: (isIdle: boolean) => {
      // iterate over all transporters and set them to idle
      return this._transporters.forEach((transporter) =>
        transporter.mock.setIdle(isIdle)
      );
    },
    /**
     * set if plugins should be used
     * @param {boolean} shouldUsePlugins
     * @return {void}
     */
    setUnmockedUsePlugins: (shouldUsePlugins: boolean) =>
      (this._shouldUsePlugins = shouldUsePlugins),
    /**
     * get if plugins should be used
     * @return {boolean} true if plugins should be used
     */
    isUnmockedUsePlugins: () => this._shouldUsePlugins,
  };
}

export class NodemailerMockTransport implements Transport<SentMessageInfo> {
  public nodemailermock: NodemailerMocked;

  public nodemailer: Transporter<Mail.Options> | undefined;
  public readonly realmailer: Transporter<Mail.Options> | undefined;
  public readonly name = 'Nodemailer Mock Transport';
  public readonly version = '0.0.0';

  // handlers passed from the mock to the transport
  private handlers;

  public _isIdle = false;
  public _closeCallCount = 0;

  constructor(
    nodemailermock: NodemailerMocked,
    handlers: {
      addSentMail: (mail: Mail.Options) => void;
      incrementCloseCallCount: () => void;
    },
    transport?: Transport | Mail.Options,
    options?: Mail.Options
  ) {
    this.nodemailermock = nodemailermock;
    this.handlers = handlers;

    // in some mocks the real nodemailer won't be available
    /* istanbul ignore else  */
    if (typeof baseCreateTransport === 'function') {
      this.realmailer = baseCreateTransport(transport, options);
    }
  }

  /**
   * send an email through this transport
   * @param  {Object}   email
   * @param  {Function} callback
   * @return {void}
   */
  send(
    email: MailMessage<SentMessageInfo>,
    callback: (err: Error | null, info: SentMessageInfo) => void
  ): void {
    // indicate that sendMail() has been called
    debug('transporter.send', email);
    // start with a basic info object
    const info = messages.info();

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

  /**
   * verify that the transport is ready to send emails
   * @param  {Function} callback (optional)
   * @return {Promise | void}
   * @throws {Error} if the transport is not ready
   */
  verify(): Promise<true>;
  verify(callback: (err: Error | null, success: true) => void): void;
  verify(
    callback?: (err: Error | null, success: true) => void
  ): Promise<true> | void {
    const { mock: parent } = this.nodemailermock;
    // should we mock the verify request?
    const isPromise = !callback && typeof Promise === 'function';
    if (!this.realmailer || parent.isMockedVerify()) {
      if (!isPromise) {
        this.determineResponseSuccess()
          .then((): void => callback && callback(null, true))
          .catch(
            (): void => callback && callback(parent.getFailResponse(), true)
          );
        return;
      }
      return this.determineResponseSuccess()
        .then((): Promise<true> => Promise.resolve(true))
        .catch((): Promise<never> => Promise.reject(parent.getFailResponse()));
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
    debug(
      'transport.close()',
      this._closeCallCount,
      this.nodemailermock.mock.getCloseCallCount()
    );
    const { mock: parent } = this.nodemailermock;

    if (this.realmailer && !parent.isMockedClose()) {
      this.realmailer.close();
    }
  }

  private async determineResponseSuccess(email?: MailMessage) {
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

export class NodemailerMockMail
  extends Mail<SentMessageInfo>
  implements NodemailerMockTransporter
{
  public mock;
  public nodemailermock: NodemailerMocked;
  public transporter: NodemailerMockTransport;

  // transport plugins
  private _userPluginsDefault: {
    [key: string | 'compile' | 'stream']: Mail.PluginFunction<Mail.Options>[];
  } = {
    compile: [],
    stream: [],
  };

  private _userPlugins: Map<string, Mail.PluginFunction<Mail.Options>[]> =
    new Map(Object.entries(this._userPluginsDefault));

  constructor(
    nodemailermock: NodemailerMocked,
    transport: NodemailerMockTransport
  ) {
    super(transport);

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
      setIdle: (isIdle: boolean) => {
        if (isIdle) {
          this.transporter._isIdle = true;
          this.emit('idle');
        } else {
          this.transporter._isIdle = false;
        }
      },
    };
  }

  use(step: string, plugin: Mail.PluginFunction<Mail.Options>) {
    const stepId = (step || '').toString();
    let plugins = this._userPlugins.get(stepId);
    if (typeof plugins !== 'undefined') {
      plugins.push(plugin);
    } else {
      plugins = [plugin];
    }
    this._userPlugins.set(stepId, plugins);

    if (this.nodemailermock.mock.isUnmockedUsePlugins()) {
      return super.use(step, plugin);
    }
    return this;
  }
}

// export the mock instance
export const mocked = new NodemailerMocked(Nodemailer);
export default mocked;
// expose the mock functions
export const { createTransport, mock, nodemailer } = mocked;
// use this to pass in a real nodemailer instance
export const getMockFor = (nodemailer?: NodemailerType) => {
  return new NodemailerMocked(nodemailer);
};
