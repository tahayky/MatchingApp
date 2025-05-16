import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_AUTH_TOKEN_COOKIE_NAME = 'admin_auth_token'; // Cookie name set by the backend

export function middleware(request: NextRequest) {
  const authTokenCookie = request.cookies.get(ADMIN_AUTH_TOKEN_COOKIE_NAME);

  const isDashboardPath = request.nextUrl.pathname.startsWith('/dashboard');
  const isLoginPath = request.nextUrl.pathname.startsWith('/login');

  // For simplicity, we're just checking for the presence of the token.
  // In a real app, you might want to verify the JWT's validity here if possible,
  // though full verification often happens at the API/page level if the token is complex.
  const isAuthenticated = !!authTokenCookie && authTokenCookie.value.length > 0;

  if (isDashboardPath && !isAuthenticated) {
    // User is trying to access dashboard but is not authenticated, redirect to login
    const loginUrl = new URL('/login', request.url);
    // Optional: pass redirect info if your login page can use it
    // loginUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname); 
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginPath && isAuthenticated) {
    // User is trying to access login page but is already authenticated, redirect to dashboard
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

// Apply middleware to /dashboard and /login paths
export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};