const fs = require('fs');
const path = require('path');

const root = path.join(
  process.cwd(),
  'node_modules',
  '@whiskeysockets',
  'baileys',
  'lib'
);

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function write(rel, text) {
  fs.writeFileSync(path.join(root, rel), text);
}

function ensure(rel, needle, message) {
  const text = read(rel);
  if (!text.includes(needle)) {
    console.warn(`[patch-baileys] ${message} (${rel})`);
    return false;
  }
  return true;
}

if (!fs.existsSync(root)) {
  console.warn('[patch-baileys] Baileys no está instalado, se omite el parche.');
  process.exit(0);
}

const ok =
  ensure('Defaults/index.js', 'NEWSLETTER_MEDIA_PATH_MAP', 'falta el mapa de media de canales') &&
  ensure('Utils/messages-media.js', 'newsletter ? NEWSLETTER_MEDIA_PATH_MAP', 'falta la ruta de subida de canales') &&
  ensure('Utils/messages.js', 'newsletter: true', 'falta el flag newsletter en prepareWAMessageMedia') &&
  ensure('Utils/messages.js', 'fileEncSha256: fileSha256', 'falta fileEncSha256 en el proto de canales') &&
  ensure('Socket/messages-send.js', 'attrs: extraAttrs', 'falta mediatype en el plaintext del canal');

if (ok) {
  console.log('[patch-baileys] Parche de media para canales presente.');
} else {
  console.warn('[patch-baileys] Revisa lib/whatsapp.js y vuelve a aplicar el parche de Baileys para canales.');
}
