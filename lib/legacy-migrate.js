import fs from 'fs';
import path from 'path';

export function migrateLegacyWhatsAppFiles(userId) {
  const root = path.join(process.cwd(), 'auth_info_baileys');
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

export function authDirFor(userId) {
  return path.join(process.cwd(), 'auth_info_baileys', `user-${userId}`);
}

export function statusPathFor(userId) {
  return path.join(process.cwd(), 'whatsapp-status', `user-${userId}.json`);
}
