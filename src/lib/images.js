// src/lib/images.js
/**
 * Image utility functions for handling image paths and fallbacks
 */

/**
 * Get the correct image path for a given image URL
 * Handles both remote and local images
 * @param {string} src - Image source URL or path
 * @param {string} fallback - Fallback image path
 * @returns {string} - Processed image path
 */
export function getImagePath(src, fallback = '/images/placeholder-cover.jpg') {
  if (!src) return fallback;
  
  // If it's already an absolute URL, return it as is
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  
  // If it's a local path starting with '/', make sure it's correctly formatted
  if (src.startsWith('/')) {
    // Remove any double slashes that might cause issues
    return src.replace(/\/+/g, '/');
  }
  
  // Otherwise, assume it's a relative path and add a leading slash
  return `/${src}`;
}

/**
 * Check if an image exists at the given path
 * This is a client-side function that attempts to load the image
 * @param {string} src - Image source URL or path
 * @returns {Promise<boolean>} - Whether the image exists
 */
export function checkImageExists(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

/**
 * Common image paths used throughout the application
 */
export const IMAGE_PATHS = {
  PLACEHOLDER_COVER: '/images/placeholder-cover.jpg',
  PLACEHOLDER_ARTIST: '/images/placeholder-artist.jpg',
  PLACEHOLDER_PROFILE: '/images/placeholder-profile.jpg',
  LOGO: '/images/logo.png',
};
