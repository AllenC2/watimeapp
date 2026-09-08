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

function localeOptions(timeZone) {
  return timeZone ? { timeZone } : {};
}

export function formatScheduledTime(value, timeZone, hour12 = false) {
  const date = parseScheduledDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(hour12 ? 'en-US' : 'es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: Boolean(hour12),
    ...localeOptions(timeZone),
  });
}

export function formatScheduledDateTime(value, timeZone, hour12 = false) {
  const date = parseScheduledDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(hour12 ? 'en-US' : 'es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: Boolean(hour12),
    ...localeOptions(timeZone),
  });
}

export function scheduledDateKey(value, timeZone) {
  const date = parseScheduledDate(value);
  if (Number.isNaN(date.getTime())) return '';
  if (timeZone) {
    return date.toLocaleDateString('en-CA', { timeZone });
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function civilDateInTimeZone(date = new Date(), timeZone) {
  const key = timeZone
    ? date.toLocaleDateString('en-CA', { timeZone })
    : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const [year, month, day] = key.split('-').map(Number);
  return { year, month: month - 1, day, key };
}

export function soonestScheduleParts(now = new Date(), extraMinutes = 10, timeZone) {
  const later = new Date(now.getTime() + extraMinutes * 60 * 1000);
  if (timeZone) {
    const date = later.toLocaleDateString('en-CA', { timeZone });
    const clock = later.toLocaleTimeString('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return { date, time: clock.replace('.', ':').slice(0, 5) };
  }
  return {
    date: `${later.getFullYear()}-${pad(later.getMonth() + 1)}-${pad(later.getDate())}`,
    time: `${pad(later.getHours())}:${pad(later.getMinutes())}`,
  };
}

export function formatLocalDateTime(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function isScheduledInPast(value, now = new Date()) {
  const date = parseScheduledDate(value);
  if (Number.isNaN(date.getTime())) return true;
  return date.getTime() < now.getTime();
}

export function isScheduledDue(value, now = new Date()) {
  const date = parseScheduledDate(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= now.getTime();
}
