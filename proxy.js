import { NextResponse } from 'next/server';
import { dbReady, getOne } from './lib/db';
import { readSessionFromRequest } from './lib/session';
import { canReadUpload } from './lib/uploads';

const PUBLIC_PREFIXES = ['/login', '/registro', '/api/auth/'];
const PUBLIC_FILES = ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.css', '.js', '.map', '.woff', '.woff2'];

function isPublicPath(pathname) {
  if (pathname.startsWith('/uploads/')) return false;
  if (PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) {
    return true;
  }
  if (pathname.startsWith('/logos/') || pathname.startsWith('/_next/')) return true;
  return PUBLIC_FILES.some((ext) => pathname.endsWith(ext));
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const session = await readSessionFromRequest(request);

  if (pathname === '/login' || pathname === '/registro') {
    if (session) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  if (pathname.startsWith('/uploads/')) {
    if (!session || !canReadUpload(pathname, session.userId)) {
      return new NextResponse(null, { status: 404 });
    }
    await dbReady;
    const owner = await getOne('SELECT session_version FROM users WHERE id = ?', [session.userId]);
    if (!owner || Number(owner.session_version || 0) !== Number(session.sv || 0)) {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Inicia sesión para continuar', code: 'errors.unauthorized' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
