/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    '@whiskeysockets/baileys',
    'pino',
    'qrcode',
    'sqlite3',
    'ws',
    'whatsapp-rust-bridge',
  ],
};

export default nextConfig;
