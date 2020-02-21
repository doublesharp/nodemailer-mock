'use strict';
const crypto = require('crypto');

const successResponse = 'nodemailer-mock success';

module.exports = {
  success_response: successResponse,
  fail_response: new Error('nodemailer-mock failure'),
  info: () => {
    const messageId = crypto.randomBytes(24).toString('hex');
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
