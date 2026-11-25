import nodemailer from 'nodemailer';

export function sendEmail() {
  return nodemailer.createTransport().sendMail({
    from: 'sender@example.test',
    to: 'recipient@example.test',
    subject: 'Welcome',
  });
}
