/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

// const nodemailermock = require('../../dist/nodemailer-mock');
const { getMockFor, nodemailerLoading } = require('../../dist/nodemailer-mock');
const nodemailer = require('nodemailer');
// if (nodemailerLoading) {
module.exports = getMockFor(nodemailer);
// }
// module.exports = nodemailer;
