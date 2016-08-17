'use strict'

module.exports = {
  success_response: 'Mocked email send success',
  fail_response: 'Mocked email send failure',
  info: {
    messageId: 'messageId',
    envelope: 'envelope',
    accepted: ['accepted'],
    rejected: ['rejected'],
    pending: ['pending'],
    response: this.success_response
  }
}