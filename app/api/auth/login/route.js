import { NextResponse } from 'next/server';
import { dbReady, getOne } from '../../../../lib/db';
import {
  assignLegacyDataToUser,
  normalizeEmail,
  prefsFromUser,
  setSessionResponse,
  verifyPassword,
} from '../../../../lib/auth';
import { normalizeUsername } from '../../../../lib/preferences';
import { jsonError } from '../../../../lib/i18n/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    await dbReady;
    const body = await request.json().catch(() => ({}));
    const identifier = String(body.identifier || body.email || body.username || '').trim();
    const password = String(body.password || '');
    if (!identifier || !password) return jsonError('auth.errorCredentials', 400);

    const email = normalizeEmail(identifier);
    const username = normalizeUsername(identifier);
    const user = identifier.includes('@')
      ? await getOne('SELECT * FROM users WHERE email = ?', [email])
      : await getOne('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return jsonError('auth.errorCredentials', 401);
    }

    await assignLegacyDataToUser(user);
    const next = await getOne('SELECT * FROM users WHERE id = ?', [user.id]);
    const response = NextResponse.json(prefsFromUser(next || user));
    return setSessionResponse(response, next || user);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
