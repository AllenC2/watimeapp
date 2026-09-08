'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Clock, Search, X, XCircle } from 'lucide-react';
import {
  formatScheduledDateTime,
  formatScheduledTime,
  parseScheduledDate,
  scheduledDateKey,
} from '../lib/schedule-time';
import { usePreferences } from './PreferencesProvider';
import { whatsappAccountLabel } from '../lib/whatsapp-label';
import { tApiError } from '../lib/i18n';

function formatDayHeading(key, timeZone, t) {
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return t('common.noDate');

  const date = new Date(year, month - 1, day);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);

  if (key === localDateKey(today, timeZone)) return t('common.today');
  if (key === localDateKey(yesterday, timeZone)) return t('common.yesterday');
  return t('history.dayOf', {
    weekday: t(`weekday.${date.getDay()}`),
    day,
    month: t(`month.${month - 1}`),
    year,
  });
}

function countLabel(count, t) {
  return count === 1 ? t('history.countOne') : t('history.countMany', { count });
}

function statusText(status, t) {
  if (status === 'sent') return t('status.sent');
  if (status === 'failed') return t('status.failed');
  return t('status.pending');
}

function localDateKey(date, timeZone) {
  return scheduledDateKey(
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T12:00:00`,
    timeZone
  );
}

function statusIcon(status) {
  switch (status) {
    case 'sent':
      return <CheckCheck size={14} />;
    case 'failed':
      return <XCircle size={14} />;
    default:
      return <Clock size={14} />;
  }
}

function messageMatches(message, query, timeZone, hour12, t) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    message.contact_name,
    message.recipient,
    message.content,
    message.status,
    statusText(message.status, t),
    formatScheduledDateTime(message.scheduled_for, timeZone, hour12),
    formatDayHeading(scheduledDateKey(message.scheduled_for, timeZone) || '', timeZone, t),
    whatsappAccountLabel(message, t),
    message.whatsapp_phone,
    message.whatsapp_name,
    message.image_url ? t('history.imageOnly') : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export default function HistoryPanel() {
  const { prefs, t } = usePreferences();
  const timeZone = prefs.timezone || undefined;
  const hour12 = prefs.hourClock === '12h';
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/schedule', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(tApiError(t, data, 'history.loadFail'));
        setMessages(Array.isArray(data) ? data : []);
      })
      .catch((err) => setError(err.message || t('history.loadFail')))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    const matches = messages
      .filter((message) => messageMatches(message, query, timeZone, hour12, t))
      .sort(
        (a, b) =>
          parseScheduledDate(b.scheduled_for) - parseScheduledDate(a.scheduled_for)
      );

    const byDay = [];
    const indexByKey = new Map();

    for (const message of matches) {
      const key = scheduledDateKey(message.scheduled_for, timeZone) || 'sin-fecha';
      let group = indexByKey.get(key);
      if (!group) {
        group = { key, label: formatDayHeading(key, timeZone, t), messages: [] };
        indexByKey.set(key, group);
        byDay.push(group);
      }
      group.messages.push(message);
    }

    return byDay;
  }, [messages, query, timeZone, hour12, t]);

  const deleteMessage = async (message) => {
    setError('');
    try {
      const res = await fetch(`/api/schedule?id=${message.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(tApiError(t, data, 'history.deleteFail'));
      setMessages((prev) => prev.filter((item) => item.id !== message.id));
    } catch (err) {
      setError(err.message || t('history.deleteFail'));
    }
  };

  return (
    <div className="history-panel">
      <div className="contacts-toolbar">
        <label className="contacts-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder={t('history.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </label>
      </div>

      {error ? <p className="prefs-error">{error}</p> : null}

      {loading ? (
        <p className="contacts-empty">{t('history.loading')}</p>
      ) : groups.length === 0 ? (
        <p className="contacts-empty">
          {messages.length === 0
            ? t('history.empty')
            : t('common.noMatches')}
        </p>
      ) : (
        <div className="history-list">
          {groups.map((group) => (
            <section key={group.key} className="history-day">
              <header className="history-day-head">
                <h3>{group.label}</h3>
                <span>{countLabel(group.messages.length, t)}</span>
              </header>
              <ul>
                {group.messages.map((message) => (
                  <li key={message.id} className="history-row">
                    {message.image_url ? (
                      <img src={message.image_url} alt="" className="history-thumb" />
                    ) : null}
                    <div className="history-copy">
                      <div className="history-copy-top">
                        <strong>{message.contact_name || message.recipient}</strong>
                        <span className="status-badge" data-status={message.status}>
                          {statusIcon(message.status)}
                          {statusText(message.status, t)}
                        </span>
                      </div>
                      <p className="history-content">
                        {message.content || (message.image_url ? t('history.imageOnly') : t('history.noText'))}
                      </p>
                      <small>
                        {formatScheduledTime(message.scheduled_for, timeZone, hour12)}
                        {message.contact_name ? ` · ${message.recipient}` : ''}
                        {whatsappAccountLabel(message, t) ? ` · ${whatsappAccountLabel(message, t)}` : ''}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="contacts-remove"
                      aria-label={t('history.deleteAria')}
                      onClick={() => deleteMessage(message)}
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
