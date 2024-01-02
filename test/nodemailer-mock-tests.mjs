'use strict';

import { expect, should } from 'chai';
import * as nodemailer from 'nodemailer';
import * as mocked from '../dist/nodemailer-mock.mjs';

import { getMockFor } from '../dist/nodemailer-mock.mjs';

should();

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
