'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Plus, Search, X } from 'lucide-react';
import { templateParagraphs } from '../lib/templates';
import { usePreferences } from './PreferencesProvider';
import { tApiError } from '../lib/i18n';

export default function TemplatesPanel() {
  const { t } = usePreferences();
  const [templates, setTemplates] = useState([]);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('list');
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/templates', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(tApiError(t, data, 'templates.loadFail'));
        setTemplates(Array.isArray(data) ? data : []);
      })
      .catch((err) => setError(err.message || t('templates.loadFail')))
      .finally(() => setLoading(false));
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((item) => String(item.content || '').toLowerCase().includes(q));
  }, [templates, query]);

  const goList = () => {
    setView('list');
    setActiveId(null);
    setDraft('');
    setError('');
  };

  const startCreate = () => {
    setActiveId(null);
    setDraft('');
    setView('edit');
    setError('');
  };

  const startEdit = (template, event) => {
    event?.stopPropagation();
    setActiveId(template.id);
    setDraft(template.content);
    setView('edit');
    setError('');
  };

  const saveTemplate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/templates', {
        method: activeId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeId ? { id: activeId, content: draft } : { content: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(tApiError(t, data, 'templates.saveFail'));

      setTemplates((prev) => {
        const next = activeId
          ? prev.map((item) => (item.id === data.id ? data : item))
          : [data, ...prev];
        return [...next].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
      });
      goList();
    } catch (err) {
      setError(err.message || t('templates.saveFail'));
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (template, event) => {
    event?.stopPropagation();
    setError('');
    try {
      const res = await fetch(`/api/templates?id=${template.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(tApiError(t, data, 'templates.deleteFail'));
      setTemplates((prev) => prev.filter((item) => item.id !== template.id));
      if (activeId === template.id) goList();
    } catch (err) {
      setError(err.message || t('templates.deleteFail'));
    }
  };

  if (view === 'edit') {
    return (
      <form className="templates-panel templates-form" onSubmit={saveTemplate}>
        <button type="button" className="prefs-back" onClick={goList}>
          <ChevronLeft size={16} />
          {t('templates.back')}
        </button>
        <label>
          {t('templates.text')}
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('templates.placeholder')}
            rows={10}
            autoFocus
          />
        </label>
        {error ? <p className="prefs-error">{error}</p> : null}
        <div className="templates-form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
          {activeId ? (
            <button
              type="button"
              className="nav-btn"
              onClick={() => deleteTemplate({ id: activeId })}
            >
              {t('common.delete')}
            </button>
          ) : null}
        </div>
      </form>
    );
  }

  return (
    <div className="templates-panel">
      <div className="contacts-toolbar">
        <label className="contacts-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder={t('templates.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </label>
        <button type="button" className="btn-primary contacts-add-btn" onClick={startCreate}>
          <Plus size={16} />
          {t('common.add')}
        </button>
      </div>

      {error ? <p className="prefs-error">{error}</p> : null}

      {loading ? (
        <p className="contacts-empty">{t('templates.loading')}</p>
      ) : matches.length === 0 ? (
        <p className="contacts-empty">
          {templates.length === 0
            ? t('templates.empty')
            : t('common.noMatches')}
        </p>
      ) : (
        <ul className="templates-list">
          {matches.map((template) => {
            const paragraphs = templateParagraphs(template.content);
            const preview = paragraphs.slice(0, 3);
            const truncated = paragraphs.length > 3;

            return (
              <li key={template.id} className="templates-row">
                <button
                  type="button"
                  className="templates-open"
                  onClick={() => startEdit(template)}
                >
                  <div className={`template-preview${paragraphs.length <= 1 ? ' template-preview--single' : ''}`}>
                    {preview.map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                    {truncated ? <span className="template-more">…</span> : null}
                  </div>
                </button>
                <div className="templates-row-actions">
                  <button
                    type="button"
                    className="contacts-remove"
                    aria-label={t('templates.deleteAria')}
                    onClick={(event) => deleteTemplate(template, event)}
                  >
                    <X size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
