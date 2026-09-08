import { NextResponse } from 'next/server';
import { getOne, getQuery, runQuery } from '../../../lib/db';
import { normalizeIdentifier } from '../../../lib/contacts';
import { AuthError, requireUser } from '../../../lib/auth';
import { jsonError } from '../../../lib/i18n/api';
import { messages } from '../../../lib/i18n/messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function csvCell(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function contactsToCsv(contacts, language) {
  const pack = messages[language] || messages.es;
  const header = [pack['csv.headerName'], pack['csv.headerId']];
  const filename = pack['csv.filename'] || 'contactos.csv';
  const rows = contacts.map((contact) => [
    csvCell(contact.name),
    csvCell(contact.identifier),
  ]);
  return {
    body: `\uFEFF${[header.join(','), ...rows.map((row) => row.join(','))].join('\n')}\n`,
    filename,
  };
}

export async function GET(request) {
  try {
    const user = await requireUser(request);
    const contacts = await getQuery(
      'SELECT id, name, identifier, search_key FROM contacts WHERE user_id = ? ORDER BY name COLLATE NOCASE ASC, identifier ASC',
      [user.id]
    );
    const params = new URL(request.url).searchParams;
    if (params.get('format') === 'csv') {
      const language = params.get('lang') === 'en' ? 'en' : 'es';
      const csv = contactsToCsv(contacts, language);
      return new NextResponse(csv.body, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${csv.filename}"`,
        },
      });
    }
    return NextResponse.json(contacts);
  } catch (error) {
    if (error instanceof AuthError) return jsonError(error.code, error.status);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const { identifier, searchKey } = normalizeIdentifier(body.identifier);

    if (!name) {
      return jsonError('errors.contactName', 400);
    }
    if (!identifier) {
      return jsonError('errors.contactId', 400);
    }

    const existing = await getOne(
      'SELECT id, name, identifier, search_key FROM contacts WHERE user_id = ? AND (identifier = ? OR search_key = ?)',
      [user.id, identifier, searchKey]
    );
    if (existing) {
      return NextResponse.json(
        {
          error: `Ya existe como ${existing.name}`,
          code: 'errors.contactExists',
          name: existing.name,
          contact: existing,
        },
        { status: 409 }
      );
    }

    const result = await runQuery(
      'INSERT INTO contacts (user_id, name, identifier, search_key) VALUES (?, ?, ?, ?)',
      [user.id, name, identifier, searchKey]
    );

    return NextResponse.json(
      { id: result.lastID, name, identifier, search_key: searchKey },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) return jsonError(error.code, error.status);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await requireUser(request);
    const params = new URL(request.url).searchParams;
    if (params.get('all') === '1') {
      const result = await runQuery('DELETE FROM contacts WHERE user_id = ?', [user.id]);
      return NextResponse.json({ ok: true, deleted: result.changes || 0 });
    }

    const id = Number.parseInt(params.get('id') || '', 10);
    if (!Number.isInteger(id) || id <= 0) {
      return jsonError('errors.invalidContact', 400);
    }

    const existing = await getOne('SELECT id FROM contacts WHERE id = ? AND user_id = ?', [id, user.id]);
    if (!existing) {
      return jsonError('errors.contactGone', 404);
    }

    await runQuery('DELETE FROM contacts WHERE id = ? AND user_id = ?', [id, user.id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return jsonError(error.code, error.status);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
