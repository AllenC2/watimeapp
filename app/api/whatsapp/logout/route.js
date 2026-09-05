import { NextResponse } from 'next/server';
import { logoutWhatsApp } from '../../../../lib/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const state = await logoutWhatsApp();
    return NextResponse.json(state);
  } catch (error) {
    console.error('[WhatsApp] logout failed:', error);
    return NextResponse.json(
      { error: error.message || 'No se pudo cerrar la sesión' },
      { status: 500 }
    );
  }
}
