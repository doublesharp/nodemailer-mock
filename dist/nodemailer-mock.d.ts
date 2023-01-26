import * as Nodemailer from 'nodemailer';
import { Transport, Transporter, SentMessageInfo } from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import MailMessage from 'nodemailer/lib/mailer/mail-message';
export type CheckMailMessageOrNull = ((email: MailMessage) => boolean) | null;
export type NodemailerType = typeof Nodemailer;
export interface NodemailerMockTransporter extends Transporter<SentMessageInfo> {
    nodemailermock: NodemailerMocked;
    mock: {
        getPlugins: () => {
            [key: string]: Mail.PluginFunction<Mail.Options>[];
        };
        getCloseCallCount: () => number;
        setIdle(isIdle: boolean): void;
    };
    sendMail(mailOptions: Mail.Options, callback: (err: Error | null, info: SentMessageInfo) => void): void;
    sendMail(mailOptions: Mail.Options): Promise<SentMessageInfo>;
}
export interface NodemailerMock {
    nodemailer: NodemailerType | undefined;
    createTransport: (transport?: Transport | Mail.Options | {
        [key: string]: unknown;
    }, options?: Mail.Options) => NodemailerMockTransporter;
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
declare class NodemailerMocked implements NodemailerMock {
    nodemailer: NodemailerType | undefined;
    private _mockedVerify;
    private _mockedClose;
    private _successResponse;
    private _failResponse;
    private _transporters;
    private _sentMail;
    private _closeCount;
    private _shouldFail;
    private _shouldFailOnce;
    private _shouldFailCheck;
    private _shouldUsePlugins;
    constructor(mailer?: NodemailerType);
    createTransport: (transport?: Mail.Options | Nodemailer.Transport<any> | {
        [key: string]: unknown;
    } | undefined, options?: Mail.Options) => NodemailerMockTransporter;
    mock: {
        /**
         * reset mock values to defaults
         */
        reset: () => void;
        /**
         * the transporters that have been created by this mock
         * @returns {Object[]} an array of transporters
         */
        getTransporters: () => NodemailerMockTransporter[];
        /**
         * get an array of sent emails
         * @return {Object[]} an array of emails
         */
        getSentMail: () => Mail.Options[];
        /**
         * get the number of times close() has been called
         * @return {number} the number of times close() has been called
         */
        getCloseCallCount: () => number;
        /**
         * determine if sendMail() should return errors once then succeed
         */
        setShouldFailOnce: (isSet?: boolean) => boolean;
        /**
         * determine if nodemailer should return errors once then succeed
         * @return {boolean} true if sendMail() should return errors once then succeed
         */
        isShouldFailOnce: () => boolean;
        /**
         * determine if sendMail() should return errors
         * @param  {boolean} isFail true will return errors, false will return successes
         */
        setShouldFail: (isFail: boolean) => void;
        /**
         * determine if sendMail() should return errors
         * @return {boolean} true if sendMail() should return errors
         */
        isShouldFail: () => boolean;
        /**
         * determine if transport.verify() should be mocked or not
         * @param  {boolean} isMocked if the function should be mocked
         */
        setMockedVerify: (isMocked: boolean) => boolean;
        /**
         * determine if transport.verify() should be mocked or not
         * @return {boolean} true if the function should be mocked
         */
        isMockedVerify: () => boolean;
        /**
         * determine if transport.close() should be mocked or not
         * @param  {boolean} isMocked if the function should be mocked
         * @return {void}
         */
        setMockedClose: (isMocked: boolean) => boolean;
        /**
         * determine if transport.close() will be mocked or not
         * @return {boolean} true if the function will be mocked
         */
        isMockedClose: () => boolean;
        /**
         * set the response messages for successes
         * @param  {string} success
         */
        setSuccessResponse: (success: string) => string;
        /**
         * get the response messages for successes
         * @return {string} success
         */
        getSuccessResponse: () => string;
        /**
         * set the response messages for failures
         * @param  {Error} failure
         */
        setFailResponse: (failure: Error) => Error;
        /**
         * get the response messages for failures
         * @return {Error} failure
         */
        getFailResponse: () => Error;
        /**
         * set the check function that returns true if a message send should fail
         * @param  {CheckMailMessageOrNull} check
         */
        setShouldFailCheck: (check: CheckMailMessageOrNull) => void;
        /**
         * get the check function that returns true if a message send should fail
         * @return {CheckMailMessageOrNull} check
         * @return {boolean} true if the message should fail
         */
        getShouldFailCheck: () => CheckMailMessageOrNull;
        /**
         * schedule the mocked transports to be idle
         * @param timeout the time in ms to wait before setting the transport to idle
         */
        scheduleIsIdle: (isIdle: boolean, timeout: number) => void;
        /**
         * set the mocked transports to be idle
         * @param isIdle true if the transport should be idle
         * @return {void}
         */
        setIsIdle: (isIdle: boolean) => void;
        /**
         * set if plugins should be used
         * @param {boolean} shouldUsePlugins
         * @return {void}
         */
        setUnmockedUsePlugins: (shouldUsePlugins: boolean) => boolean;
        /**
         * get if plugins should be used
         * @return {boolean} true if plugins should be used
         */
        isUnmockedUsePlugins: () => boolean;
    };
}
export declare class NodemailerMockTransport implements Transport<SentMessageInfo> {
    nodemailermock: NodemailerMocked;
    nodemailer: Transporter<Mail.Options> | undefined;
    readonly realmailer: Transporter<Mail.Options> | undefined;
    readonly name = "Nodemailer Mock Transport";
    readonly version = "0.0.0";
    private handlers;
    _isIdle: boolean;
    _closeCallCount: number;
    constructor(nodemailermock: NodemailerMocked, handlers: {
        addSentMail: (mail: Mail.Options) => void;
        incrementCloseCallCount: () => void;
    }, transport?: Transport | Mail.Options, options?: Mail.Options);
    /**
     * send an email through this transport
     * @param  {Object}   email
     * @param  {Function} callback
     * @return {void}
     */
    send(email: MailMessage<SentMessageInfo>, callback: (err: Error | null, info: SentMessageInfo) => void): void;
    /**
     * verify that the transport is ready to send emails
     * @param  {Function} callback (optional)
     * @return {Promise | void}
     * @throws {Error} if the transport is not ready
     */
    verify(): Promise<true>;
    verify(callback: (err: Error | null, success: true) => void): void;
    isIdle(): boolean;
    close(): void;
    private determineResponseSuccess;
}
export declare class NodemailerMockMail extends Mail<SentMessageInfo> implements NodemailerMockTransporter {
    mock: {
        /**
         * get a dictionary of plugins used by this transport
         * @return {{ [key: string]: Mail.PluginFunction<Mail.Options>[] }} plugins keyed by the step id
         */
        getPlugins: () => {
            [k: string]: Mail.PluginFunction<Mail.Options>[];
        };
        getCloseCallCount: () => number;
        setIdle: (isIdle: boolean) => void;
    };
    nodemailermock: NodemailerMocked;
    transporter: NodemailerMockTransport;
    private _userPluginsDefault;
    private _userPlugins;
    constructor(nodemailermock: NodemailerMocked, transport: NodemailerMockTransport);
    use(step: string, plugin: Mail.PluginFunction<Mail.Options>): this;
}
export declare const mocked: NodemailerMocked;
export default mocked;
export declare const createTransport: (transport?: Mail.Options | Nodemailer.Transport<any> | {
    [key: string]: unknown;
} | undefined, options?: Mail.Options) => NodemailerMockTransporter, mock: {
    /**
     * reset mock values to defaults
     */
    reset: () => void;
    /**
     * the transporters that have been created by this mock
     * @returns {Object[]} an array of transporters
     */
    getTransporters: () => NodemailerMockTransporter[];
    /**
     * get an array of sent emails
     * @return {Object[]} an array of emails
     */
    getSentMail: () => Mail.Options[];
    /**
     * get the number of times close() has been called
     * @return {number} the number of times close() has been called
     */
    getCloseCallCount: () => number;
    /**
     * determine if sendMail() should return errors once then succeed
     */
    setShouldFailOnce: (isSet?: boolean) => boolean;
    /**
     * determine if nodemailer should return errors once then succeed
     * @return {boolean} true if sendMail() should return errors once then succeed
     */
    isShouldFailOnce: () => boolean;
    /**
     * determine if sendMail() should return errors
     * @param  {boolean} isFail true will return errors, false will return successes
     */
    setShouldFail: (isFail: boolean) => void;
    /**
     * determine if sendMail() should return errors
     * @return {boolean} true if sendMail() should return errors
     */
    isShouldFail: () => boolean;
    /**
     * determine if transport.verify() should be mocked or not
     * @param  {boolean} isMocked if the function should be mocked
     */
    setMockedVerify: (isMocked: boolean) => boolean;
    /**
     * determine if transport.verify() should be mocked or not
     * @return {boolean} true if the function should be mocked
     */
    isMockedVerify: () => boolean;
    /**
     * determine if transport.close() should be mocked or not
     * @param  {boolean} isMocked if the function should be mocked
     * @return {void}
     */
    setMockedClose: (isMocked: boolean) => boolean;
    /**
     * determine if transport.close() will be mocked or not
     * @return {boolean} true if the function will be mocked
     */
    isMockedClose: () => boolean;
    /**
     * set the response messages for successes
     * @param  {string} success
     */
    setSuccessResponse: (success: string) => string;
    /**
     * get the response messages for successes
     * @return {string} success
     */
    getSuccessResponse: () => string;
    /**
     * set the response messages for failures
     * @param  {Error} failure
     */
    setFailResponse: (failure: Error) => Error;
    /**
     * get the response messages for failures
     * @return {Error} failure
     */
    getFailResponse: () => Error;
    /**
     * set the check function that returns true if a message send should fail
     * @param  {CheckMailMessageOrNull} check
     */
    setShouldFailCheck: (check: CheckMailMessageOrNull) => void;
    /**
     * get the check function that returns true if a message send should fail
     * @return {CheckMailMessageOrNull} check
     * @return {boolean} true if the message should fail
     */
    getShouldFailCheck: () => CheckMailMessageOrNull;
    /**
     * schedule the mocked transports to be idle
     * @param timeout the time in ms to wait before setting the transport to idle
     */
    scheduleIsIdle: (isIdle: boolean, timeout: number) => void;
    /**
     * set the mocked transports to be idle
     * @param isIdle true if the transport should be idle
     * @return {void}
     */
    setIsIdle: (isIdle: boolean) => void;
    /**
     * set if plugins should be used
     * @param {boolean} shouldUsePlugins
     * @return {void}
     */
    setUnmockedUsePlugins: (shouldUsePlugins: boolean) => boolean;
    /**
     * get if plugins should be used
     * @return {boolean} true if plugins should be used
     */
    isUnmockedUsePlugins: () => boolean;
}, nodemailer: typeof Nodemailer | undefined;
export declare const getMockFor: (nodemailer?: NodemailerType) => NodemailerMocked;
