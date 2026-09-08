import { NextResponse } from 'next/server';
import { dbReady, getOne } from '../../../../lib/db';
import { AuthError, normalizeEmail, requireUser } from '../../../../lib/auth';
import { issueAndSendEmailCode, isEmailVerified } from '../../../../lib/email-otp';
import { jsonError } from '../../../../lib/i18n/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    await dbReady;
    const body = await request.json().catch(() => ({}));
    let user;
    try {
      user = await requireUser(request);
    } catch (error) {
      if (!(error instanceof AuthError)) throw error;
      const email = normalizeEmail(body.email);
      user = await getOne('SELECT * FROM users WHERE email = ?', [email]);
    }
    if (!user) return jsonError('auth.errorVerifyCode', 400);
    if (isEmailVerified(user)) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }
    let issued;
    try {
      issued = await issueAndSendEmailCode(user);
    } catch (error) {
      if (error instanceof AuthError || error.status) {
        return jsonError(error.code, error.status, error.extra || {});
      }
      throw error;
    }
    return NextResponse.json({
      ok: true,
      needsVerification: true,
      email: user.email,
      remaining: issued.remaining,
      expiresAt: issued.expiresAt,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
