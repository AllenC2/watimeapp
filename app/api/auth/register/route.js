import { NextResponse } from 'next/server';
import { dbReady, getOne, runQuery } from '../../../../lib/db';
import {
  AuthError,
  assignLegacyDataToUser,
  defaultUserColumns,
  hashPassword,
  parseRegisterInput,
} from '../../../../lib/auth';
import { issueAndSendEmailCode } from '../../../../lib/email-otp';
import { verifyRegisterEmail } from '../../../../lib/email-verify';
import { isMailConfigured } from '../../../../lib/mail';
import { jsonError } from '../../../../lib/i18n/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    await dbReady;
    if (!isMailConfigured()) return jsonError('auth.errorMailNotConfigured', 503);

    const body = await request.json().catch(() => ({}));
    const parsed = parseRegisterInput(body);
    if (parsed.error) return jsonError(parsed.error, 400);

    const emailCheck = verifyRegisterEmail(parsed.email);
    if (emailCheck.error) return jsonError(emailCheck.error, 400);

    const defaults = defaultUserColumns();
    const passwordHash = await hashPassword(parsed.password);

    let result;
    try {
      result = await runQuery(
        `INSERT INTO users (
          username, email, password_hash, theme, agenda_view, week_starts_on,
          timezone, hour_clock, language, logo_data_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          parsed.username,
          parsed.email,
          passwordHash,
          defaults.theme,
          defaults.agenda_view,
          defaults.week_starts_on,
          defaults.timezone,
          defaults.hour_clock,
          defaults.language,
          defaults.logo_data_url,
        ]
      );
    } catch (error) {
      const takenUser = await getOne('SELECT id FROM users WHERE username = ?', [parsed.username]);
      if (takenUser) return jsonError('auth.errorUsernameTaken', 409);
      return jsonError('auth.errorEmailTaken', 409);
    }

    await assignLegacyDataToUser(await getOne('SELECT * FROM users WHERE id = ?', [result.lastID]));
    const user = await getOne('SELECT * FROM users WHERE id = ?', [result.lastID]);
    let issued;
    try {
      issued = await issueAndSendEmailCode(user);
    } catch (error) {
      if (error instanceof AuthError || error.status) {
        return jsonError(error.code, error.status || 502, {
          needsVerification: true,
          email: user.email,
        });
      }
      throw error;
    }

    return NextResponse.json(
      { needsVerification: true, email: user.email, expiresAt: issued.expiresAt },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
