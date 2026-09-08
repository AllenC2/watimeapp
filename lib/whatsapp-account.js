import fs from 'fs';
import path from 'path';
import { phoneFromJid } from './whatsapp-label';
import { authDirFor, statusPathFor } from './legacy-migrate';

export { phoneFromJid };

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function readStoredWhatsAppAccount(userId) {
  const creds = readJson(path.join(authDirFor(userId), 'creds.json'));
  const fileStatus = readJson(statusPathFor(userId));
  const jid = String(creds?.me?.id || '');
  const phone = fileStatus?.phone || phoneFromJid(jid) || '';
  const name = fileStatus?.name || creds?.me?.name || '';
  return { phone, name, jid };
}

export function accountFromSock(sock, userId) {
  const user = sock?.user || {};
  const jid = String(user.id || '');
  const phone = phoneFromJid(jid);
  const name = user.name || user.notify || '';
  if (phone || name) return { phone, name, jid };
  return userId ? readStoredWhatsAppAccount(userId) : { phone: '', name: '', jid: '' };
}
