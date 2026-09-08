import { normalizeUsername } from './preferences.js';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function canClaimLegacyData(user, env = process.env) {
  const email = normalizeEmail(env.LEGACY_OWNER_EMAIL);
  const username = normalizeUsername(env.LEGACY_OWNER_USERNAME || '');
  if (!email && !username) return false;
  if (email && normalizeEmail(user.email) === email) return true;
  if (username && normalizeUsername(user.username) === username) return true;
  return false;
}
