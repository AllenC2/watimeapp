import { NextResponse } from 'next/server';
import { getOne, getQuery, runQuery } from '../../../lib/db';
import { AuthError, requireUser } from '../../../lib/auth';
import { jsonError } from '../../../lib/i18n/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseId(value) {
  const id = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request) {
  try {
    const user = await requireUser(request);
    const templates = await getQuery(
      'SELECT id, content, created_at, updated_at FROM templates WHERE user_id = ? ORDER BY updated_at DESC, id DESC',
      [user.id]
    );
    return NextResponse.json(templates);
  } catch (error) {
    if (error instanceof AuthError) return jsonError(error.code, error.status);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const content = String(body.content || '').trim();
    if (!content) {
      return jsonError('errors.templateText', 400);
    }

    const result = await runQuery(
      'INSERT INTO templates (user_id, content) VALUES (?, ?)',
      [user.id, content]
    );
    const template = await getOne(
      'SELECT id, content, created_at, updated_at FROM templates WHERE id = ? AND user_id = ?',
      [result.lastID, user.id]
    );
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return jsonError(error.code, error.status);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const id = parseId(body.id);
    const content = String(body.content || '').trim();

    if (!id) {
      return jsonError('errors.invalidTemplate', 400);
    }
    if (!content) {
      return jsonError('errors.templateText', 400);
    }

    const existing = await getOne('SELECT id FROM templates WHERE id = ? AND user_id = ?', [id, user.id]);
    if (!existing) {
      return jsonError('errors.templateGone', 404);
    }

    await runQuery(
      'UPDATE templates SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [content, id, user.id]
    );
    const template = await getOne(
      'SELECT id, content, created_at, updated_at FROM templates WHERE id = ? AND user_id = ?',
      [id, user.id]
    );
    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof AuthError) return jsonError(error.code, error.status);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await requireUser(request);
    const id = parseId(new URL(request.url).searchParams.get('id'));
    if (!id) {
      return jsonError('errors.invalidTemplate', 400);
    }

    const existing = await getOne('SELECT id FROM templates WHERE id = ? AND user_id = ?', [id, user.id]);
    if (!existing) {
      return jsonError('errors.templateGone', 404);
    }

    await runQuery('DELETE FROM templates WHERE id = ? AND user_id = ?', [id, user.id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return jsonError(error.code, error.status);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
