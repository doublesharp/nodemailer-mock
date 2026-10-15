import Debug from 'debug';
import { AsyncLocalStorage } from 'node:async_hooks';
import * as Nodemailer from 'nodemailer';
import {
  Transport,
  Transporter,
  SentMessageInfo,
} from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import MailMessage from 'nodemailer/lib/mailer/mail-message';

import { messages, createFailResponse, MockInfo, MockResponseMode } from './lib/messages';
import { copyInfo, createInfo } from './lib/response';

export type { MockSentMessageInfo, RealisticMockSentMessageInfo, MockInfo, MockResponseMode } from './lib/messages';

const debug = Debug('nodemailer-mock');

// Reusable plugins must accept different transport result types, including the mock's legacy result.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NodemailerMockPlugin = Mail.PluginFunction<any>;
export type CheckMailMessageOrNull = ((email: Parameters<NodemailerMockPlugin>[0]) => boolean) | null;
export type NodemailerType = Pick<typeof Nodemailer, 'createTransport' | 'createTestAccount' | 'getTestMessageUrl'>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NodemailerMockTransportInput = Transport<any> | Mail.Options | { [key: string]: unknown } | string;

export interface MockOptions<Mode extends MockResponseMode = 'legacy'> {
  responseMode?: Mode;
  messageIdGenerator?: () => string;
}

export interface MockResetOptions {
  clearTransporters?: boolean;
}

export type MockQueuedResult<Mode extends MockResponseMode = 'legacy'> =
  { error: Error; info?: never } | { error?: never; info?: Partial<MockInfo<Mode>> };

interface SendContext<Mode extends MockResponseMode> {
  generation: number;
  outcome?: MockQueuedResult<Mode>;
}

// A shared async scope avoids retaining one AsyncLocalStorage instance per transporter.
const sendInvocation = new AsyncLocalStorage<SendContext<MockResponseMode>>();

export interface NodemailerMockTransporter<Mode extends MockResponseMode = 'legacy'>
  extends Transporter<MockInfo<Mode>> {
  nodemailermock: NodemailerMocked<Mode>;
  use(step: string, plugin: NodemailerMockPlugin): this;
  mock: {
    getPlugins: () => {
      [key: string]: NodemailerMockPlugin[];
    };
    getCloseCallCount: () => number;
    setIdle(isIdle: boolean): void;
  };

  sendMail(
    mailOptions: Mail.Options,
    callback: (err: Error | null, info: MockInfo<Mode>) => void
  ): void;
  sendMail(mailOptions: Mail.Options): Promise<MockInfo<Mode>>;
}

