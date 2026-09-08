export function normalizeIdentifier(raw) {
  const value = String(raw || '').trim();
  if (!value) return { identifier: '', searchKey: '' };
  if (value.includes('@')) {
    const identifier = value;
    return { identifier, searchKey: identifier.toLowerCase() };
  }
  const digits = value.replace(/\D/g, '');
  return {
    identifier: digits || value,
    searchKey: (digits || value).toLowerCase(),
  };
}

export function looksLikeIdentifier(raw) {
  const value = String(raw || '').trim();
  if (!value) return false;
  if (value.includes('@')) return true;
  return value.replace(/\D/g, '').length >= 3;
}

export function contactMatches(contact, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  if (String(contact.name || '').toLowerCase().includes(q)) return true;
  if (String(contact.identifier || '').toLowerCase().includes(q)) return true;
  if (digits && String(contact.search_key || '').includes(digits)) return true;
  return false;
}

export function isExactContactMatch(contact, query) {
  const { identifier, searchKey } = normalizeIdentifier(query);
  if (!identifier) return false;
  return (
    String(contact.identifier || '').toLowerCase() === identifier.toLowerCase() ||
    String(contact.search_key || '') === searchKey
  );
}
