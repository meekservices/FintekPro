"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_PROMPTS = void 0;
exports.getPrompt = getPrompt;
exports.getPromptSystem = getPromptSystem;
var chat_1 = require("./chat");
var portfolio_1 = require("./portfolio");
var proposal_1 = require("./proposal");
var kyc_1 = require("./kyc");
var compliance_1 = require("./compliance");
var global_advisory_1 = require("./global-advisory");
exports.ALL_PROMPTS = __assign(__assign(__assign(__assign(__assign(__assign({}, chat_1.chatPrompts), portfolio_1.portfolioPrompts), proposal_1.proposalPrompts), kyc_1.kycPrompts), compliance_1.compliancePrompts), global_advisory_1.globalAdvisoryPrompts);
function getPrompt(name) {
    var prompt = exports.ALL_PROMPTS[name];
    if (!prompt) {
        throw new Error("Prompt '".concat(name, "' not found in prompt library"));
    }
    return prompt;
}
function getPromptSystem(name) {
    return getPrompt(name).systemPrompt;
}
