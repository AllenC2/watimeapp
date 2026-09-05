import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { getWhatsAppState } from '../../../../lib/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export async function GET() {
  const live = getWhatsAppState();
  const creds = await readJson(path.join(process.cwd(), 'auth_info_baileys', 'creds.json'));
  const fileStatus = await readJson(path.join(process.cwd(), 'whatsapp-status.json'));

  const qrDataUrl = live.qrDataUrl || fileStatus?.qrDataUrl || null;
  const phoneRaw = qrDataUrl
    ? live.phone || ''
    : live.phone ||
      fileStatus?.phone ||
      String(creds?.me?.id || '').split(':')[0].split('@')[0] ||
      '';
  const name = qrDataUrl ? live.name || '' : live.name || fileStatus?.name || creds?.me?.name || '';
  const platform = qrDataUrl
    ? live.platform || ''
    : live.platform || fileStatus?.platform || creds?.platform || '';

  return NextResponse.json({
    ...live,
    qrDataUrl,
    error: live.error || fileStatus?.error || '',
    phone: phoneRaw,
    phoneLabel: formatPhone(phoneRaw) || live.phoneLabel,
    name,
    platform,
    platformLabel: platformLabel(platform),
    hasSession: Boolean(phoneRaw) || (live.hasSession && !qrDataUrl),
  });
}
