const fs = require('fs');
const path = require('path');

const root = path.join(
  process.cwd(),
  'node_modules',
  '@whiskeysockets',
  'baileys',
  'lib'
);

if (!fs.existsSync(root)) {
  throw new Error('[patch-baileys] Baileys no está instalado.');
}

const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, '..', 'package.json'), 'utf8')
);
if (packageJson.version !== '7.0.0-rc13') {
  throw new Error(
    `[patch-baileys] Versión no soportada: ${packageJson.version}. ` +
      'Actualiza el parche antes de cambiar Baileys.'
  );
}

function patch(rel, description, replacements, expected) {
  const filePath = path.join(root, rel);
  let text = fs.readFileSync(filePath, 'utf8');
  if (text.includes(expected)) {
    console.log(`[patch-baileys] OK: ${description}`);
    return;
  }

  const replacement = replacements.find(({ from }) => text.includes(from));
  if (!replacement) {
    throw new Error(
      `[patch-baileys] No se pudo aplicar "${description}" en ${rel}. ` +
        'La implementación de Baileys cambió.'
    );
  }

  text = text.replace(replacement.from, replacement.to);
  fs.writeFileSync(filePath, text);
  if (!text.includes(expected)) {
    throw new Error(`[patch-baileys] Falló la validación de "${description}" en ${rel}.`);
  }
  console.log(`[patch-baileys] PATCH: ${description}`);
}

patch(
  'Defaults/index.js',
  'rutas de subida newsletter',
  [
    {
      from: `export const MEDIA_PATH_MAP = {
    image: '/mms/image',
    video: '/mms/video',
    document: '/mms/document',
    audio: '/mms/audio',
    sticker: '/mms/image',
    'thumbnail-link': '/mms/image',
    'product-catalog-image': '/product/image',
    'md-app-state': '',
    'md-msg-hist': '/mms/md-app-state',
    'biz-cover-photo': '/pps/biz-cover-photo'
};`,
      to: `export const MEDIA_PATH_MAP = {
    image: '/mms/image',
    video: '/mms/video',
    document: '/mms/document',
    audio: '/mms/audio',
    sticker: '/mms/image',
    'thumbnail-link': '/mms/image',
    'product-catalog-image': '/product/image',
    'md-app-state': '',
    'md-msg-hist': '/mms/md-app-state',
    'biz-cover-photo': '/pps/biz-cover-photo'
};
export const NEWSLETTER_MEDIA_PATH_MAP = {
    image: '/newsletter/newsletter-image',
    video: '/newsletter/newsletter-video',
    document: '/newsletter/newsletter-document',
    audio: '/newsletter/newsletter-audio',
    gif: '/newsletter/newsletter-gif',
    ptt: '/newsletter/newsletter-ptt',
    ptv: '/newsletter/newsletter-ptv',
    sticker: '/newsletter/newsletter-sticker-pack',
    'thumbnail-link': '/newsletter/newsletter-image'
};`,
    },
  ],
  'NEWSLETTER_MEDIA_PATH_MAP'
);

patch(
  'Utils/messages-media.js',
  'importar rutas newsletter',
  [
    {
      from: "import { DEFAULT_ORIGIN, MEDIA_HKDF_KEY_MAPPING, MEDIA_PATH_MAP } from '../Defaults/index.js';",
      to: "import { DEFAULT_ORIGIN, MEDIA_HKDF_KEY_MAPPING, MEDIA_PATH_MAP, NEWSLETTER_MEDIA_PATH_MAP } from '../Defaults/index.js';",
    },
  ],
  'MEDIA_PATH_MAP, NEWSLETTER_MEDIA_PATH_MAP'
);

patch(
  'Utils/messages-media.js',
  'aceptar el indicador newsletter',
  [
    {
      from: 'return async (filePath, { mediaType, fileEncSha256B64, timeoutMs }) => {',
      to: 'return async (filePath, { mediaType, fileEncSha256B64, timeoutMs, newsletter }) => {',
    },
  ],
  'fileEncSha256B64, timeoutMs, newsletter'
);

patch(
  'Utils/messages-media.js',
  'usar endpoint newsletter y generar miniatura',
  [
    {
      from: 'const url = `https://${hostname}${MEDIA_PATH_MAP[mediaType]}/${fileEncSha256B64}?auth=${auth}&token=${fileEncSha256B64}`;',
      to: `const mediaPath = (newsletter ? NEWSLETTER_MEDIA_PATH_MAP[mediaType] : undefined) || MEDIA_PATH_MAP[mediaType];
            let url = \`https://\${hostname}\${mediaPath}/\${fileEncSha256B64}?auth=\${auth}&token=\${fileEncSha256B64}\`;
            if (newsletter) {
                url += '&server_thumb_gen=1';
                if (mediaType === 'video' || mediaType === 'gif' || mediaType === 'ptv') {
                    url += '&server_transcode=1';
                }
            }`,
    },
  ],
  "url += '&server_thumb_gen=1'"
);

