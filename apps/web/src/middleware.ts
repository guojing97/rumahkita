import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hasRefreshToken =
    request.cookies.has('refreshToken') || request.cookies.has('refresh_token');

  const { pathname } = request.nextUrl;
  const normalizedPath =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  // 1. Root gateway: route '/' redirects based on authentication status
  if (normalizedPath === '' || normalizedPath === '/') {
    if (hasRefreshToken) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const isPublicRoute =
    normalizedPath === '/login' ||
    normalizedPath.startsWith('/password') ||
    normalizedPath.startsWith('/api') ||
    normalizedPath.startsWith('/_next') ||
    normalizedPath.includes('.');

  // 2. If unauthenticated user accesses protected route -> redirect to /login?redirect=<path>
  if (!hasRefreshToken && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', normalizedPath);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
