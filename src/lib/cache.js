// src/lib/cache.js
/**
 * Cache utility for Next.js application
 * Provides memory and persistent caching mechanisms
 */

// In-memory cache store
const memoryCache = new Map();

/**
 * Get data from cache or compute it if not available
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to compute data if not in cache
 * @param {number} ttl - Time to live in seconds (default: 1 hour)
 * @returns {Promise<any>} - Cached or computed data
 */
export async function getOrComputeData(key, fetchFn, ttl = 3600) {
  // Check if data exists in cache and is not expired
  const cachedItem = memoryCache.get(key);
  const now = Date.now();
  
  if (cachedItem && cachedItem.expiresAt > now) {
    console.log(`Cache hit for key: ${key}`);
    return cachedItem.data;
  }
  
  // If not in cache or expired, compute data
  console.log(`Cache miss for key: ${key}, fetching data...`);
  const data = await fetchFn();
  
  // Store in cache with expiration
  memoryCache.set(key, {
    data,
    expiresAt: now + (ttl * 1000)
  });
  
  return data;
}

/**
 * Create a stable cache key based on parameters
 * @param {string} prefix - Key prefix
 * @param {Object} params - Parameters to include in key
 * @returns {string} - Stable cache key
 */
export function createCacheKey(prefix, params) {
  const sortedParams = Object.entries(params)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  
  return `${prefix}:${sortedParams}`;
}

/**
 * Create a time-based cache key that changes on a schedule
 * @param {string} prefix - Key prefix
 * @param {Object} params - Parameters to include in key
 * @param {number} intervalSeconds - Interval in seconds (default: 1 hour)
 * @returns {string} - Time-based cache key
 */
export function createTimedCacheKey(prefix, params, intervalSeconds = 3600) {
  const timeSlot = Math.floor(Date.now() / (intervalSeconds * 1000));
  return createCacheKey(`${prefix}:${timeSlot}`, params);
}

/**
 * Clear all cache entries or specific entries matching a prefix
 * @param {string} [prefix] - Optional prefix to clear only matching entries
 */
export function clearCache(prefix) {
  if (!prefix) {
    memoryCache.clear();
    console.log('Cleared entire cache');
    return;
  }
  
  // Clear only entries with matching prefix
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
  console.log(`Cleared cache entries with prefix: ${prefix}`);
}

/**
 * Get cache statistics
 * @returns {Object} - Cache statistics
 */
export function getCacheStats() {
  const now = Date.now();
  let activeEntries = 0;
  let expiredEntries = 0;
  
  for (const [key, value] of memoryCache.entries()) {
    if (value.expiresAt > now) {
      activeEntries++;
    } else {
      expiredEntries++;
    }
  }
  
  return {
    totalEntries: memoryCache.size,
    activeEntries,
    expiredEntries
  };
}
