/**
 * Extract a thumbnail frame from a video File.
 * Seeks to ~25% of the video duration for a representative frame.
 * Returns a Blob (JPEG) that can be uploaded to storage.
 */
export async function extractVideoThumbnail(
    videoFile: File,
    seekPercent = 0.25
): Promise<Blob | null> {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;

        const url = URL.createObjectURL(videoFile);
        video.src = url;

        const cleanup = () => {
            URL.revokeObjectURL(url);
            video.remove();
        };

        video.onloadedmetadata = () => {
            // Seek to a point in the video (default 25%)
            const seekTime = isFinite(video.duration)
                ? video.duration * seekPercent
                : 1; // fallback to 1s if duration unknown
            video.currentTime = Math.max(0.5, seekTime);
        };

        video.onseeked = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth || 720;
                canvas.height = video.videoHeight || 1280;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    cleanup();
                    resolve(null);
                    return;
                }

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(
                    (blob) => {
                        cleanup();
                        resolve(blob);
                    },
                    "image/jpeg",
                    0.85
                );
            } catch (err) {
                console.error("Thumbnail extraction failed:", err);
                cleanup();
                resolve(null);
            }
        };

        video.onerror = () => {
            console.error("Video load error during thumbnail extraction");
            cleanup();
            resolve(null);
        };

        // Timeout fallback — if video never loads metadata
        setTimeout(() => {
            cleanup();
            resolve(null);
        }, 10000);
    });
}
