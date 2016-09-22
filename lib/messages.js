'use strict';

module.exports = {
  success_response: 'nodemailer-mock success',
  fail_response: 'nodemailer-mock failure',
  info: {
    messageId: 'messageId',
    envelope: 'envelope',
    accepted: ['accepted'],
    rejected: ['rejected'],
    pending: ['pending'],
    response: this.success_response,
  },
};
