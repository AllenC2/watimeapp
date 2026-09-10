import fs from 'fs';
import https from 'https';
import path from 'path';
import {
  extractImageThumb,
  generateWAMessageFromContent,
  getRawMediaUploadData,
} from '@whiskeysockets/baileys';
import { absoluteUploadPath } from './uploads';

const NEWSLETTER_MEDIA_PATH = {
  image: '/newsletter/newsletter-image',
  video: '/newsletter/newsletter-video',
  document: '/newsletter/newsletter-document',
  audio: '/newsletter/newsletter-audio',
  gif: '/newsletter/newsletter-gif',
  ptt: '/newsletter/newsletter-ptt',
  ptv: '/newsletter/newsletter-ptv',
  sticker: '/newsletter/newsletter-sticker',
  'thumbnail-link': '/newsletter/newsletter-image',
};

function encodeHashForUpload(b64) {
  return encodeURIComponent(
    String(b64 || '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
  );
}

function postFile(url, filePath, timeoutMs = 30000) {
  const size = fs.statSync(filePath).size;
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': size,
          Origin: 'https://web.whatsapp.com',
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error(body || `Error de subida (${res.statusCode})`));
          }
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Tiempo de espera agotado al subir la imagen'));
    });
    req.on('error', reject);
    fs.createReadStream(filePath).pipe(req);
  });
}

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

export function createNewsletterUpload(sock) {
  return async (filePath, opts = {}) => {
    const mediaType = opts.mediaType || 'image';
    const hash = opts.fileEncSha256B64 || opts.fileEncSha256B64;
    const timeoutMs = opts.timeoutMs || opts.timeoutMs || 30000;
    const token = encodeHashForUpload(hash);
    const mediaPath = NEWSLETTER_MEDIA_PATH[mediaType] || `/newsletter/newsletter-${mediaType}`;

    let mediaConn = await sock.refreshMediaConn(false);
    const hosts = [...(mediaConn.hosts || [])];

    for (const host of hosts) {
      const hostname = host.hostname || host.host;
      if (!hostname) continue;
      const auth = encodeURIComponent(mediaConn.auth);
      const url = `https://${hostname}${mediaPath}/${token}?auth=${auth}&token=${token}&server_thumb_gen=1`;
      try {
        const result = await postFile(url, filePath, timeoutMs);
        if (result?.url || result?.direct_path) {
          console.log('[WhatsApp] Media de canal subida', {
            mediaType,
            directPath: result.direct_path || null,
            hasThumb: Boolean(result.thumbnail_info?.thumbnail_direct_path),
            keys: Object.keys(result),
          });
          return {
            mediaUrl: result.url,
            directPath: result.direct_path,
            meta_hmac: result.meta_hmac,
            fbid: result.fbid,
            ts: result.ts,
            thumbnailDirectPath: result.thumbnail_info?.thumbnail_direct_path,
            thumbnailSha256: result.thumbnail_info?.thumbnail_sha256,
          };
        }
        mediaConn = await sock.refreshMediaConn(true);
      } catch (err) {
        console.warn(`[WhatsApp] Falló subida de canal a ${hostname}:`, err.message || err);
      }
    }

    throw new Error('No se pudo subir la imagen al canal de WhatsApp');
  };
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
  if (directPath.startsWith('/o1/')) {
    throw new Error(
      'WhatsApp rechazó la imagen del canal. El archivo se subió por una ruta incorrecta.'
    );
  }
}

export async function sendChannelImage(sock, jid, imagePath, caption) {
  const prepared = await prepareImageBuffer(imagePath);
  const { filePath, fileSha256, fileLength } = await getRawMediaUploadData(prepared.buffer, 'image');

  try {
    const uploaded = await createNewsletterUpload(sock)(filePath, {
      mediaType: 'image',
      fileEncSha256B64: fileSha256.toString('base64'),
    });

    if (!uploaded?.directPath || String(uploaded.directPath).startsWith('/o1/')) {
      throw new Error('WhatsApp devolvió una ruta de imagen inválida para el canal.');
    }

    let jpegThumbnail;
    let width = prepared.width;
    let height = prepared.height;
    try {
      const thumb = await extractImageThumb(prepared.buffer, 64);
      jpegThumbnail = thumb.buffer;
      width = thumb.original?.width || width;
      height = thumb.original?.height || height;
    } catch (err) {
      console.warn('[WhatsApp] No se pudo generar miniatura:', err.message || err);
    }

    const imageMessage = {
      directPath: uploaded.directPath,
      mimetype: prepared.mimetype,
      fileSha256,
      fileEncSha256: fileSha256,
      fileLength,
    };

    if (caption) imageMessage.caption = caption;
    if (jpegThumbnail) imageMessage.jpegThumbnail = jpegThumbnail;
    if (width) imageMessage.width = width;
    if (height) imageMessage.height = height;
    if (uploaded.thumbnailDirectPath) {
      imageMessage.thumbnailDirectPath = uploaded.thumbnailDirectPath;
    }
    if (uploaded.thumbnailSha256) {
      imageMessage.thumbnailSha256 = Buffer.isBuffer(uploaded.thumbnailSha256)
        ? uploaded.thumbnailSha256
        : Buffer.from(String(uploaded.thumbnailSha256), 'base64');
    }

    console.log('[WhatsApp] Proto de imagen de canal', {
      directPath: imageMessage.directPath,
      mimetype: imageMessage.mimetype,
      fileLength,
      hasEncSha: Boolean(imageMessage.fileEncSha256),
      hasJpegThumb: Boolean(imageMessage.jpegThumbnail),
      hasThumbPath: Boolean(imageMessage.thumbnailDirectPath),
    });

    const full = generateWAMessageFromContent(
      jid,
      { imageMessage },
      { userJid: sock.user?.id || sock.authState?.creds?.me?.id }
    );

    await sock.relayMessage(jid, full.message, { messageId: full.key.id });
    return full;
  } finally {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  }
}
