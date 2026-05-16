import { NextRequest, NextResponse } from 'next/server';

/**
 * Routes that require authentication.
 * Everything under /dashboard (added later) will be gated.
 * Auth pages (/login, /register) are always accessible.
 */
const PROTECTED_PREFIXES = ['/dashboard', '/submit', '/submissions'];

const AUTH_PAGES = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasRefreshToken = request.cookies.has('refresh_token');

  // Authenticated users hitting /login or /register → redirect to home
  if (hasRefreshToken && AUTH_PAGES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Unauthenticated users hitting a protected route → redirect to login
  if (
    !hasRefreshToken &&
    PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/submit', '/submissions/:path*', '/login', '/register'],
};
