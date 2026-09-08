import { NextResponse } from 'next/server';
import { connectWhatsApp, getWhatsAppState } from '../../../../lib/whatsapp';
import { AuthError, requireUser } from '../../../../lib/auth';
import { jsonError } from '../../../../lib/i18n/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const state = await connectWhatsApp(user.id, { force: Boolean(body?.force) });
    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof AuthError) return jsonError(error.code, error.status);
    console.error('[WhatsApp] connect failed:', error);
    return NextResponse.json(
      { error: error.message || 'No se pudo iniciar la conexión' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const user = await requireUser(request);
    return NextResponse.json(getWhatsAppState(user.id));
  } catch (error) {
    if (error instanceof AuthError) return jsonError(error.code, error.status);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
