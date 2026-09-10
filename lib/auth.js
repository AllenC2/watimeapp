import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { dbReady, getOne, runQuery } from './db';
import { migrateLegacyWhatsAppFiles } from './legacy-migrate';
import { canClaimLegacyData } from './legacy-claim';
import { passwordRuleError } from './password-rules';
import {
  isAgendaView,
  isHourClock,
  isLanguage,
  isThemeId,
  isTimeZone,
  isWeekStartsOn,
  normalizeUsername,
} from './preferences';
import {
  clearSessionCookieHeader,
  readSessionFromRequest,
  sessionCookieHeader,
  signSession,
} from './session';

const scryptAsync = promisify(scrypt);

export class AuthError extends Error {
  constructor(code = 'errors.unauthorized', status = 401, extra = {}) {
    super(code);
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `${salt.toString('hex')}:${Buffer.from(hash).toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored || '').split(':');
  if (!saltHex || !hashHex) return false;
  const hash = await scryptAsync(password, Buffer.from(saltHex, 'hex'), 64);
  const actual = Buffer.from(hash);
  const expected = Buffer.from(hashHex, 'hex');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function prefsFromUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    theme: isThemeId(user.theme) ? user.theme : 'dark',
    logoDataUrl: user.logo_data_url || '',
    agendaView: isAgendaView(user.agenda_view) ? user.agenda_view : 'month',
    weekStartsOn: isWeekStartsOn(user.week_starts_on) ? user.week_starts_on : 'monday',
    timezone: isTimeZone(user.timezone) ? user.timezone : '',
    hourClock: isHourClock(user.hour_clock) ? user.hour_clock : '24h',
    language: isLanguage(user.language) ? user.language : 'en',
    emailVerified: Boolean(user.email_verified_at),
    showSetup: !user.setup_seen_at,
    showWelcome: !user.welcome_seen_at,
  };
}

export async function requireUser(request) {
  await dbReady;
  const session = await readSessionFromRequest(request);
  if (!session) throw new AuthError();
  const user = await getOne('SELECT * FROM users WHERE id = ?', [session.userId]);
  if (!user) throw new AuthError();
  if (Number(user.session_version || 0) !== Number(session.sv || 0)) throw new AuthError();
  return user;
}

export async function setSessionResponse(response, user) {
  const token = await signSession(user.id, Number(user.session_version || 0));
  response.headers.set('Set-Cookie', sessionCookieHeader(token));
  return response;
}

export function clearSessionResponse(response) {
  response.headers.set('Set-Cookie', clearSessionCookieHeader());
  return response;
}

export { canClaimLegacyData } from './legacy-claim';

export async function assignLegacyDataToUser(user) {
  if (!user?.id || !canClaimLegacyData(user)) return;
  const meta = await getOne(`SELECT value FROM app_meta WHERE key = 'legacy_migrated_user_id'`);
  if (meta?.value) return;
  await runQuery(`UPDATE scheduled_messages SET user_id = ? WHERE user_id IS NULL`, [user.id]);
  await runQuery(`UPDATE contacts SET user_id = ? WHERE user_id IS NULL`, [user.id]);
  await runQuery(`UPDATE templates SET user_id = ? WHERE user_id IS NULL`, [user.id]);
  migrateLegacyWhatsAppFiles(user.id);
  await runQuery(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES ('legacy_migrated_user_id', ?)`,
    [String(user.id)]
  );
}

export function parseRegisterInput(body) {
  const username = normalizeUsername(body.username);
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const confirmPassword = String(body.confirmPassword || '');
  if (!username || username.length < 3) return { error: 'prefs.errorUsername' };
  if (!email || !email.includes('@')) return { error: 'prefs.errorEmail' };
  const passwordError = passwordRuleError(password);
  if (passwordError) return { error: passwordError };
  if (password !== confirmPassword) return { error: 'auth.errorPasswordMatch' };
  if (body.acceptTerms !== true) return { error: 'auth.errorAcceptLegal' };
  return { username, email, password };
}

export function defaultUserColumns() {
  return {
    theme: 'dark',
    agenda_view: 'month',
    week_starts_on: 'monday',
    timezone: '',
    hour_clock: '24h',
    language: 'en',
    logo_data_url: '',
  };
}
