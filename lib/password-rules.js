export const PASSWORD_SYMBOLS = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~\\';

const LETTER_RE = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/;
const DIGIT_RE = /[0-9]/;
const SYMBOL_RE = /[!@#$%^&*()_+\-=[\]{}|;:'",.<>?/`~\\]/;

export function passwordChecks(password) {
  const value = String(password || '');
  return {
    length: value.length >= 6,
    letter: LETTER_RE.test(value),
    digit: DIGIT_RE.test(value),
    symbol: SYMBOL_RE.test(value),
  };
}

export function isPasswordValid(password) {
  const checks = passwordChecks(password);
  return checks.length && checks.letter && checks.digit && checks.symbol;
}

export function passwordRuleError(password) {
  return isPasswordValid(password) ? null : 'auth.errorPasswordRules';
}

export function passwordStrengthLevel(password) {
  const value = String(password || '');
  if (!value) return 0;
  const checks = passwordChecks(value);
  const met = [checks.length, checks.letter, checks.digit, checks.symbol].filter(Boolean).length;
  if (met < 4) return 1;
  if (value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value)) return 4;
  if (value.length >= 10) return 3;
  return 2;
}
