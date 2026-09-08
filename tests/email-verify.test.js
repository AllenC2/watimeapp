import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { verifyRegisterEmail } from '../lib/email-verify.js';

describe('verifyRegisterEmail', () => {
  it('normalizes a valid address', () => {
    assert.deepEqual(verifyRegisterEmail('  Foo.Bar+1@Example.COM '), {
      email: 'foo.bar+1@example.com',
    });
  });

  it('rejects invalid addresses', () => {
    assert.equal(verifyRegisterEmail('not-an-email').error, 'auth.errorEmailInvalid');
    assert.equal(verifyRegisterEmail('a@b').error, 'auth.errorEmailInvalid');
  });
});
