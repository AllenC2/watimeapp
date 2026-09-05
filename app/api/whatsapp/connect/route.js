import { NextResponse } from 'next/server';
import { connectWhatsApp, getWhatsAppState } from '../../../../lib/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const state = await connectWhatsApp({ force: Boolean(body?.force) });
    return NextResponse.json(state);
  } catch (error) {
    console.error('[WhatsApp] connect failed:', error);
    return NextResponse.json(
      { error: error.message || 'No se pudo iniciar la conexión' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(getWhatsAppState());
}
