import path from 'path';

export function uploadsRoot() {
  return path.resolve(process.cwd(), 'public', 'uploads');
}

export function uploadPathOwnerId(pathname) {
  let raw = String(pathname || '');
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  raw = raw.split('?')[0];
  if (raw.startsWith('/api/uploads/')) raw = raw.slice(4);
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

export function parseUploadUrl(imageUrl) {
  let raw = String(imageUrl || '').split('?')[0];
  if (!raw) return null;
  if (!raw.startsWith('/')) raw = `/${raw}`;
  if (raw.startsWith('/api/uploads/')) raw = raw.slice(4);
  const ownerId = uploadPathOwnerId(raw);
  if (ownerId == null) return null;
  const match = raw.match(/^\/uploads\/(\d+)\/([^/]+)$/);
  if (!match) return null;
  return { userId: ownerId, filename: match[2], pathname: raw };
}

export function absoluteUploadPath(imageUrl) {
  const parsed = parseUploadUrl(imageUrl);
  if (!parsed) return null;
  const dir = path.resolve(uploadsRoot(), String(parsed.userId));
  const fullPath = path.resolve(dir, parsed.filename);
  const prefix = `${dir}${path.sep}`;
  if (fullPath !== dir && !fullPath.startsWith(prefix)) return null;
  return fullPath;
}

export function mimeForUploadFilename(filename) {
  switch (path.extname(filename || '').toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'image/jpeg';
  }
}
