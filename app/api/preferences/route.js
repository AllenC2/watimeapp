import { NextResponse } from 'next/server';
import { getOne, runQuery } from '../../../lib/db';
import { AuthError, normalizeEmail, prefsFromUser, requireUser } from '../../../lib/auth';
import {
  isAgendaView,
  isHourClock,
  isLanguage,
  isThemeId,
  isTimeZone,
  isWeekStartsOn,
} from '../../../lib/preferences';
import { jsonError } from '../../../lib/i18n/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const user = await requireUser(request);
    return NextResponse.json(prefsFromUser(user));
  } catch (error) {
    if (error instanceof AuthError) return jsonError(error.code, error.status);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));

    const theme = isThemeId(body.theme) ? body.theme : user.theme;
    const agendaView = isAgendaView(body.agendaView) ? body.agendaView : user.agenda_view;
    const weekStartsOn = isWeekStartsOn(body.weekStartsOn) ? body.weekStartsOn : user.week_starts_on;
    const timezone = body.timezone === undefined
      ? user.timezone
      : isTimeZone(body.timezone)
        ? body.timezone
        : user.timezone;
    const hourClock = isHourClock(body.hourClock) ? body.hourClock : user.hour_clock;
    const language = isLanguage(body.language) ? body.language : user.language;
    const logoDataUrl = body.logoDataUrl === undefined ? user.logo_data_url : String(body.logoDataUrl || '');
    const welcomeSeenAt =
      body.welcomeSeen === true && !user.welcome_seen_at
        ? new Date().toISOString()
        : user.welcome_seen_at;
    const setupSeenAt =
      body.setupSeen === true && !user.setup_seen_at
        ? new Date().toISOString()
        : user.setup_seen_at;
    let email = user.email;
    let emailVerifiedAt = user.email_verified_at;
    if (body.email !== undefined) {
      email = normalizeEmail(body.email);
      if (!email || !email.includes('@')) return jsonError('prefs.errorEmail', 400);
      if (email !== user.email) emailVerifiedAt = null;
    }

    try {
      await runQuery(
        `UPDATE users SET
          email = ?, theme = ?, agenda_view = ?, week_starts_on = ?, timezone = ?,
          hour_clock = ?, language = ?, logo_data_url = ?, email_verified_at = ?,
          welcome_seen_at = ?, setup_seen_at = ?
         WHERE id = ?`,
        [
          email,
          theme,
          agendaView,
          weekStartsOn,
          timezone,
          hourClock,
          language,
          logoDataUrl,
          emailVerifiedAt,
          welcomeSeenAt,
          setupSeenAt,
          user.id,
        ]
      );
    } catch {
      return jsonError('auth.errorEmailTaken', 409);
    }

    const next = await getOne('SELECT * FROM users WHERE id = ?', [user.id]);
    return NextResponse.json(prefsFromUser(next));
  } catch (error) {
    if (error instanceof AuthError) return jsonError(error.code, error.status);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
