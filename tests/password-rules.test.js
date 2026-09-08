import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isPasswordValid,
  passwordRuleError,
  passwordStrengthLevel,
  passwordChecks,
} from '../lib/password-rules.js';

describe('password-rules', () => {
  it('rejects short or incomplete passwords', () => {
    assert.equal(isPasswordValid('Ab1!'), false);
    assert.equal(isPasswordValid('abcdef'), false);
    assert.equal(isPasswordValid('abcdef1'), false);
    assert.equal(isPasswordValid('abcdef!'), false);
    assert.equal(isPasswordValid('123456!'), false);
    assert.equal(passwordRuleError('secret'), 'auth.errorPasswordRules');
  });

  it('accepts 6+ chars with letter, digit and symbol', () => {
    assert.equal(isPasswordValid('ab12!x'), true);
    assert.equal(passwordRuleError('ab12!x'), null);
    assert.deepEqual(passwordChecks('ab12!x'), {
      length: true,
      letter: true,
      digit: true,
      symbol: true,
    });
  });

  it('treats incomplete passwords as weak and complete ones as fair or better', () => {
    assert.equal(passwordStrengthLevel(''), 0);
    assert.equal(passwordStrengthLevel('abc'), 1);
    assert.equal(passwordStrengthLevel('ab12!x'), 2);
    assert.ok(passwordStrengthLevel('Abcdef12!xyz') >= 3);
  });
});
