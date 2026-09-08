import { NextResponse } from 'next/server';
import { dbReady, getOne } from '../../../../lib/db';
import { normalizeEmail, prefsFromUser, setSessionResponse } from '../../../../lib/auth';
import { consumeEmailCode, isEmailVerified } from '../../../../lib/email-otp';
import { jsonError } from '../../../../lib/i18n/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    await dbReady;
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const user = await getOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return jsonError('auth.errorVerifyCode', 400);
    if (isEmailVerified(user)) {
      return NextResponse.json({ alreadyVerified: true });
    }
    try {
      await consumeEmailCode(user, body.code);
    } catch (error) {
      if (error.status) return jsonError(error.code, error.status);
      throw error;
    }
    const verified = await getOne('SELECT * FROM users WHERE id = ?', [user.id]);
    const response = NextResponse.json(prefsFromUser(verified));
    return setSessionResponse(response, verified);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
