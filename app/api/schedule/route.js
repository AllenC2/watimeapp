import { NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { runQuery, getQuery, getOne } from '../../../lib/db';
import { normalizeIdentifier } from '../../../lib/contacts';
import { AuthError, requireUser } from '../../../lib/auth';
import { ApiError, jsonError } from '../../../lib/i18n/api';
import { formatLocalDateTime, isScheduledTooSoon } from '../../../lib/schedule-time';
import { sendMessageNow } from '../../../lib/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function extensionFor(type, originalName) {
  const fromName = path.extname(originalName || '').toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(fromName)) return fromName;
  if (type === 'image/jpeg') return '.jpg';
  if (type === 'image/png') return '.png';
  if (type === 'image/webp') return '.webp';
  if (type === 'image/gif') return '.gif';
  return '.jpg';
}

function mimeFromUpload(file) {
  const type = String(file?.type || '').toLowerCase();
  if (ALLOWED_TYPES.has(type)) return type;
  const ext = path.extname(file?.name || '').toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return type;
}

async function saveImage(userId, file) {
  if (!file || typeof file === 'string' || file.size === 0) return null;

  const type = mimeFromUpload(file);
  if (!ALLOWED_TYPES.has(type)) {
    throw new ApiError('errors.imageType');
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new ApiError('errors.imageSize');
  }

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', String(userId));
  await mkdir(uploadsDir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extensionFor(type, file.name)}`;
  const filepath = path.join(uploadsDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  return `/uploads/${userId}/${filename}`;
}

async function deleteMessageImage(userId, imageUrl) {
  const relative = String(imageUrl || '').replace(/^\//, '');
  const allowed = `uploads/${userId}/`;
  if (!relative.startsWith(allowed)) return;

  const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads', String(userId));
  const fullPath = path.resolve(process.cwd(), 'public', relative);
  const prefix = `${uploadsDir}${path.sep}`;
  if (fullPath !== uploadsDir && !fullPath.startsWith(prefix)) return;

  try {
    await unlink(fullPath);
  } catch {
    /* already gone */
  }
}

export async function GET(request) {
  try {
    const user = await requireUser(request);
    const messages = await getQuery(
      `SELECT m.*, c.name AS contact_name
       FROM scheduled_messages m
       LEFT JOIN contacts c ON c.user_id = m.user_id AND c.identifier = m.recipient
       WHERE m.user_id = ?
       ORDER BY m.scheduled_for ASC`,
      [user.id]
    );
    return NextResponse.json(messages);
  } catch (error) {
    if (error instanceof AuthError) return jsonError(error.code, error.status);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await requireUser(request);
    const contentType = request.headers.get('content-type') || '';
    let recipient;
    let content;
    let scheduled_for;
    let image_url = null;
    let sendNow = false;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      recipient = String(formData.get('recipient') || '').trim();
      content = String(formData.get('content') || '').trim();
      scheduled_for = String(formData.get('scheduled_for') || '').trim();
      sendNow = String(formData.get('send_now') || '') === '1';
      image_url = await saveImage(user.id, formData.get('image'));
    } else {
      const body = await request.json();
      recipient = body.recipient;
      content = body.content;
      scheduled_for = body.scheduled_for;
      sendNow = Boolean(body.send_now);
    }

    recipient = normalizeIdentifier(recipient).identifier;

    if (!recipient || (!content && !image_url)) {
      return jsonError('errors.missingFields', 400);
    }

    if (sendNow) {
      scheduled_for = formatLocalDateTime(new Date(), user.timezone);
    } else {
      if (!scheduled_for) return jsonError('errors.missingFields', 400);
      if (isScheduledTooSoon(scheduled_for, new Date(), user.timezone)) return jsonError('errors.schedulePast', 400);
    }

    const inserted = await runQuery(
      'INSERT INTO scheduled_messages (user_id, recipient, content, scheduled_for, status, image_url, whatsapp_phone, whatsapp_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [user.id, recipient, content || '', scheduled_for, 'pending', image_url, '', '']
    );

    if (sendNow) {
      const msg = await getOne(
        'SELECT * FROM scheduled_messages WHERE id = ? AND user_id = ?',
        [inserted.lastID, user.id]
      );
      try {
        const account = await sendMessageNow(user.id, msg);
        await runQuery(
          `UPDATE scheduled_messages SET status = 'sent', whatsapp_phone = ?, whatsapp_name = ? WHERE id = ? AND user_id = ?`,
          [account.phone || '', account.name || '', msg.id, user.id]
        );
      } catch (error) {
        console.error(`[schedule] Error enviando mensaje ${msg.id}:`, error);
        await runQuery(
          `UPDATE scheduled_messages SET status = 'failed' WHERE id = ? AND user_id = ?`,
          [msg.id, user.id]
        );
        if (error.code === 'WHATSAPP_OFFLINE') return jsonError('errors.whatsappOffline', 409);
        return jsonError('errors.sendFailed', 502);
      }
    }

    return NextResponse.json({ success: true, sent: sendNow }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return jsonError(error.code, error.status);
    if (error instanceof ApiError) return jsonError(error.code, 400, error.extra);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await requireUser(request);
    const params = new URL(request.url).searchParams;
    const wipeAll = params.get('all') === '1';

    if (wipeAll) {
      const messages = await getQuery(
        'SELECT image_url FROM scheduled_messages WHERE user_id = ?',
        [user.id]
      );
      await Promise.all(messages.map((msg) => deleteMessageImage(user.id, msg.image_url)));
      await runQuery('DELETE FROM scheduled_messages WHERE user_id = ?', [user.id]);
      return NextResponse.json({ ok: true, deleted: messages.length });
    }

    const id = Number.parseInt(params.get('id') || '', 10);
    if (!Number.isInteger(id) || id <= 0) {
      return jsonError('errors.invalidMessage', 400);
    }

    const existing = await getOne(
      'SELECT id, image_url FROM scheduled_messages WHERE id = ? AND user_id = ?',
      [id, user.id]
    );
    if (!existing) {
      return jsonError('errors.messageGone', 404);
    }

    await deleteMessageImage(user.id, existing.image_url);
    await runQuery('DELETE FROM scheduled_messages WHERE id = ? AND user_id = ?', [id, user.id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return jsonError(error.code, error.status);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
