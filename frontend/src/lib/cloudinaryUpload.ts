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
 * Uploads a file to Cloudinary using unsigned upload preset.
 * Automatically delegates to chunked upload for videos larger than 10MB.
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
  const TEN_MB = 10 * 1024 * 1024;
  const isVideo = file.type.startsWith('video/') || options?.resourceType === 'video';

  if (file.size > TEN_MB && isVideo) {
    console.log(`[Cloudinary] Video size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds 10MB limit. Using chunked upload.`);
    return uploadLargeToCloudinary(file, options);
  }

  const maxRetries = options?.retries ?? 2; // Default to 2 retries (3 total attempts)
  let attempt = 0;

  const executeUpload = (): Promise<CloudinaryUploadResult> => {
    return new Promise((resolve, reject) => {
      if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
        console.error('[Cloudinary] Configuration missing!', {
          cloudName: !!CLOUDINARY_CLOUD_NAME,
          uploadPreset: !!CLOUDINARY_UPLOAD_PRESET
        });
        reject(new Error('Cloudinary configuration missing. Please check your VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET environment variables.'));
        return;
      }

      const resourceType = options?.resourceType || 'auto';
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      if (options?.folder) formData.append('folder', options.folder);
      formData.append('tags', 'zurureels');

      const xhr = new XMLHttpRequest();
      xhr.timeout = 300000; // 300s / 5m timeout

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
 * Uploads large videos in chunks of 5MB sequentially to avoid network timeout issues
 */
export async function uploadLargeToCloudinary(
  file: File,
  options?: {
    resourceType?: 'video' | 'image' | 'auto';
    folder?: string;
    onProgress?: (percent: number) => void;
    retries?: number;
  }
): Promise<CloudinaryUploadResult> {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  const totalSize = file.size;
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
  const resourceType = options?.resourceType || 'video';

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary configuration missing.');
  }

  // Generate a unique upload ID for this file
  const uniqueUploadId = 'zuru_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

  let currentChunk = 0;
  let lastResponse: any = null;

  while (currentChunk < totalChunks) {
    const start = currentChunk * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalSize);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('file', chunk);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    if (options?.folder) {
      formData.append('folder', options.folder);
    }
    formData.append('tags', 'zurureels');

    const maxRetries = options?.retries ?? 2;
    let attempt = 0;
    let success = false;
    let chunkResText = '';

    while (attempt <= maxRetries && !success) {
      try {
        const xhr = new XMLHttpRequest();
        const responsePromise = new Promise<{ status: number; text: string }>((resolve, reject) => {
          xhr.timeout = 180000; // 3 minutes per chunk
          
          if (options?.onProgress) {
            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                const uploadedBefore = start;
                const totalUploaded = uploadedBefore + e.loaded;
                const percent = Math.min(Math.round((totalUploaded / totalSize) * 100), 99);
                options.onProgress?.(percent);
              }
            });
          }

          xhr.addEventListener('load', () => {
            resolve({ status: xhr.status, text: xhr.responseText });
          });
          xhr.addEventListener('error', () => reject(new Error('Chunk upload network error')));
          xhr.addEventListener('timeout', () => reject(new Error('Chunk upload timed out')));
          xhr.addEventListener('abort', () => reject(new Error('Chunk upload aborted')));
        });

        const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
        xhr.open('POST', url);
        xhr.setRequestHeader('X-Unique-Upload-Id', uniqueUploadId);
        xhr.setRequestHeader('Content-Range', `bytes ${start}-${end - 1}/${totalSize}`);
        xhr.send(formData);

        const res = await responsePromise;
        if (res.status === 200 || res.status === 201) {
          success = true;
          chunkResText = res.text;
        } else {
          throw new Error(`Status ${res.status}: ${res.text}`);
        }
      } catch (err) {
        attempt++;
        if (attempt > maxRetries) {
          throw err;
        }
        console.warn(`Chunk ${currentChunk} upload attempt ${attempt} failed, retrying...`, err);
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }

    lastResponse = JSON.parse(chunkResText);
    currentChunk++;
  }

  if (options?.onProgress) {
    options.onProgress(100);
  }

  if (!lastResponse || !lastResponse.secure_url) {
    throw new Error('Upload completed but secure URL not found in Cloudinary response');
  }

  return {
    secure_url: lastResponse.secure_url,
    public_id: lastResponse.public_id,
    width: lastResponse.width,
    height: lastResponse.height,
    duration: lastResponse.duration,
    format: lastResponse.format,
  };
}

/**
 * Build an optimized Cloudinary video URL with HLS adaptive bitrate streaming (m3u8)
 */
export function buildVideoUrl(publicId: string): string {
  if (!CLOUDINARY_CLOUD_NAME) return '';
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/sp_auto/${publicId}.m3u8`;
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
