'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LogOut, Settings } from 'lucide-react';
import WhatsAppStatusPill from './WhatsAppStatusPill';
import IdentifierMenu from './IdentifierMenu';
import { usePreferences } from './PreferencesProvider';
import { useTour } from './TourProvider';

function firstInitial(name) {
  const letter = String(name || '').trim().charAt(0);
  return letter ? letter.toUpperCase() : 'U';
}

export default function UserMenu() {
  const { prefs, t, logout } = usePreferences();
  const { openAccountMenu } = useTour();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    setOpen(Boolean(openAccountMenu));
  }, [openAccountMenu]);

  useEffect(() => {
    if (!open || openAccountMenu) return undefined;

    const onPointerDown = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      if (event.target.closest?.('.modal-overlay')) return;
      if (event.target.closest?.('.tour-root')) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, openAccountMenu]);

  return (
    <div className="user-menu" ref={rootRef} data-tour="account">
      <div className="user-menu-pill user-menu-pill--bar" data-tour="whatsapp">
        <WhatsAppStatusPill onOpenSession={() => setOpen(false)} />
      </div>
      <button
        type="button"
        className="user-menu-trigger"
        aria-label={t('account.menu')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {firstInitial(prefs.username)}
      </button>
      <div className="user-menu-dropdown" data-open={open ? 'true' : 'false'} role="menu">
        <div className="user-menu-pill user-menu-pill--menu">
          <WhatsAppStatusPill onOpenSession={() => setOpen(false)} />
        </div>
        <IdentifierMenu onOpen={() => setOpen(false)} />
        <Link
          href="/configuracion"
          className="user-menu-item"
          role="menuitem"
          onClick={() => setOpen(false)}
        >
          <Settings size={16} />
          {t('nav.settings')}
        </Link>
        <button type="button" className="user-menu-item user-menu-item--danger" role="menuitem" onClick={() => logout()}>
          <LogOut size={16} />
          {t('settings.logout')}
        </button>
      </div>
    </div>
  );
}
