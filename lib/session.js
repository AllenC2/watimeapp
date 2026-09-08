const SESSION_TTL_SEC = 7 * 24 * 60 * 60;
export const SESSION_COOKIE = 'wp_session';

export function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET is required in production');
  }
  return 'watime-dev-insecure-secret';
}

function bytesToBase64Url(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i += 1) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function textToBase64Url(text) {
  return bytesToBase64Url(new TextEncoder().encode(text));
}

function base64UrlToText(value) {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSign(data) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getAuthSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return bytesToBase64Url(sig);
}

export async function signSession(userId, sessionVersion = 0) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  const data = textToBase64Url(
    JSON.stringify({
      userId: Number(userId),
      sv: Number(sessionVersion) || 0,
      exp,
    })
  );
  const sig = await hmacSign(data);
  return `${data}.${sig}`;
}

export async function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacSign(data);
  if (!timingSafeEqual(expected, sig)) return null;
  try {
    const parsed = JSON.parse(base64UrlToText(data));
    if (!Number.isInteger(parsed.userId) || parsed.userId <= 0) return null;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    const sv = Number(parsed.sv);
    parsed.sv = Number.isInteger(sv) && sv >= 0 ? sv : 0;
    return parsed;
  } catch {
    return null;
  }
}

export function readCookie(cookieHeader, name) {
  const raw = String(cookieHeader || '');
  const parts = raw.split(';');
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}

export async function readSessionFromRequest(request) {
  const token = readCookie(request.headers.get('cookie'), SESSION_COOKIE);
  return verifySessionToken(token);
}

export function sessionCookieHeader(token) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SEC}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookieHeader() {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}
