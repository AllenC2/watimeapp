/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    '@whiskeysockets/baileys',
    'pino',
    'qrcode',
    'sqlite3',
    'ws',
    'whatsapp-rust-bridge',
    'sharp',
  ],
  outputFileTracingExcludes: {
    '*': ['auth_info_baileys/**', 'public/uploads/**', 'whatsapp-status/**'],
  },
  async rewrites() {
    return [
      {
        source: '/uploads/:userId/:filename',
        destination: '/api/uploads/:userId/:filename',
      },
    ];
  },
};

export default nextConfig;
