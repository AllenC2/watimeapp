'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { contactMatches } from '../lib/contacts';
import { initialsFrom } from '../lib/preferences';
import { usePreferences } from './PreferencesProvider';
import { tApiError } from '../lib/i18n';

export default function ContactsPanel() {
  const { t, locale } = usePreferences();
  const [contacts, setContacts] = useState([]);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadContacts = async () => {
    const res = await fetch('/api/contacts', { cache: 'no-store' });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(tApiError(t, data, 'contacts.loadFail'));
    setContacts(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    loadContacts()
      .catch((err) => setError(err.message || t('contacts.loadFail')))
      .finally(() => setLoading(false));
  }, []);

  const matches = useMemo(
    () => contacts.filter((contact) => contactMatches(contact, query)),
    [contacts, query]
  );

  const startAdd = () => {
    setAdding(true);
    setError('');
    setName('');
    setIdentifier('');
  };

  const cancelAdd = () => {
    setAdding(false);
    setError('');
    setName('');
    setIdentifier('');
  };

  const saveContact = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, identifier }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(tApiError(t, data, 'contacts.saveFail'));
      setContacts((prev) =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: 'base' }))
      );
      cancelAdd();
    } catch (err) {
      setError(err.message || t('contacts.saveFail'));
    } finally {
      setSaving(false);
    }
  };

  const deleteContact = async (contact) => {
    setError('');
    try {
      const res = await fetch(`/api/contacts?id=${contact.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(tApiError(t, data, 'contacts.deleteFail'));
      setContacts((prev) => prev.filter((item) => item.id !== contact.id));
    } catch (err) {
      setError(err.message || t('contacts.deleteFail'));
    }
  };

  return (
    <div className="contacts-panel">
      <div className="contacts-toolbar">
        <label className="contacts-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder={t('contacts.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </label>
        <button type="button" className="btn-primary contacts-add-btn" onClick={startAdd}>
          <Plus size={16} />
          {t('common.add')}
        </button>
      </div>

      {adding ? (
        <form className="contacts-add-form" onSubmit={saveContact}>
          <label>
            {t('contacts.name')}
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('picker.namePlaceholder')}
              autoComplete="off"
              autoFocus
            />
          </label>
          <label>
            {t('contacts.identifier')}
            <input
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={t('contacts.identifierPlaceholder')}
              autoComplete="off"
            />
          </label>
          <div className="contacts-add-actions">
            <button type="button" className="nav-btn" onClick={cancelAdd}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p className="prefs-error">{error}</p> : null}

      {loading ? (
        <p className="contacts-empty">{t('contacts.loading')}</p>
      ) : matches.length === 0 ? (
        <p className="contacts-empty">
          {contacts.length === 0
            ? t('contacts.empty')
            : t('common.noMatches')}
        </p>
      ) : (
        <ul className="contacts-list">
          {matches.map((contact) => (
            <li key={contact.id} className="contacts-row">
              <span className="contacts-avatar" aria-hidden="true">
                {initialsFrom(contact.name)}
              </span>
              <span className="contacts-copy">
                <strong>{contact.name}</strong>
                <small>{contact.identifier}</small>
              </span>
              <button
                type="button"
                className="contacts-remove"
                aria-label={t('contacts.delete', { name: contact.name })}
                onClick={() => deleteContact(contact)}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
