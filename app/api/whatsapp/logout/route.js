import { NextResponse } from 'next/server';
import { logoutWhatsApp } from '../../../../lib/whatsapp';
import { AuthError, requireUser } from '../../../../lib/auth';
import { jsonError } from '../../../../lib/i18n/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const user = await requireUser(request);
    const state = await logoutWhatsApp(user.id);
    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof AuthError) return jsonError(error.code, error.status);
    console.error('[WhatsApp] logout failed:', error);
    return NextResponse.json(
      { error: error.message || 'No se pudo cerrar la sesión' },
      { status: 500 }
    );
  }
}
