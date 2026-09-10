import fs from 'fs';
import path from 'path';

export function migrateLegacyWhatsAppFiles(userId) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), ['auth_info', 'baileys'].join('_'));
  const dest = path.join(root, `user-${userId}`);
  if (fs.existsSync(root) && fs.existsSync(path.join(root, 'creds.json'))) {
    if (!fs.existsSync(path.join(dest, 'creds.json'))) {
      fs.mkdirSync(dest, { recursive: true });
      for (const name of fs.readdirSync(root)) {
        if (name.startsWith('user-')) continue;
        fs.renameSync(path.join(root, name), path.join(dest, name));
      }
    }
  }

  const oldStatus = path.join(process.cwd(), 'whatsapp-status.json');
  if (fs.existsSync(oldStatus)) {
    const dir = path.join(process.cwd(), 'whatsapp-status');
    fs.mkdirSync(dir, { recursive: true });
    const next = path.join(dir, `user-${userId}.json`);
    if (!fs.existsSync(next)) fs.renameSync(oldStatus, next);
    else fs.unlinkSync(oldStatus);
  }
}

export function authDirRoot() {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), ['auth_info', 'baileys'].join('_'));
}

export function authDirFor(userId) {
  return path.join(authDirRoot(), `user-${userId}`);
}

export function listRestorableUserIds() {
  const root = authDirRoot();
  if (!fs.existsSync(root)) return [];

  const ids = [];
  for (const name of fs.readdirSync(root)) {
    const match = String(name).match(/^user-(\d+)$/);
    if (!match) continue;
    const userId = Number(match[1]);
    if (!Number.isInteger(userId) || userId <= 0) continue;
    if (!fs.existsSync(path.join(root, name, 'creds.json'))) continue;
    ids.push(userId);
  }
  return ids.sort((a, b) => a - b);
}

export function statusPathFor(userId) {
  return path.join(process.cwd(), 'whatsapp-status', `user-${userId}.json`);
}
