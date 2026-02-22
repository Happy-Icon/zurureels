import { Heart, Share2, Bookmark, MessageCircle, Play, Pause, Volume2, VolumeX, Clock, MapPin, ShieldCheck, Sparkle, AlertCircle, RefreshCw } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getReelExpiryDisplay, isReelExpiringSoon } from "@/utils/reelExpiry";

export interface ReelData {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  location: string;
  category: "hotel" | "villa" | "boat" | "tour" | "event" | "apartment" | "food" | "drinks" | "rentals" | "adventure" | "camps";
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
}

interface ReelCardProps {
  reel: ReelData;
  isActive: boolean;
  onSave?: (id: string) => void;
  onBook?: (id: string) => void;
}

export function ReelCard({ reel, isActive, onSave, onBook }: ReelCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showMuteHint, setShowMuteHint] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(reel.saved);
  const [likeCount, setLikeCount] = useState(reel.likes);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        // Browsers require muted for autoplay — start muted, user can unmute
        videoRef.current.muted = true;
        setIsMuted(true);
        setShowMuteHint(true);
        videoRef.current.play().catch(err => console.log("Autoplay blocked:", err));
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [isActive]);

  const togglePlay = () => {
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
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      setShowMuteHint(false);
    }
  };

  const handleVideoError = (e: any) => {
    const videoElement = e.target as HTMLVideoElement;
    console.error("Video playback error:", videoElement.error);
    let message = "Failed to load video";
    if (videoElement.error) {
      switch (videoElement.error.code) {
        case 1: message = "Video loading aborted"; break;
        case 2: message = "Network error while loading video"; break;
        case 3: message = "Video decoding failed"; break;
        case 4: message = "Video format not supported or access denied"; break;
      }
    }
    setError(message);
    setIsPlaying(false);
  };

  const retryLoad = () => {
    setError(null);
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(err => console.log("Retry play blocked:", err));
    }
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    onSave?.(reel.id);
  };

  const categoryColors: Record<string, string> = {
    hotel: "bg-blue-500/90",
    villa: "bg-emerald-500/90",
    boat: "bg-cyan-500/90",
    tour: "bg-amber-500/90",
    event: "bg-purple-500/90",
    apartment: "bg-indigo-500/90",
    food: "bg-orange-500/90",
    drinks: "bg-pink-500/90",
    rentals: "bg-teal-500/90",
    adventure: "bg-red-500/90",
    camps: "bg-green-600/90",
  };

  return (
    <div className="relative h-full w-full snap-start overflow-hidden">
      {/* Video Background */}
      <div className="absolute inset-0 bg-black">
        <video
          ref={videoRef}
          src={reel.videoUrl}
          poster={reel.thumbnailUrl}
          className="h-full w-full object-cover"
          loop
          playsInline
          muted={isMuted}
          onPlay={() => {
            setIsPlaying(true);
            setError(null);
          }}
          onPause={() => setIsPlaying(false)}
          onError={handleVideoError}
        />

        {/* Play/Pause Overlay */}
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-10"
        >
          {!isPlaying && !error && (
            <div className="rounded-full bg-black/30 p-4 backdrop-blur-sm transition-transform active:scale-90">
              <Play className="h-12 w-12 text-white fill-white" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-4 p-6 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 max-w-[80%] text-center">
              <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <div className="space-y-1">
                <p className="text-white font-medium">{error}</p>
                <p className="text-xs text-white/60">Tap to try again</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  retryLoad();
                }}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          )}
        </button>
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 gradient-overlay pointer-events-none" />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-20">
        <span className="text-xl font-display font-semibold text-primary-foreground drop-shadow-md">
          ZuruSasa
        </span>
        <button
          onClick={toggleMute}
          className="rounded-full bg-black/40 backdrop-blur-sm p-2.5 transition-all hover:bg-black/60 active:scale-90"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <VolumeX className="h-5 w-5 text-white" />
          ) : (
            <Volume2 className="h-5 w-5 text-white" />
          )}
        </button>
      </div>

      {/* Tap-for-sound hint (shown when video is playing but muted) */}
      {isPlaying && isMuted && showMuteHint && (
        <button
          onClick={toggleMute}
          className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm font-medium animate-pulse"
        >
          <VolumeX className="h-4 w-4" />
          Tap for sound
        </button>
      )}

      {/* Right Side Actions */}
      <div className="absolute right-4 bottom-32 md:bottom-24 flex flex-col items-center gap-5">
        {/* Host Avatar */}
        <div className="relative">
          <img
            src={reel.hostAvatar}
            alt={reel.hostName}
            className="h-12 w-12 rounded-full border-2 border-primary-foreground object-cover"
          />
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-1.5 rounded">
            +
          </span>
        </div>

        {/* Like */}
        <button onClick={handleLike} className="flex flex-col items-center gap-1">
          <Heart
            className={cn(
              "h-7 w-7 transition-all duration-200",
              isLiked
                ? "fill-red-500 text-red-500 scale-110"
                : "text-primary-foreground"
            )}
          />
          <span className="text-xs text-primary-foreground font-medium">
            {likeCount > 999 ? `${(likeCount / 1000).toFixed(1)}k` : likeCount}
          </span>
        </button>

        {/* Save */}
        <button onClick={handleSave} className="flex flex-col items-center gap-1">
          <Bookmark
            className={cn(
              "h-7 w-7 transition-all duration-200",
              isSaved
                ? "fill-primary text-primary scale-110"
                : "text-primary-foreground"
            )}
          />
          <span className="text-xs text-primary-foreground font-medium">Save</span>
        </button>

        {/* Share */}
        <button className="flex flex-col items-center gap-1">
          <Share2 className="h-7 w-7 text-primary-foreground" />
          <span className="text-xs text-primary-foreground font-medium">Share</span>
        </button>
      </div>

      {/* Bottom Content */}
      <div className="absolute bottom-20 md:bottom-8 left-0 right-16 p-4 space-y-3">
        {/* Category & Expiry Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn("text-xs capitalize", categoryColors[reel.category])}>
            {reel.category}
          </Badge>
          {reel.postedAt && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs border-primary-foreground/30 text-primary-foreground/90 gap-1",
                isReelExpiringSoon(new Date(reel.postedAt)) && "border-orange-400/50 text-orange-200"
              )}
            >
              <Clock className="h-3 w-3" />
              {getReelExpiryDisplay(new Date(reel.postedAt))}
            </Badge>
          )}
          {reel.isLive && (
            <Badge className="bg-red-500 animate-pulse text-white border-0 gap-1.5 px-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              LIVE
            </Badge>
          )}
          {reel.lat && reel.lng && (
            <Badge className="bg-emerald-500 text-white border-0 gap-1.5 px-2">
              <ShieldCheck className="h-3 w-3" />
              VERIFIED
            </Badge>
          )}
        </div>

        {/* Title & Location */}
        <div className="space-y-1">
          <h3 className="text-xl font-display font-semibold text-primary-foreground line-clamp-2 drop-shadow-md">
            {reel.title}
          </h3>
          <p className="text-sm text-primary-foreground/80">{reel.location}</p>
        </div>

        {/* Price & Rating */}
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold text-primary-foreground">
            KES {reel.price.toLocaleString()}
            <span className="text-sm font-normal text-primary-foreground/80">
              /{reel.priceUnit}
            </span>
          </span>
          <span className="flex items-center gap-1 text-sm text-primary-foreground">
            ⭐ {reel.rating.toFixed(1)}
          </span>
        </div>

        {/* Book Button */}
        <Button
          onClick={() => onBook?.(reel.id)}
          className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
        >
          Book Now
        </Button>
      </div>
    </div>
  );
}
