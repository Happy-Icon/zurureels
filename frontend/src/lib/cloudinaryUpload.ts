/**
 * Cloudinary Upload Utility
 * Uses unsigned upload preset for browser-based uploads
 */

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  width?: number;
  height?: number;
  duration?: number;
  format: string;
}

/**
 * Uploads a file to Cloudinary using unsigned upload preset
 * @param file - File to upload (video or image)
 * @param options - Upload options
 * @returns CloudinaryUploadResult with secure_url and public_id
 */
export async function uploadToCloudinary(
  file: File,
  options?: {
    resourceType?: 'video' | 'image' | 'auto';
    folder?: string;
    onProgress?: (percent: number) => void;
    retries?: number;
  }
): Promise<CloudinaryUploadResult> {
  const maxRetries = options?.retries ?? 2; // Default to 2 retries (3 total attempts)
  let attempt = 0;

  const executeUpload = (): Promise<CloudinaryUploadResult> => {
    return new Promise((resolve, reject) => {
      if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
        reject(new Error('Cloudinary configuration missing'));
        return;
      }

      const resourceType = options?.resourceType || 'auto';
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      if (options?.folder) formData.append('folder', options.folder);
      formData.append('tags', 'zurureels');

      const xhr = new XMLHttpRequest();
      xhr.timeout = 60000; // 60s timeout

      if (options?.onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            options.onProgress?.(percent);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status !== 200) {
          reject(new Error(`Status ${xhr.status}: ${xhr.responseText}`));
          return;
        }
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({
            secure_url: response.secure_url,
            public_id: response.public_id,
            width: response.width,
            height: response.height,
            duration: response.duration,
            format: response.format,
          });
        } catch (e) {
          reject(new Error('Failed to parse Cloudinary response'));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.addEventListener('timeout', () => reject(new Error('Upload timed out')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
      xhr.open('POST', url);
      xhr.send(formData);
    });
  };

  while (attempt <= maxRetries) {
    try {
      return await executeUpload();
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) throw err;
      console.warn(`Upload attempt ${attempt} failed, retrying...`, err);
      // Brief delay before retry (exponential backoff)
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  throw new Error('Upload failed after multiple attempts');
}

/**
 * Build an optimized Cloudinary video URL with auto optimization
 */
export function buildVideoUrl(publicId: string): string {
  if (!CLOUDINARY_CLOUD_NAME) return '';
  // Apply auto quality and format optimization
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/q_auto,f_auto/${publicId}`;
}

/**
 * Build an optimized Cloudinary image URL
 */
export function buildImageUrl(publicId: string, transforms?: string): string {
  if (!CLOUDINARY_CLOUD_NAME) return '';
  const defaultTransforms = 'w_400,h_600,c_fill,q_auto,f_auto';
  const finalTransforms = transforms || defaultTransforms;
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${finalTransforms}/${publicId}`;
}
