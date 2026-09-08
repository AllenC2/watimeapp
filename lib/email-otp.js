import { randomInt } from 'crypto';
import { AuthError } from './auth';
import { inspectEmailCode, hashEmailCode, MAX_VERIFY_FAILS } from './email-code';
import { messages } from './i18n/messages';
import { sendMail } from './mail';
import { runQuery } from './db';

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_GAP_MS = 45 * 1000;
const MAX_CODES_PER_DAY = 3;

export function isEmailVerified(user) {
  return Boolean(user?.email_verified_at);
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function tMail(language, key, vars = {}) {
  const lang = language === 'en' ? 'en' : 'es';
  let text = messages[lang][key] || messages.es[key] || key;
  Object.entries(vars).forEach(([name, value]) => {
    text = text.replaceAll(`{${name}}`, String(value));
  });
  return text;
}

export async function issueAndSendEmailCode(user) {
  const sentAt = user.email_verify_sent_at ? new Date(user.email_verify_sent_at).getTime() : 0;
  if (sentAt && Date.now() - sentAt < RESEND_GAP_MS) {
    const expiresMs = user.email_verify_expires ? new Date(user.email_verify_expires).getTime() : 0;
    const extra =
      user.email_verify_hash && expiresMs > Date.now()
        ? { expiresAt: user.email_verify_expires }
        : {};
    throw new AuthError('auth.errorVerifyWait', 429, extra);
  }

  const day = todayUtc();
  const count = user.email_verify_day === day ? Number(user.email_verify_day_count || 0) : 0;
  if (count >= MAX_CODES_PER_DAY) {
    throw new AuthError('auth.errorVerifyLimit', 429);
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const now = new Date();
  const expires = new Date(now.getTime() + CODE_TTL_MS);
  await runQuery(
    `UPDATE users SET email_verify_hash = ?, email_verify_expires = ?, email_verify_sent_at = ?, email_verify_fails = 0 WHERE id = ?`,
    [hashEmailCode(user.email, code), expires.toISOString(), now.toISOString(), user.id]
  );

  await sendMail({
    to: user.email,
    subject: tMail(user.language, 'auth.mailCodeSubject'),
    text: tMail(user.language, 'auth.mailCodeBody', { code }),
  }).catch(async (error) => {
    await runQuery(`UPDATE users SET email_verify_sent_at = NULL WHERE id = ?`, [user.id]);
    throw error;
  });

  const nextCount = count + 1;
  await runQuery(
    `UPDATE users SET email_verify_day = ?, email_verify_day_count = ? WHERE id = ?`,
    [day, nextCount, user.id]
  );
  return { remaining: MAX_CODES_PER_DAY - nextCount, expiresAt: expires.toISOString() };
}

export async function consumeEmailCode(user, code) {
  const result = inspectEmailCode(user, code);
  if (!result.ok) {
    if (result.countFail) {
      const fails = Number(user.email_verify_fails || 0) + 1;
      await runQuery(`UPDATE users SET email_verify_fails = ? WHERE id = ?`, [fails, user.id]);
      if (fails >= MAX_VERIFY_FAILS) throw new AuthError('auth.errorVerifyLocked', 429);
    }
    throw new AuthError(result.code, result.code === 'auth.errorVerifyLocked' ? 429 : 400);
  }

  await runQuery(
    `UPDATE users SET
      email_verified_at = ?,
      email_verify_hash = NULL,
      email_verify_expires = NULL,
      email_verify_sent_at = NULL,
      email_verify_fails = 0
     WHERE id = ?`,
    [new Date().toISOString(), user.id]
  );
}
