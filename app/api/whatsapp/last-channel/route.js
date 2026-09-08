import { NextResponse } from 'next/server';
import { listAdministeredNewsletters } from '../../../../lib/whatsapp';
import { AuthError, requireUser } from '../../../../lib/auth';
import { jsonError } from '../../../../lib/i18n/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const user = await requireUser(request);
    return NextResponse.json(await listAdministeredNewsletters(user.id));
  } catch (error) {
    if (error instanceof AuthError) return jsonError(error.code, error.status);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