patch(
  'Utils/messages-media.js',
  'devolver metadatos de miniatura',
  [
    {
      from: `mediaUrl: result.url,
                        directPath: result.direct_path,
                        meta_hmac: result.meta_hmac,
                        fbid: result.fbid,
                        ts: result.ts`,
      to: `mediaUrl: result.url || result.direct_path,
                        directPath: result.direct_path,
                        meta_hmac: result.meta_hmac,
                        fbid: result.fbid,
                        ts: result.ts,
                        thumbnailDirectPath: result.thumbnail_info?.thumbnail_direct_path,
                        thumbnailSha256: result.thumbnail_info?.thumbnail_sha256`,
    },
  ],
  'thumbnailDirectPath: result.thumbnail_info?.thumbnail_direct_path'
);

patch(
  'Utils/messages.js',
  'subir como newsletter y conservar miniatura',
  [
    {
      from: `const { mediaUrl, directPath } = await options.upload(filePath, {
            fileEncSha256B64: fileSha256B64,
            mediaType: mediaType,
            timeoutMs: options.mediaUploadTimeoutMs
        });`,
      to: `const { directPath, thumbnailDirectPath, thumbnailSha256 } = await options.upload(filePath, {
            fileEncSha256B64: fileSha256B64,
            mediaType: mediaType,
            timeoutMs: options.mediaUploadTimeoutMs,
            newsletter: true
        });`,
    },
    {
      from: `const { mediaUrl, directPath, thumbnailDirectPath, thumbnailSha256 } = await options.upload(filePath, {
            fileEncSha256B64: fileSha256B64,
            mediaType: mediaType,
            timeoutMs: options.mediaUploadTimeoutMs,
            newsletter: true
        });`,
      to: `const { directPath, thumbnailDirectPath, thumbnailSha256 } = await options.upload(filePath, {
            fileEncSha256B64: fileSha256B64,
            mediaType: mediaType,
            timeoutMs: options.mediaUploadTimeoutMs,
            newsletter: true
        });`,
    },
  ],
  'const { directPath, thumbnailDirectPath, thumbnailSha256 } = await options.upload'
);

patch(
  'Utils/messages.js',
  'construir el proto newsletter sin campos de media cifrada',
  [
    {
      from: `url: mediaUrl,
                directPath,
                fileSha256,
                fileLength,
                ...uploadData,`,
      to: `directPath,
                fileSha256,
                fileLength,
                thumbnailDirectPath,
                thumbnailSha256: thumbnailSha256 ? Buffer.from(thumbnailSha256, 'base64') : undefined,
                ...uploadData,`,
    },
    {
      from: `url: null,
                directPath,
                fileSha256,
                fileEncSha256: fileSha256,
                fileLength,
                thumbnailDirectPath,
                thumbnailSha256: thumbnailSha256 ? Buffer.from(thumbnailSha256, 'base64') : undefined,
                ...uploadData,`,
      to: `directPath,
                fileSha256,
                fileLength,
                thumbnailDirectPath,
                thumbnailSha256: thumbnailSha256 ? Buffer.from(thumbnailSha256, 'base64') : undefined,
                ...uploadData,`,
    },
  ],
  `directPath,
                fileSha256,
                fileLength,
                thumbnailDirectPath`
);

patch(
  'Socket/messages-send.js',
  'identificar el tipo de media en el nodo newsletter',
  [
    {
      from: `binaryNodeContent.push({
                    tag: 'plaintext',
                    attrs: {},
                    content: bytes
                });`,
      to: `binaryNodeContent.push({
                    tag: 'plaintext',
                    attrs: mediaType ? { mediatype: mediaType } : {},
                    content: bytes
                });`,
    },
    {
      from: `binaryNodeContent.push({
                    tag: 'plaintext',
                    attrs: extraAttrs,
                    content: bytes
                });`,
      to: `binaryNodeContent.push({
                    tag: 'plaintext',
                    attrs: mediaType ? { mediatype: mediaType } : {},
                    content: bytes
                });`,
    },
  ],
  'attrs: mediaType ? { mediatype: mediaType } : {}'
);

console.log('[patch-baileys] Parche de media para newsletters aplicado y validado.');
