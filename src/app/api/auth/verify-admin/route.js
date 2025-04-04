import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export async function GET() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { isAdmin: false, error: 'No authentication token' },
        { status: 401 }
      );
    }
    
    try {
      // Verify the token
      const secretKey = process.env.ADMIN_SECRET_TOKEN || 'fallback_secret_token';
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(secretKey)
      );

      // Check if the token contains isAdmin flag
      if (payload && payload.isAdmin) {
        return NextResponse.json(
          { isAdmin: true, username: payload.username },
          { 
            headers: { 
              'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
              'Pragma': 'no-cache'
            } 
          }
        );
      } else {
        return NextResponse.json(
          { isAdmin: false, error: 'Not authorized as admin' },
          { status: 403 }
        );
      }
    } catch (tokenError) {
      console.error('Token verification error:', tokenError);
      return NextResponse.json(
        { isAdmin: false, error: 'Invalid token' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Admin verification error:', error);
    return NextResponse.json(
      { isAdmin: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 