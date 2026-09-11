const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');

if (process.env.ALLOW_LEGACY_BOT !== '1') {
  console.error(
    '[WATime] bot.js está desactivado. El envío lo hace el panel Next.js por usuario.\n' +
      'Si necesitas el bot legado, arráncalo con ALLOW_LEGACY_BOT=1 (no lo uses en multi-usuario).'
  );
  process.exit(1);
}

console.warn('[WATime] bot.js no aísla datos por usuario. Usa el panel Next.js (lib/whatsapp.js).');

const dbPath = path.resolve(__dirname, 'messages.db');
const db = new sqlite3.Database(dbPath);

const runQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const getQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Variables globales para mantener el estado de la conexión
let globalSock = null;
let isConnected = false;
let schedulerStarted = false;
const statusPath = path.join(__dirname, 'whatsapp-status.json');

function getSessionInfo(sock) {
  const user = sock?.user || {};
  const id = user.id || '';
  return {
    phone: id.split(':')[0].split('@')[0] || '',
    name: user.name || user.notify || '',
    platform: sock?.authState?.creds?.platform || '',
  };
}

function writeStatus() {
  const info = getSessionInfo(globalSock);
  const payload = {
    connected: isConnected,
    ...info,
    updatedAt: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(statusPath, JSON.stringify(payload));
  } catch (err) {
    console.error('[Status] No se pudo guardar el estado de WhatsApp:', err.message);
  }
}

writeStatus();
setInterval(writeStatus, 5000);

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
  });

  globalSock = sock;

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n[!] Escanea este código QR con tu aplicación de WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      isConnected = false;
      writeStatus();
      const statusCode = lastDisconnect.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`[!] Conexión cerrada (Código: ${statusCode}). Reconectando: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 3000); // Pequeño delay antes de reconectar
      } else {
        console.log('[!] Sesión cerrada. Por favor elimina la carpeta auth_info_baileys y vuelve a escanear el QR.');
      }
    } else if (connection === 'open') {
      isConnected = true;
      writeStatus();
      console.log('\n[✓] ¡Conectado exitosamente a WhatsApp!');
      
      if (!schedulerStarted) {
        startScheduler();
        schedulerStarted = true;
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Escuchar mensajes entrantes para ayudar al usuario a obtener el JID de su canal o grupo
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.key.fromMe && m.type === 'notify') {
      const jid = msg.key.remoteJid;
      if (jid && jid.includes('@newsletter')) {
        console.log(`\n[INFO] 📡 Actividad detectada en un Canal. El JID de tu canal es: ${jid}\n`);
      } else if (jid && jid.includes('@g.us')) {
        console.log(`\n[INFO] 👥 Actividad detectada en un Grupo. El JID del grupo es: ${jid}\n`);
      }
    }
  });
}

function startScheduler() {
  console.log('[Scheduler] Iniciando... Verificando mensajes cada minuto.');
  
  // Ejecutar verificación cada 30 segundos
  setInterval(async () => {
    if (!isConnected || !globalSock) return; // No hacer nada si no estamos conectados

    try {
      const now = new Date().toISOString();
      
      const messages = await getQuery(
        `SELECT * FROM scheduled_messages WHERE status = 'pending' AND scheduled_for <= ?`,
        [now]
      );

      if (messages.length > 0) {
        console.log(`\n[Scheduler] Encontrados ${messages.length} mensajes para enviar.`);
        
        for (const msg of messages) {
          try {
            console.log(`[Scheduler] Procesando mensaje ID ${msg.id} para ${msg.recipient}...`);
            
            let jid = msg.recipient.trim();
            if (jid.startsWith('@') && !jid.includes('@newsletter') && !jid.includes('@g.us')) {
              jid = `${jid.slice(1)}@newsletter`;
            }
            let resultJid = jid;

            if (jid.includes('@newsletter') || jid.includes('@g.us')) {
              console.log(`[Scheduler] Destinatario reconocido como Canal o Grupo: ${jid}`);
            } else {
              if (!jid.includes('@')) {
                jid = jid.replace(/\D/g, '') + '@s.whatsapp.net';
              }

              console.log(`[Scheduler] Verificando si ${jid} existe en WhatsApp...`);
              let [result] = await globalSock.onWhatsApp(jid);

              // Manejo especial para números de México
              if ((!result || !result.exists) && jid.startsWith('52') && !jid.startsWith('521') && jid.length === 27) {
                const altJid = jid.replace(/^52/, '521');
                console.log(`[Scheduler] Intentando alternativa (formato México): ${altJid}`);
                const [altResult] = await globalSock.onWhatsApp(altJid);
                if (altResult && altResult.exists) {
                  result = altResult;
                }
              }

              if (result && result.exists) {
                resultJid = result.jid;
              } else {
                throw new Error(`El número/JID no está registrado o es incorrecto.`);
              }
            }

            console.log(`[Scheduler] Enviando mensaje a: ${resultJid}`);
            
            // Pausa pequeña para estabilizar conexión antes del envío
            await new Promise(res => setTimeout(res, 500));

            const {
              mimeFromPath,
              resolvePublicImage,
              assertChannelMediaAccepted,
            } = await import('./lib/newsletter-upload.js');

            const imagePath = msg.image_url ? resolvePublicImage(msg.image_url) : null;
            const payload = imagePath
              ? {
                  image: fs.readFileSync(imagePath),
                  caption: msg.content || undefined,
                  mimetype: mimeFromPath(imagePath),
                }
              : { text: msg.content };

            const sent = await globalSock.sendMessage(resultJid, payload);
            if (!sent?.key?.id) {
              throw new Error('WhatsApp no confirmó el envío del mensaje.');
            }
            assertChannelMediaAccepted(resultJid, sent);
            
            const waUser = globalSock?.user || {};
            const waPhone = String(waUser.id || '').split(':')[0].split('@')[0] || '';
            const waName = waUser.name || waUser.notify || '';
            await runQuery(
              `UPDATE scheduled_messages SET status = 'sent', whatsapp_phone = ?, whatsapp_name = ? WHERE id = ?`,
              [waPhone, waName, msg.id]
            );
            console.log(`[✓] Mensaje ID ${msg.id} enviado con éxito.`);
            
          } catch (sendError) {
            console.error(`[X] Error enviando mensaje ID ${msg.id}:`, sendError.message || sendError);
            await runQuery(`UPDATE scheduled_messages SET status = 'failed' WHERE id = ?`, [msg.id]);
          }
        }
      }
    } catch (dbError) {
      console.error('[X] Error al consultar base de datos en scheduler:', dbError);
    }
  }, 30000);
}

connectToWhatsApp();
