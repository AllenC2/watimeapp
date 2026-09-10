export const PREFS_STORAGE_KEY = 'wp-panel-prefs';

export const DEFAULT_LOGO_SRC = '/logos/watime-logo-extend.svg?v=3';
export const APP_ICON_SRC = '/logos/watime-icono.svg?v=2';
export const APP_VERSION = '1.4';

export const DEFAULT_PREFS = {
  username: '',
  email: '',
  theme: 'lima',
  logoDataUrl: '',
  agendaView: 'month',
  weekStartsOn: 'monday',
  timezone: '',
  hourClock: '24h',
  language: 'es',
};

export function initialsFrom(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  if (words[0]) return words[0].slice(0, 2).toUpperCase();
  return 'U';
}

export function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '');
}

export function readPrefs() {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFS };
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    const next = { ...DEFAULT_PREFS };
    if (isThemeId(parsed.theme)) next.theme = parsed.theme;
    if (isLanguage(parsed.language)) next.language = parsed.language;
    return next;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function writePrefs(prefs) {
  const theme = isThemeId(prefs?.theme) ? prefs.theme : DEFAULT_PREFS.theme;
  const language = isLanguage(prefs?.language) ? prefs.language : DEFAULT_PREFS.language;
  window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ theme, language }));
  applyTheme(theme);
  applyLanguage(language);
  return { ...DEFAULT_PREFS, ...prefs, theme, language };
}

export function clearLocalData() {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFS };
  window.localStorage.removeItem(PREFS_STORAGE_KEY);
  try {
    window.sessionStorage.clear();
  } catch {
    /* ignore */
  }
  return writePrefs({
    ...DEFAULT_PREFS,
    timezone: detectTimeZone(),
  });
}

export const THEMES = [
  { id: 'lima', label: 'Lima', swatches: ['#f3ffe6', '#c8f542', '#3ee0a0'] },
  { id: 'dark', label: 'Oscuro', swatches: ['#0f111a', '#25D366', '#128C7E'] },
  { id: 'light', label: 'Claro', swatches: ['#eef2f6', '#128C7E', '#25D366'] },
  { id: 'marino', label: 'Marino', swatches: ['#0a1b3d', '#4aa3e8', '#e8c547'] },
  { id: 'bosque', label: 'Bosque', swatches: ['#07140f', '#5bb7d4', '#e07a2f'] },
  { id: 'petalo', label: 'Pétalo', swatches: ['#f8e4ea', '#ffffff', '#e4c04a'] },
];

export const THEME_IDS = THEMES.map((theme) => theme.id);

export function isThemeId(theme) {
  return THEME_IDS.includes(theme);
}

export const AGENDA_VIEWS = [
  { id: 'month', label: 'Mensual', description: 'Calendario por mes, como ahora' },
  { id: 'week', label: 'Semanal', description: 'Agenda de siete días' },
];

export const AGENDA_VIEW_IDS = AGENDA_VIEWS.map((view) => view.id);

export function isAgendaView(view) {
  return AGENDA_VIEW_IDS.includes(view);
}

export const WEEK_STARTS = [
  { id: 'monday', label: 'Lunes', description: 'La semana empieza el lunes' },
  { id: 'sunday', label: 'Domingo', description: 'La semana empieza el domingo' },
];

export const WEEK_START_IDS = WEEK_STARTS.map((item) => item.id);

export function isWeekStartsOn(value) {
  return WEEK_START_IDS.includes(value);
}

export function detectTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function isTimeZone(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function shouldAdoptBrowserTimeZone(stored) {
  return !isTimeZone(stored) || stored === 'UTC' || stored === 'Etc/UTC';
}

export function timeZoneMeta(timeZone, now = new Date(), locale = 'es') {
  const id = isTimeZone(timeZone) ? timeZone : detectTimeZone();
  const city = id.split('/').pop().replace(/_/g, ' ');
  let offset = '';
  try {
    offset =
      new Intl.DateTimeFormat(locale, {
        timeZone: id,
        timeZoneName: 'longOffset',
      })
        .formatToParts(now)
        .find((part) => part.type === 'timeZoneName')?.value || '';
  } catch {
    offset = '';
  }
  return { id, city, offset };
}

export const HOUR_CLOCKS = [
  { id: '24h', label: '24 horas', description: '13:00, 18:30' },
  { id: '12h', label: '12 horas', description: '1:00 PM, 6:30 PM' },
];

export const HOUR_CLOCK_IDS = HOUR_CLOCKS.map((item) => item.id);

export function isHourClock(value) {
  return HOUR_CLOCK_IDS.includes(value);
}

export const LANGUAGES = [
  { id: 'es', label: 'Español', description: 'Idioma del panel' },
  { id: 'en', label: 'English', description: 'Panel language' },
];

export const LANGUAGE_IDS = LANGUAGES.map((item) => item.id);

export function isLanguage(value) {
  return LANGUAGE_IDS.includes(value);
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', isThemeId(theme) ? theme : 'lima');
}

export function applyLanguage(language) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = isLanguage(language) ? language : 'es';
}
