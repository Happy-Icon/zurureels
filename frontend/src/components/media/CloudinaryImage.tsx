import { buildImageUrl } from "@/lib/cloudinary";

interface CloudinaryImageProps {
    /** Cloudinary public ID  OR  a full external URL (fallback) */
    src: string;
    alt?: string;
    className?: string;
    width?: number;
    height?: number;
}

/**
 * Renders a Cloudinary-optimised image when `src` is a public ID,
 * otherwise falls back to a plain <img> for external URLs.
 *
 * Automatically applies f_auto + q_auto via URL transformation.
 */
export const CloudinaryImage = ({
    src,
    alt = "",
    className,
    width,
    height,
}: CloudinaryImageProps) => {
    const isExternalUrl =
        !src ||
        src.startsWith("http://") ||
        src.startsWith("https://") ||
        src.startsWith("blob:") ||
        src.startsWith("data:");

    const imgSrc = isExternalUrl ? src : buildImageUrl(src, width, height);

    return (
        <img
            src={imgSrc}
            alt={alt}
            className={className}
            width={width}
            height={height}
        />
    );
};
