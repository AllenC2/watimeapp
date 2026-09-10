'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, CheckCheck, Clock, Plus, XCircle } from 'lucide-react';
import { civilDateInTimeZone, formatScheduledTime, parseScheduledDate, scheduledDateKey } from '../lib/schedule-time';
import { usePreferences } from './PreferencesProvider';
import { whatsappAccountLabel } from '../lib/whatsapp-label';

function weekTitle(days, t) {
  const start = days[0];
  const end = days[6];
  if (start.month === end.month && start.year === end.year) {
    return `${start.day} – ${end.day} ${t(`month.${start.month}`)} ${start.year}`;
  }
  if (start.year === end.year) {
    return `${start.day} ${t(`monthShort.${start.month}`)} – ${end.day} ${t(`monthShort.${end.month}`)} ${start.year}`;
  }
  return `${start.day} ${t(`monthShort.${start.month}`)} ${start.year} – ${end.day} ${t(`monthShort.${end.month}`)} ${end.year}`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month, weekStartsOn) {
  const day = new Date(year, month, 1).getDay();
  if (weekStartsOn === 'sunday') return day;
  return day === 0 ? 6 : day - 1;
}

function formatDateKey(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function getWeeksInMonth(year, month, weekStartsOn) {
  const totalDays = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month, weekStartsOn);
  return Math.ceil((firstDay + totalDays) / 7);
}

function partsFromDate(date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
  };
}

function shiftDay(year, month, day, delta) {
  const next = new Date(year, month, day);
  next.setDate(next.getDate() + delta);
  return partsFromDate(next);
}

function startOfWeek(year, month, day, weekStartsOn) {
  const date = new Date(year, month, day);
  const weekday = date.getDay();
  const offset = weekStartsOn === 'sunday'
    ? -weekday
    : weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + offset);
  return partsFromDate(date);
}

function weekDays(monday) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday.year, monday.month, monday.day + index);
    const parts = partsFromDate(date);
    return {
      ...parts,
      key: formatDateKey(parts.year, parts.month, parts.day),
    };
  });
}

