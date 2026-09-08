import { createHash } from 'crypto';
import { getAuthSecret } from './session.js';

export const MAX_VERIFY_FAILS = 8;

export function hashEmailCode(email, code) {
  return createHash('sha256')
    .update(`${getAuthSecret()}:${email}:${code}`)
    .digest('hex');
}

export function inspectEmailCode(user, code, now = Date.now()) {
  if (Number(user?.email_verify_fails || 0) >= MAX_VERIFY_FAILS) {
    return { ok: false, code: 'auth.errorVerifyLocked', countFail: false };
  }

  const trimmed = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(trimmed)) {
    return { ok: false, code: 'auth.errorVerifyCode', countFail: true };
  }
  if (!user?.email_verify_hash || !user?.email_verify_expires) {
    return { ok: false, code: 'auth.errorVerifyExpired', countFail: false };
  }
  if (new Date(user.email_verify_expires).getTime() < now) {
    return { ok: false, code: 'auth.errorVerifyExpired', countFail: false };
  }
  if (hashEmailCode(user.email, trimmed) !== user.email_verify_hash) {
    return { ok: false, code: 'auth.errorVerifyCode', countFail: true };
  }
  return { ok: true, code: null, countFail: false };
}
