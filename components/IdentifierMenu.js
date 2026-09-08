'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AtSign, Check, Copy, X } from 'lucide-react';
import { usePreferences } from './PreferencesProvider';

export default function IdentifierMenu({ onOpen }) {
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const [connected, setConnected] = useState(true);
  const [channels, setChannels] = useState([]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    const refresh = async () => {
      try {
        const res = await fetch('/api/whatsapp/last-channel', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        setConnected(data.connected !== false);
        setChannels(Array.isArray(data.channels) ? data.channels : []);
      } catch {
        /* keep last */
      }
    };

    refresh();
    const interval = setInterval(refresh, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(''), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyId = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
    } catch {
      /* ignore */
    }
  };

  const roleLabel = (role) => {
    if (role === 'OWNER') return t('identifier.roleOwner');
    if (role === 'ADMIN') return t('identifier.roleAdmin');
    return '';
  };

  return (
    <>
      <button
        type="button"
        className="user-menu-item"
        role="menuitem"
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        <AtSign size={16} />
        {t('account.identifier')}
      </button>

      {open
        ? createPortal(
            <div className="modal-overlay" onClick={() => setOpen(false)}>
              <div
                className="modal-panel session-modal identifier-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="identifier-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="modal-header">
                  <h2 id="identifier-title">{t('identifier.title')}</h2>
                  <button
                    type="button"
                    className="nav-btn"
                    aria-label={t('common.close')}
                    onClick={() => setOpen(false)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <p className="session-modal-text identifier-hint">
                  {connected ? t('identifier.hint') : t('identifier.offline')}
                </p>
                {channels.length ? (
                  <ul className="identifier-list">
                    {channels.map((channel) => (
                      <li key={channel.jid} className="identifier-id">
                        <div className="identifier-copy-block">
                          <strong>{channel.name}</strong>
                          <code>{channel.id}</code>
                          {roleLabel(channel.role) ? (
                            <span className="identifier-role">{roleLabel(channel.role)}</span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="nav-btn"
                          onClick={() => copyId(channel.id)}
                          aria-label={t('identifier.copy')}
                        >
                          {copied === channel.id ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="identifier-empty">
                    {connected ? t('identifier.empty') : t('identifier.offline')}
                  </p>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
