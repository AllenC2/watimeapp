export function formatWhatsAppPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('52') && digits.length >= 12) {
    const rest = digits.slice(2);
    if (rest.startsWith('1') && rest.length === 11) {
      return `+52 ${rest.slice(1, 3)} ${rest.slice(3, 7)} ${rest.slice(7)}`;
    }
    return `+52 ${rest}`;
  }
  return `+${digits}`;
}

export function phoneFromJid(id) {
  return String(id || '').split(':')[0].split('@')[0] || '';
}

export function whatsappAccountLabel(account = {}, t) {
  const name = String(account.name || account.whatsapp_name || '').trim();
  const formatted = formatWhatsAppPhone(account.phone || account.whatsapp_phone || '');
  const value = name || formatted;
  if (!value) return '';
  if (typeof t === 'function') return t('wa.by', { name: value });
  return `Por: ${value}`;
}
