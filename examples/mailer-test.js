/**
 * This is a test module used in the Jest test example
 */
const nodemailer = require('nodemailer');

module.exports = {
  send: async () => {
    // create a transport
    const transport = nodemailer.createTransport({});
    // send an email
    await transport.sendMail({ to: 'justin@to.com', from: 'justin@from.com' });
  },
};
