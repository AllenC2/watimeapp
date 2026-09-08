const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export function verifyRegisterEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) return { error: 'auth.errorEmailInvalid' };
  return { email: normalized };
}
