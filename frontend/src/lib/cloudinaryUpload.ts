import { CLOUDINARY_UPLOAD_PRESET } from "@/lib/cloudinary";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;

export interface CloudinaryUploadResult {
    publicId: string;
    secureUrl: string;
    format: string;
    duration?: number;
    width?: number;
    height?: number;
}

/**
 * Upload a file directly from the browser to Cloudinary using an
 * unsigned upload preset.
 *
 * Usage:
 *   const result = await uploadToCloudinary(file, { resourceType: "video" });
 *   // store result.publicId in Supabase — use it with CloudinaryVideo
 */
export async function uploadToCloudinary(
    file: File,
    options: {
        resourceType?: "image" | "video" | "auto";
        folder?: string;
        onProgress?: (percent: number) => void;
    } = {}
): Promise<CloudinaryUploadResult> {
    const { resourceType = "auto", folder, onProgress } = options;

    if (!CLOUD_NAME) {
        throw new Error(
            "VITE_CLOUDINARY_CLOUD_NAME is not set. " +
            "Add it to your .env file before uploading."
        );
    }

    if (!CLOUDINARY_UPLOAD_PRESET) {
        throw new Error(
            "VITE_CLOUDINARY_UPLOAD_PRESET is not set. " +
            "Create an unsigned upload preset in the Cloudinary console and add it to your .env."
        );
    }

    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    if (folder) {
        formData.append("folder", folder);
    }

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open("POST", url);

        if (onProgress) {
            xhr.upload.addEventListener("progress", (event) => {
                if (event.lengthComputable) {
                    onProgress(Math.round((event.loaded / event.total) * 100));
                }
            });
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const data = JSON.parse(xhr.responseText);
                resolve({
                    publicId: data.public_id as string,
                    secureUrl: data.secure_url as string,
                    format: data.format as string,
                    duration: data.duration as number | undefined,
                    width: data.width as number | undefined,
                    height: data.height as number | undefined,
                });
            } else {
                reject(new Error(`Cloudinary upload failed: ${xhr.responseText}`));
            }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(formData);
    });
}
