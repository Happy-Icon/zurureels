import { useRef, forwardRef } from "react";
import { buildVideoUrl } from "@/lib/cloudinary";

interface CloudinaryVideoProps {
    /** Cloudinary public ID  OR  a full external URL (fallback) */
    src: string;
    poster?: string;
    className?: string;
    muted?: boolean;
    loop?: boolean;
    playsInline?: boolean;
    autoPlay?: boolean;
    preload?: string;
    crossOrigin?: "" | "anonymous" | "use-credentials";
    onPlay?: () => void;
    onPause?: () => void;
    onError?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
    videoRef?: React.RefObject<HTMLVideoElement>;
}

/**
 * Renders a Cloudinary-optimised video when `src` is a Cloudinary public ID,
 * otherwise falls back to a plain <video> for external/raw URLs.
 *
 * Automatically applies f_auto + q_auto via URL transformation.
 */
export const CloudinaryVideo = forwardRef<HTMLVideoElement, CloudinaryVideoProps>(
    (
        {
            src,
            poster,
            className,
            muted = true,
            loop = true,
            playsInline = true,
            autoPlay,
            preload = "metadata",
            crossOrigin = "anonymous",
            onPlay,
            onPause,
            onError,
            videoRef,
        },
        _ref
    ) => {
        const internalRef = useRef<HTMLVideoElement>(null);
        const ref = (videoRef ?? internalRef) as React.RefObject<HTMLVideoElement>;

        // Determine the actual video source URL
        const isExternalUrl =
            !src ||
            src.startsWith("http://") ||
            src.startsWith("https://") ||
            src.startsWith("blob:") ||
            src.startsWith("data:");

        const videoSrc = isExternalUrl ? src : buildVideoUrl(src);

        return (
            <video
                ref={ref}
                src={videoSrc}
                poster={poster}
                className={className}
                muted={muted}
                loop={loop}
                playsInline={playsInline}
                autoPlay={autoPlay}
                preload={preload}
                crossOrigin={crossOrigin}
                onPlay={onPlay}
                onPause={onPause}
                onError={onError}
            />
        );
    }
);

CloudinaryVideo.displayName = "CloudinaryVideo";
