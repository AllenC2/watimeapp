import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { runQuery, getQuery } from './db';
import { isScheduledDue } from './schedule-time';
import {
  isNewsletterJid,
  prepareImageBuffer,
  resolvePublicImage,
  sendChannelImage,
} from './newsletter-upload';

const AUTH_DIR = path.join(process.cwd(), 'auth_info_baileys');
const STATUS_PATH = path.join(process.cwd(), 'whatsapp-status.json');
const QR_WAIT_MS = 20000;
const SCHEDULER_VERSION = 4;

function store() {
  if (!globalThis.__whatsappClient) {
    globalThis.__whatsappClient = {
      sock: null,
      connecting: false,
      connected: false,
      reconnect: true,
      qrDataUrl: null,
      phone: '',
      name: '',
      platform: '',
      error: '',
      schedulerStarted: false,
      schedulerTimer: null,
      connectPromise: null,
      generation: 0,
    };
  }
  return globalThis.__whatsappClient;
}

function formatPhone(raw) {
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

function phoneFromJid(id) {
  return String(id || '').split(':')[0].split('@')[0] || '';
}

function applyUser(sock) {
  const state = store();
  const user = sock?.user || {};
  state.phone = phoneFromJid(user.id);
  state.name = user.name || user.notify || '';
  state.platform = sock?.authState?.creds?.platform || '';
}

function readStatusFile() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeStatusFile() {
  const state = store();
  const payload = {
    connected: state.connected,
    connecting: state.connecting,
    phone: state.phone,
    name: state.name,
    platform: state.platform,
    qrDataUrl: state.qrDataUrl,
    error: state.error || '',
    updatedAt: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(STATUS_PATH, JSON.stringify(payload));
  } catch (err) {
    console.error('[WhatsApp] No se pudo guardar el estado:', err.message);
  }
}

async function qrToDataUrl(qr) {
  const options = {
    width: 280,
    margin: 1,
    color: { dark: '#111111', light: '#ffffff' },
  };
  try {
    return await QRCode.toDataURL(qr, { ...options, errorCorrectionLevel: 'M' });
  } catch {
    return QRCode.toDataURL(qr, { ...options, errorCorrectionLevel: 'L' });
  }
}

export function getWhatsAppState() {
  const state = store();
  if (state.connected && state.sock) startScheduler();
  const file = !state.qrDataUrl && !state.connected ? readStatusFile() : null;
  const fileAgeMs = file?.updatedAt ? Date.now() - new Date(file.updatedAt).getTime() : Infinity;
  const fileFresh = Number.isFinite(fileAgeMs) && fileAgeMs >= 0 && fileAgeMs < 25000;

  const connected = state.connected;
  const connecting = state.connecting || Boolean(fileFresh && file?.connecting && !connected);
  const qrDataUrl = state.qrDataUrl || (!connected && fileFresh ? file?.qrDataUrl || null : null);
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
    hasSession: Boolean(phone) || fs.existsSync(path.join(AUTH_DIR, 'creds.json')),
  };
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

function startScheduler() {
  const state = store();
  if (state.schedulerVersion === SCHEDULER_VERSION && state.schedulerTimer) return;
  if (state.schedulerTimer) clearInterval(state.schedulerTimer);

  const tick = async () => {
    const current = store();
    if (!current.connected || !current.sock) {
      return;
    }

    try {
      const messages = await getQuery(
        `SELECT * FROM scheduled_messages WHERE status = 'pending'`
      );
      const due = messages.filter((msg) => isScheduledDue(msg.scheduled_for));

      for (const msg of due) {
        try {
          await sendScheduledMessage(current.sock, msg);
          await runQuery(`UPDATE scheduled_messages SET status = 'sent' WHERE id = ?`, [msg.id]);
        } catch (err) {
          console.error(`[WhatsApp] Error enviando mensaje ${msg.id}:`, err.message || err);
          await runQuery(`UPDATE scheduled_messages SET status = 'failed' WHERE id = ?`, [msg.id]);
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

async function wipeAuthDir() {
  await fs.promises.rm(AUTH_DIR, { recursive: true, force: true });
}

async function baileysVersion() {
  try {
    const result = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('version timeout')), 4000)),
    ]);
    return result?.version;
  } catch (err) {
    console.warn('[WhatsApp] No se pudo obtener la versión de Baileys:', err.message);
    return undefined;
  }
}

async function startSocket() {
  const state = store();
  const generation = ++state.generation;
  state.reconnect = true;
  state.connecting = true;
  state.connected = false;
  state.qrDataUrl = null;
  state.error = '';
  writeStatusFile();

  const version = await baileysVersion();
  const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const sock = makeWASocket({
    ...(version ? { version } : {}),
    auth: authState,
    browser: Browsers.ubuntu('Chrome'),
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  state.sock = sock;
  sock.ev.on('creds.update', saveCreds);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(getWhatsAppState());
    };

    const timeout = setTimeout(finish, QR_WAIT_MS);

    sock.ev.on('connection.update', async (update) => {
      const current = store();
      if (current.generation !== generation) return;

      const { connection, lastDisconnect, qr } = update;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log('[WhatsApp] connection.update', {
        connection: connection || null,
        hasQr: Boolean(qr),
        statusCode: statusCode || null,
      });

      if (qr) {
        try {
          current.qrDataUrl = await qrToDataUrl(qr);
          current.connecting = true;
          current.error = '';
          writeStatusFile();
          clearTimeout(timeout);
          finish();
        } catch (err) {
          current.error = `No se pudo dibujar el QR: ${err.message}`;
          writeStatusFile();
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
        applyUser(sock);
        writeStatusFile();
        startScheduler();
        console.log('[WhatsApp] Conectado');
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
        writeStatusFile();
        endSocket(sock);
        clearTimeout(timeout);
        finish();

        if (loggedOut) {
          wipeAuthDir().catch(() => {});
          return;
        }

        if (current.reconnect) {
          setTimeout(() => {
            const latest = store();
            if (!latest.connected && !latest.connecting && latest.reconnect) {
              connectWhatsApp().catch((err) => {
                console.error('[WhatsApp] Error al reconectar:', err.message || err);
              });
            }
          }, restartRequired ? 1000 : 3000);
        }
      }
    });
  });
}

export async function connectWhatsApp({ force = false } = {}) {
  const state = store();

  if (force) {
    await logoutWhatsApp();
  }

  if (state.connected && state.sock) return getWhatsAppState();
  if (state.connectPromise) return state.connectPromise;

  if (state.connecting && !state.sock) {
    state.connecting = false;
  }

  if (state.sock && !state.connected && !state.qrDataUrl) {
    endSocket(state.sock);
    state.sock = null;
    state.connecting = false;
  }

  if (state.qrDataUrl && state.sock) return getWhatsAppState();

  state.connectPromise = startSocket().finally(() => {
    store().connectPromise = null;
  });

  return state.connectPromise;
}

export async function logoutWhatsApp() {
  const state = store();
  state.reconnect = false;
  state.connecting = false;
  state.qrDataUrl = null;
  state.error = '';
  state.connectPromise = null;
  state.generation += 1;

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

  await wipeAuthDir();
  writeStatusFile();
  return getWhatsAppState();
}
