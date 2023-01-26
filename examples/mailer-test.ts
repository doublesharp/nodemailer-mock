import * as nodemailer from 'nodemailer';

export const mailer: {
  send: () => Promise<void>;
} = {
  send: async () => {
    // create a transport
    const transport = nodemailer.createTransport({});
    // send an email
    await transport.sendMail({ to: 'justin@to.com', from: 'justin@from.com' });
  },
};

export default mailer;
