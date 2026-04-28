'use strict';

const { getMockFor } = require('../../dist/nodemailer-mock');
const nodemailer = require('nodemailer');
module.exports = getMockFor(nodemailer);
