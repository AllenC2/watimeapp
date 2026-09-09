'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { dateLocale, messages, tApiError, translate } from '../lib/i18n';
import {
  DEFAULT_PREFS,
  PREFS_STORAGE_KEY,
  applyLanguage,
  applyTheme,
  detectTimeZone,
  readPrefs,
  shouldAdoptBrowserTimeZone,
  writePrefs,
} from '../lib/preferences';

const PreferencesContext = createContext(null);

async function logoutRequest() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    /* still leave */
  }
  try {
    window.localStorage.removeItem(PREFS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.location.href = '/login';
}

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  useEffect(() => {
    const cached = readPrefs();
    applyTheme(cached.theme);
    applyLanguage(cached.language);

    let cancelled = false;
    (async () => {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (cancelled) return;
      if (!res.ok) {
        const onAuthPage =
          window.location.pathname === '/login' || window.location.pathname === '/registro';
        if (!onAuthPage && res.status === 401) {
          await logoutRequest();
          return;
        }
        setPrefs({ ...DEFAULT_PREFS, theme: cached.theme, language: cached.language, username: '', email: '' });
        return;
      }
      const data = await res.json();
      let next = data;
      if (shouldAdoptBrowserTimeZone(data.timezone)) {
        const timezone = detectTimeZone();
        if (timezone && timezone !== data.timezone) {
          const save = await fetch('/api/preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timezone }),
          });
          if (save.ok) next = await save.json();
          else next = { ...data, timezone };
        }
      }
      if (cancelled) return;
      setPrefs(next);
      writePrefs({ theme: next.theme, language: next.language });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const t = useCallback(
    (key, vars) => translate(messages, prefs.language, key, vars),
    [prefs.language]
  );

  const applyPrefs = useCallback((data) => {
    setPrefs(data);
    writePrefs({ theme: data.theme, language: data.language });
  }, []);

  const updatePrefs = useCallback(async (patch) => {
    const res = await fetch('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(tApiError(t, data, 'auth.errorGeneric'));
    }
    setPrefs(data);
    writePrefs({ theme: data.theme, language: data.language });
    return data;
  }, [t]);

  const value = useMemo(
    () => ({
      prefs,
      t,
      locale: dateLocale(prefs.language),
      applyPrefs,
      updatePrefs,
      logout: logoutRequest,
      resetLocalData: async () => {
        const next = await updatePrefs({
          theme: DEFAULT_PREFS.theme,
          logoDataUrl: '',
          agendaView: DEFAULT_PREFS.agendaView,
          weekStartsOn: DEFAULT_PREFS.weekStartsOn,
          hourClock: DEFAULT_PREFS.hourClock,
          language: DEFAULT_PREFS.language,
        });
        return next;
      },
    }),
    [prefs, t, applyPrefs, updatePrefs]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences debe usarse dentro de PreferencesProvider');
  }
  return context;
}
