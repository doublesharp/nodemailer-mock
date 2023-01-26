import { randomBytes } from 'crypto';
import { SentMessageInfo } from 'nodemailer';

const successResponse = 'nodemailer-mock success';

export const messages: {
  readonly success_response: string;
  readonly fail_response: Error;
  readonly info: () => SentMessageInfo;
} = {
  success_response: successResponse,
  fail_response: new Error('nodemailer-mock failure'),
  info: (): SentMessageInfo => {
    const messageId = randomBytes(24).toString('hex');
    return {
      messageId,
      envelope: 'envelope',
      accepted: ['accepted'],
      rejected: ['rejected'],
      pending: ['pending'],
      response: successResponse,
    };
  },
};
