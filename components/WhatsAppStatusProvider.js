'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePreferences } from './PreferencesProvider';
import { tApiError } from '../lib/i18n';

const STORAGE_KEY = 'watime-wa-status';

export const CHECKING = {
  state: 'connecting',
  phone: '',
  phoneLabel: '',
  platform: '',
  platformLabel: '',
  name: '',
  connected: false,
  connecting: true,
  qrDataUrl: null,
  hasSession: false,
  error: '',
};

export const EMPTY = {
  state: 'offline',
  phone: '',
  phoneLabel: '',
  platform: '',
  platformLabel: '',
  name: '',
  connected: false,
  connecting: false,
  qrDataUrl: null,
  hasSession: false,
  error: '',
};

function readSnapshot() {
  if (typeof window === 'undefined') return CHECKING;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return CHECKING;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return CHECKING;
    return { ...CHECKING, ...data, qrDataUrl: null };
  } catch {
    return CHECKING;
  }
}

function writeSnapshot(status) {
  try {
    const { qrDataUrl, ...rest } = status || {};
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {
    /* ignore quota / private mode */
  }
}

const WhatsAppStatusContext = createContext(null);

export function WhatsAppStatusProvider({ children }) {
  const { t } = usePreferences();
  const [status, setStatus] = useState(CHECKING);
  const [urgent, setUrgent] = useState(0);

  const applyStatus = useCallback((data) => {
    setStatus(data);
    writeSnapshot(data);
  }, []);

  useEffect(() => {
    const snapshot = readSnapshot();
    if (snapshot !== CHECKING) setStatus(snapshot);
  }, []);

  const readJson = useCallback(async (res) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        res.ok
          ? t('wa.errorNotJson')
          : t('wa.errorHttp', { status: res.status })
      );
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const res = await fetch('/api/whatsapp/status', { cache: 'no-store' });
        if (res.status === 401) return;
        const data = await readJson(res);
        if (!res.ok) throw new Error(tApiError(t, data, 'wa.errorStatus'));
        if (!cancelled) applyStatus(data);
      } catch {
        if (!cancelled) applyStatus(EMPTY);
      }
    };

    refresh();
    const interval = setInterval(refresh, urgent > 0 ? 800 : 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [applyStatus, readJson, t, urgent]);

  const beginUrgent = useCallback(() => setUrgent((n) => n + 1), []);
  const endUrgent = useCallback(() => setUrgent((n) => Math.max(0, n - 1)), []);

  return (
    <WhatsAppStatusContext.Provider
      value={{ status, applyStatus, readJson, beginUrgent, endUrgent }}
    >
      {children}
    </WhatsAppStatusContext.Provider>
  );
}

export function useWhatsAppStatus() {
  const ctx = useContext(WhatsAppStatusContext);
  if (!ctx) throw new Error('useWhatsAppStatus must be used within WhatsAppStatusProvider');
  return ctx;
}
