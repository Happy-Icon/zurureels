/**
 * MiniVideoEditor — Clean video recorder + trimmer.
 *
 * Two modes:
 *  1. RECORD: Opens LiveVideoRecorder (20s max, front/back camera, auto-stops).
 *  2. TRIM:   Shows the recorded/uploaded video with a WhatsApp-style trim bar
 *             so users can crop to ≤ 20 seconds before uploading.
 *
 * No scores. No emojis. No fake audio cues. Just record → trim → upload.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, Upload, Play, Pause, Scissors, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveVideoRecorder } from "./LiveVideoRecorder";
import { toast } from "sonner";

// ─── Public Types ──────────────────────────────────────────────────────────────

interface MiniVideoEditorProps {
  category: string;
  videoFile?: File | null;
  onBack: () => void;
  onSubmit: (data: VideoEditorSubmitData) => void;
}

export interface VideoEditorSubmitData {
  category: string;
  videoFile: File;
  duration: number;
  lat?: number;
  lng?: number;
  isLive?: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_REEL_DURATION = 20; // seconds — hard limit
const THUMBNAIL_COUNT = 12;   // frames in the filmstrip

// ─── Component ─────────────────────────────────────────────────────────────────

export const MiniVideoEditor = ({
  category,
  videoFile,
  onBack,
  onSubmit,
}: MiniVideoEditorProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trimBarRef = useRef<HTMLDivElement>(null);

  // Mutable ref to avoid stale closures in drag handlers
  const trimRef = useRef({ start: 0, end: MAX_REEL_DURATION, duration: 0 });

  // ── State ──────────────────────────────────────────────────────────────────

  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(MAX_REEL_DURATION);
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  const [showRecorder, setShowRecorder] = useState(!videoFile);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [capturedLocation, setCapturedLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [isExporting, setIsExporting] = useState(false);

  // Keep the ref in sync with state (prevents stale closures in pointer events)
  useEffect(() => {
    trimRef.current = { start: trimStart, end: trimEnd, duration: videoDuration };
  }, [trimStart, trimEnd, videoDuration]);

  // ── Create object URL for the source video ────────────────────────────────

  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setLocalVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [videoFile]);

  // ── Recording complete handler ────────────────────────────────────────────

  const handleRecordingComplete = useCallback(
    (file: File, loc?: { lat: number; lng: number }) => {
      setRecordedFile(file);
      if (loc) setCapturedLocation(loc);
      const url = URL.createObjectURL(file);
      setLocalVideoUrl(url);
      setShowRecorder(false);
    },
    []
  );

  // ── Video metadata ready → set duration + extract filmstrip ───────────────

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isFinite(video.duration)) return;

    const dur = video.duration;
    setVideoDuration(dur);
    setTrimStart(0);
    setTrimEnd(Math.min(dur, MAX_REEL_DURATION));
    extractThumbnails(video, dur);
  }, []);

  // ── Extract thumbnail frames for the filmstrip ────────────────────────────

  const extractThumbnails = async (video: HTMLVideoElement, duration: number) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 56;
    canvas.height = 96;
    const frames: string[] = [];

    for (let i = 0; i < THUMBNAIL_COUNT; i++) {
      const time = (duration / THUMBNAIL_COUNT) * (i + 0.5);
      video.currentTime = time;
      await new Promise<void>((r) =>
        video.addEventListener("seeked", () => r(), { once: true })
      );
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.35));
    }

    video.currentTime = 0;
    setThumbnails(frames);
  };

  // ── Time update — loop playback within trim bounds ────────────────────────

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);

    if (video.currentTime >= trimRef.current.end) {
      video.pause();
      video.currentTime = trimRef.current.start;
      setIsPlaying(false);
    }
  }, []);

  // ── Play / Pause ──────────────────────────────────────────────────────────

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      // If cursor is outside trim range, reset to start
      if (video.currentTime < trimRef.current.start || video.currentTime >= trimRef.current.end) {
        video.currentTime = trimRef.current.start;
      }
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  // ── Trim-handle drag logic (uses ref → never stale) ───────────────────────

  const handleDragStart = useCallback(
    (handle: "start" | "end") => (e: React.PointerEvent) => {
      e.preventDefault();
      const bar = trimBarRef.current;
      if (!bar) return;

      const onMove = (ev: PointerEvent) => {
        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        const { duration, start, end } = trimRef.current;
        const time = ratio * duration;

        if (handle === "start") {
          const ns = Math.max(0, Math.min(time, end - 1));
          if (end - ns <= MAX_REEL_DURATION) {
            setTrimStart(ns);
            trimRef.current.start = ns;
          }
        } else {
          const ne = Math.min(duration, Math.max(time, start + 1));
          if (ne - start <= MAX_REEL_DURATION) {
            setTrimEnd(ne);
            trimRef.current.end = ne;
          }
        }
      };

      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    []
  );

  // ── Submit — trim if needed, then hand file to parent ─────────────────────

  const handleSubmit = async () => {
    const sourceFile = recordedFile || videoFile;
    if (!sourceFile) {
      toast.error("No video found. Please record or upload a video first.");
      return;
    }

    const selectedDuration = trimEnd - trimStart;

    // If the entire video is already ≤ 20s and user didn't adjust handles → skip trimming
    const fullRange =
      videoDuration <= MAX_REEL_DURATION + 0.5 &&
      trimStart < 0.5 &&
      trimEnd >= videoDuration - 0.5;

    if (fullRange) {
      onSubmit({
        category,
        videoFile: sourceFile,
        duration: Math.round(videoDuration),
        lat: capturedLocation?.lat,
        lng: capturedLocation?.lng,
        isLive: !!recordedFile,
      });
      return;
    }

    // Trim via captureStream + MediaRecorder
    if (!videoRef.current) return;
    setIsExporting(true);

    try {
      const trimmed = await trimVideo(videoRef.current, trimStart, trimEnd);
      onSubmit({
        category,
        videoFile: trimmed,
        duration: Math.round(selectedDuration),
        lat: capturedLocation?.lat,
        lng: capturedLocation?.lng,
        isLive: !!recordedFile,
      });
    } catch (err) {
      console.error("Trim failed, uploading original:", err);
      // Graceful fallback: upload original file with the trim metadata
      onSubmit({
        category,
        videoFile: sourceFile,
        duration: Math.round(selectedDuration),
        lat: capturedLocation?.lat,
        lng: capturedLocation?.lng,
        isLive: !!recordedFile,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // ── Derived layout values ─────────────────────────────────────────────────

  const trimmedDuration = trimEnd - trimStart;
  const leftPct = videoDuration > 0 ? (trimStart / videoDuration) * 100 : 0;
  const rightPct = videoDuration > 0 ? ((videoDuration - trimEnd) / videoDuration) * 100 : 0;
  const playheadPct = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;
  const needsTrimming = videoDuration > MAX_REEL_DURATION;
  const canUpload = videoDuration > 0 && trimmedDuration >= 1 && trimmedDuration <= MAX_REEL_DURATION && !isExporting;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Recording mode
  // ═══════════════════════════════════════════════════════════════════════════

  if (showRecorder) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <LiveVideoRecorder
          onRecordingComplete={handleRecordingComplete}
          onCancel={onBack}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Trim + Preview mode
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <div className="flex items-center gap-1.5 text-sm">
          <Scissors className="h-4 w-4 text-muted-foreground" />
          <span
            className={cn(
              "font-semibold tabular-nums",
              trimmedDuration > MAX_REEL_DURATION ? "text-destructive" : "text-foreground"
            )}
          >
            {trimmedDuration.toFixed(1)}s
          </span>
          <span className="text-muted-foreground">/ {MAX_REEL_DURATION}s</span>
        </div>

        <Button size="sm" onClick={handleSubmit} disabled={!canUpload}>
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Trimming…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-1" />
              Upload
            </>
          )}
        </Button>
      </div>

      {/* ── Video Preview ───────────────────────────────────────────────── */}
      <div
        className="flex-1 relative bg-black flex items-center justify-center cursor-pointer"
        onClick={togglePlayback}
      >
        {localVideoUrl ? (
          <video
            ref={videoRef}
            src={localVideoUrl}
            className="max-h-full max-w-full object-contain"
            style={{ aspectRatio: "9/16" }}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            playsInline
            muted
          />
        ) : (
          <p className="text-white/40">No video loaded</p>
        )}

        {/* Play overlay (visible when paused) */}
        {localVideoUrl && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="h-16 w-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <Play className="h-7 w-7 text-white ml-1" />
            </div>
          </div>
        )}
      </div>

      {/* ── Trim Bar (WhatsApp-style filmstrip with drag handles) ────── */}
      {videoDuration > 0 && (
        <div className="px-4 pt-3 pb-5 bg-background border-t border-border space-y-2">
          {needsTrimming && (
            <p className="text-xs text-center text-amber-500 font-medium">
              Video is {videoDuration.toFixed(1)}s — drag handles to select up to {MAX_REEL_DURATION}s
            </p>
          )}

          <div className="relative h-14 touch-none" ref={trimBarRef}>
            {/* Filmstrip thumbnails */}
            <div className="absolute inset-0 flex rounded-lg overflow-hidden">
              {thumbnails.length > 0
                ? thumbnails.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="h-full flex-1 object-cover"
                    draggable={false}
                  />
                ))
                : <div className="h-full w-full bg-muted animate-pulse rounded-lg" />
              }
            </div>

            {/* Dimmed regions outside trim range */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-black/60 rounded-l-lg pointer-events-none"
              style={{ width: `${leftPct}%` }}
            />
            <div
              className="absolute top-0 bottom-0 right-0 bg-black/60 rounded-r-lg pointer-events-none"
              style={{ width: `${rightPct}%` }}
            />

            {/* Selected region border */}
            <div
              className="absolute top-0 bottom-0 border-2 border-primary pointer-events-none"
              style={{ left: `${leftPct}%`, right: `${rightPct}%` }}
            />

            {/* Left trim handle */}
            <div
              className="absolute top-0 bottom-0 z-10 flex items-center justify-center cursor-ew-resize"
              style={{ left: `${leftPct}%`, width: 20, transform: "translateX(-10px)" }}
              onPointerDown={handleDragStart("start")}
            >
              <div className="h-8 w-1.5 bg-primary rounded-full shadow-lg" />
            </div>

            {/* Right trim handle */}
            <div
              className="absolute top-0 bottom-0 z-10 flex items-center justify-center cursor-ew-resize"
              style={{ left: `${100 - rightPct}%`, width: 20, transform: "translateX(-10px)" }}
              onPointerDown={handleDragStart("end")}
            >
              <div className="h-8 w-1.5 bg-primary rounded-full shadow-lg" />
            </div>

            {/* Playhead */}
            {isPlaying && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none shadow"
                style={{ left: `${playheadPct}%` }}
              />
            )}
          </div>

          {/* Time labels */}
          <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums px-0.5">
            <span>{formatTime(trimStart)}</span>
            <span>{formatTime(trimEnd)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Format seconds to M:SS */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Trim a video element's playback range to a new File using captureStream.
 * Falls back by rejecting if captureStream is unavailable.
 */
function trimVideo(
  video: HTMLVideoElement,
  start: number,
  end: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    // captureStream may not exist in all browsers
    const captureStream =
      (video as any).captureStream || (video as any).mozCaptureStream;
    if (!captureStream) {
      reject(new Error("captureStream not supported"));
      return;
    }

    const stream: MediaStream = captureStream.call(video);
    const mimeTypes = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    const mimeType =
      mimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) || "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      resolve(new File([blob], `reel-trimmed.${ext}`, { type: mimeType }));
    };

    recorder.onerror = () => reject(new Error("MediaRecorder error"));

    // Seek to start, then play + record until end
    video.currentTime = start;
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.play();
      recorder.start();

      const poll = () => {
        if (video.currentTime >= end || video.paused) {
          video.pause();
          if (recorder.state === "recording") recorder.stop();
        } else {
          requestAnimationFrame(poll);
        }
      };
      poll();
    };

    video.addEventListener("seeked", onSeeked, { once: true });
  });
}
