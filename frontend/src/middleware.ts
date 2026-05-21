import { NextRequest, NextResponse } from 'next/server';

/**
 * Routes that require authentication.
 * Everything under /dashboard (added later) will be gated.
 * Auth pages (/login, /register) are always accessible.
 */
const PROTECTED_PREFIXES = ['/dashboard', '/submit', '/submissions', '/achievements'];

const AUTH_PAGES = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasSession = request.cookies.has('logged_in');

  // Authenticated users hitting /login or /register → redirect to home
  if (hasSession && AUTH_PAGES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Unauthenticated users hitting a protected route → redirect to login
  if (
    !hasSession &&
    PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/submit', '/submissions/:path*', '/achievements', '/login', '/register'],
};
