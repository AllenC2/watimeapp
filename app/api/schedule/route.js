import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { runQuery, getQuery } from '../../../lib/db';

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

async function saveImage(file) {
  if (!file || typeof file === 'string' || file.size === 0) return null;

  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('El archivo debe ser una imagen JPG, PNG, WEBP o GIF');
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('La imagen no puede superar 8 MB');
  }

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadsDir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extensionFor(file.type, file.name)}`;
  const filepath = path.join(uploadsDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  return `/uploads/${filename}`;
}

export async function GET() {
  try {
    const messages = await getQuery('SELECT * FROM scheduled_messages ORDER BY scheduled_for ASC');
    return NextResponse.json(messages);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let recipient;
    let content;
    let scheduled_for;
    let image_url = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      recipient = String(formData.get('recipient') || '').trim();
      content = String(formData.get('content') || '').trim();
      scheduled_for = String(formData.get('scheduled_for') || '').trim();
      image_url = await saveImage(formData.get('image'));
    } else {
      const body = await request.json();
      recipient = body.recipient;
      content = body.content;
      scheduled_for = body.scheduled_for;
    }

    if (!recipient || !scheduled_for || (!content && !image_url)) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    await runQuery(
      'INSERT INTO scheduled_messages (recipient, content, scheduled_for, status, image_url) VALUES (?, ?, ?, ?, ?)',
      [recipient, content || '', scheduled_for, 'pending', image_url]
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
