import { NextResponse } from 'next/server';
import { getOne, runQuery } from '../../../../lib/db';
import {
  AuthError,
  prefsFromUser,
  requireUser,
  setSessionResponse,
  verifyPassword,
  hashPassword,
} from '../../../../lib/auth';
import { jsonError } from '../../../../lib/i18n/api';
import { passwordRuleError } from '../../../../lib/password-rules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    const confirmPassword = String(body.confirmPassword || '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      return jsonError('prefs.errorPasswordFields', 400);
    }
    if (!(await verifyPassword(currentPassword, user.password_hash))) {
      return jsonError('prefs.errorPasswordCurrent', 400);
    }
    const passwordError = passwordRuleError(newPassword);
    if (passwordError) return jsonError(passwordError, 400);
    if (newPassword !== confirmPassword) return jsonError('prefs.errorPasswordConfirm', 400);

    const passwordHash = await hashPassword(newPassword);
    await runQuery(
      'UPDATE users SET password_hash = ?, session_version = COALESCE(session_version, 0) + 1 WHERE id = ?',
      [passwordHash, user.id]
    );
    const next = await getOne('SELECT * FROM users WHERE id = ?', [user.id]);
    const response = NextResponse.json(prefsFromUser(next));
    return setSessionResponse(response, next);
  } catch (error) {
    if (error instanceof AuthError) return jsonError(error.code, error.status);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
