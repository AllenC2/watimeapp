export function uploadPathOwnerId(pathname) {
  let raw = String(pathname || '');
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (raw.includes('..') || raw.includes('\\')) return null;
  const match = raw.match(/^\/uploads\/(\d+)\/([^/]+)$/);
  if (!match) return null;
  const userId = Number(match[1]);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  if (!match[2] || match[2].startsWith('.')) return null;
  return userId;
}

export function canReadUpload(pathname, userId) {
  const ownerId = uploadPathOwnerId(pathname);
  return ownerId != null && ownerId === Number(userId);
}
