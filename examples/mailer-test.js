/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

const nodemailer = require('nodemailer');

module.exports = {
  send: async () => {
    // create a transport
    const transport = nodemailer.createTransport({});
    // send an email
    await transport.sendMail({ to: 'justin@to.com', from: 'justin@from.com' });
  },
};
