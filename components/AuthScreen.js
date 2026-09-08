'use client';

import { useEffect, useState } from 'react';
import { usePreferences } from './PreferencesProvider';
import { DEFAULT_LOGO_SRC } from '../lib/preferences';
import { tApiError } from '../lib/i18n';
import { passwordRuleError, passwordStrengthLevel } from '../lib/password-rules';

function parseExpiresAt(value) {
  const ms = new Date(value || '').getTime();
  return Number.isFinite(ms) ? ms : null;
}

function formatRemain(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const STRENGTH_KEYS = ['', 'auth.passwordStrengthWeak', 'auth.passwordStrengthFair', 'auth.passwordStrengthGood', 'auth.passwordStrengthStrong'];

export default function AuthScreen({ initialMode = 'login' }) {
  const { t } = usePreferences();
  const [mode, setMode] = useState(initialMode === 'register' ? 'register' : 'login');
  const isRegister = mode === 'register';
  const isVerify = mode === 'verify';
  const [pendingEmail, setPendingEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [registerPassword, setRegisterPassword] = useState('');
  const strengthLevel = isRegister && !isVerify ? passwordStrengthLevel(registerPassword) : 0;

  useEffect(() => {
    if (!isVerify || !expiresAt) return undefined;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isVerify, expiresAt]);

  const remainMs = expiresAt ? expiresAt - now : 0;
  const codeExpired = Boolean(isVerify && expiresAt && remainMs <= 0);

  const goVerify = (email, message = '', nextExpiresAt = null) => {
    setPendingEmail(email);
    setExpiresAt(parseExpiresAt(nextExpiresAt));
    setMode('verify');
    setError(message);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const form = new FormData(event.currentTarget);

    try {
      if (isVerify) {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: pendingEmail,
            code: String(form.get('code') || ''),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(tApiError(t, data, 'auth.errorGeneric'));
          return;
        }
        if (data.alreadyVerified) {
          window.location.assign('/login');
          return;
        }
        window.location.assign('/');
        return;
      }

      const payload = isRegister
        ? {
            username: String(form.get('username') || ''),
            email: String(form.get('email') || ''),
            password: String(form.get('password') || ''),
            confirmPassword: String(form.get('confirmPassword') || ''),
          }
        : {
            identifier: String(form.get('identifier') || ''),
            password: String(form.get('password') || ''),
          };

      if (isRegister) {
        const passwordError = passwordRuleError(payload.password);
        if (passwordError) {
          setError(t(passwordError));
          return;
        }
      }

      const res = await fetch(isRegister ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (data.needsVerification && data.email) {
        goVerify(
          data.email,
          res.ok ? '' : tApiError(t, data, 'auth.errorEmailUnverified'),
          data.expiresAt
        );
        return;
      }
      if (!res.ok) {
        setError(tApiError(t, data, 'auth.errorGeneric'));
        return;
      }
      window.location.assign('/');
    } catch {
      setError(t('auth.errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(tApiError(t, data, 'auth.errorGeneric'));
        return;
      }
      if (data.expiresAt) setExpiresAt(parseExpiresAt(data.expiresAt));
    } catch {
      setError(t('auth.errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="glass-panel auth-card">
        <img
          src={DEFAULT_LOGO_SRC}
          alt={t('brand.alt')}
          className="auth-logo"
          data-default="true"
        />
        {isVerify ? null : (
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!isRegister}
              data-active={!isRegister}
              onClick={() => {
                setMode('login');
                setError('');
                setRegisterPassword('');
              }}
            >
              {t('auth.login')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isRegister}
              data-active={isRegister}
              onClick={() => {
                setMode('register');
                setError('');
                setRegisterPassword('');
              }}
            >
              {t('auth.register')}
            </button>
          </div>
        )}
        <header className="auth-header">
          <h1>
            {isVerify
              ? t('auth.verifyTitle')
              : isRegister
                ? t('auth.registerTitle')
                : t('auth.loginTitle')}
          </h1>
          <p>
            {isVerify
              ? t('auth.verifySubtitle', { email: pendingEmail })
              : isRegister
                ? t('auth.registerSubtitle')
                : t('auth.loginSubtitle')}
          </p>
          {isVerify && expiresAt ? (
            <p className="auth-code-timer" data-expired={codeExpired ? 'true' : 'false'} aria-live="polite">
              {codeExpired
                ? t('auth.verifyExpired')
                : t('auth.verifyExpires', { time: formatRemain(remainMs) })}
            </p>
          ) : null}
        </header>
        <form className="auth-form" onSubmit={onSubmit}>
          {isVerify ? (
            <div className="form-group">
              <label htmlFor="auth-code">{t('auth.verifyCode')}</label>
              <input
                id="auth-code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
              />
            </div>
          ) : isRegister ? (
            <>
              <div className="form-group">
                <label htmlFor="auth-username">{t('prefs.username')}</label>
                <input
                  id="auth-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  spellCheck={false}
                  placeholder={t('auth.usernamePlaceholder')}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="auth-email">{t('prefs.email')}</label>
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('auth.emailPlaceholder')}
                  required
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label htmlFor="auth-identifier">{t('auth.loginIdentifier')}</label>
              <input
                id="auth-identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                spellCheck={false}
                placeholder={t('auth.identifierPlaceholder')}
                required
              />
            </div>
          )}
          {isVerify ? null : (
            <div className="form-group">
              <label htmlFor="auth-password">{t('auth.password')}</label>
              <input
                id="auth-password"
                key={isRegister ? 'register-password' : 'login-password'}
                name="password"
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                value={isRegister ? registerPassword : undefined}
                onChange={isRegister ? (e) => setRegisterPassword(e.target.value) : undefined}
              />
              {isRegister ? (
                <div
                  className="auth-strength"
                  data-level={String(strengthLevel)}
                  aria-live="polite"
                >
                  <div className="auth-strength-bars" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <small className="auth-strength-hint">{t('auth.passwordHint')}</small>
                  {strengthLevel ? (
                    <small className="auth-strength-label">{t(STRENGTH_KEYS[strengthLevel])}</small>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
          {isRegister && !isVerify ? (
            <div className="form-group">
              <label htmlFor="auth-confirm">{t('auth.confirmPassword')}</label>
              <input
                id="auth-confirm"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
              />
            </div>
          ) : null}
          {error ? <p className="prefs-error">{error}</p> : null}
          <button type="submit" className="btn-primary" disabled={busy}>
            {isVerify
              ? t('auth.submitVerify')
              : isRegister
                ? t('auth.submitRegister')
                : t('auth.submitLogin')}
          </button>
          {isVerify ? (
            <button type="button" className="auth-resend" disabled={busy} onClick={resendCode}>
              {t('auth.resendCode')}
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
