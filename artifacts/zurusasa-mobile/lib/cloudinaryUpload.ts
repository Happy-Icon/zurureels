/**
 * Cloudinary Upload Utility for ZuruSasa Mobile (React Native)
 * Uploads media files directly to Cloudinary using unsigned upload preset.
 */

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dwcuyxujd';
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'zurusasa';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  width?: number;
  height?: number;
  duration?: number;
  format: string;
}

export async function uploadToCloudinaryMobile(
  localUri: string,
  options?: {
    resourceType?: 'video' | 'image' | 'auto';
    folder?: string;
    onProgress?: (percent: number) => void;
  }
): Promise<CloudinaryUploadResult> {
  const isVideo = options?.resourceType === 'video' || !!localUri.match(/\.(mp4|mov|avi|mkv|webm)/i);
  const resourceType = isVideo ? 'video' : 'image';
  const folder = options?.folder || 'reels';

  const filename = localUri.split('/').pop() || `upload_${Date.now()}`;
  const ext = (filename.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase();
  const mimeType = isVideo
    ? `video/${ext === 'mov' ? 'quicktime' : 'mp4'}`
    : `image/${ext === 'png' ? 'png' : 'jpeg'}`;

  const formData = new FormData();
  formData.append('file', {
    uri: localUri,
    type: mimeType,
    name: filename,
  } as any);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);
  formData.append('tags', 'zurureels');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.timeout = 300000; // 5 minute timeout

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
        reject(new Error(`Cloudinary upload failed (Status ${xhr.status}): ${xhr.responseText}`));
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

    xhr.addEventListener('error', () => reject(new Error('Cloudinary network error')));
    xhr.addEventListener('timeout', () => reject(new Error('Cloudinary upload timed out')));
    xhr.addEventListener('abort', () => reject(new Error('Cloudinary upload aborted')));

    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
    xhr.open('POST', url);
    xhr.send(formData);
  });
}

export function getCloudinaryVideoThumbnail(videoSecureUrl: string): string {
  if (!videoSecureUrl || !videoSecureUrl.includes('cloudinary.com')) {
    return videoSecureUrl;
  }
  return videoSecureUrl
    .replace('/upload/', '/upload/so_0,w_400,h_600,c_fill,q_auto,f_jpg/')
    .replace(/\.([a-z0-9]+)$/i, '.jpg');
}
