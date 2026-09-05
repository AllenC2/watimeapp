'use client';

import { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';

const EMPTY = {
  state: 'offline',
  stateLabel: 'Desconectado',
  phoneLabel: 'Sin número',
  platformLabel: 'WhatsApp',
  name: '',
  connected: false,
  connecting: false,
  qrDataUrl: null,
  hasSession: false,
  error: '',
};

export default function WhatsAppStatusPill() {
  const [status, setStatus] = useState(EMPTY);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const readJson = async (res) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        res.ok
          ? 'El servidor no devolvió JSON'
          : `Error ${res.status} al hablar con WhatsApp`
      );
    }
  };

  const load = async () => {
    const res = await fetch('/api/whatsapp/status', { cache: 'no-store' });
    const data = await readJson(res);
    if (!res.ok) throw new Error(data.error || 'No se pudo leer el estado');
    return data;
  };

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const data = await load();
        if (!cancelled) {
          setStatus((prev) => {
            if (data.qrDataUrl) setError('');
            if (prev.qrDataUrl && !data.qrDataUrl && !data.connected) {
              return { ...data, qrDataUrl: prev.qrDataUrl };
            }
            return data;
          });
        }
      } catch {
        if (!cancelled) setStatus(EMPTY);
      }
    };

    refresh();
    const interval = setInterval(refresh, modal ? 800 : 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [modal]);

  useEffect(() => {
    if (modal === 'connect' && status.connected) {
      setBusy(false);
      setModal(null);
    }
  }, [modal, status.connected]);

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
      if (!res.ok) throw new Error(data.error || 'No se pudo conectar');
      setStatus(data);
      if (data.error && !data.qrDataUrl && !data.connected) {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message || 'No se pudo iniciar la conexión');
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
      if (!res.ok) throw new Error(data.error || 'No se pudo cerrar la sesión');
      setStatus({ ...EMPTY, ...data });
      setModal(null);
    } catch (err) {
      setError(err.message || 'No se pudo cerrar la sesión');
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
      if (!connectRes.ok) throw new Error(connectData.error || 'No se pudo volver a conectar');
      setStatus(connectData);
      if (connectData.error && !connectData.qrDataUrl && !connectData.connected) {
        setError(connectData.error);
      }
    } catch (err) {
      setError(err.message || 'No se pudo reiniciar la sesión');
    } finally {
      setBusy(false);
    }
  };

  const onPillClick = () => {
    setError('');
    if (status.connected) setModal('logout');
    else startConnect();
  };

  const details = [status.phoneLabel, status.platformLabel, status.name]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <button
        type="button"
        className="status-pill"
        data-state={status.state}
        title={`${details}. Clic para ${status.connected ? 'cerrar sesión' : 'conectar'}`}
        onClick={onPillClick}
      >
        <span className="status-pill-dot" aria-hidden="true" />
        <Smartphone size={14} />
        <div className="status-pill-copy">
          <span className="status-pill-phone">{status.phoneLabel}</span>
          <span className="status-pill-meta">
            {status.platformLabel}
            {status.name ? ` · ${status.name}` : ''}
          </span>
        </div>
        <span className="status-pill-state">{status.stateLabel}</span>
      </button>

      {modal && (
        <div className="modal-overlay" onClick={() => !busy && setModal(null)}>
          <div
            className="modal-panel session-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{status.connected || modal === 'logout' ? 'Cerrar sesión' : 'Conectar WhatsApp'}</h2>
              <button
                type="button"
                className="nav-btn"
                aria-label="Cerrar"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                <X size={18} />
              </button>
            </div>

            {modal === 'logout' ? (
              <>
                <p className="session-modal-text">
                  Esto desconecta {status.phoneLabel !== 'Sin número' ? status.phoneLabel : 'el celular'}
                  {status.name ? ` (${status.name})` : ''} y cierra la sesión de WhatsApp.
                </p>
                {error && <p className="session-modal-error">{error}</p>}
                <div className="session-modal-actions">
                  <button type="button" className="nav-btn" disabled={busy} onClick={() => setModal(null)}>
                    Cancelar
                  </button>
                  <button type="button" className="btn-danger" disabled={busy} onClick={confirmLogout}>
                    {busy ? 'Cerrando...' : 'Cerrar sesión'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="session-modal-text">
                  {status.qrDataUrl
                    ? 'Escanea este código con WhatsApp: Dispositivos vinculados.'
                    : status.hasSession
                      ? 'Reconectando con la sesión guardada...'
                      : 'Generando código QR...'}
                </p>
                <div className="qr-box">
                  {status.qrDataUrl ? (
                    <img src={status.qrDataUrl} alt="Código QR de WhatsApp" />
                  ) : (
                    <span>{busy || status.connecting ? 'Esperando QR...' : 'Sin QR todavía'}</span>
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
                      {busy ? 'Reiniciando...' : 'Cerrar sesión y volver a conectar'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
