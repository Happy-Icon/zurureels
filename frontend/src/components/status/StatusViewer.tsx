import { useState, useEffect, useRef } from "react";
import { HostStatus } from "@/hooks/useHostStatuses";
import { ChevronLeft, ChevronRight, X, Play, Pause, User, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface StatusViewerProps {
  statuses: HostStatus[];
  hostName: string;
  hostAvatar: string;
  hostUserId: string;
  open: boolean;
  onClose: () => void;
}

const DEFAULT_STORY_DURATION = 5000; // 5 seconds per status

export function StatusViewer({
  statuses,
  hostName,
  hostAvatar,
  hostUserId,
  open,
  onClose
}: StatusViewerProps) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedBeforePauseRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const activeStatus = statuses[currentIndex];
  const duration = activeStatus?.mediaType === "video" && videoDuration 
    ? videoDuration * 1000 
    : DEFAULT_STORY_DURATION;

  // Reset when status list or dialog state changes
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setProgress(0);
      setIsPaused(false);
      setVideoDuration(null);
      elapsedBeforePauseRef.current = 0;
    }
  }, [open, statuses.length]);

  const handleNext = () => {
    elapsedBeforePauseRef.current = 0;
    setProgress(0);
    setVideoDuration(null);
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose(); // Finished all stories
    }
  };

  const handlePrev = () => {
    elapsedBeforePauseRef.current = 0;
    setProgress(0);
    setVideoDuration(null);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") handleNext();
      else if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === " ") {
        e.preventDefault();
        setIsPaused(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, currentIndex, statuses.length]);

  // Main animation timer loop
  useEffect(() => {
    if (!open || !activeStatus || isPaused) {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
        timerRef.current = null;
      }
      // If paused, pause video too
      if (videoRef.current && isPaused) {
        videoRef.current.pause();
      }
      return;
    }

    // Play video if active status is a video
    if (videoRef.current && activeStatus.mediaType === "video" && !isPaused) {
      videoRef.current.play().catch(err => console.warn("Video play blocked:", err));
    }

    startTimeRef.current = performance.now() - elapsedBeforePauseRef.current;

    const animate = (time: number) => {
      const elapsed = time - startTimeRef.current;
      elapsedBeforePauseRef.current = elapsed;
      
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        handleNext();
      } else {
        timerRef.current = requestAnimationFrame(animate);
      }
    };

    timerRef.current = requestAnimationFrame(animate);

    return () => {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
      }
    };
  }, [open, currentIndex, isPaused, duration, activeStatus]);

  // Handle video metadata (duration) loading
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const vidDur = videoRef.current.duration;
      // Cap video story length to max 15 seconds for snappiness, or use video length
      setVideoDuration(vidDur ? Math.min(vidDur, 15) : null);
    }
  };

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsPaused(true);
  };

  const handlePressEnd = () => {
    setIsPaused(false);
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const clickX = e.clientX;
    const screenWidth = window.innerWidth;
    
    // Tap left 30% to go back, right 70% to go forward
    if (clickX < screenWidth * 0.3) {
      handlePrev();
    } else {
      handleNext();
    }
  };

  const handleViewProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
    if (hostUserId) {
      navigate(`/profile/${hostUserId}`);
    }
  };

  if (!open || !activeStatus) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-fade-in">
      {/* Mobile container constraint on desktop */}
      <div className="relative w-full h-full md:max-w-[420px] md:h-[90vh] md:rounded-[32px] md:overflow-hidden md:border border-white/10 shadow-2xl flex flex-col bg-zinc-950">
        
        {/* Gestures Area */}
        <div 
          className="relative flex-1 w-full h-full cursor-pointer overflow-hidden flex items-center justify-center select-none"
          onClick={handleOverlayClick}
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
        >
          {/* Render Status Media */}
          {activeStatus.mediaType === "text" ? (
            <div className={cn("w-full h-full flex items-center justify-center p-8 text-center text-2xl font-display font-bold leading-normal px-10 shadow-inner select-none", activeStatus.backgroundGradient || "bg-gradient-to-br from-zinc-800 to-black text-white")}>
              <span className="drop-shadow-md select-text">{activeStatus.textContent}</span>
            </div>
          ) : activeStatus.mediaType === "video" ? (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <video
                ref={videoRef}
                src={activeStatus.mediaUrl}
                className="w-full h-full object-cover"
                playsInline
                muted={false} // Allow sound for statuses
                onLoadedMetadata={handleLoadedMetadata}
              />
            </div>
          ) : (
            <div className="w-full h-full bg-black flex items-center justify-center">
              <img
                src={activeStatus.mediaUrl}
                alt="Host Status"
                className="w-full h-full object-cover pointer-events-none"
              />
            </div>
          )}

          {/* Caption Overlay */}
          {activeStatus.mediaType !== "text" && activeStatus.caption && (
            <div className="absolute bottom-16 left-0 right-0 p-5 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none text-center">
              <p className="text-white text-sm font-medium drop-shadow-md select-text leading-snug px-4">
                {activeStatus.caption}
              </p>
            </div>
          )}
        </div>

        {/* Top Controls Overlay */}
        <div className="absolute top-0 left-0 right-0 p-4 pt-5 bg-gradient-to-b from-black/60 to-transparent z-20 pointer-events-auto">
          {/* Progress Indicators */}
          <div className="flex gap-1.5 mb-4">
            {statuses.map((_, index) => {
              let widthVal = 0;
              if (index < currentIndex) widthVal = 100;
              else if (index === currentIndex) widthVal = progress;
              
              return (
                <div key={index} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-75 ease-linear"
                    style={{ width: `${widthVal}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Host Info Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border-2 border-white/60 overflow-hidden bg-zinc-800 shrink-0">
                <img 
                  src={hostAvatar} 
                  alt={hostName} 
                  className="h-full w-full object-cover pointer-events-none"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${hostName}`;
                  }}
                />
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-bold leading-tight drop-shadow-sm">{hostName}</p>
                <p className="text-[10px] text-white/70 leading-none mt-0.5 drop-shadow-sm font-medium">
                  {formatDistanceToNow(new Date(activeStatus.createdAt))} ago
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaused(prev => !prev);
                }}
                className="p-2 rounded-full hover:bg-white/10 text-white/95 transition-colors"
              >
                {isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-2 rounded-full hover:bg-white/10 text-white/95 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* View Profile Sticky Bottom Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex justify-center z-20 pointer-events-auto">
          <button
            onClick={handleViewProfile}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-bold text-xs shadow-lg hover:bg-white/90 active:scale-95 transition-all"
          >
            <User className="h-3.5 w-3.5" />
            View Host Profile
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
