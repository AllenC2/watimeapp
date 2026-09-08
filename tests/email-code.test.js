import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashEmailCode, inspectEmailCode, MAX_VERIFY_FAILS } from '../lib/email-code.js';

describe('inspectEmailCode', () => {
  const email = 'user@example.com';
  const now = Date.parse('2026-09-08T18:00:00.000Z');

  function userWithCode(code, extra = {}) {
    return {
      email,
      email_verify_hash: hashEmailCode(email, code),
      email_verify_expires: new Date(now + 15 * 60 * 1000).toISOString(),
      email_verify_fails: 0,
      ...extra,
    };
  }

  it('accepts a matching 6-digit code', () => {
    const result = inspectEmailCode(userWithCode('123456'), '123456', now);
    assert.equal(result.ok, true);
  });

  it('rejects a wrong code and counts a fail', () => {
    const result = inspectEmailCode(userWithCode('123456'), '000000', now);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'auth.errorVerifyCode');
    assert.equal(result.countFail, true);
  });

  it('rejects expired codes without counting a fail', () => {
    const result = inspectEmailCode(
      userWithCode('123456', { email_verify_expires: new Date(now - 1000).toISOString() }),
      '123456',
      now
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, 'auth.errorVerifyExpired');
    assert.equal(result.countFail, false);
  });

  it('locks after too many fails', () => {
    const result = inspectEmailCode(
      userWithCode('123456', { email_verify_fails: MAX_VERIFY_FAILS }),
      '123456',
      now
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, 'auth.errorVerifyLocked');
  });
});
