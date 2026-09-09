'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Download, Globe, ImagePlus, KeyRound, Languages, MailCheck, Palette, Shield, SlidersHorizontal, UserRound, X } from 'lucide-react';
import { AGENDA_VIEWS, detectTimeZone, HOUR_CLOCKS, LANGUAGES, THEMES, timeZoneMeta, WEEK_STARTS } from '../lib/preferences';
import { messages, tApiError, translate } from '../lib/i18n';
import { passwordRuleError } from '../lib/password-rules';
import { usePreferences } from './PreferencesProvider';
import { useTour } from './TourProvider';

const MENU_DEFS = [
  { id: 'general', titleKey: 'prefs.menu.general', descKey: 'prefs.menu.generalDesc', icon: SlidersHorizontal },
  { id: 'perfil', titleKey: 'prefs.menu.profile', descKey: 'prefs.menu.profileDesc', icon: UserRound },
  { id: 'estilos', titleKey: 'prefs.menu.styles', descKey: 'prefs.menu.stylesDesc', icon: Palette },
  { id: 'privacidad', titleKey: 'prefs.menu.privacy', descKey: 'prefs.menu.privacyDesc', icon: Shield },
];

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

export default function PreferencesPanel({ onTitleChange }) {
  const { prefs, applyPrefs, updatePrefs, resetLocalData, t, locale } = usePreferences();
  const { startTour } = useTour();
  const [menu, setMenu] = useState('general');
  const [subpage, setSubpage] = useState(null);
  const [username, setUsername] = useState(prefs.username);
  const [email, setEmail] = useState(prefs.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [codeExpiresAt, setCodeExpiresAt] = useState(null);
  const [verifyWait, setVerifyWait] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [onList, setOnList] = useState(true);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmWipeMessages, setConfirmWipeMessages] = useState(false);
  const [wipingMessages, setWipingMessages] = useState(false);
  const [confirmWipeContacts, setConfirmWipeContacts] = useState(false);
  const [wipingContacts, setWipingContacts] = useState(false);
  const [exportingContacts, setExportingContacts] = useState(false);
  const fileRef = useRef(null);
  const zone = timeZoneMeta(prefs.timezone, new Date(), locale);
  const menus = MENU_DEFS.map((item) => ({
    ...item,
    title: t(item.titleKey),
    description: t(item.descKey),
  }));

  const titleFor = (nextMenu, nextSubpage, nextOnList) => {
    if (!isMobile || nextOnList) return t('prefs.back');
    if (nextSubpage === 'password') return t('prefs.passwordTitle');
    if (nextSubpage === 'verify') return t('prefs.verifyEmailTitle');
    return menus.find((entry) => entry.id === nextMenu)?.title || t('prefs.back');
  };

  const goToMenu = (id) => {
    setMenu(id);
    setSubpage(null);
    setError('');
    setMessage('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setVerifyCode('');
    setConfirmWipe(false);
    setConfirmWipeMessages(false);
    setConfirmWipeContacts(false);
    if (isMobile) {
      setOnList(false);
      onTitleChange?.(titleFor(id, null, false));
    }
  };

  const backToList = () => {
    setOnList(true);
    setSubpage(null);
    setError('');
    setMessage('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setVerifyCode('');
    setConfirmWipe(false);
    setConfirmWipeMessages(false);
    setConfirmWipeContacts(false);
    onTitleChange?.(isMobile ? t('prefs.back') : '');
  };

  const openPasswordPage = () => {
    setSubpage('password');
    setError('');
    setMessage('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onTitleChange?.(titleFor(menu, 'password', onList));
  };

  const closePasswordPage = () => {
    setSubpage(null);
    setError('');
    setMessage('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onTitleChange?.(titleFor(menu, null, onList));
  };

  useEffect(() => {
    setUsername(prefs.username);
    setEmail(prefs.email);
  }, [prefs.username, prefs.email]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const apply = () => {
      const mobile = media.matches;
      setIsMobile(mobile);
      if (!mobile) setOnList(true);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!onTitleChange) return;
    if (!isMobile || onList) {
      onTitleChange(isMobile ? t('prefs.back') : '');
      return;
    }
    if (subpage === 'password') {
      onTitleChange(t('prefs.passwordTitle'));
      return;
    }
    if (subpage === 'verify') {
      onTitleChange(t('prefs.verifyEmailTitle'));
      return;
    }
    const item = MENU_DEFS.find((entry) => entry.id === menu);
    onTitleChange(item ? t(item.titleKey) : t('prefs.back'));
  }, [isMobile, onList, menu, subpage, onTitleChange, t]);

  useEffect(() => () => onTitleChange?.(''), [onTitleChange]);

  useEffect(() => {
    if (subpage !== 'verify' || !codeExpiresAt) return undefined;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [subpage, codeExpiresAt]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const nextEmail = email.trim();
    if (!nextEmail || !nextEmail.includes('@')) {
      setError(t('prefs.errorEmail'));
      return;
    }

    try {
      await updatePrefs({ email: nextEmail });
      setMessage(t('prefs.profileUpdated'));
    } catch (err) {
      setError(err.message || t('prefs.errorEmail'));
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t('prefs.errorPasswordFields'));
      return;
    }
    const passwordError = passwordRuleError(newPassword);
    if (passwordError) {
      setError(t(passwordError));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('prefs.errorPasswordConfirm'));
      return;
    }

    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(tApiError(t, data, 'prefs.errorPasswordCurrent'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage(t('prefs.passwordUpdated'));
    } catch (err) {
      setError(err.message);
    }
  };

  const emailMatchesSaved =
    email.trim().toLowerCase() === String(prefs.email || '').trim().toLowerCase();
  const emailIsVerified = Boolean(prefs.emailVerified) && emailMatchesSaved;

  const requestVerifyCode = async () => {
    setError('');
    setVerifyWait(false);
    const res = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: prefs.email }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.expiresAt) setCodeExpiresAt(parseExpiresAt(data.expiresAt));
    if (!res.ok) {
      if (data.code === 'auth.errorVerifyWait') setVerifyWait(true);
      throw new Error(tApiError(t, data, 'auth.errorMailSend'));
    }
    if (data.alreadyVerified) {
      const me = await fetch('/api/auth/me', { cache: 'no-store' });
      if (me.ok) applyPrefs(await me.json());
      setSubpage(null);
      setCodeExpiresAt(null);
      setVerifyWait(false);
      setMessage(t('prefs.emailVerified'));
      return;
    }
    setMessage(t('prefs.verifyEmailSent', { remaining: data.remaining ?? 0 }));
  };

  const openVerifyPage = async () => {
    setSubpage('verify');
    setError('');
    setMessage('');
    setVerifyCode('');
    onTitleChange?.(titleFor(menu, 'verify', onList));
    setVerifyBusy(true);
    try {
      await requestVerifyCode();
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifyBusy(false);
    }
  };

  const closeVerifyPage = () => {
    setSubpage(null);
    setError('');
    setMessage('');
    setVerifyCode('');
    setCodeExpiresAt(null);
    setVerifyWait(false);
    onTitleChange?.(titleFor(menu, null, onList));
  };

  const resendVerifyCode = async () => {
    setError('');
    setVerifyBusy(true);
    try {
      await requestVerifyCode();
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifyBusy(false);
    }
  };

  const saveVerifyCode = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setVerifyBusy(true);
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: prefs.email, code: verifyCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(tApiError(t, data, 'auth.errorVerifyCode'));
      if (data.alreadyVerified) {
        const me = await fetch('/api/auth/me', { cache: 'no-store' });
        if (me.ok) applyPrefs(await me.json());
      } else {
        applyPrefs(data);
      }
      setVerifyCode('');
      setSubpage(null);
      onTitleChange?.(titleFor(menu, null, onList));
      setMessage(t('prefs.emailVerified'));
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifyBusy(false);
    }
  };

  const onLogo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t('prefs.errorLogoType'));
      return;
    }
    if (file.size > 1024 * 1024) {
      setError(t('prefs.errorLogoSize'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updatePrefs({ logoDataUrl: String(reader.result || '') });
      setError('');
      setMessage(t('prefs.logoUpdated'));
    };
    reader.readAsDataURL(file);
  };

  const codeRemainMs = codeExpiresAt ? codeExpiresAt - now : 0;
  const verifyWaitText =
    verifyWait && codeRemainMs > 0
      ? t('auth.errorVerifyWaitActive', { time: formatRemain(codeRemainMs) })
      : error;

  return (
    <div className="prefs-shell" data-view={isMobile ? (onList ? 'list' : 'page') : 'split'}>
      <nav className="prefs-menu" aria-label={t('prefs.nav')}>
        {menus.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className="prefs-menu-item"
              data-active={menu === item.id}
              onClick={() => goToMenu(item.id)}
            >
              <Icon size={18} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="prefs-content">
        {isMobile && subpage !== 'password' && subpage !== 'verify' ? (
          <button type="button" className="prefs-back prefs-back--menus" onClick={backToList}>
            <ChevronLeft size={16} />
            {t('prefs.back')}
          </button>
        ) : null}
        {menu === 'general' ? (
          <div className="prefs-form">
            <h3>{t('prefs.language')}</h3>
            <div className="prefs-view-row">
              {LANGUAGES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="prefs-view"
                  data-active={prefs.language === item.id}
                  onClick={() => {
                    updatePrefs({ language: item.id });
                    setError('');
                    const nextT = (key, vars) => translate(messages, item.id, key, vars);
                    setMessage(nextT('prefs.languageSaved', { label: nextT(`prefs.language.${item.id}`) }));
                  }}
                >
                  <Languages size={18} />
                  <span>
                    <strong>{t(`prefs.language.${item.id}`)}</strong>
                    <small>{t(`prefs.language.${item.id}Desc`)}</small>
                  </span>
                </button>
              ))}
            </div>
            <h3>{t('prefs.timezone')}</h3>
            <div className="prefs-timezone">
              <Globe size={18} aria-hidden="true" />
              <span>
                <strong>{zone.city}</strong>
                <small>
                  {zone.id}
                  {zone.offset ? ` · ${zone.offset}` : ''}
                </small>
              </span>
              <button
                type="button"
                className="prefs-timezone-detect"
                onClick={() => {
                  const timezone = detectTimeZone();
                  updatePrefs({ timezone });
                  setError('');
                  setMessage(t('prefs.timezoneDetected', { city: timeZoneMeta(timezone, new Date(), locale).city }));
                }}
              >
                {t('prefs.detect')}
              </button>
            </div>
            <h3>{t('prefs.hourFormat')}</h3>
            <div className="prefs-view-row">
              {HOUR_CLOCKS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="prefs-view"
                  data-active={prefs.hourClock === item.id}
                  onClick={() => {
                    updatePrefs({ hourClock: item.id });
                    setError('');
                    setMessage(t('prefs.hourApplied', { label: t(item.id === '12h' ? 'prefs.hour.12' : 'prefs.hour.24') }));
                  }}
                >
                  <Clock size={18} />
                  <span>
                    <strong>{t(item.id === '12h' ? 'prefs.hour.12' : 'prefs.hour.24')}</strong>
                    <small>{t(item.id === '12h' ? 'prefs.hour.12Desc' : 'prefs.hour.24Desc')}</small>
                  </span>
                </button>
              ))}
            </div>
            <h3>{t('prefs.weekStart')}</h3>
            <div className="prefs-view-row">
              {WEEK_STARTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="prefs-view"
                  data-active={prefs.weekStartsOn === item.id}
                  onClick={() => {
                    updatePrefs({ weekStartsOn: item.id });
                    setError('');
                    setMessage(t('prefs.weekApplied', { label: t(`prefs.week.${item.id}`) }));
                  }}
                >
                  <CalendarDays size={18} />
                  <span>
                    <strong>{t(`prefs.week.${item.id}`)}</strong>
                    <small>{t(`prefs.week.${item.id}Desc`)}</small>
                  </span>
                </button>
              ))}
            </div>
            <h3>{t('prefs.viewType')}</h3>
            <div className="prefs-view-row">
              {AGENDA_VIEWS.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  className="prefs-view"
                  data-active={prefs.agendaView === view.id}
                  onClick={() => {
                    updatePrefs({ agendaView: view.id });
                    setError('');
                    setMessage(t('prefs.viewApplied', { label: t(`prefs.view.${view.id}`) }));
                  }}
                >
                  <CalendarDays size={18} />
                  <span>
                    <strong>{t(`prefs.view.${view.id}`)}</strong>
                    <small>{t(`prefs.view.${view.id}Desc`)}</small>
                  </span>
                </button>
              ))}
            </div>
            <h3>{t('prefs.tour')}</h3>
            <button type="button" className="prefs-tour-btn" onClick={() => startTour()}>
              {t('prefs.tourStart')}
            </button>
            {error && <p className="prefs-error">{error}</p>}
            {message && <p className="prefs-ok">{message}</p>}
          </div>
        ) : menu === 'perfil' && subpage === 'password' ? (
          <form className="prefs-form" onSubmit={savePassword}>
            <button type="button" className="prefs-back" onClick={closePasswordPage}>
              <ChevronLeft size={16} />
              {t('prefs.menu.profile')}
            </button>
            <h3>{t('prefs.changePassword')}</h3>
            <label>
              {t('prefs.currentPassword')}
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label>
              {t('prefs.newPassword')}
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label>
              {t('prefs.confirmPassword')}
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            {error && <p className="prefs-error">{error}</p>}
            {message && <p className="prefs-ok">{message}</p>}
            <button type="submit" className="btn-primary">
              {t('prefs.savePassword')}
            </button>
          </form>
        ) : menu === 'perfil' && subpage === 'verify' ? (
          <form className="prefs-form" onSubmit={saveVerifyCode}>
            <button type="button" className="prefs-back" onClick={closeVerifyPage}>
              <ChevronLeft size={16} />
              {t('prefs.menu.profile')}
            </button>
            <h3>{t('prefs.verifyEmailTitle')}</h3>
            <p className="prefs-hint">{t('prefs.verifyEmailHint', { email: prefs.email })}</p>
            <label>
              {t('auth.verifyCode')}
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                disabled={verifyBusy}
              />
            </label>
            {error && <p className="prefs-error">{verifyWaitText}</p>}
            {message && <p className="prefs-ok">{message}</p>}
            <button type="submit" className="btn-primary" disabled={verifyBusy || verifyCode.length !== 6}>
              {t('auth.submitVerify')}
            </button>
            <button type="button" className="prefs-back" onClick={resendVerifyCode} disabled={verifyBusy}>
              {t('auth.resendCode')}
            </button>
          </form>
        ) : menu === 'perfil' ? (
          <form className="prefs-form" onSubmit={saveProfile}>
            <h3>{t('prefs.profileInfo')}</h3>
            <label>
              {t('prefs.username')}
              <input
                value={username}
                readOnly
                autoComplete="username"
                spellCheck={false}
              />
              <small>{t('prefs.usernameHint')}</small>
            </label>
            <label>
              <span className="prefs-label-row">
                {t('prefs.email')}
                <span
                  className="prefs-email-badge"
                  data-verified={emailIsVerified ? 'true' : 'false'}
                >
                  {emailIsVerified ? t('prefs.emailVerified') : t('prefs.emailUnverified')}
                </span>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            {!emailIsVerified && emailMatchesSaved ? (
              <button type="button" className="prefs-row-btn" onClick={openVerifyPage} disabled={verifyBusy}>
                <MailCheck size={18} />
                <span>
                  <strong>{t('prefs.verifyEmail')}</strong>
                  <small>{t('prefs.verifyEmailDesc')}</small>
                </span>
                <ChevronRight size={18} />
              </button>
            ) : null}
            <button type="button" className="prefs-row-btn" onClick={openPasswordPage}>
              <KeyRound size={18} />
              <span>
                <strong>{t('prefs.changePassword')}</strong>
                <small>{t('prefs.changePasswordDesc')}</small>
              </span>
              <ChevronRight size={18} />
            </button>
            {error && <p className="prefs-error">{error}</p>}
            {message && <p className="prefs-ok">{message}</p>}
            <button type="submit" className="btn-primary">
              {t('prefs.saveProfile')}
            </button>
          </form>
        ) : menu === 'estilos' ? (
          <div className="prefs-form">
            <h3>{t('prefs.theme')}</h3>
            <div className="prefs-theme-row">
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  className="prefs-theme"
                  data-active={prefs.theme === theme.id}
                  onClick={() => {
                    updatePrefs({ theme: theme.id });
                    setError('');
                    setMessage(t('prefs.themeApplied', { label: t(`prefs.theme.${theme.id}`) }));
                  }}
                >
                  <span className="prefs-theme-swatches" aria-hidden="true">
                    {theme.swatches.map((color) => (
                      <span key={color} style={{ background: color }} />
                    ))}
                  </span>
                  {t(`prefs.theme.${theme.id}`)}
                </button>
              ))}
            </div>

            <h3>{t('prefs.logo')}</h3>
            <div className="prefs-logo">
              {prefs.logoDataUrl ? (
                <img src={prefs.logoDataUrl} alt={t('prefs.logoAlt')} />
              ) : (
                <span>{t('prefs.logoNone')}</span>
              )}
              <div className="prefs-logo-actions">
                <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()}>
                  <ImagePlus size={16} /> {t('prefs.logoChange')}
                </button>
                {prefs.logoDataUrl ? (
                  <button
                    type="button"
                    className="nav-btn"
                    onClick={() => {
                      updatePrefs({ logoDataUrl: '' });
                      if (fileRef.current) fileRef.current.value = '';
                      setMessage(t('prefs.logoReset'));
                    }}
                  >
                    <X size={16} /> {t('prefs.logoRemove')}
                  </button>
                ) : null}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                hidden
                onChange={onLogo}
              />
            </div>
            {error && <p className="prefs-error">{error}</p>}
            {message && <p className="prefs-ok">{message}</p>}
          </div>
        ) : menu === 'privacidad' ? (
          <div className="prefs-form">
            <h3>{t('prefs.privacyLocal')}</h3>
            <p className="prefs-privacy-copy">{t('prefs.privacyLocalCopy')}</p>
            {confirmWipe ? (
              <div className="prefs-privacy-actions">
                <button
                  type="button"
                  className="btn-danger"
                  onClick={async () => {
                    const next = await resetLocalData();
                    setUsername(next.username);
                    setEmail(next.email);
                    setConfirmWipe(false);
                    setError('');
                    setMessage(t('prefs.privacyLocalDone'));
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                >
                  {t('common.confirmDelete')}
                </button>
                <button type="button" className="nav-btn" onClick={() => setConfirmWipe(false)}>
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <button type="button" className="btn-danger" onClick={() => {
                setConfirmWipe(true);
                setConfirmWipeMessages(false);
                setConfirmWipeContacts(false);
                setError('');
                setMessage('');
              }}>
                {t('prefs.privacyLocalAction')}
              </button>
            )}
            <h3>{t('prefs.privacyMessages')}</h3>
            <p className="prefs-privacy-copy">{t('prefs.privacyMessagesCopy')}</p>
            {confirmWipeMessages ? (
              <div className="prefs-privacy-actions">
                <button
                  type="button"
                  className="btn-danger"
                  disabled={wipingMessages}
                  onClick={async () => {
                    setWipingMessages(true);
                    setError('');
                    setMessage('');
                    try {
                      const res = await fetch('/api/schedule?all=1', { method: 'DELETE' });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(tApiError(t, data, 'prefs.privacyMessagesFail'));
                      setConfirmWipeMessages(false);
                      const count = Number(data.deleted) || 0;
                      setMessage(
                        count === 1
                          ? t('prefs.privacyMessagesDoneOne')
                          : t('prefs.privacyMessagesDoneMany', { count })
                      );
                    } catch (err) {
                      setError(err.message || t('prefs.privacyMessagesFail'));
                    } finally {
                      setWipingMessages(false);
                    }
                  }}
                >
                  {wipingMessages ? t('common.deleting') : t('common.confirmDelete')}
                </button>
                <button
                  type="button"
                  className="nav-btn"
                  disabled={wipingMessages}
                  onClick={() => setConfirmWipeMessages(false)}
                >
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  setConfirmWipeMessages(true);
                  setConfirmWipe(false);
                  setConfirmWipeContacts(false);
                  setError('');
                  setMessage('');
                }}
              >
                {t('prefs.privacyMessagesAction')}
              </button>
            )}
            <h3>{t('prefs.privacyContacts')}</h3>
            <p className="prefs-privacy-copy">{t('prefs.privacyContactsCopy')}</p>
            <button
              type="button"
              className="btn-primary"
              disabled={exportingContacts}
              onClick={async () => {
                setExportingContacts(true);
                setError('');
                setMessage('');
                try {
                  const res = await fetch(`/api/contacts?format=csv&lang=${prefs.language}`, { cache: 'no-store' });
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(tApiError(t, data, 'prefs.privacyContactsExportFail'));
                  }
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = t('csv.filename');
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  URL.revokeObjectURL(url);
                  setMessage(t('prefs.privacyContactsExported'));
                } catch (err) {
                  setError(err.message || t('prefs.privacyContactsExportFail'));
                } finally {
                  setExportingContacts(false);
                }
              }}
            >
              <Download size={16} />
              {exportingContacts ? t('prefs.privacyContactsExporting') : t('prefs.privacyContactsExport')}
            </button>
            {confirmWipeContacts ? (
              <div className="prefs-privacy-actions">
                <button
                  type="button"
                  className="btn-danger"
                  disabled={wipingContacts}
                  onClick={async () => {
                    setWipingContacts(true);
                    setError('');
                    setMessage('');
                    try {
                      const res = await fetch('/api/contacts?all=1', { method: 'DELETE' });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(tApiError(t, data, 'prefs.privacyContactsFail'));
                      setConfirmWipeContacts(false);
                      const count = Number(data.deleted) || 0;
                      setMessage(
                        count === 1
                          ? t('prefs.privacyContactsDoneOne')
                          : t('prefs.privacyContactsDoneMany', { count })
                      );
                    } catch (err) {
                      setError(err.message || t('prefs.privacyContactsFail'));
                    } finally {
                      setWipingContacts(false);
                    }
                  }}
                >
                  {wipingContacts ? t('common.deleting') : t('common.confirmDelete')}
                </button>
                <button
                  type="button"
                  className="nav-btn"
                  disabled={wipingContacts}
                  onClick={() => setConfirmWipeContacts(false)}
                >
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  setConfirmWipeContacts(true);
                  setConfirmWipe(false);
                  setConfirmWipeMessages(false);
                  setError('');
                  setMessage('');
                }}
              >
                {t('prefs.privacyContactsAction')}
              </button>
            )}
            {error && <p className="prefs-error">{error}</p>}
            {message && <p className="prefs-ok">{message}</p>}
          </div>
        ) : null}
      </div>
    </div>
  );
}
