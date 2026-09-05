'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, CheckCheck, Clock, XCircle } from 'lucide-react';
import { formatScheduledTime, parseScheduledDate, scheduledDateKey } from '../lib/schedule-time';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Mon=0, Sun=6
}

function formatDateKey(year, month, day) {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function getWeeksInMonth(year, month) {
  const totalDays = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  return Math.ceil((firstDay + totalDays) / 7);
}

export default function CalendarView({ messages }) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  const messagesByDate = useMemo(() => {
    const map = {};
    if (!messages) return map;
    for (const msg of messages) {
      const key = scheduledDateKey(msg.scheduled_for);
      if (!map[key]) map[key] = [];
      map[key].push(msg);
    }
    return map;
  }, [messages]);

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDay(null);
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDay(null);
  };

  const goToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDay(null);
  };

  const totalDays = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const weeks = getWeeksInMonth(currentYear, currentMonth);

  const dayCells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const dayNum = i - firstDay + 1;
    if (dayNum < 1 || dayNum > totalDays) {
      dayCells.push(null);
    } else {
      dayCells.push(dayNum);
    }
  }

  const selectedDateKey = selectedDay !== null
    ? formatDateKey(currentYear, currentMonth, selectedDay)
    : null;
  const selectedMessages = selectedDateKey
    ? [...(messagesByDate[selectedDateKey] || [])].sort(
        (a, b) => parseScheduledDate(a.scheduled_for) - parseScheduledDate(b.scheduled_for)
      )
    : [];

  const isToday = (day) =>
    day === today.getDate() &&
    currentMonth === today.getMonth() &&
    currentYear === today.getFullYear();

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent': return <CheckCheck size={14} />;
      case 'failed': return <XCircle size={14} />;
      default: return <Clock size={14} />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'sent': return 'Enviado';
      case 'failed': return 'Error';
      default: return 'Pendiente';
    }
  };

  return (
    <div className="calendar-layout">
      <div className="glass-panel calendar-panel">
        {/* Navigation */}
        <div className="calendar-nav">
          <button onClick={goToPrevMonth} className="nav-btn" aria-label="Mes anterior">
            <ChevronLeft size={20} />
          </button>
          <h2 className="calendar-title">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
          <button onClick={goToToday} className="nav-btn nav-btn-today">
            Hoy
          </button>
          <button onClick={goToNextMonth} className="nav-btn" aria-label="Mes siguiente">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Legend */}
        <div className="calendar-legend">
          <span className="legend-item">
            <span className="event-dot" data-status="pending" /> Pendiente
          </span>
          <span className="legend-item">
            <span className="event-dot" data-status="sent" /> Enviado
          </span>
          <span className="legend-item">
            <span className="event-dot" data-status="failed" /> Error
          </span>
        </div>

        {/* Weekday headers */}
        <div className="calendar-weekdays">
          {WEEKDAYS.map((d) => (
            <div key={d} className="weekday-header">{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div className="calendar-grid">
          {dayCells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="calendar-cell calendar-cell--empty" />;
            }

            const dateKey = formatDateKey(currentYear, currentMonth, day);
            const dayMsgs = messagesByDate[dateKey] || [];
            const isTodayCell = isToday(day);
            const isSelected = selectedDay === day;

            return (
              <div
                key={dateKey}
                className={`calendar-cell${isTodayCell ? ' calendar-cell--today' : ''}${isSelected ? ' calendar-cell--selected' : ''}${dayMsgs.length > 0 ? ' calendar-cell--has-events' : ''}`}
                onClick={() => setSelectedDay(isSelected ? null : day)}
              >
                <span className="day-number">{day}</span>
                {dayMsgs.length > 0 && (
                  <div className="day-events">
                    {dayMsgs.slice(0, 4).map((msg) => (
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
      </div>

      {/* Day detail panel */}
      {selectedDay !== null && (
        <div className="glass-panel calendar-detail-panel">
          <div className="detail-header">
            <h2>
              {selectedDay} de {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <button onClick={() => setSelectedDay(null)} className="nav-btn" aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>

          {selectedMessages.length === 0 ? (
            <p className="placeholder chat-empty">No hay mensajes programados para este día.</p>
          ) : (
            <div className="chat-thread">
              {selectedMessages.map((msg) => (
                <div key={msg.id} className="chat-row">
                  <article
                    className="chat-bubble"
                    data-status={msg.status}
                    title={getStatusText(msg.status)}
                  >
                    <span className="chat-bubble-recipient">{msg.recipient}</span>
                    {msg.image_url && (
                      <img src={msg.image_url} alt="" className="chat-bubble-image" />
                    )}
                    {msg.content ? <p className="chat-bubble-text">{msg.content}</p> : null}
                    <div className="chat-bubble-meta">
                      <time>
                        {formatScheduledTime(msg.scheduled_for)}
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
        </div>
      )}
    </div>
  );
}
