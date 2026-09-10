'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, X } from 'lucide-react';
import { usePreferences } from './PreferencesProvider';
import { tApiError } from '../lib/i18n';
import { EMPTY, useWhatsAppStatus } from './WhatsAppStatusProvider';

function platformText(platform, t) {
  switch (String(platform || '').toLowerCase()) {
    case 'android':
      return t('wa.platform.android');
    case 'ios':
      return t('wa.platform.ios');
    case 'smba':
    case 'smb':
      return t('wa.platform.business');
    case 'web':
      return t('wa.platform.web');
    default:
      return platform ? String(platform) : t('wa.platform.default');
  }
}

function stateText(status, t) {
  if (status.connected) return t('wa.connected');
  if (status.qrDataUrl) return t('wa.waitingQr');
  if (status.connecting) {
    if (!status.hasSession && !status.phone) return t('wa.checking');
    return t('wa.connecting');
  }
  return t('wa.disconnected');
}

export default function WhatsAppStatusPill({ onOpenSession }) {
  const { t } = usePreferences();
  const { status, applyStatus, readJson, beginUrgent, endUrgent } = useWhatsAppStatus();
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!modal) return undefined;
    beginUrgent();
    return () => endUrgent();
  }, [modal, beginUrgent, endUrgent]);

  useEffect(() => {
    if (modal === 'connect' && status.connected) {
      setBusy(false);
      setModal(null);
    }
  }, [modal, status.connected]);

  useEffect(() => {
    if (status.qrDataUrl) setError('');
  }, [status.qrDataUrl]);

  const startConnect = async () => {
    setError('');
    setBusy(true);
    setModal('connect');
    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(tApiError(t, data, 'wa.errorConnect'));
      applyStatus(data);
      if (data.error && !data.qrDataUrl && !data.connected) {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message || t('wa.errorStart'));
    } finally {
      setBusy(false);
    }
  };

  const confirmLogout = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/whatsapp/logout', { method: 'POST' });
      const data = await readJson(res);
      if (!res.ok) throw new Error(tApiError(t, data, 'wa.errorLogout'));
      applyStatus({ ...EMPTY, ...data });
      setModal(null);
    } catch (err) {
      setError(err.message || t('wa.errorLogout'));
    } finally {
      setBusy(false);
    }
  };

  const resetAndReconnect = async () => {
    setError('');
    setBusy(true);
    setModal('connect');
    try {
      const connectRes = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      const connectData = await readJson(connectRes);
      if (!connectRes.ok) throw new Error(tApiError(t, connectData, 'wa.errorReconnect'));
      applyStatus(connectData);
      if (connectData.error && !connectData.qrDataUrl && !connectData.connected) {
        setError(connectData.error);
      }
    } catch (err) {
      setError(err.message || t('wa.errorReset'));
    } finally {
      setBusy(false);
    }
  };

  const onPillClick = () => {
    setError('');
    onOpenSession?.();
    if (status.connected) setModal('logout');
    else startConnect();
  };

  const phoneLabel = status.phone ? status.phoneLabel : t('wa.noNumber');
  const platformLabel = platformText(status.platform, t);
  const details = [phoneLabel, platformLabel, status.name]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <button
        type="button"
        className="status-pill"
        data-state={status.state}
        title={status.connected ? t('wa.pillTitleLogout', { details }) : t('wa.pillTitleConnect', { details })}
        onClick={onPillClick}
      >
        <span className="status-pill-dot" aria-hidden="true" />
        <Smartphone size={14} />
        <div className="status-pill-copy">
          <span className="status-pill-phone">{phoneLabel}</span>
          <span className="status-pill-meta">
            {platformLabel}
            {status.name ? ` · ${status.name}` : ''}
          </span>
        </div>
        <span className="status-pill-state">{stateText(status, t)}</span>
      </button>

      {modal && createPortal(
        <div className="modal-overlay" onClick={() => !busy && setModal(null)}>
          <div
            className="modal-panel session-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{status.connected || modal === 'logout' ? t('wa.logoutTitle') : t('wa.connectTitle')}</h2>
              <button
                type="button"
                className="nav-btn"
                aria-label={t('common.close')}
                disabled={busy}
                onClick={() => setModal(null)}
              >
                <X size={18} />
              </button>
            </div>

            {modal === 'logout' ? (
              <>
                <p className="session-modal-text">
                  {t('wa.logoutCopy', {
                    phone: status.phone ? phoneLabel : t('wa.logoutPhoneFallback'),
                    name: status.name ? t('wa.logoutName', { name: status.name }) : '',
                  })}
                </p>
                {error && <p className="session-modal-error">{error}</p>}
                <div className="session-modal-actions">
                  <button type="button" className="nav-btn" disabled={busy} onClick={() => setModal(null)}>
                    {t('common.cancel')}
                  </button>
                  <button type="button" className="btn-danger" disabled={busy} onClick={confirmLogout}>
                    {busy ? t('wa.loggingOut') : t('wa.logoutAction')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="session-modal-text">
                  {status.qrDataUrl
                    ? t('wa.scanQr')
                    : status.hasSession
                      ? t('wa.reconnecting')
                      : t('wa.generatingQr')}
                </p>
                <div className="qr-box">
                  {status.qrDataUrl ? (
                    <img src={status.qrDataUrl} alt={t('wa.qrAlt')} />
                  ) : (
                    <span>{busy || status.connecting ? t('wa.waitingQrDots') : t('wa.noQr')}</span>
                  )}
                </div>
                {(error || status.error) && (
                  <p className="session-modal-error">{error || status.error}</p>
                )}
                {!status.qrDataUrl && (
                  <div className="session-modal-actions">
                    <button
                      type="button"
                      className="btn-danger"
                      disabled={busy}
                      onClick={resetAndReconnect}
                    >
                      {busy ? t('wa.resetting') : t('wa.resetReconnect')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
