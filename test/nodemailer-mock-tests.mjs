'use strict';

import { expect, should } from 'chai';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as nodemailer from 'nodemailer';
import * as mocked from '../dist/nodemailer-mock.mjs';

import { getMockFor } from '../dist/nodemailer-mock.mjs';

should();

describe('callback exceptions', () => {
  for (const method of ['sendMail', 'verify']) {
    it(`should not call ${method} callbacks twice when they throw`, () => {
      const modulePath = createRequire(import.meta.url).resolve('../dist/nodemailer-mock.js');
      const output = execFileSync(process.execPath, ['-e', `
        const { createTransport } = require(${JSON.stringify(modulePath)});
        const transport = createTransport();
        let calls = 0;
        const errors = [];
        process.on('unhandledRejection', error => errors.push(error.message));
        const callback = () => {
          calls++;
          if (calls === 1) throw new Error('callback failure');
        };
        if (${JSON.stringify(method)} === 'sendMail') transport.sendMail({}, callback);
        else transport.verify(callback);
        setImmediate(() => console.log(JSON.stringify({ calls, errors })));
      `], { encoding: 'utf8' });
      expect(JSON.parse(output)).to.deep.equal({ calls: 1, errors: ['callback failure'] });
    });
  }
});

describe('Test MJS', () => {
  describe('module loading', () => {
    it('should allow loading as an ES module', async () => {
      // load the mock using the real one
      const testMock = mocked.getMockFor(nodemailer);
      'undefined'.should.not.equal(typeof testMock);
      // it's the mock one...
      testMock.should.have.property('mock');
    });

    it('should load getMockFor as a function', async () => {
      expect(typeof getMockFor).to.equal('function');
    });
  });
});
