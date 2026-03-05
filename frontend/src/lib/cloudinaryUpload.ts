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
  }
): Promise<CloudinaryUploadResult> {
  if (!CLOUDINARY_CLOUD_NAME) {
    throw new Error('VITE_CLOUDINARY_CLOUD_NAME is not configured');
  }

  if (!CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('VITE_CLOUDINARY_UPLOAD_PRESET is not configured');
  }

  const resourceType = options?.resourceType || 'auto';
  const formData = new FormData();

  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  
  if (options?.folder) {
    formData.append('folder', options.folder);
  }

  // Add tags for organization
  formData.append('tags', 'zurureels');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
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
        reject(new Error(`Cloudinary upload failed: ${xhr.responseText}`));
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

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
    xhr.open('POST', url);
    xhr.send(formData);
  });
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
