(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "crypto"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.messages = void 0;
    const crypto_1 = require("crypto");
    const successResponse = 'nodemailer-mock success';
    exports.messages = {
        success_response: successResponse,
        fail_response: new Error('nodemailer-mock failure'),
        info: () => {
            const messageId = (0, crypto_1.randomBytes)(24).toString('hex');
            return {
                messageId,
                envelope: 'envelope',
                accepted: ['accepted'],
                rejected: ['rejected'],
                pending: ['pending'],
                response: successResponse,
            };
        },
    };
});
