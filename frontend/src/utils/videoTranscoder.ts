import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

export const loadFFmpeg = async () => {
    if (ffmpeg) return ffmpeg;

    ffmpeg = new FFmpeg();

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    return ffmpeg;
};

/**
 * Transcodes a video file to a web-safe MP4 (H.264/AAC) format.
 * This happens entirely on the user's device.
 */
export const transcodeVideo = async (
    videoFile: File,
    onProgress?: (progress: number) => void
): Promise<File> => {
    const ffmpeg = await loadFFmpeg();

    const inputName = 'input' + videoFile.name.substring(videoFile.name.lastIndexOf('.'));
    const outputName = 'output.mp4';

    // Write the file to ffmpeg's virtual file system
    await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

    if (onProgress) {
        ffmpeg.on('progress', ({ progress }) => {
            onProgress(progress * 100);
        });
    }

    // Run the transcoding command
    // -i: input
    // -c:v libx264: use H.264 video codec (standard web support)
    // -preset ultrafast: prioritize speed over file size
    // -crf 28: balance quality and size
    // -c:a aac: use AAC audio codec
    // -movflags +faststart: optimize for streaming
    await ffmpeg.exec([
        '-i', inputName,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        outputName
    ]);

    // Read the result
    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data], { type: 'video/mp4' });

    // Cleanup
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    return new File([blob], 'optimized_video.mp4', { type: 'video/mp4' });
};
