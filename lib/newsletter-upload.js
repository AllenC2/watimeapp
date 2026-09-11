import fs from 'fs';
import path from 'path';
import { absoluteUploadPath } from './uploads';

export function isNewsletterJid(jid) {
  return String(jid || '').includes('@newsletter');
}

export function resolvePublicImage(imageUrl) {
  const fullPath = absoluteUploadPath(imageUrl);
  if (!fullPath || !fs.existsSync(fullPath)) {
    throw new Error(`No se encontró el archivo de imagen: ${imageUrl}`);
  }
  return fullPath;
}

export function mimeFromPath(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
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

export async function prepareImageBuffer(filePath) {
  const original = fs.readFileSync(filePath);
  try {
    const sharp = (await import('sharp')).default;
    const buffer = await sharp(original).rotate().jpeg({ quality: 85 }).toBuffer();
    return { buffer, mimetype: 'image/jpeg' };
  } catch (err) {
    console.warn('[WhatsApp] No se pudo convertir la imagen a JPEG:', err.message || err);
    return {
      buffer: original,
      mimetype: mimeFromPath(filePath),
    };
  }
}

function isRejectedChannelMediaPath(directPath) {
  return String(directPath || '').startsWith('/o1/');
}

export function assertChannelMediaAccepted(jid, sent) {
  if (!isNewsletterJid(jid) || !sent?.message) return;
  const media =
    sent.message.imageMessage ||
    sent.message.videoMessage ||
    sent.message.documentMessage ||
    sent.message.audioMessage ||
    sent.message.stickerMessage;
  const directPath = media?.directPath || '';
  if (isRejectedChannelMediaPath(directPath)) {
    throw new Error(
      'WhatsApp rechazó la imagen del canal. El archivo se subió por una ruta incorrecta.'
    );
  }
}
