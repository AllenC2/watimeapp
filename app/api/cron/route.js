import { NextResponse } from 'next/server';
import { jsonError } from '../../../lib/i18n/api';

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') || '';
  if (!secret || header !== `Bearer ${secret}`) {
    return jsonError('errors.unauthorized', 401);
  }
  return NextResponse.json({
    success: true,
    processed: 0,
    note: 'El envío lo hace el scheduler de WhatsApp por usuario.',
  });
}
