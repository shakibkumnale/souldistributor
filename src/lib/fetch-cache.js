// src/lib/fetch-cache.js
/**
 * Next.js fetch caching utilities
 * Implements modern fetch caching patterns for Next.js applications
 */

/**
 * Create a cached fetch function with revalidation
 * @param {Object} options - Cache options
 * @param {number} options.revalidate - Revalidation time in seconds
 * @param {boolean} options.tags - Cache tags for on-demand revalidation
 * @returns {Function} - Cached fetch function
 */
export function createCachedFetch(options = {}) {
  const { 
    revalidate = 3600, // Default to 1 hour
    tags = [] 
  } = options;
  
  return async function cachedFetch(url, fetchOptions = {}) {
    try {
      // Add cache configuration to fetch options
      const nextConfig = {
        next: {
          revalidate,
          ...(tags.length > 0 ? { tags } : {})
        }
      };
      
      // Merge with user-provided options
      const mergedOptions = {
        ...fetchOptions,
        ...nextConfig
      };
      
      // Perform the fetch with caching
      const response = await fetch(url, mergedOptions);
      
      if (!response.ok) {
        throw new Error(`Fetch error: ${response.status} ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      console.error(`Cached fetch error for ${url}:`, error);
      throw error;
    }
  };
}

/**
 * Revalidate cache for specific tags
 * @param {string|string[]} tags - Tag or tags to revalidate
 * @returns {Promise<void>}
 */
export async function revalidateCache(tags) {
  try {
    const tagsArray = Array.isArray(tags) ? tags : [tags];
    
    // Next.js 13+ revalidation endpoint
    const revalidateUrl = '/api/revalidate';
    
    const response = await fetch(revalidateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        tags: tagsArray,
        secret: process.env.REVALIDATION_SECRET 
      })
    });
    
    if (!response.ok) {
      throw new Error(`Revalidation failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Cache revalidation error:', error);
    throw error;
  }
}

/**
 * Create a data fetcher with caching for use in React components
 * @param {Function} fetchFn - Function that performs the data fetching
 * @param {Object} options - Cache options
 * @returns {Function} - Cached data fetcher
 */
export function createCachedDataFetcher(fetchFn, options = {}) {
  return async function(...args) {
    try {
      // Create a cache key based on function name and arguments
      const cacheKey = `${fetchFn.name}:${JSON.stringify(args)}`;
      
      // Use the fetch cache
      const cachedFetch = createCachedFetch(options);
      
      // Call the fetch function with the cached fetch
      return await fetchFn(cachedFetch, ...args);
    } catch (error) {
      console.error('Cached data fetcher error:', error);
      throw error;
    }
  };
}
