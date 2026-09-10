import { readFile, stat } from 'fs/promises';
import { NextResponse } from 'next/server';
import { AuthError, requireUser } from '../../../../../lib/auth';
import { absoluteUploadPath, canReadUpload, mimeForUploadFilename } from '../../../../../lib/uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const user = await requireUser(request);
    const { userId, filename } = await params;
    const pathname = `/uploads/${userId}/${filename}`;
    if (!canReadUpload(pathname, user.id)) {
      return new NextResponse(null, { status: 404 });
    }

    const fullPath = absoluteUploadPath(pathname);
    if (!fullPath) return new NextResponse(null, { status: 404 });

    let fileStat;
    try {
      fileStat = await stat(fullPath);
    } catch {
      return new NextResponse(null, { status: 404 });
    }
    if (!fileStat.isFile()) return new NextResponse(null, { status: 404 });

    const bytes = await readFile(fullPath);
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': mimeForUploadFilename(filename),
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return new NextResponse(null, { status: 404 });
    return new NextResponse(null, { status: 404 });
  }
}
