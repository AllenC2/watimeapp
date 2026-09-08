import { AuthError } from './auth';

export function isMailConfigured() {
  return Boolean(String(process.env.RESEND_API_KEY || '').trim());
}

function mailErrorCode(status, body) {
  const text = `${body}`.toLowerCase();
  if (status === 403 && (text.includes('not verified') || text.includes('domain'))) {
    return 'auth.errorMailFrom';
  }
  if (
    text.includes('you can only send testing emails to your own email') ||
    text.includes('only send to your own')
  ) {
    return 'auth.errorMailTo';
  }
  return 'auth.errorMailSend';
}

export async function sendMail({ to, subject, text }) {
  const key = String(process.env.RESEND_API_KEY || '').trim();
  if (!key) throw new AuthError('auth.errorMailNotConfigured', 503);
  const from = String(process.env.MAIL_FROM || '').trim() || 'WATime <noreply@watime.click>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[mail] Resend error', res.status, body);
    throw new AuthError(mailErrorCode(res.status, body), 502);
  }
}
