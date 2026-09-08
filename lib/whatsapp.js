import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestWaWebVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { runQuery, getQuery } from './db';
import { isScheduledDue } from './schedule-time';
import { accountFromSock } from './whatsapp-account';
import { formatWhatsAppPhone } from './whatsapp-label';
import { authDirFor, statusPathFor } from './legacy-migrate';
import {
  isNewsletterJid,
  prepareImageBuffer,
  resolvePublicImage,
  sendChannelImage,
} from './newsletter-upload';

const QR_WAIT_MS = 20000;
const SCHEDULER_VERSION = 5;

function stores() {
  if (!globalThis.__whatsappClients) globalThis.__whatsappClients = new Map();
  return globalThis.__whatsappClients;
}

function store(userId) {
  const id = Number(userId);
  const map = stores();
  if (!map.has(id)) {
    map.set(id, {
      userId: id,
      sock: null,
      connecting: false,
      connected: false,
      reconnect: true,
      qrDataUrl: null,
      phone: '',
      name: '',
      platform: '',
      error: '',
      newsletterJids: new Set(),
      adminChannelsCache: null,
      schedulerTimer: null,
      connectPromise: null,
      generation: 0,
    });
    const file = readStatusFile(id);
    const created = map.get(id);
    for (const jid of file?.newsletterJids || []) {
      if (isNewsletterJid(jid)) created.newsletterJids.add(String(jid));
    }
  }
  return map.get(id);
}

function formatPhone(raw) {
  return formatWhatsAppPhone(raw);
}

function platformLabel(platform) {
  switch (String(platform || '').toLowerCase()) {
    case 'android':
      return 'Android';
    case 'ios':
      return 'iPhone';
    case 'smba':
    case 'smb':
      return 'Business';
    case 'web':
      return 'Web';
    default:
      return platform ? String(platform) : 'WhatsApp';
  }
}

function applyUser(userId, sock) {
  const state = store(userId);
  const user = sock?.user || {};
  state.phone = String(user.id || '').split(':')[0].split('@')[0] || '';
  state.name = user.name || user.notify || '';
  state.platform = sock?.authState?.creds?.platform || '';
}

function readStatusFile(userId) {
  try {
    return JSON.parse(fs.readFileSync(statusPathFor(userId), 'utf8'));
  } catch {
    return null;
  }
}

function writeStatusFile(userId) {
  const state = store(userId);
  const payload = {
    connected: state.connected,
    connecting: state.connecting,
    phone: state.phone,
    name: state.name,
    platform: state.platform,
    error: state.error || '',
    newsletterJids: [...(state.newsletterJids || [])],
    updatedAt: new Date().toISOString(),
  };
  try {
    fs.mkdirSync(path.dirname(statusPathFor(userId)), { recursive: true });
    fs.writeFileSync(statusPathFor(userId), JSON.stringify(payload));
  } catch (err) {
    console.error('[WhatsApp] No se pudo guardar el estado:', err.message);
  }
}

