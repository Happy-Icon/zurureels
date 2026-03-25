import { Heart, Share2, Bookmark, Play, Pause, Volume2, VolumeX, Clock, MapPin, ShieldCheck, Sparkle, AlertCircle, RefreshCw, Plus, Check, Loader2, Video, ChevronUp, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getReelExpiryDisplay, isReelExpiringSoon } from "@/utils/reelExpiry";
import { useReelInteractions } from "@/hooks/useReelInteractions";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export interface ReelData {
  id: string;
  experienceId?: string;
  hostUserId?: string;
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  location: string;
  category: "hotel" | "villa" | "apartment" | "boats" | "food" | "drinks" | "rentals" | "adventure" | "parks_camps" | "tours" | "events";
  price: number;
  priceUnit: string;
  rating: number;
  likes: number;
  saved: boolean;
  hostName: string;
  hostAvatar: string;
  postedAt?: string;
  isLive?: boolean;
  lat?: number;
  lng?: number;
  processingStatus?: 'uploading' | 'processing' | 'ready' | 'failed';
  processedVideoUrl?: string;
}

interface ReelCardProps {
  reel: ReelData;
  isActive: boolean;
  preloadNext?: boolean;
  onSave?: (id: string) => void;
  onBook?: (id: string) => void;
}

let globalMuted = true;

