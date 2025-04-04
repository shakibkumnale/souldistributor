import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Cache durations in seconds
const CACHE_DURATIONS = {
  static: 60 * 60 * 24 * 30, // 30 days for static assets
  images: 60 * 60 * 24 * 7,  // 7 days for images
  api: 60 * 60,             // 1 hour for API responses
  pages: 60 * 5             // 5 minutes for pages
};

export async function middleware(request) {
  // Get the pathname of the request (e.g. /admin)
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();
  
  // Add caching headers based on the route type
  addCachingHeaders(pathname, response);
  
  // Check if the pathname starts with /admin
  const isAdminRoute = pathname.startsWith('/admin');
  
  // If it's an admin route, verify the auth token
  if (isAdminRoute) {
    // Get the token from cookies
    const token = request.cookies.get('auth-token')?.value;
    
    // If there's no token, redirect to login
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    try {
      // Verify the token using jose instead of jsonwebtoken (better for Edge runtime)
      const secret = process.env.ADMIN_SECRET_TOKEN || 'fallback_secret_token';
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(secret)
      );
      
      // Check if the user is an admin
      if (!payload || !payload.isAdmin) {
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }
      
      // Check if username matches the expected admin username
      const adminUsername = process.env.ADMIN_USERNAME || 'shakibkumnale';
      if (payload.username !== adminUsername) {
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }
      
      // If everything is ok, allow the request
      return NextResponse.next();
    } catch {
      // If token verification fails, redirect to login
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  
  // For non-admin routes, return the response with caching headers
  return response;
}

/**
 * Add appropriate caching headers based on the route type
 * @param {string} pathname - The request pathname
 * @param {NextResponse} response - The Next.js response object
 */
function addCachingHeaders(pathname, response) {
  // Skip caching for admin routes
  if (pathname.startsWith('/admin')) {
    response.headers.set('Cache-Control', 'no-store, must-revalidate');
    return;
  }
  
  // Add caching headers based on path pattern
  if (pathname.match(/\.(jpe?g|png|gif|svg|webp|avif)$/i)) {
    // Images
    response.headers.set(
      'Cache-Control',
      `public, max-age=${CACHE_DURATIONS.images}, stale-while-revalidate=${CACHE_DURATIONS.images * 2}`
    );
  } else if (pathname.match(/\.(js|css|woff2?|ttf|eot)$/i)) {
    // Static assets
    response.headers.set(
      'Cache-Control',
      `public, max-age=${CACHE_DURATIONS.static}, stale-while-revalidate=${CACHE_DURATIONS.static * 2}`
    );
  } else if (pathname.startsWith('/api/')) {
    // API routes
    response.headers.set(
      'Cache-Control',
      `public, max-age=${CACHE_DURATIONS.api}, stale-while-revalidate=${CACHE_DURATIONS.api * 2}`
    );
  } else if (!pathname.includes('.')) {
    // Page routes (no file extension)
    response.headers.set(
      'Cache-Control',
      `public, max-age=${CACHE_DURATIONS.pages}, stale-while-revalidate=${CACHE_DURATIONS.pages * 2}`
    );
  }
}

export const config = {
  // Specify which paths this middleware should run on
  matcher: [
    '/admin/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};