export interface NodemailerMock<Mode extends MockResponseMode = 'legacy'> {
  nodemailer: NodemailerType | undefined;
  createTransport: (
    transport?: NodemailerMockTransportInput,
    options?: Mail.Options
  ) => NodemailerMockTransporter<Mode>;
  mock: {
    reset: (options?: MockResetOptions) => void;
    setSentMessageInfo: (info: Partial<MockInfo<Mode>>) => void;
    queueResult: (result: MockQueuedResult<Mode>) => void;
    getTransporters: () => NodemailerMockTransporter<Mode>[];
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

export class NodemailerMocked<Mode extends MockResponseMode = 'legacy'> implements NodemailerMock<Mode> {
  public nodemailer: NodemailerType | undefined;

  private _mockedVerify = true;
  private _mockedClose = true;

  // our response messages
  private _successResponse = messages.success_response;
  private _failResponse = createFailResponse();

  private _transporters: NodemailerMockMail<Mode>[] = [];
  private _generation = 0;
  private _queue: MockQueuedResult<Mode>[] = [];
  private _sentMessageInfo: Partial<MockInfo<Mode>> = {};
  private readonly _messageIdGenerator?: () => string;
  private readonly _responseMode: MockResponseMode;
  private _idleTimers = new Set<ReturnType<typeof setTimeout>>();

  // Sent mail cache
  private _sentMail: Mail.Options[] = [];
  private _closeCount = 0;

  // Should the callback be a success or failure?
  private _shouldFail = false;
  private _shouldFailOnce = false;
  private _shouldFailCheck: CheckMailMessageOrNull = null;
  private _shouldUsePlugins = false;

  constructor(mailer?: NodemailerType, options: MockOptions<Mode> = {}) {
    this.nodemailer = mailer;
    this._responseMode = options.responseMode ?? 'legacy';
    this._messageIdGenerator = options.messageIdGenerator;

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
    transport?: NodemailerMockTransportInput,
    options?: Mail.Options
  ): NodemailerMockTransporter<Mode> => {
    // indicate that we are creating a transport
    debug('createTransport', options);
    const _transport = new NodemailerMockTransport(
      this,
      {
        beginSend: () => ({ generation: this._generation, outcome: this._queue.shift() }),
        createInfo: (email) => createInfo(email, this._responseMode, this._successResponse),
        configureInfo: (info, overrides) => {
          if (this._messageIdGenerator) info.messageId = this._messageIdGenerator();
          return { ...info, ...copyInfo(this._sentMessageInfo), ...copyInfo(overrides ?? {}) };
        },
        failureInfo: (info) => {
          if (this._messageIdGenerator) info.messageId = this._messageIdGenerator();
          return info;
        },
        addSentMail: (mail, generation) => {
          if (generation === this._generation) this._sentMail.push(mail);
        },
        incrementCloseCallCount: () => this._closeCount++,
      },
      transport,
      options
    );
    const _transporter = new NodemailerMockMail(this, _transport, options);
    _transport.nodemailer = _transporter;
    this._transporters.push(_transporter);
    return _transporter;
  };

  public mock = {
    /**
     * Reset behavior and history, preserving factory response configuration.
     * clearTransporters also drops the registry, listeners, and transporter-local counts/idle state.
     * Held transporters and their plugins remain reusable; real transports are not closed.
     */
    reset: (options: MockResetOptions = {}) => {
      this._generation++;
      this._queue = [];
      this._sentMessageInfo = {};
      if (options.clearTransporters) {
        for (const transporter of this._transporters) {
          transporter.removeAllListeners();
          transporter.transporter._closeCallCount = 0;
          transporter.transporter._isIdle = false;
        }
        this._transporters = [];
      }
      for (const timer of this._idleTimers) {
        clearTimeout(timer);
      }
      this._idleTimers.clear();
      this._sentMail = [];
      this._closeCount = 0;
      this._shouldFail = this._shouldFailOnce = false;
      this._successResponse = messages.success_response;
      this._failResponse = createFailResponse();
      this._mockedVerify = true;
      this._mockedClose = true;
      this._shouldFailCheck = null;
      this._shouldUsePlugins = false;
    },
    setSentMessageInfo: (info: Partial<MockInfo<Mode>>) => {
      this._sentMessageInfo = copyInfo(info);
    },
    queueResult: (result: MockQueuedResult<Mode>) => {
      this._queue.push(result.error ? { error: result.error } : { info: copyInfo(result.info ?? {}) });
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
      const timer = setTimeout(() => {
        this._idleTimers.delete(timer);
        // iterate over all transporters and set them to idle
        return this._transporters.forEach((transporter) =>
          transporter.mock.setIdle(isIdle)
        );
      }, timeout);
      this._idleTimers.add(timer);
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

export class NodemailerMockTransport<Mode extends MockResponseMode = 'legacy'> implements Transport<MockInfo<Mode>> {
  public nodemailermock: NodemailerMocked<Mode>;

  public nodemailer: Transporter<MockInfo<Mode>> | undefined;
  public readonly realmailer: Transporter<SentMessageInfo> | undefined;
  public readonly name = 'Nodemailer Mock Transport';
  public readonly version = '0.0.0';

  // handlers passed from the mock to the transport
  private handlers;
  private readonly _sends = new WeakMap<MailMessage<MockInfo<Mode>>, SendContext<Mode>>();

  public withSendContext<T>(send: () => T): T {
    return sendInvocation.run(this.handlers.beginSend(), send);
  }

  public captureSend(email: MailMessage<MockInfo<Mode>>): void {
    const context = sendInvocation.getStore() as SendContext<Mode> | undefined;
    if (context) this._sends.set(email, context);
  }

  public _isIdle = false;
  public _closeCallCount = 0;

  constructor(
    nodemailermock: NodemailerMocked<Mode>,
    handlers: {
      beginSend: () => SendContext<Mode>;
      createInfo: (email: MailMessage<MockInfo<Mode>>) => MockInfo<Mode>;
      configureInfo: (info: MockInfo<Mode>, overrides?: Partial<MockInfo<Mode>>) => MockInfo<Mode>;
      failureInfo: (info: MockInfo<Mode>) => MockInfo<Mode>;
      addSentMail: (mail: Mail.Options, generation: number) => void;
      incrementCloseCallCount: () => void;
    },
    transport?: NodemailerMockTransportInput,
    options?: Mail.Options
  ) {
    this.nodemailermock = nodemailermock;
    this.handlers = handlers;

    // in some mocks the real nodemailer won't be available
    const mailer = nodemailermock.nodemailer ?? Nodemailer;
    /* istanbul ignore else  */
    if (typeof mailer.createTransport === 'function') {
      this.realmailer = mailer.createTransport(transport ?? {}, options);
    }
  }

  /**
   * send an email through this transport
   * @param  {Object}   email
   * @param  {Function} callback
   * @return {void}
   */
  send(
    email: MailMessage<MockInfo<Mode>>,
    callback: (err: Error | null, info: MockInfo<Mode>) => void
  ): void {
    // indicate that sendMail() has been called
    debug('transporter.send', email);
    const context = this._sends.get(email) ?? this.handlers.beginSend();
    this._sends.delete(email);
    let info = this.handlers.createInfo(email);
    const outcome = context.outcome;
    const response = outcome
      ? (outcome.error ? Promise.reject(outcome.error) : Promise.resolve(true))
      : this.determineResponseSuccess(email);

    response.then(() => {
      info = this.handlers.configureInfo(info, outcome?.info);
      this.handlers.addSentMail(email.data, context.generation);
      return info;
    }, (error: unknown) => {
      try {
        info = this.handlers.failureInfo(info);
      } catch {
        // A result generator must not replace the selected send error.
      }
      throw error;
    }).then((result) => {
      debug('transporter.send', 'SUCCESS', result);
      return callback && callback(null, result);
    }, (error: unknown) => {
      info.response = error instanceof Error
        ? error
        : new Error('Failure check threw a non-Error value', { cause: error });
      debug('transporter.send', 'FAIL', info.response, info);
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
  verify(callback: (err: Error | null, success?: true) => void): void;
  verify(
    callback?: (err: Error | null, success?: true) => void
  ): Promise<true> | void {
    const { mock: parent } = this.nodemailermock;
    // should we mock the verify request?
    const isPromise = !callback && typeof Promise === 'function';
    if (!this.realmailer || parent.isMockedVerify()) {
      if (!isPromise) {
        this.determineResponseSuccess()
          .then(
            (): void => callback && callback(null, true),
            (error: Error): void => callback && callback(error)
          );
        return;
      }
      return this.determineResponseSuccess().then((): true => true);
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

  private async determineResponseSuccess(email?: MailMessage<MockInfo<Mode>>) {
    const { mock: parent } = this.nodemailermock;
    // if shouldFailCheck defined use it
    const _shouldFailCheck = parent.getShouldFailCheck();
    if (email && _shouldFailCheck && _shouldFailCheck(email)) {
      throw parent.getFailResponse();
    }
    // determine if we want to return an error
    if (parent.isShouldFail()) {
      // if this is a one time failure, reset the status
      if (parent.isShouldFailOnce()) {
        parent.setShouldFail(false);
        parent.setShouldFailOnce(false);
      }
      throw parent.getFailResponse();
    }
    return true;
  }
}

export class NodemailerMockMail<Mode extends MockResponseMode = 'legacy'>
  extends Mail<MockInfo<Mode>>
  implements NodemailerMockTransporter<Mode>
{
  public mock;
  public nodemailermock: NodemailerMocked<Mode>;
  public transporter: NodemailerMockTransport<Mode>;

  // transport plugins
  private _mockPluginsDefault: {
    [key: string | 'compile' | 'stream']: NodemailerMockPlugin[];
  } = {
    compile: [],
    stream: [],
  };

  private _mockPlugins: Map<string, NodemailerMockPlugin[]> =
    new Map(Object.entries(this._mockPluginsDefault));

  constructor(
    nodemailermock: NodemailerMocked<Mode>,
    transport: NodemailerMockTransport<Mode>,
    defaults?: Mail.Options
  ) {
    super(transport, transport.realmailer?.options, defaults);

    this.nodemailermock = nodemailermock;
    this.transporter = transport;
    // This plugin runs before user plugins, including plugins whose callbacks resume outside the async context.
    super.use('compile', (email, done) => {
      transport.captureSend(email);
      done();
    });

    this.mock = {
      /**
       * get a dictionary of plugins used by this transport
       * @return {{ [key: string]: NodemailerMockPlugin[] }} plugins keyed by the step id
       */
      getPlugins: () => Object.fromEntries(this._mockPlugins),
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

  sendMail(mailOptions: Mail.Options, callback: (err: Error | null, info: MockInfo<Mode>) => void): void;
  sendMail(mailOptions: Mail.Options): Promise<MockInfo<Mode>>;
  sendMail(
    mailOptions: Mail.Options,
    callback?: (err: Error | null, info: MockInfo<Mode>) => void
  ): Promise<MockInfo<Mode>> | void {
    return this.transporter.withSendContext(() => callback
      ? super.sendMail(mailOptions, callback)
      : super.sendMail(mailOptions));
  }

  use(step: string, plugin: NodemailerMockPlugin) {
    const stepId = (step || '').toString();
    let plugins = this._mockPlugins.get(stepId);
    if (typeof plugins !== 'undefined') {
      plugins.push(plugin);
    } else {
      plugins = [plugin];
    }
    this._mockPlugins.set(stepId, plugins);

    return super.use(step, (mail, callback) => {
      if (this.nodemailermock.mock.isUnmockedUsePlugins()) {
        plugin(mail, callback);
      } else {
        callback();
      }
    });
  }
}

// export the mock instance
export const mocked = new NodemailerMocked(Nodemailer);

// expose the mock functions
export const { createTransport, mock, nodemailer } = mocked;
// use this to pass in a real nodemailer instance
export const getMockFor = <Mode extends MockResponseMode = 'legacy'>(
  nodemailer?: NodemailerType, options?: MockOptions<Mode>
) => {
  return new NodemailerMocked(nodemailer, options);
};

export default mocked;
