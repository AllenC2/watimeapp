'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, UserPlus, X } from 'lucide-react';
import {
  contactMatches,
  isExactContactMatch,
  looksLikeIdentifier,
  normalizeIdentifier,
} from '../lib/contacts';
import { usePreferences } from './PreferencesProvider';
import { tApiError } from '../lib/i18n';

export default function RecipientPicker({ id, value, onChange }) {
  const { t, locale } = usePreferences();
  const [contacts, setContacts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);
  const nameInputRef = useRef(null);
  const inputRef = useRef(null);

  const selected = useMemo(() => {
    const contact = contacts.find((item) => item.identifier === value);
    if (contact) return contact;
    const channel = channels.find((item) => item.id === value || item.jid === value);
    if (channel) return { name: channel.name, identifier: channel.id };
    return null;
  }, [contacts, channels, value]);

  const loadContacts = async () => {
    const res = await fetch('/api/contacts', { cache: 'no-store' });
    const data = await res.json().catch(() => []);
    if (res.ok && Array.isArray(data)) setContacts(data);
  };

  const loadChannels = async () => {
    const res = await fetch('/api/whatsapp/last-channel', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.channels)) setChannels(data.channels);
    else setChannels([]);
  };

  useEffect(() => {
    loadContacts().catch(() => {});
    loadChannels().catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    loadChannels().catch(() => {});
    return undefined;
  }, [open]);

  useEffect(() => {
    if (selected && !open && !adding) setQuery(selected.name);
  }, [selected, open, adding]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setAdding(false);
        setError('');
        if (selected) setQuery(selected.name);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, selected]);

  useEffect(() => {
    if (adding) nameInputRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    const active = rootRef.current?.querySelector('.recipient-picker-menu [data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const channelMatches = useMemo(
    () =>
      channels.filter((channel) =>
        contactMatches(
          { name: channel.name, identifier: channel.id, search_key: String(channel.id || '').toLowerCase() },
          query
        )
      ),
    [channels, query]
  );

  const matches = useMemo(
    () => contacts.filter((contact) => contactMatches(contact, query)),
    [contacts, query]
  );

  const knownExact = (nextQuery) =>
    contacts.some((contact) => isExactContactMatch(contact, nextQuery)) ||
    channels.some((channel) =>
      isExactContactMatch(
        { identifier: channel.id, search_key: String(channel.id || '').toLowerCase() },
        nextQuery
      )
    );

  const canAdd = looksLikeIdentifier(query) && !knownExact(query);

  const emitIdentifier = (nextQuery, contact = null) => {
    if (contact) {
      onChange(contact.identifier);
      return;
    }
    if (looksLikeIdentifier(nextQuery)) {
      onChange(normalizeIdentifier(nextQuery).identifier);
      return;
    }
    onChange('');
  };

  const selectChannel = (channel) => {
    setQuery(channel.name);
    setOpen(false);
    setAdding(false);
    setError('');
    onChange(channel.jid);
  };

  const selectContact = (contact) => {
    setQuery(contact.name);
    setOpen(false);
    setAdding(false);
    setError('');
    onChange(contact.identifier);
  };

  const clearSelection = () => {
    setQuery('');
    setOpen(true);
    setAdding(false);
    setError('');
    onChange('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleQueryChange = (nextQuery) => {
    setQuery(nextQuery);
    setOpen(true);
    setAdding(false);
    setError('');
    setHighlight(0);
    const exact =
      contacts.find((contact) => isExactContactMatch(contact, nextQuery)) ||
      channels.find((channel) =>
        isExactContactMatch(
          { identifier: channel.id, search_key: String(channel.id || '').toLowerCase() },
          nextQuery
        )
      );
    emitIdentifier(nextQuery, exact ? { identifier: exact.identifier || exact.id } : null);
  };

  const startAdd = () => {
    setAdding(true);
    setNewName('');
    setError('');
  };

  const saveContact = async (event) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      setError(t('picker.writeName'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, identifier: query }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.contact) {
        setContacts((prev) => {
          if (prev.some((item) => item.id === data.contact.id)) return prev;
          return [...prev, data.contact];
        });
        selectContact(data.contact);
        return;
      }
      if (!res.ok) throw new Error(tApiError(t, data, 'contacts.saveFail'));
      setContacts((prev) =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: 'base' }))
      );
      selectContact(data);
    } catch (err) {
      setError(err.message || t('contacts.saveFail'));
    } finally {
      setSaving(false);
    }
  };

  const showMenu =
    !selected && open && (adding || canAdd || matches.length > 0 || channelMatches.length > 0 || query.trim());
  const addOffset = canAdd || adding ? 1 : 0;
  const channelOffset = addOffset + channelMatches.length;

  const onKeyDown = (event) => {
    if (!showMenu && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (!showMenu) return;

    const optionCount = channelOffset + matches.length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((index) => (index + 1) % Math.max(optionCount, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((index) => (index - 1 + Math.max(optionCount, 1)) % Math.max(optionCount, 1));
    } else if (event.key === 'Enter' && !adding) {
      event.preventDefault();
      if (canAdd && highlight === 0) startAdd();
      else if (highlight < channelOffset) {
        const channel = channelMatches[highlight - addOffset];
        if (channel) selectChannel(channel);
      } else {
        const contact = matches[highlight - channelOffset];
        if (contact) selectContact(contact);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
      setAdding(false);
    }
  };

  return (
    <div className="recipient-picker" ref={rootRef}>
      {selected ? (
        <div className="recipient-tag" id={id}>
          <div className="recipient-tag-copy">
            <span className="recipient-tag-name">{selected.name}</span>
            <small className="recipient-tag-id">{selected.identifier}</small>
          </div>
          <button
            type="button"
            className="recipient-tag-remove"
            aria-label={t('picker.remove', { name: selected.name })}
            onClick={clearSelection}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <input
          ref={inputRef}
          type="text"
          id={id}
          placeholder={t('picker.placeholder')}
          value={query}
          autoComplete="off"
          role="combobox"
          aria-expanded={showMenu}
          aria-controls="recipient-picker-list"
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          required
        />
      )}

      {showMenu && (
        <div className="recipient-picker-menu" id="recipient-picker-list" role="listbox">
          {adding ? (
            <div className="recipient-picker-add-form">
              <p>{t('picker.nameFor', { id: normalizeIdentifier(query).identifier || query.trim() })}</p>
              <input
                ref={nameInputRef}
                type="text"
                placeholder={t('picker.namePlaceholder')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveContact(e);
                  }
                }}
              />
              {error && <span className="recipient-picker-error">{error}</span>}
              <div className="recipient-picker-add-actions">
                <button type="button" className="nav-btn" onClick={() => setAdding(false)}>
                  {t('common.cancel')}
                </button>
                <button type="button" className="btn-primary" disabled={saving} onClick={saveContact}>
                  <UserPlus size={16} />
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {canAdd && (
                <button
                  type="button"
                  className="recipient-picker-add"
                  role="option"
                  aria-selected={highlight === 0}
                  data-active={highlight === 0}
                  onMouseEnter={() => setHighlight(0)}
                  onClick={startAdd}
                >
                  <Plus size={16} />
                  {t('picker.addQuery', { query: query.trim() })}
                </button>
              )}
              {channelMatches.length > 0 && (
                <div className="recipient-picker-options">
                  <p className="recipient-picker-heading">{t('picker.channels')}</p>
                  {channelMatches.map((channel, index) => (
                    <button
                      key={channel.jid}
                      type="button"
                      className="recipient-picker-option"
                      role="option"
                      aria-selected={highlight === index + addOffset}
                      data-active={highlight === index + addOffset}
                      onMouseEnter={() => setHighlight(index + addOffset)}
                      onClick={() => selectChannel(channel)}
                    >
                      <span>{channel.name}</span>
                      <small>
                        {channel.id}
                        {channel.role === 'OWNER'
                          ? ` · ${t('picker.roleOwner')}`
                          : channel.role === 'ADMIN'
                            ? ` · ${t('picker.roleAdmin')}`
                            : ''}
                      </small>
                    </button>
                  ))}
                </div>
              )}
              {matches.length > 0 && (
                <div className="recipient-picker-options">
                  {channelMatches.length > 0 ? (
                    <p className="recipient-picker-heading">{t('picker.contacts')}</p>
                  ) : null}
                  {matches.map((contact, index) => (
                    <button
                      key={contact.id}
                      type="button"
                      className="recipient-picker-option"
                      role="option"
                      aria-selected={highlight === index + channelOffset}
                      data-active={highlight === index + channelOffset}
                      onMouseEnter={() => setHighlight(index + channelOffset)}
                      onClick={() => selectContact(contact)}
                    >
                      <span>{contact.name}</span>
                      <small>{contact.identifier}</small>
                    </button>
                  ))}
                </div>
              )}
              {!canAdd && matches.length === 0 && channelMatches.length === 0 && (
                <p className="recipient-picker-empty">
                  {query.trim()
                    ? t('picker.emptySearch')
                    : t('picker.emptyList')}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
