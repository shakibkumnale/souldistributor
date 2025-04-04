// src/app/api/revalidate/route.js
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * API route for on-demand revalidation
 * Allows revalidating specific paths or tags
 */
export async function POST(request) {
  try {
    const { path, tags, secret } = await request.json();
    
    // Validate the request has proper authorization
    const expectedSecret = process.env.REVALIDATION_SECRET;
    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Invalid revalidation token' },
        { status: 401 }
      );
    }
    
    // Revalidate by path if provided
    if (path) {
      revalidatePath(path);
    }
    
    // Revalidate by tags if provided
    if (tags && Array.isArray(tags)) {
      for (const tag of tags) {
        revalidateTag(tag);
      }
    }
    
    return NextResponse.json({
      revalidated: true,
      now: Date.now(),
      path: path || null,
      tags: tags || null
    });
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json(
      { error: 'Error revalidating', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET handler for testing the revalidation endpoint
 */
export async function GET() {
  return NextResponse.json({
    message: 'Revalidation endpoint is working. Use POST to revalidate content.',
    instructions: 'Send a POST request with path, tags, and secret in the request body.'
  });
}