function NewMessageButton({ onNewMessage }) {
  const { t } = usePreferences();
  const [hint, setHint] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const onClick = async () => {
    let connected = false;
    try {
      const res = await fetch('/api/whatsapp/status', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      connected = Boolean(data.connected);
    } catch {
      connected = false;
    }
    if (connected) {
      setHint(false);
      onNewMessage();
      return;
    }
    setHint(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setHint(false), 4000);
  };

  return (
    <div className="new-message-btn-wrap">
      <button type="button" className="btn-primary" data-tour="new-message" onClick={onClick}>
        <Plus size={18} /> {t('agenda.newMessage')}
      </button>
      {hint ? (
        <span className="new-message-tooltip" role="status">
          {t('agenda.connectWhatsappHint')}
        </span>
      ) : null}
    </div>
  );
}

export default function CalendarView({ messages, onNewMessage }) {
  const { prefs, t } = usePreferences();
  const isWeekView = prefs.agendaView === 'week';
  const weekStartsOn = prefs.weekStartsOn === 'sunday' ? 'sunday' : 'monday';
  const weekdayOrder = weekStartsOn === 'sunday' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];
  const weekdayLabels = weekdayOrder.map((day) => t(`weekdayShort.${day}`));
  const timeZone = prefs.timezone || undefined;
  const hour12 = prefs.hourClock === '12h';
  const today = new Date();
  const todayParts = civilDateInTimeZone(today, timeZone);
  const [currentYear, setCurrentYear] = useState(todayParts.year);
  const [currentMonth, setCurrentMonth] = useState(todayParts.month);
  const [selectedDay, setSelectedDay] = useState(todayParts.day);
  const [dayPageOpen, setDayPageOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const onChange = () => {
      if (!media.matches) setDayPageOpen(false);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const messagesByDate = useMemo(() => {
    const map = {};
    if (!messages) return map;
    for (const msg of messages) {
      const key = scheduledDateKey(msg.scheduled_for, timeZone);
      if (!map[key]) map[key] = [];
      map[key].push(msg);
    }
    return map;
  }, [messages, timeZone]);

  const selectDate = (parts) => {
    setCurrentYear(parts.year);
    setCurrentMonth(parts.month);
    setSelectedDay(parts.day);
  };

  const openDay = (parts) => {
    selectDate(parts);
    if (window.matchMedia('(max-width: 768px)').matches) setDayPageOpen(true);
  };

  const goToPrev = () => {
    if (isWeekView) {
      selectDate(shiftDay(currentYear, currentMonth, selectedDay, -7));
      return;
    }

    const nextMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const nextYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const maxDay = getDaysInMonth(nextYear, nextMonth);
    setCurrentYear(nextYear);
    setCurrentMonth(nextMonth);
    setSelectedDay((day) => Math.min(day, maxDay));
  };

  const goToNext = () => {
    if (isWeekView) {
      selectDate(shiftDay(currentYear, currentMonth, selectedDay, 7));
      return;
    }

    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const maxDay = getDaysInMonth(nextYear, nextMonth);
    setCurrentYear(nextYear);
    setCurrentMonth(nextMonth);
    setSelectedDay((day) => Math.min(day, maxDay));
  };

  const goToToday = () => {
    selectDate(todayParts);
  };

  const totalDays = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth, weekStartsOn);
  const weeks = getWeeksInMonth(currentYear, currentMonth, weekStartsOn);

  const dayCells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const dayNum = i - firstDay + 1;
    if (dayNum < 1 || dayNum > totalDays) {
      dayCells.push(null);
    } else {
      dayCells.push(dayNum);
    }
  }

  const week = weekDays(startOfWeek(currentYear, currentMonth, selectedDay, weekStartsOn));
  const selectedDateKey = formatDateKey(currentYear, currentMonth, selectedDay);
  const selectedMessages = [...(messagesByDate[selectedDateKey] || [])].sort(
    (a, b) => parseScheduledDate(a.scheduled_for) - parseScheduledDate(b.scheduled_for)
  );

  const isToday = (year, month, day) =>
    day === todayParts.day &&
    month === todayParts.month &&
    year === todayParts.year;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent': return <CheckCheck size={14} />;
      case 'failed': return <XCircle size={14} />;
      default: return <Clock size={14} />;
    }
  };

  const getStatusText = (status) => {
    if (status === 'sent') return t('status.sent');
    if (status === 'failed') return t('status.failed');
    return t('status.pending');
  };

  const dayDetail = (showBack) => (
    <>
      <div className="detail-header">
        {showBack ? (
          <button type="button" className="prefs-back" onClick={() => setDayPageOpen(false)}>
            <ChevronLeft size={16} />
            {t('agenda.backToCalendar')}
          </button>
        ) : null}
        <h2>
          {t('agenda.dayOf', { day: selectedDay, month: t(`month.${currentMonth}`), year: currentYear })}
        </h2>
      </div>

      {selectedMessages.length === 0 ? (
        <p className="placeholder chat-empty">{t('agenda.emptyDay')}</p>
      ) : (
        <div className="chat-thread">
          {selectedMessages.map((msg) => (
            <div key={msg.id} className="chat-row">
              <article
                className="chat-bubble"
                data-status={msg.status}
                title={getStatusText(msg.status)}
              >
                <span className="chat-bubble-recipient" title={msg.recipient}>
                  {msg.contact_name || msg.recipient}
                </span>
                {whatsappAccountLabel(msg, t) ? (
                  <span className="chat-bubble-wa">{whatsappAccountLabel(msg, t)}</span>
                ) : null}
                {msg.image_url && (
                  <img src={msg.image_url} alt="" className="chat-bubble-image" />
                )}
                {msg.content ? <p className="chat-bubble-text">{msg.content}</p> : null}
                <div className="chat-bubble-meta">
                  <time>
                    {formatScheduledTime(msg.scheduled_for, timeZone, hour12)}
                  </time>
                  <span className="chat-bubble-status" aria-label={getStatusText(msg.status)}>
                    {getStatusIcon(msg.status)}
                  </span>
                </div>
              </article>
            </div>
          ))}
        </div>
      )}
      <div className="calendar-detail-footer">
        <NewMessageButton onNewMessage={onNewMessage} />
      </div>
    </>
  );

  return (
    <div className="calendar-layout">
      <div className="glass-panel calendar-panel" data-tour="calendar" data-day-page={dayPageOpen ? 'true' : 'false'}>
        <div className="calendar-nav">
          <button onClick={goToPrev} className="nav-btn" aria-label={isWeekView ? t('agenda.prevWeek') : t('agenda.prevMonth')}>
            <ChevronLeft size={20} />
          </button>
          <h2 className="calendar-title">
            {isWeekView ? (
              weekTitle(week, t)
            ) : (
              <>
                <span className="calendar-title-month">{t(`month.${currentMonth}`)}</span>
                <span className="calendar-title-year">{currentYear}</span>
              </>
            )}
          </h2>
          <button onClick={goToNext} className="nav-btn" aria-label={isWeekView ? t('agenda.nextWeek') : t('agenda.nextMonth')}>
            <ChevronRight size={20} />
          </button>
        </div>

        {isWeekView ? (
          <>
            <div className="calendar-weekdays">
              {weekdayLabels.map((d) => (
                <div key={d} className="weekday-header">{d}</div>
              ))}
            </div>
            <div className="week-grid">
              {week.map((cell) => {
                const dayMsgs = [...(messagesByDate[cell.key] || [])].sort(
                  (a, b) => parseScheduledDate(a.scheduled_for) - parseScheduledDate(b.scheduled_for)
                );
                const isTodayCell = isToday(cell.year, cell.month, cell.day);
                const isSelected = cell.key === selectedDateKey;
                const visible = dayMsgs.slice(0, 4);

                return (
                  <div
                    key={cell.key}
                    className={`week-cell${isTodayCell ? ' week-cell--today' : ''}${isSelected ? ' week-cell--selected' : ''}`}
                    onClick={() => openDay(cell)}
                  >
                    <div className="week-cell-head">
                      <span className="week-cell-day">{cell.day}</span>
                      {cell.month !== currentMonth ? (
                        <span className="week-cell-month">{t(`monthShort.${cell.month}`)}</span>
                      ) : null}
                    </div>
                    <div className="week-events">
                      {visible.map((msg) => (
                        <article key={msg.id} className="week-event" data-status={msg.status}>
                          <strong>{formatScheduledTime(msg.scheduled_for, timeZone, hour12)}</strong>
                          <span>{msg.contact_name || msg.recipient}</span>
                        </article>
                      ))}
                      {dayMsgs.length > 4 ? (
                        <span className="week-event-more">{t('agenda.more', { count: dayMsgs.length - 4 })}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="calendar-weekdays">
              {weekdayLabels.map((d) => (
                <div key={d} className="weekday-header">{d}</div>
              ))}
            </div>

            <div className="calendar-grid">
              {dayCells.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="calendar-cell calendar-cell--empty" />;
                }

                const dateKey = formatDateKey(currentYear, currentMonth, day);
                const dayMsgs = [...(messagesByDate[dateKey] || [])].sort(
                  (a, b) => parseScheduledDate(a.scheduled_for) - parseScheduledDate(b.scheduled_for)
                );
                const isTodayCell = isToday(currentYear, currentMonth, day);
                const isSelected = selectedDay === day;
                const visibleDots = dayMsgs.slice(-4);

                return (
                  <div
                    key={dateKey}
                    className={`calendar-cell${isTodayCell ? ' calendar-cell--today' : ''}${isSelected ? ' calendar-cell--selected' : ''}${dayMsgs.length > 0 ? ' calendar-cell--has-events' : ''}`}
                    onClick={() => openDay({ year: currentYear, month: currentMonth, day })}
                  >
                    <span className="day-number">{day}</span>
                    {dayMsgs.length > 0 && (
                      <div className="day-events">
                        {visibleDots.map((msg) => (
                          <span
                            key={msg.id}
                            className="event-dot"
                            data-status={msg.status}
                            title={msg.content}
                          />
                        ))}
                        {dayMsgs.length > 4 && (
                          <span className="event-overflow">+{dayMsgs.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
        <div className="calendar-footer">
          <button type="button" onClick={goToToday} className="nav-btn nav-btn-today">
            {t('agenda.todayLabel', {
              day: todayParts.day,
              month: t(`month.${todayParts.month}`),
            })}
          </button>
          <div className="calendar-legend">
            <span className="legend-item">
              <span className="event-dot" data-status="pending" /> {t('agenda.legendPending')}
            </span>
            <span className="legend-item">
              <span className="event-dot" data-status="sent" /> {t('agenda.legendSent')}
            </span>
            <span className="legend-item">
              <span className="event-dot" data-status="failed" /> {t('agenda.legendFailed')}
            </span>
          </div>
        </div>
        {dayPageOpen ? (
          <div className="calendar-day-page">{dayDetail(true)}</div>
        ) : null}
      </div>

      <div className="glass-panel calendar-detail-panel">{dayDetail(false)}</div>
      <div className="calendar-new-message-bar">
        <NewMessageButton onNewMessage={onNewMessage} />
      </div>
    </div>
  );
}
