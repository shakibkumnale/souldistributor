// src/lib/route-handlers.js
/**
 * Next.js API route handler utilities with caching
 */
import { NextResponse } from 'next/server';
import { createTimedCacheKey, getOrComputeData } from './cache';

/**
 * Create a cached API route handler
 * @param {Function} handler - Async function that handles the request and returns data
 * @param {Object} options - Options for the handler
 * @param {number} options.revalidate - Revalidation time in seconds
 * @param {Function} options.getCacheKey - Function to generate cache key from request
 * @returns {Function} - Next.js route handler function
 */
export function createCachedRouteHandler(handler, options = {}) {
  const {
    revalidate = 3600, // Default to 1 hour
    getCacheKey = (req) => {
      // Default cache key generator based on URL and search params
      const url = new URL(req.url);
      return createTimedCacheKey('api', {
        path: url.pathname,
        search: url.search || ''
      }, revalidate);
    }
  } = options;

  return async function cachedRouteHandler(req) {
    try {
      // Generate cache key for this request
      const cacheKey = getCacheKey(req);
      
      // Get data from cache or compute it
      const data = await getOrComputeData(
        cacheKey,
        async () => await handler(req),
        revalidate
      );
      
      // Return cached or fresh data with cache headers
      return NextResponse.json(data, {
        status: 200,
        headers: {
          'Cache-Control': `s-maxage=${revalidate}, stale-while-revalidate=${revalidate * 2}`
        }
      });
    } catch (error) {
      console.error('API route error:', error);
      return NextResponse.json(
        { error: error.message || 'Internal Server Error' },
        { status: error.status || 500 }
      );
    }
  };
}

/**
 * Create a handler for dynamic routes with caching
 * @param {Function} getDataFn - Function to get data for the route
 * @param {Object} options - Caching options
 * @returns {Function} - Handler function
 */
export function createCachedDataHandler(getDataFn, options = {}) {
  const { 
    revalidate = 3600,
    notFoundMessage = 'Resource not found',
    errorMessage = 'Error fetching data'
  } = options;
  
  return async function(params) {
    try {
      // Create a cache key based on the params
      const cacheKey = createTimedCacheKey(
        'data-handler',
        params,
        revalidate
      );
      
      // Get data from cache or compute it
      const data = await getOrComputeData(
        cacheKey,
        async () => await getDataFn(params),
        revalidate
      );
      
      if (!data) {
        throw new Error(notFoundMessage);
      }
      
      return data;
    } catch (error) {
      console.error(`Data handler error:`, error);
      throw new Error(errorMessage);
    }
  };
}
