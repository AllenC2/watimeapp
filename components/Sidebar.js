'use client';

import Link from 'next/link';
import UserMenu from './UserMenu';
import { usePreferences } from './PreferencesProvider';
import { DEFAULT_LOGO_SRC } from '../lib/preferences';

export default function Sidebar() {
  const { prefs, t } = usePreferences();
  const logoSrc = prefs.logoDataUrl || DEFAULT_LOGO_SRC;

  return (
    <header className="topbar">
      <Link href="/" className="topbar-brand">
        <img
          src={logoSrc}
          alt={t('brand.alt')}
          className="topbar-logo"
          data-default={!prefs.logoDataUrl}
        />
      </Link>
      <UserMenu />
    </header>
  );
}
