export { messages } from './messages.js';

export function interpolate(template, vars = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] == null ? '' : String(vars[key])
  );
}

export function translate(messages, language, key, vars) {
  const pack = messages[language] || messages.es;
  const template = pack[key] ?? messages.es[key] ?? key;
  return interpolate(template, vars);
}

export function htmlLang(language) {
  return language === 'en' ? 'en' : 'es';
}

export function dateLocale(language) {
  return language === 'en' ? 'en-US' : 'es-MX';
}

const ERROR_TEXT_TO_KEY = {
  'Faltan campos requeridos': 'errors.missingFields',
  'Mensaje no válido': 'errors.invalidMessage',
  'El mensaje ya no existe': 'errors.messageGone',
  'El archivo debe ser una imagen JPG, PNG, WEBP o GIF': 'errors.imageType',
  'La imagen no puede superar 8 MB': 'errors.imageSize',
  'Escribe un nombre para el contacto': 'errors.contactName',
  'Escribe un número o ID válido': 'errors.contactId',
  'Contacto no válido': 'errors.invalidContact',
  'El contacto ya no existe': 'errors.contactGone',
  'Escribe el texto de la plantilla': 'errors.templateText',
  'Plantilla no válida': 'errors.invalidTemplate',
  'La plantilla ya no existe': 'errors.templateGone',
  'No se pudo cerrar la sesión': 'wa.errorLogout',
  'No se pudo iniciar la conexión': 'wa.errorStart',
};

export function tApiError(t, data, fallbackKey) {
  if (data?.code) return t(data.code, data);
  const text = String(data?.error || data || '');
  if (ERROR_TEXT_TO_KEY[text]) return t(ERROR_TEXT_TO_KEY[text]);
  const exists = text.match(/^Ya existe como (.+)$/);
  if (exists) return t('errors.contactExists', { name: exists[1] });
  return text || t(fallbackKey);
}
