'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Globe, Languages } from 'lucide-react';
import { messages, translate } from '../lib/i18n';
import { applyLanguage, detectTimeZone, timeZoneMeta } from '../lib/preferences';
import { usePreferences } from './PreferencesProvider';
import { useTour } from './TourProvider';

export default function WelcomeModal() {
  const pathname = usePathname();
  const { prefs, updatePrefs } = usePreferences();
  const { startTour } = useTour();
  const [busy, setBusy] = useState(false);
  const [setupLang, setSetupLang] = useState('en');
  const startedPendingTour = useRef(false);

  const onAuthPage = pathname === '/login' || pathname === '/registro';
  const showSetup = Boolean(prefs.id && prefs.showSetup && !onAuthPage);
  const pendingTour = Boolean(prefs.id && prefs.showWelcome && !prefs.showSetup && !onAuthPage);

  useEffect(() => {
    if (showSetup) applyLanguage(setupLang);
  }, [showSetup, setupLang]);

  useEffect(() => {
    if (!pendingTour || startedPendingTour.current) return undefined;
    startedPendingTour.current = true;
    let cancelled = false;
    (async () => {
      try {
        await updatePrefs({ welcomeSeen: true });
        if (!cancelled) startTour();
      } catch {
        startedPendingTour.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingTour, startTour, updatePrefs]);

  if (!showSetup || typeof document === 'undefined') return null;

  const setupT = (key, vars) => translate(messages, setupLang, key, vars);
  const zone = timeZoneMeta(prefs.timezone || detectTimeZone(), new Date(), setupLang === 'en' ? 'en' : 'es');

  async function finishSetup() {
    if (busy) return;
    setBusy(true);
    try {
      await updatePrefs({
        language: setupLang,
        timezone: detectTimeZone(),
        setupSeen: true,
        welcomeSeen: true,
      });
      applyLanguage(setupLang);
      startTour();
    } catch {
      /* stay on setup */
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="modal-overlay">
      <div
        className="modal-panel welcome-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
      >
        <div className="modal-header">
          <h2 id="setup-title">
            <Languages size={20} aria-hidden />
            {setupT('setup.title')}
          </h2>
        </div>
        <p className="session-modal-text">{setupT('setup.subtitle')}</p>
        <div className="prefs-view-row setup-langs">
          <button
            type="button"
            className="prefs-view"
            data-active={setupLang === 'en'}
            onClick={() => setSetupLang('en')}
          >
            <span>
              <strong>English</strong>
              <small>English</small>
            </span>
          </button>
          <button
            type="button"
            className="prefs-view"
            data-active={setupLang === 'es'}
            onClick={() => setSetupLang('es')}
          >
            <span>
              <strong>Español</strong>
              <small>Spanish</small>
            </span>
          </button>
        </div>
        <p className="setup-timezone">
          <Globe size={16} aria-hidden />
          {setupT('setup.timezone', { zone: zone.city || zone.id })}
        </p>
        <div className="session-modal-actions setup-actions">
          <button type="button" className="btn-primary" disabled={busy} onClick={finishSetup}>
            {setupT('setup.continue')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
