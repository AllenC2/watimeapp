import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { getAuthSecret, readCookie, signSession, verifySessionToken, SESSION_COOKIE } from '../lib/session.js';

describe('session helpers', () => {
  const previousSecret = process.env.AUTH_SECRET;
  const previousEnv = process.env.NODE_ENV;

  after(() => {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
  });

  it('reads a named cookie from the header', () => {
    const header = `${SESSION_COOKIE}=abc.def; Path=/; Other=1`;
    assert.equal(readCookie(header, SESSION_COOKIE), 'abc.def');
    assert.equal(readCookie(header, 'Other'), '1');
    assert.equal(readCookie('', SESSION_COOKIE), '');
  });

  it('uses a dev fallback when AUTH_SECRET is missing', () => {
    delete process.env.AUTH_SECRET;
    process.env.NODE_ENV = 'development';
    assert.equal(getAuthSecret(), 'watime-dev-insecure-secret');
  });

  it('requires AUTH_SECRET in production', () => {
    delete process.env.AUTH_SECRET;
    process.env.NODE_ENV = 'production';
    assert.throws(() => getAuthSecret(), /AUTH_SECRET is required in production/);
  });

  it('embeds and checks session version', async () => {
    process.env.AUTH_SECRET = 'test-secret';
    process.env.NODE_ENV = 'development';
    const token = await signSession(4, 2);
    const parsed = await verifySessionToken(token);
    assert.equal(parsed.userId, 4);
    assert.equal(parsed.sv, 2);
  });
});
