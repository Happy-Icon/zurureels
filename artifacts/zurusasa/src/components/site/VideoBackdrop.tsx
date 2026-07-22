import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  /** Tailwind classes for the tint overlay on top of the video. */
  overlayClassName?: string;
  /** Skip the IntersectionObserver gate (use on above-the-fold sections). */
  eager?: boolean;
  className?: string;
};

export function VideoBackdrop({
  src,
  overlayClassName,
  eager = false,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(eager);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    if (mq.matches) return;
    if (eager) {
      setMounted(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: "1200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager]);

  useEffect(() => {
    if (mounted && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [mounted]);

  return (
    <div
      ref={ref}
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className ?? ""}`}
    >
      {mounted && !reduceMotion && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
          src={src}
        />
      )}
      <div className={`absolute inset-0 ${overlayClassName ?? "bg-background/70"}`} />
    </div>
  );
}
