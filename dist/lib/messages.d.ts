import { SentMessageInfo } from 'nodemailer';
export declare const messages: {
    readonly success_response: string;
    readonly fail_response: Error;
    readonly info: () => SentMessageInfo;
};