async function qrToDataUrl(qr) {
  return QRCode.toDataURL(String(qr), {
    errorCorrectionLevel: 'L',
    margin: 4,
    scale: 8,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}

export function getWhatsAppState(userId) {
  const state = store(userId);
  if (state.connected && state.sock) startScheduler(userId);
  const file = !state.connected ? readStatusFile(userId) : null;
  const fileAgeMs = file?.updatedAt ? Date.now() - new Date(file.updatedAt).getTime() : Infinity;
  const fileFresh = Number.isFinite(fileAgeMs) && fileAgeMs >= 0 && fileAgeMs < 25000;

  const connected = state.connected;
  const connecting = state.connecting || Boolean(fileFresh && file?.connecting && !connected);
  const qrDataUrl = state.qrDataUrl || null;
  const error = state.error || (!connected && !qrDataUrl && fileFresh ? file?.error || '' : '');
  const phone = state.phone || (fileFresh ? file?.phone || '' : '');
  const name = state.name || (fileFresh ? file?.name || '' : '');
  const platform = state.platform || (fileFresh ? file?.platform || '' : '');

  let status = 'offline';
  let statusLabel = 'Desconectado';

  if (connected) {
    status = 'connected';
    statusLabel = 'Conectado';
  } else if (connecting) {
    status = 'connecting';
    statusLabel = qrDataUrl ? 'Esperando QR' : 'Conectando...';
  }

  return {
    connected,
    connecting,
    qrDataUrl,
    error,
    status,
    statusLabel,
    state: status,
    stateLabel: statusLabel,
    phone,
    phoneLabel: formatPhone(phone) || 'Sin número',
    name,
    platform,
    platformLabel: platformLabel(platform),
    hasSession: Boolean(phone) || fs.existsSync(path.join(authDirFor(userId), 'creds.json')),
  };
}

function chatJid(chat) {
  return String(chat?.id || chat?.jid || '').trim();
}

function rememberNewsletterChats(userId, chats) {
  const state = store(userId);
  if (!state.newsletterJids) state.newsletterJids = new Set();
  let added = false;
  for (const chat of chats || []) {
    const jid = chatJid(chat);
    if (!isNewsletterJid(jid) || state.newsletterJids.has(jid)) continue;
    state.newsletterJids.add(jid);
    added = true;
  }
  if (added) {
    state.adminChannelsCache = null;
    writeStatusFile(userId);
  }
}

function newsletterRole(meta) {
  return String(meta?.viewer_metadata?.role || meta?.viewerMetadata?.role || meta?.role || '').toUpperCase();
}

function newsletterName(meta, jid) {
  const nested = meta?.thread_metadata?.name;
  const fromThread = typeof nested === 'string' ? nested : nested?.text;
  const name = String(meta?.name || fromThread || '').trim();
  if (name) return name;
  return `@${String(jid).split('@')[0]}`;
}

function formatChannelId(jid) {
  return `@${String(jid || '').split('@')[0]}`;
}

export async function listAdministeredNewsletters(userId) {
  const state = store(userId);
  if (!state.connected || !state.sock?.newsletterMetadata) {
    return { connected: false, channels: [] };
  }
  if (state.adminChannelsCache && Date.now() - state.adminChannelsCache.at < 20000) {
    return { connected: true, channels: state.adminChannelsCache.items };
  }

  const jids = [...(state.newsletterJids || [])];
  const channels = [];
  for (const jid of jids) {
    try {
      const meta = await state.sock.newsletterMetadata('jid', jid);
      const role = newsletterRole(meta);
      if (role === 'GUEST' || role === 'SUBSCRIBER') continue;
      channels.push({
        jid,
        id: formatChannelId(jid),
        name: newsletterName(meta, jid),
        role: role === 'OWNER' || role === 'ADMIN' ? role : '',
      });
    } catch (err) {
      console.warn('[WhatsApp] No se pudo leer canal', jid, err.message || err);
    }
  }
  channels.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  state.adminChannelsCache = { at: Date.now(), items: channels };
  return { connected: true, channels };
}

export function getWhatsAppAccount(userId, sock) {
  return accountFromSock(sock || store(userId).sock, userId);
}

export async function sendMessageNow(userId, msg) {
  const state = store(userId);
  if (!state.connected || !state.sock) {
    const error = new Error('WHATSAPP_OFFLINE');
    error.code = 'WHATSAPP_OFFLINE';
    throw error;
  }
  await sendScheduledMessage(state.sock, msg);
  return getWhatsAppAccount(userId, state.sock);
}

async function sendScheduledMessage(sock, msg) {
  let jid = String(msg.recipient || '').trim();
  let resultJid = jid;

  if (!jid.includes('@newsletter') && !jid.includes('@g.us')) {
    if (!jid.includes('@')) {
      jid = `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
    }

    let [result] = await sock.onWhatsApp(jid);
    if ((!result || !result.exists) && jid.startsWith('52') && !jid.startsWith('521') && jid.length === 27) {
      const altJid = jid.replace(/^52/, '521');
      const [altResult] = await sock.onWhatsApp(altJid);
      if (altResult?.exists) result = altResult;
    }

    if (result?.exists) resultJid = result.jid;
    else throw new Error('El número/JID no está registrado o es incorrecto.');
  }

  const imagePath = msg.image_url ? resolvePublicImage(msg.image_url) : null;

  if (imagePath && isNewsletterJid(resultJid)) {
    console.log(`[WhatsApp] Enviando imagen a canal ${resultJid} (mensaje ${msg.id})`);
    const sent = await sendChannelImage(sock, resultJid, imagePath, msg.content);
    if (!sent?.key?.id) {
      throw new Error('WhatsApp no confirmó el envío de la imagen al canal.');
    }
    console.log(`[WhatsApp] Mensaje ${msg.id} enviado`, sent.key.id);
    return;
  }

  let payload = { text: msg.content };
  if (imagePath) {
    const prepared = await prepareImageBuffer(imagePath);
    payload = {
      image: prepared.buffer,
      caption: msg.content || undefined,
      mimetype: prepared.mimetype,
    };
  }

  console.log(`[WhatsApp] Enviando mensaje ${msg.id} a ${resultJid}${imagePath ? ' (con imagen)' : ''}`);
  const sent = await sock.sendMessage(resultJid, payload);
  if (!sent?.key?.id) {
    throw new Error('WhatsApp no confirmó el envío del mensaje.');
  }
  console.log(`[WhatsApp] Mensaje ${msg.id} enviado`, sent.key.id);
}

function startScheduler(userId) {
  const state = store(userId);
  if (state.schedulerVersion === SCHEDULER_VERSION && state.schedulerTimer) return;
  if (state.schedulerTimer) clearInterval(state.schedulerTimer);

  const tick = async () => {
    const current = store(userId);
    if (!current.connected || !current.sock) return;

    try {
      const messages = await getQuery(
        `SELECT * FROM scheduled_messages WHERE user_id = ? AND status = 'pending'`,
        [userId]
      );
      const due = messages.filter((msg) => isScheduledDue(msg.scheduled_for));

      for (const msg of due) {
        try {
          await sendScheduledMessage(current.sock, msg);
          const account = getWhatsAppAccount(userId, current.sock);
          await runQuery(
            `UPDATE scheduled_messages SET status = 'sent', whatsapp_phone = ?, whatsapp_name = ? WHERE id = ? AND user_id = ?`,
            [account.phone || '', account.name || '', msg.id, userId]
          );
        } catch (err) {
          console.error(`[WhatsApp] Error enviando mensaje ${msg.id}:`, err.message || err);
          await runQuery(
            `UPDATE scheduled_messages SET status = 'failed' WHERE id = ? AND user_id = ?`,
            [msg.id, userId]
          );
        }
      }
    } catch (err) {
      console.error('[WhatsApp] Error en el scheduler:', err.message || err);
    }
  };

  state.schedulerTimer = setInterval(tick, 15000);
  state.schedulerVersion = SCHEDULER_VERSION;
  tick();
}

function endSocket(sock) {
  if (!sock) return;
  try {
    sock.ev?.removeAllListeners?.();
  } catch {
    /* ignore */
  }
  try {
    sock.end?.(undefined);
  } catch {
    /* ignore */
  }
  try {
    sock.ws?.close?.();
  } catch {
    /* ignore */
  }
}

async function wipeAuthDir(userId) {
  await fs.promises.rm(authDirFor(userId), { recursive: true, force: true });
}

async function baileysVersion() {
  try {
    const result = await Promise.race([
      fetchLatestWaWebVersion(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('version timeout')), 6000)),
    ]);
    if (result?.version) {
      console.log('[WhatsApp] Versión web', result.version.join('.'));
      return result.version;
    }
  } catch (err) {
    console.warn('[WhatsApp] No se pudo obtener la versión de WhatsApp Web:', err.message);
  }
  return undefined;
}

async function startSocket(userId) {
  const state = store(userId);
  const generation = ++state.generation;
  state.reconnect = true;
  state.connecting = true;
  state.connected = false;
  state.qrDataUrl = null;
  state.error = '';
  writeStatusFile(userId);

  const version = await baileysVersion();
  const { state: authState, saveCreds } = await useMultiFileAuthState(authDirFor(userId));
  const sock = makeWASocket({
    ...(version ? { version } : {}),
    auth: authState,
    browser: Browsers.macOS('Chrome'),
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  state.sock = sock;
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('chats.upsert', (chats) => rememberNewsletterChats(userId, chats));
  sock.ev.on('chats.update', (chats) => rememberNewsletterChats(userId, chats));
  sock.ev.on('messaging-history.set', ({ chats }) => rememberNewsletterChats(userId, chats));
  sock.ev.on('messages.upsert', ({ messages }) => {
    rememberNewsletterChats(
      userId,
      (messages || []).map((message) => ({ id: message?.key?.remoteJid }))
    );
  });

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(getWhatsAppState(userId));
    };

    const timeout = setTimeout(finish, QR_WAIT_MS);

    sock.ev.on('connection.update', async (update) => {
      const current = store(userId);
      if (current.generation !== generation) return;

      const { connection, lastDisconnect, qr } = update;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log('[WhatsApp] connection.update', {
        userId,
        connection: connection || null,
        hasQr: Boolean(qr),
        statusCode: statusCode || null,
      });

      if (qr) {
        current.pendingQr = qr;
        try {
          const dataUrl = await qrToDataUrl(qr);
          if (current.generation !== generation || current.pendingQr !== qr) return;
          current.qrDataUrl = dataUrl;
          current.connecting = true;
          current.error = '';
          writeStatusFile(userId);
          clearTimeout(timeout);
          finish();
        } catch (err) {
          current.error = `No se pudo dibujar el QR: ${err.message}`;
          writeStatusFile(userId);
          console.error('[WhatsApp] Error generando imagen QR:', err);
          clearTimeout(timeout);
          finish();
        }
      }

      if (connection === 'open') {
        current.connected = true;
        current.connecting = false;
        current.qrDataUrl = null;
        current.error = '';
        applyUser(userId, sock);
        writeStatusFile(userId);
        startScheduler(userId);
        console.log('[WhatsApp] Conectado', userId);
        clearTimeout(timeout);
        finish();
      }

      if (connection === 'close') {
        if (current.sock !== sock) return;

        const loggedOut = statusCode === DisconnectReason.loggedOut;
        const restartRequired = statusCode === DisconnectReason.restartRequired;
        current.connected = false;
        current.connecting = false;
        current.qrDataUrl = null;
        current.sock = null;
        current.error = loggedOut
          ? 'Sesión cerrada en el teléfono.'
          : lastDisconnect?.error?.message || `Conexión cerrada (${statusCode || 'sin código'}).`;
        writeStatusFile(userId);
        endSocket(sock);
        clearTimeout(timeout);
        finish();

        if (loggedOut) {
          wipeAuthDir(userId).catch(() => {});
          return;
        }

        if (current.reconnect) {
          setTimeout(() => {
            const latest = store(userId);
            if (!latest.connected && !latest.connecting && latest.reconnect) {
              connectWhatsApp(userId).catch((err) => {
                console.error('[WhatsApp] Error al reconectar:', err.message || err);
              });
            }
          }, restartRequired ? 1000 : 3000);
        }
      }
    });
  });
}

export async function connectWhatsApp(userId, { force = false } = {}) {
  const state = store(userId);

  if (force) {
    await logoutWhatsApp(userId);
  }

  if (state.connected && state.sock) return getWhatsAppState(userId);
  if (state.connectPromise) return state.connectPromise;

  if (state.connecting && !state.sock) {
    state.connecting = false;
  }

  if (state.sock && !state.connected && !state.qrDataUrl) {
    endSocket(state.sock);
    state.sock = null;
    state.connecting = false;
  }

  if (state.qrDataUrl && state.sock) return getWhatsAppState(userId);

  state.connectPromise = startSocket(userId).finally(() => {
    store(userId).connectPromise = null;
  });

  return state.connectPromise;
}

export async function logoutWhatsApp(userId) {
  const state = store(userId);
  state.reconnect = false;
  state.connecting = false;
  state.qrDataUrl = null;
  state.error = '';
  state.connectPromise = null;
  state.generation += 1;
  if (state.schedulerTimer) {
    clearInterval(state.schedulerTimer);
    state.schedulerTimer = null;
  }

  const sock = state.sock;
  state.sock = null;
  state.connected = false;
  state.phone = '';
  state.name = '';
  state.platform = '';

  try {
    if (sock) {
      await Promise.race([
        sock.logout(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('logout timeout')), 4000)),
      ]);
    }
  } catch {
    endSocket(sock);
  }

  await wipeAuthDir(userId);
  writeStatusFile(userId);
  return getWhatsAppState(userId);
}
