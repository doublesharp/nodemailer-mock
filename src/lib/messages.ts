import { randomBytes } from 'crypto';

/** The mock's fixed result fields, including its legacy error response. */
export interface MockSentMessageInfo {
  messageId: string;
  envelope: string;
  accepted: string[];
  rejected: string[];
  pending: string[];
  response: string | Error;
}

export interface RealisticMockSentMessageInfo extends Omit<MockSentMessageInfo, 'envelope'> {
  envelope: { from: string; to: string[] };
}

export type MockResponseMode = 'legacy' | 'realistic';
export type MockInfo<Mode extends MockResponseMode = 'legacy'> =
  Mode extends 'realistic' ? RealisticMockSentMessageInfo : MockSentMessageInfo;

export const createFailResponse = () => new Error('nodemailer-mock failure');

const successResponse = 'nodemailer-mock success';

export const messages: {
  readonly success_response: string;
  readonly fail_response: Error;
  readonly info: () => MockSentMessageInfo;
} = {
  success_response: successResponse,
  fail_response: createFailResponse(),
  info: (): MockSentMessageInfo => {
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
