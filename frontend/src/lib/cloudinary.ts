/**
 * Cloudinary URL helpers — zero SDK dependency.
 * Builds optimized Cloudinary CDN URLs using simple string manipulation.
 * This avoids any potential Vite/ESM compatibility issues with the SDK packages.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string || "";

/**
 * Build an optimised Cloudinary video URL from a public ID.
 * Applies f_auto + q_auto automatically.
 */
export function buildVideoUrl(publicId: string): string {
  if (!CLOUD_NAME) return publicId;
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/f_auto,q_auto/${publicId}`;
}

/**
 * Build an optimised Cloudinary image URL from a public ID.
 * Applies f_auto + q_auto automatically.
 */
export function buildImageUrl(publicId: string, width?: number, height?: number): string {
  if (!CLOUD_NAME) return publicId;
  const transforms = width && height
    ? `c_fill,w_${width},h_${height},f_auto,q_auto`
    : `f_auto,q_auto`;
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms}/${publicId}`;
}

/**
 * Upload preset (unsigned) for browser-side direct uploads.
 */
export const CLOUDINARY_UPLOAD_PRESET =
  (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string) || "";

export const CLOUDINARY_CLOUD_NAME = CLOUD_NAME;
