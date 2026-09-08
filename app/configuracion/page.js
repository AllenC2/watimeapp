'use client';

import { useEffect, useState } from 'react';
import { Clock, FileText, LogOut, SlidersHorizontal, TriangleAlert, Users, X } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import PreferencesPanel from '../../components/PreferencesPanel';
import ContactsPanel from '../../components/ContactsPanel';
import HistoryPanel from '../../components/HistoryPanel';
import TemplatesPanel from '../../components/TemplatesPanel';
import { usePreferences } from '../../components/PreferencesProvider';
import { initialsFrom } from '../../lib/preferences';

const SECTION_IDS = [
  { id: 'preferencias', icon: SlidersHorizontal, titleKey: 'settings.card.preferences', descKey: 'settings.card.preferencesDesc' },
  { id: 'contactos', icon: Users, titleKey: 'settings.card.contacts', descKey: 'settings.card.contactsDesc' },
  { id: 'historial', icon: Clock, titleKey: 'settings.card.history', descKey: 'settings.card.historyDesc' },
  { id: 'plantillas', icon: FileText, titleKey: 'settings.card.templates', descKey: 'settings.card.templatesDesc' },
];

export default function Configuracion() {
  const [openSection, setOpenSection] = useState(null);
  const [modalTitle, setModalTitle] = useState('');
  const { prefs, t, logout } = usePreferences();
  const sections = SECTION_IDS.map((section) => ({
    ...section,
    title: t(section.titleKey),
    description: t(section.descKey),
  }));
  const active = sections.find((section) => section.id === openSection);
  const roleLabel = prefs.role === 'Administrador' || prefs.role === 'Administrator'
    ? t('role.admin')
    : prefs.role;

  useEffect(() => {
    if (!openSection) return;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setModalTitle('');
        setOpenSection(null);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openSection]);

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <header>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.subtitle')}</p>
        </header>

        {prefs.emailVerified === false ? (
          <div className="settings-alert" role="alert">
            <TriangleAlert size={20} aria-hidden="true" />
            <p>{t('settings.emailUnverified')}</p>
          </div>
        ) : null}

        <div className="settings-layout">
          <section className="settings-profile" aria-label={t('settings.currentUser')}>
            <span className="settings-profile-avatar" aria-hidden="true">
              {initialsFrom(prefs.username)}
            </span>
            <div className="settings-profile-copy">
              <p className="settings-profile-name">{prefs.username}</p>
              <p className="settings-profile-meta">{prefs.email}</p>
            </div>
            {roleLabel ? <span className="settings-profile-status">{roleLabel}</span> : null}
          </section>

          <section className="settings-grid">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  className="settings-card"
                  onClick={() => setOpenSection(section.id)}
                >
                  <span className="settings-card-icon" aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <span className="settings-card-copy">
                    <span className="settings-card-title">{section.title}</span>
                    <span className="settings-card-desc">{section.description}</span>
                  </span>
                </button>
              );
            })}
          </section>

          <button type="button" className="settings-logout" onClick={() => logout()}>
            <LogOut size={18} />
            {t('settings.logout')}
          </button>
        </div>
      </main>

      {active && (
        <div
          className="modal-overlay modal-overlay--sheet"
          onClick={() => {
            setModalTitle('');
            setOpenSection(null);
          }}
        >
          <div
            className={
              active.id === 'preferencias'
                ? 'modal-panel modal-panel--prefs'
                : active.id === 'contactos'
                  ? 'modal-panel modal-panel--contacts'
                  : active.id === 'historial'
                    ? 'modal-panel modal-panel--history'
                    : active.id === 'plantillas'
                      ? 'modal-panel modal-panel--templates'
                      : 'modal-panel'
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="settings-modal-title">{modalTitle || active.title}</h2>
              <button
                type="button"
                className="nav-btn"
                aria-label={t('common.close')}
                onClick={() => {
                  setModalTitle('');
                  setOpenSection(null);
                }}
              >
                <X size={18} />
              </button>
            </div>
            {active.id === 'preferencias' ? <PreferencesPanel onTitleChange={setModalTitle} /> : null}
            {active.id === 'contactos' ? <ContactsPanel /> : null}
            {active.id === 'historial' ? <HistoryPanel /> : null}
            {active.id === 'plantillas' ? <TemplatesPanel /> : null}
          </div>
        </div>
      )}
    </div>
  );
}