export function ReelCard({ reel, isActive, preloadNext, onSave, onBook }: ReelCardProps) {
  // Unload video when not active or next
  // Adaptive streaming (HLS) with dynamic import
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const videoUrl = reel.processedVideoUrl || reel.videoUrl;
    const isHls = videoUrl.endsWith('.m3u8');

    if (!isActive && !preloadNext) {
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      return;
    }

    let hls: any = null;
    if (isHls) {
      import('hls.js').then(HlsModule => {
        const Hls = HlsModule.default;
        if (Hls.isSupported()) {
          hls = new Hls();
          hls.loadSource(videoUrl);
          hls.attachMedia(video);
          video.oncanplay = () => hls && hls.startLoad();
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = videoUrl;
        }
      });
      return () => {
        if (hls) hls.destroy();
      };
    } else {
      video.src = videoUrl;
    }
    // eslint-disable-next-line
  }, [isActive, preloadNext, reel.processedVideoUrl, reel.videoUrl]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(globalMuted);
  const [showMuteHint, setShowMuteHint] = useState(globalMuted);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();

  // Persistent interactions via Supabase
  const {
    isLiked,
    likeCount,
    isSaved,
    isFollowing,
    toggleLike,
    toggleSave,
    toggleFollow,
  } = useReelInteractions(reel.id, reel.hostUserId);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.muted = globalMuted;
      setIsMuted(globalMuted);
      setShowMuteHint(globalMuted);

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((err: Error) => {
            // AbortError is expected when scrolling fast — play() interrupted by pause()
            if (err.name !== "AbortError") {
              console.warn("Autoplay blocked:", err);
            }
          });
      }
    } else {
      // Wait for any pending play promise to settle before pausing
      const playPromise = video.play().catch(() => { });
      Promise.resolve(playPromise).finally(() => {
        video.pause();
        setIsPlaying(false);
      });
    }
  }, [isActive]);


  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        setError(null);
        videoRef.current.play().catch(err => {
          console.error("Manual play error:", err);
          setError("Failed to play video");
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (videoRef.current) {
      const newMuted = !isMuted;
      globalMuted = newMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      setShowMuteHint(false);
    }
  };

  useEffect(() => {
    if (!reel.videoUrl) {
      setError("Video currently unavailable");
    }
  }, [reel.videoUrl]);

  const handleVideoError = (e: any) => {
    const videoElement = e.target as HTMLVideoElement;
    console.error("Video playback error:", videoElement.error);
    if (retryCount < 3) {
      setRetryCount(retryCount + 1);
      setTimeout(() => {
        videoElement.load();
        videoElement.play().catch(() => { });
      }, 500);
      return;
    }
    const videoUrl = reel.videoUrl || "";
    const isMov = videoUrl.toLowerCase().endsWith('.mov');
    const isHevc = videoUrl.toLowerCase().includes('hevc');
    let message = "Failed to load video";
    if (videoElement.error) {
      switch (videoElement.error.code) {
        case 1: message = "Video loading aborted"; break;
        case 2: message = "Network error while loading video"; break;
        case 3: message = "Video decoding failed"; break;
        case 4:
          if (isMov) {
            message = "iPhone video (.mov) may not be supported in this browser. Try Chrome or Safari.";
          } else if (isHevc) {
            message = "HEVC video format not supported on this device.";
          } else {
            message = "Video format not supported or access denied";
          }
          break;
      }
    } else if (!reel.videoUrl) {
      message = "Video currently unavailable";
    }
    setError(message);
    setIsPlaying(false);
  };

  const retryLoad = () => {
    setError(null);
    setRetryCount(0);
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(err => console.log("Retry play blocked:", err));
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLike();
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSave();
    onSave?.(reel.id);
  };

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFollow();
  };

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reel.hostUserId) {
      navigate(`/profile/${reel.hostUserId}`);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.share) {
        await navigator.share({
          title: reel.title,
          text: `Check out ${reel.title} on ZuruSasa!`,
          url: window.location.origin + `/reel/${reel.id}`,
        });
      } else {
        await navigator.clipboard.writeText(window.location.origin + `/reel/${reel.id}`);
        toast.success("Link copied!");
      }
    } catch (err) {
      // User cancelled share or it failed silently
    }
  };

  const categoryColors: Record<string, string> = {
    hotel: "bg-blue-500/90",
    villa: "bg-emerald-500/90",
    boats: "bg-cyan-500/90",
    tours: "bg-amber-500/90",
    events: "bg-purple-500/90",
    apartment: "bg-indigo-500/90",
    food: "bg-orange-500/90",
    drinks: "bg-pink-500/90",
    rentals: "bg-teal-500/90",
    adventure: "bg-red-500/90",
    parks_camps: "bg-green-600/90",
  };

  const renderActions = () => (
    <>
      {/* Host Avatar + Follow */}
      <div className="relative">
        <button onClick={handleAvatarClick} className="block">
          <img
            src={reel.hostAvatar}
            alt={reel.hostName}
            className="h-12 w-12 rounded-full border-2 border-primary-foreground object-cover transition-transform hover:scale-105"
          />
        </button>
        {/* Follow/Unfollow button */}
        <button
          onClick={handleFollow}
          className={cn(
            "absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full p-0.5 transition-all active:scale-90",
            isFollowing
              ? "bg-emerald-500 text-white"
              : "bg-primary text-primary-foreground"
          )}
          aria-label={isFollowing ? "Unfollow" : "Follow"}
        >
          {isFollowing ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Like */}
      <button onClick={handleLike} className="flex flex-col items-center gap-1 transition-transform active:scale-90">
        <Heart
          className={cn(
            "h-7 w-7 transition-all duration-200",
            isLiked
              ? "fill-red-500 text-red-500 scale-110"
              : "text-white"
          )}
        />
        <span className="text-xs text-white font-medium drop-shadow-md">
          {likeCount > 999 ? `${(likeCount / 1000).toFixed(1)}k` : likeCount}
        </span>
      </button>

      {/* Save */}
      <button onClick={handleSave} className="flex flex-col items-center gap-1 transition-transform active:scale-90">
        <Bookmark
          className={cn(
            "h-7 w-7 transition-all duration-200",
            isSaved
              ? "fill-primary text-primary scale-110"
              : "text-white"
          )}
        />
        <span className="text-xs text-white font-medium drop-shadow-md">
          {isSaved ? "Saved" : "Save"}
        </span>
      </button>

      {/* Share */}
      <button onClick={handleShare} className="flex flex-col items-center gap-1 transition-transform active:scale-90">
        <Share2 className="h-7 w-7 text-white" />
        <span className="text-xs text-white font-medium drop-shadow-md">Share</span>
      </button>

      {/* Mute/Unmute - Mobile specific placement */}
      <button 
        onClick={toggleMute} 
        className="flex flex-col items-center gap-1 transition-all duration-300 md:hidden"
      >
        <div className={cn(
          "p-2.5 rounded-full transition-colors",
          isMuted ? "bg-orange-500 text-white shadow-lg shadow-orange-500/50" : "bg-black/20 text-white"
        )}>
          {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
        </div>
        <span className="text-[10px] text-white font-bold drop-shadow-md uppercase tracking-wider">
          {isMuted ? "Sound On" : "Mute"}
        </span>
      </button>
    </>
  );

  return (
    <div className="relative h-[100dvh] md:h-full w-full snap-start flex items-center justify-center bg-transparent">
      <div className="relative h-full w-full md:h-[calc(100vh-6rem)] md:max-w-[340px] md:aspect-[9/18] md:rounded-[15px] overflow-hidden flex-shrink-0 group/video bg-black shadow-2xl md:border border-border/50 mx-auto md:mx-0">
        
        {/* Video Background */}
        <div className="absolute inset-0 bg-black">
          <div className="relative h-full w-full">
            {/* Blurred poster while loading */}
            {!videoLoaded && (
              <img
                src={reel.thumbnailUrl}
                alt="Preview"
                className="absolute inset-0 h-full w-full object-cover blur-lg scale-105 z-10 transition-opacity duration-500"
                style={{ opacity: videoLoaded ? 0 : 1 }}
              />
            )}
            <video
              ref={videoRef}
              src={reel.processedVideoUrl || reel.videoUrl}
              poster={reel.thumbnailUrl}
              className="h-full w-full object-cover"
              loop
              playsInline
              muted={isMuted}
              preload={isActive ? "auto" : preloadNext ? "auto" : "metadata"}
              crossOrigin="anonymous"
              onPlay={() => {
                setIsPlaying(true);
                setError(null);
              }}
              onPause={() => setIsPlaying(false)}
              onError={handleVideoError}
              onLoadedData={() => setVideoLoaded(true)}
            />
          </div>
        </div>

        {/* Top Bar - Overlay */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-20 md:flex hidden">
          <span className="text-xl font-display font-semibold text-white drop-shadow-md">
            ZuruSasa
          </span>
          <button
            onClick={toggleMute}
            className="rounded-full bg-black/40 backdrop-blur-sm p-2.5 transition-all hover:bg-black/60 active:scale-90"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="h-5 w-5 text-white" /> : <Volume2 className="h-5 w-5 text-white" />}
          </button>
        </div>

        {/* Play/Pause tap area — only when no error */}
        {!error && (
          <button
            onClick={(e) => togglePlay(e)}
            className="absolute inset-0 flex items-center justify-center z-10"
          >
            {!isPlaying && (
              <div className="rounded-full bg-black/30 p-4 backdrop-blur-sm transition-transform active:scale-90">
                <Play className="h-12 w-12 text-white fill-white" />
              </div>
            )}
          </button>
        )}

        {/* Error overlay — separate from play button so no nested <button> */}
        {error && (
          <div
            onClick={retryLoad}
            className="absolute inset-0 flex items-center justify-center z-20 cursor-pointer"
          >
            <div className="flex flex-col items-center gap-4 p-6 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 max-w-[80%] text-center">
              <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <div className="space-y-1">
                <p className="text-white font-medium">{error}</p>
                <p className="text-xs text-white/60">Tap to try again</p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm">
                <RefreshCw className="h-4 w-4" />
                Retry
              </div>
            </div>
          </div>
        )}
        <div className="absolute right-4 bottom-32 flex flex-col items-center gap-5 z-20 md:hidden">
          {renderActions()}
        </div>

        {/* Bottom Content */}
        <div className="absolute bottom-20 md:bottom-6 left-0 right-16 md:right-4 p-4 space-y-3 z-30 pointer-events-auto">
          {/* Category & Expiry Badges */}
          <div className="flex flex-col items-start gap-1.5 pb-1">
            {reel.postedAt && (
              <div 
                className={cn(
                  "text-[10px] font-bold uppercase tracking-[0.1em] text-white/90 drop-shadow-md flex items-center gap-1",
                  isReelExpiringSoon(new Date(reel.postedAt)) && "text-orange-400"
                )}
              >
                <Clock className="h-3 w-3" />
                {getReelExpiryDisplay(new Date(reel.postedAt))}
              </div>
            )}
            <Badge className={cn("text-[11px] h-5 px-2 font-bold capitalize shadow-lg", categoryColors[reel.category])}>
              {reel.category}
            </Badge>
          </div>

          {/* Title & Location */}
          <div className="space-y-1">
            <h3 className="text-xl font-display font-semibold text-white line-clamp-2 drop-shadow-md">
              {reel.title}
            </h3>
            <p className="text-sm text-white/80">{reel.location}</p>
          </div>

          {/* Price & Rating */}
          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold text-white">
              KES {reel.price.toLocaleString()}
              <span className="text-sm font-normal text-white/80">
                /{reel.priceUnit}
              </span>
            </span>
            <span className="flex items-center gap-1 text-sm text-white">
              ⭐ {reel.rating.toFixed(1)}
            </span>
          </div>

          {/* Book Button */}
          <Button
            onClick={() => onBook?.(reel.id)}
            className="w-full md:w-auto bg-[#EE7D30] hover:bg-[#EE7D30]/90 text-white font-semibold shadow-lg shadow-orange-500/20 px-8"
          >
            Book Now
          </Button>
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 gradient-overlay pointer-events-none z-10" />

        {/* Desktop Sidebar Integrated */}
        <div className="hidden md:flex absolute right-4 bottom-6 flex-col items-center gap-4 z-30">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              const container = e.currentTarget.closest('.overflow-y-scroll, .overflow-y-auto');
              if (container) container.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
            }}
            className="rounded-full bg-white/10 hover:bg-white/20 p-2 transition-all backdrop-blur-md"
          >
            <ChevronUp className="h-5 w-5 text-white" />
          </button>

          {renderActions()}

          <button 
            onClick={(e) => {
              e.stopPropagation();
              const container = e.currentTarget.closest('.overflow-y-scroll, .overflow-y-auto');
              if (container) container.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
            }}
            className="rounded-full bg-white/10 hover:bg-white/20 p-2 transition-all backdrop-blur-md"
          >
            <ChevronDown className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>


    </div>
  );
}
