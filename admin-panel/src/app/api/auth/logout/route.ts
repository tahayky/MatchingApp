import { NextResponse } from 'next/server';

const ADMIN_AUTH_TOKEN_COOKIE_NAME = 'admin_auth_token'; // Ensure this matches the cookie name used in login and middleware

export async function POST() {
  try {
    const response = NextResponse.json({ success: true, message: 'Logout successful' });
    response.cookies.set(ADMIN_AUTH_TOKEN_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0, // Expire the cookie immediately
      sameSite: 'lax',
    });
    return response;
  } catch (error) {
    console.error('Logout API error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred during logout.';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

// Optional: GET handler if you want to allow logout via GET link from anywhere (e.g. a simple <a> tag)
// However, for actions that change state (like logging out), POST is generally preferred.
export async function GET() {
  try {
    const response = NextResponse.json({ success: true, message: 'Logout successful (via GET)' });
    response.cookies.set(ADMIN_AUTH_TOKEN_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
      sameSite: 'lax',
    });
    return response;
  } catch (error) {
    console.error('Logout API error (GET):', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred during logout.';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}