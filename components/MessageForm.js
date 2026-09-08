'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Clock, Calendar, ImagePlus, X, FileText, ChevronLeft } from 'lucide-react';
import { fromDateAndTime, isScheduledInPast, soonestScheduleParts } from '../lib/schedule-time';
import { templateParagraphs } from '../lib/templates';
import RecipientPicker from './RecipientPicker';
import TimeField from './TimeField';
import { usePreferences } from './PreferencesProvider';
import { tApiError } from '../lib/i18n';

export default function MessageForm({ onMessageScheduled, embedded = false }) {
  const { prefs, t } = usePreferences();
  const hour12 = prefs.hourClock === '12h';
  const defaultWhen = () => soonestScheduleParts(new Date(), 10, prefs.timezone);
  const [recipient, setRecipient] = useState('');
  const [content, setContent] = useState('');
  const [intent, setIntent] = useState('schedule');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingIntent, setLoadingIntent] = useState('');
  const [pickingTemplate, setPickingTemplate] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState('');
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef(null);
  const dateInputRef = useRef(null);

  useEffect(() => {
    const next = defaultWhen();
    setDate(next.date);
    setTime(next.time);
  }, [prefs.timezone]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview('');
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const clearImage = () => {
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(t('message.alertImageOnly'));
      clearImage();
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert(t('message.alertImageSize'));
      clearImage();
      return;
    }

    setImageFile(file);
  };

  const openTemplatePicker = async () => {
    setPickingTemplate(true);
    setTemplatesError('');
    setTemplatesLoading(true);
    try {
      const res = await fetch('/api/templates', { cache: 'no-store' });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(tApiError(t, data, 'message.loadTemplatesFailed'));
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      setTemplatesError(err.message || t('message.loadTemplatesFailed'));
    } finally {
      setTemplatesLoading(false);
    }
  };

  const selectTemplate = (template) => {
    setContent(template.content || '');
    setPickingTemplate(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!recipient) return;
    if (!content && !imageFile) {
      alert(t('message.alertNeedContent'));
      return;
    }

    let scheduled_for = '';
    if (intent === 'schedule') {
      if (!date || !time) {
        setFormError(t('message.alertNeedWhen'));
        return;
      }
      scheduled_for = fromDateAndTime(date, time);
      if (isScheduledInPast(scheduled_for)) {
        setFormError(t('message.alertPast'));
        return;
      }
    }

    setLoading(true);
    setLoadingIntent(intent);

    const formData = new FormData();
    formData.append('recipient', recipient);
    formData.append('content', content);
    formData.append('scheduled_for', scheduled_for);
    formData.append('send_now', intent === 'now' ? '1' : '0');
    if (imageFile) formData.append('image', imageFile);

    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setRecipient('');
        setContent('');
        const next = defaultWhen();
        setDate(next.date);
        setTime(next.time);
        setFormError('');
        clearImage();
        onMessageScheduled?.();
      } else {
        const data = await res.json().catch(() => ({}));
        const fallback = intent === 'now' ? 'message.alertSend' : 'message.alertSchedule';
        setFormError(data.error ? tApiError(t, data, fallback) : t(fallback));
      }
    } catch (error) {
      console.error(error);
      setFormError(t('message.alertConnection'));
    } finally {
      setLoading(false);
      setLoadingIntent('');
    }
  };

  const form = pickingTemplate ? (
    <div className="template-picker">
      <button type="button" className="prefs-back" onClick={() => setPickingTemplate(false)}>
        <ChevronLeft size={16} />
        {t('message.backToNew')}
      </button>
      {templatesError ? <p className="prefs-error">{templatesError}</p> : null}
      {templatesLoading ? (
        <p className="contacts-empty">{t('message.loadingTemplates')}</p>
      ) : templates.length === 0 ? (
        <p className="contacts-empty">{t('message.noTemplates')}</p>
      ) : (
        <ul className="templates-list">
          {templates.map((template) => {
            const paragraphs = templateParagraphs(template.content);
            const preview = paragraphs.slice(0, 3);
            const truncated = paragraphs.length > 3;
            return (
              <li key={template.id} className="templates-row">
                <button
                  type="button"
                  className="templates-open"
                  onClick={() => selectTemplate(template)}
                >
                  <div className={`template-preview${paragraphs.length <= 1 ? ' template-preview--single' : ''}`}>
                    {preview.map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                    {truncated ? <span className="template-more">…</span> : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="message-form">
      <div className="form-group">
        <label htmlFor="recipient">{t('message.recipient')}</label>
        <RecipientPicker id="recipient" value={recipient} onChange={setRecipient} />
      </div>

      <div className="form-group">
        <div className="content-label-row">
          <label htmlFor="content">{t('message.content')}</label>
          <button type="button" className="content-template-btn" onClick={openTemplatePicker}>
            <FileText size={16} />
            {t('message.template')}
          </button>
        </div>
        <textarea
          id="content"
          rows="4"
          placeholder={t('message.contentPlaceholder')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        ></textarea>
      </div>

      <div className="form-group">
        <label htmlFor="image">{t('message.image')}</label>
        <input
          ref={fileInputRef}
          type="file"
          id="image"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleImageChange}
          className="image-input"
        />

        {imagePreview ? (
          <div className="image-preview">
            <img src={imagePreview} alt={t('message.imagePreviewAlt')} />
            <button type="button" className="image-preview-remove" onClick={clearImage} aria-label={t('message.removeImage')}>
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="image-dropzone"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus size={20} />
            <span>{t('message.attachImage')}</span>
            <small>{t('message.imageHint')}</small>
          </button>
        )}
      </div>

      <div className="message-action-tabs" role="tablist" aria-label={t('message.title')}>
        <button
          type="button"
          role="tab"
          aria-selected={intent === 'schedule'}
          data-active={intent === 'schedule'}
          disabled={loading}
          onClick={() => {
            setFormError('');
            setIntent('schedule');
            if (intent !== 'schedule') {
              const next = defaultWhen();
              setDate(next.date);
              setTime(next.time);
            }
          }}
        >
          <Calendar size={18} /> {t('message.schedule')}
        </button>
        <button
          type={intent === 'now' ? 'submit' : 'button'}
          role={intent === 'now' ? 'button' : 'tab'}
          aria-selected={intent === 'now'}
          data-active={intent === 'now'}
          data-kind="now"
          disabled={loading}
          onClick={() => {
            if (intent === 'now') return;
            setIntent('now');
            setFormError('');
          }}
        >
          <Send size={18} /> {loadingIntent === 'now' ? t('message.sending') : intent === 'now' ? t('message.confirmSend') : t('message.sendNow')}
        </button>
      </div>

      {intent === 'schedule' ? (
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="date"><Calendar size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> {t('message.date')}</label>
          <div className="date-field">
            <input
              ref={dateInputRef}
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onClick={() => {
                try {
                  dateInputRef.current?.showPicker?.();
                } catch {
                  /* ignore */
                }
              }}
            />
            <Calendar className="date-field-icon" size={18} aria-hidden="true" />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="time"><Clock size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> {t('message.time')}</label>
          <TimeField
            key={hour12 ? '12h' : '24h'}
            id="time"
            value={time}
            hour12={hour12}
            onChange={setTime}
          />
        </div>
      </div>
      ) : null}

      {formError ? <p className="prefs-error">{formError}</p> : null}

      {intent === 'schedule' ? (
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? t('message.scheduling') : (
            <>
              <Calendar size={18} /> {t('message.schedule')}
            </>
          )}
        </button>
      ) : null}
    </form>
  );

  if (embedded) {
    return form;
  }

  return (
    <div className="glass-panel">
      <h2>{t('message.title')}</h2>
      {form}
    </div>
  );
}
