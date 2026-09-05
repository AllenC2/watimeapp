function pad(value) {
  return String(value).padStart(2, '0');
}

export function fromDateAndTime(date, time) {
  const clock = String(time || '').length === 5 ? `${time}:00` : time;
  return `${date}T${clock}`;
}

export function parseScheduledDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return new Date(NaN);

  if (/Z|[+-]\d{2}:\d{2}$/.test(raw)) {
    return new Date(raw);
  }

  const normalized = raw.replace(' ', 'T');
  const [dayPart, timePart = '00:00:00'] = normalized.split('T');
  const [year, month, day] = dayPart.split('-').map(Number);
  const [hour = 0, minute = 0, second = 0] = timePart.split(':').map(Number);

  if (!year || !month || !day) return new Date(raw);
  return new Date(year, month - 1, day, hour, minute, Math.floor(second));
}

export function formatScheduledTime(value) {
  const date = parseScheduledDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatScheduledDateTime(value) {
  const date = parseScheduledDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function scheduledDateKey(value) {
  const date = parseScheduledDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isScheduledDue(value, now = new Date()) {
  const date = parseScheduledDate(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= now.getTime();
}
