import { Heart, Share2, Bookmark, Play, Pause, Volume2, VolumeX, Clock, MapPin, ShieldCheck, Sparkle, AlertCircle, RefreshCw, Plus, Check, Loader2, Video, ChevronUp, ChevronDown, Info, Users, Star, User } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getReelExpiryDisplay, isReelExpiringSoon } from "@/utils/reelExpiry";
import { useReelInteractions } from "@/hooks/useReelInteractions";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AskZuruButton } from "@/components/city-pulse/AskZuruButton";

export interface ReelData {
  id: string;
  experienceId?: string;
  hostUserId?: string;
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  description?: string;
  location: string;
  category: "hotel" | "villa" | "apartment" | "boats" | "food" | "drinks" | "rentals" | "adventure" | "parks_camps" | "tours" | "events";
  price: number;
  priceUnit: string;
  rating: number;
  bookingsCount?: number;
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
  onBook?: (reel: ReelData) => void;
  onAskAI?: () => void;
  topOverlay?: React.ReactNode;
}

let globalMuted = true;

export function ReelCard({ reel, isActive, preloadNext, onSave, onBook, onAskAI, topOverlay }: ReelCardProps) {
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

  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' && window.innerWidth >= 768);
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const { user } = useAuth();

  const handleEnquire = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Please log in to contact the host");
      navigate("/auth");
      return;
    }

    if (!reel.hostUserId) {
      toast.error("Host information unavailable");
      return;
    }

    if (user.id === reel.hostUserId) {
      toast.error("This is your own listing!");
      return;
    }

    try {
      const participants = [user.id, reel.hostUserId].sort();
      const { data: conv, error } = await supabase
        .from("conversations")
        .select("id")
        .eq("participant_one", participants[0])
        .eq("participant_two", participants[1])
        .maybeSingle();

      if (error) throw error;

      let convId = conv?.id;

      if (!convId) {
        const { data: newConv, error: createError } = await supabase
          .from("conversations")
          .insert({
            participant_one: participants[0],
            participant_two: participants[1]
          })
          .select("id")
          .single();
        
        if (createError) throw createError;
        convId = newConv.id;
      }

      navigate(`/profile/messages?convId=${convId}`);
    } catch (err) {
      console.error("Error creating conversation:", err);
      toast.error("Failed to initiate chat");
    }
  };
  
  const effectiveThumbnail = useMemo(() => {
    if (reel.thumbnailUrl) return reel.thumbnailUrl;
    
    // Fallback: If it's a Cloudinary video, generate the first-frame thumbnail URL
    const videoUrl = reel.processedVideoUrl || reel.videoUrl;
    if (videoUrl?.includes('res.cloudinary.com')) {
      return videoUrl.replace(/\.([a-z0-9]+)$/i, '.jpg').replace('/upload/', '/upload/so_0,w_400,h_600,c_fill,q_auto,f_jpg/');
    }
    return '';
  }, [reel.thumbnailUrl, reel.processedVideoUrl, reel.videoUrl]);

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
              : "text-white drop-shadow-lg"
          )}
        />
        <span className="text-[10px] md:text-[9px] text-white font-bold drop-shadow-md uppercase tracking-tight">
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
              : "text-white drop-shadow-lg"
          )}
        />
        <span className="text-[10px] md:text-[9px] text-white font-bold drop-shadow-md uppercase tracking-tight">
          {isSaved ? "Saved" : "Save"}
        </span>
      </button>

      {/* Share */}
      <button onClick={handleShare} className="flex flex-col items-center gap-1 transition-transform active:scale-90">
        <Share2 className="h-7 w-7 text-white drop-shadow-lg" />
        <span className="text-[10px] md:text-[9px] text-white font-bold drop-shadow-md uppercase tracking-tight">Share</span>
      </button>

      {/* Info / Details */}
      <Sheet>
        <SheetTrigger asChild>
          <button className="flex flex-col items-center gap-1 transition-transform active:scale-90">
            <Info className="h-7 w-7 text-white drop-shadow-lg" />
            <span className="text-[10px] md:text-[9px] text-white font-bold drop-shadow-md uppercase tracking-tight">Info</span>
          </button>
        </SheetTrigger>
        <SheetContent side={isDesktop ? "right" : "bottom"} className="flex flex-col gap-0 p-0 overflow-hidden bg-background border-border/10 rounded-t-3xl md:rounded-l-3xl md:rounded-tr-none z-[100] h-[85vh] md:h-full md:max-w-[400px]">
          <div className="relative h-56 w-full shrink-0 bg-muted">
            <img src={effectiveThumbnail} alt="Preview" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute bottom-4 left-5 right-5">
                 <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground drop-shadow-sm">{reel.title}</h2>
                 <p className="flex items-center text-sm font-medium text-muted-foreground gap-1.5 mt-1"><MapPin className="h-4 w-4 text-primary" /> {reel.location}</p>
            </div>
          </div>
          <ScrollArea className="flex-1 px-5 pt-6 pb-24">
            <div className="space-y-6">
              
              {/* Host Info */}
              <button 
                onClick={handleAvatarClick}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors group"
              >
                <img src={reel.hostAvatar} alt={reel.hostName} className="h-14 w-14 rounded-full object-cover border-[3px] border-background shadow-md group-hover:scale-105 transition-transform" />
                <div className="flex-1 text-left">
                  <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mb-0.5">Hosted By</p>
                  <p className="text-base font-bold leading-tight group-hover:text-primary transition-colors">{reel.hostName}</p>
                </div>
              </button>

              {/* Stats Row */}
              <div className="flex gap-4">
                <div className="flex-1 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-center space-y-1.5">
                  <div className="flex justify-center items-center gap-2 text-orange-600 dark:text-orange-400">
                    <Users className="h-5 w-5" />
                    <span className="font-bold text-xl">{reel.bookingsCount || Math.floor(Math.random() * 50) + 10}</span>
                  </div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Booked</p>
                </div>
                <div className="flex-1 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center space-y-1.5">
                  <div className="flex justify-center items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Star className="h-5 w-5 fill-current" />
                    <span className="font-bold text-xl">{reel.rating.toFixed(1)}</span>
                  </div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Rating</p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Info className="h-4 w-4" /> About this
                </h3>
                <p className="text-sm leading-relaxed text-foreground/80 bg-muted/20 p-4 rounded-2xl border border-border/50">
                  {reel.description || "Experience the best of what this host has to offer. Book now to secure your spot and enjoy a wonderful time."}
                </p>
              </div>
            </div>
          </ScrollArea>
          
          {/* Sticky Bottom Actions inside Sheet */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/90 backdrop-blur-xl border-t border-border flex items-center gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
             <div className="flex flex-col justify-center shrink-0 pr-3 border-r border-border/50 min-w-[100px]">
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Price</p>
               <p className="font-bold text-lg md:text-xl leading-none text-foreground">
                 <span className="text-xs font-medium text-muted-foreground mr-1">KES</span>
                 {reel.price.toLocaleString()}
               </p>
             </div>
             <Button
                onClick={() => reel.availabilityStatus !== 'booked_out' && onBook?.(reel.id)}
                disabled={reel.availabilityStatus === 'booked_out'}
                className={cn(
                  "flex-1 font-bold h-12 shadow-lg",
                  reel.availabilityStatus === 'booked_out' 
                    ? "bg-muted text-muted-foreground shadow-none opacity-80 cursor-not-allowed" 
                    : "bg-[#EE7D30] hover:bg-[#EE7D30]/90 text-white shadow-orange-500/20"
                )}
              >
                {reel.availabilityStatus === 'booked_out' ? "Fully Booked" : "Book Now"}
              </Button>
              <Button
                onClick={handleEnquire}
                variant="outline"
                className="flex-none px-4 h-12 border-border/50 hover:bg-muted text-foreground"
              >
                Enquire
              </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Mute/Unmute - Mobile specific placement */}
      <button 
        onClick={toggleMute} 
        className="flex flex-col items-center gap-1 transition-all duration-300"
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
    <div className="relative h-[100dvh] md:h-screen w-full snap-start flex items-center justify-center bg-transparent">
      {/* Root Container for the vertical card + optional outside elements */}
      <div className="relative h-full w-full md:h-[90vh] md:max-w-[400px] md:aspect-[9/16] flex-shrink-0 mx-auto transition-all duration-500">
        
        {/* The Clipped Video Frame */}
        <div className="relative h-full w-full md:rounded-[32px] overflow-hidden group/video bg-black shadow-2xl md:border border-white/10">
        
        {/* Video Background */}
        <div className="absolute inset-0 bg-black">
          <div className="relative h-full w-full">
            {/* Blurred poster while loading */}
            {!videoLoaded && (
              <img
                src={effectiveThumbnail}
                alt="Preview"
                className="absolute inset-0 h-full w-full object-cover blur-lg scale-105 z-10 transition-opacity duration-500"
                style={{ opacity: videoLoaded ? 0 : 1 }}
              />
            )}
            <video
              ref={videoRef}
              src={reel.processedVideoUrl || reel.videoUrl}
              poster={effectiveThumbnail}
              className="h-full w-full object-cover"
              loop
              playsInline
              muted={isMuted}
              preload={isActive ? "auto" : preloadNext ? "auto" : "metadata"}
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

        {/* Custom Top Overlay (e.g. Tab Switchers) */}
        {topOverlay && (
          <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
            {topOverlay}
          </div>
        )}



        {/* Play/Pause tap area — only when no error */}
        {!error && (
          <button
            onClick={(e) => isMuted ? toggleMute(e) : togglePlay(e)}
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

        {/* Bottom Content - INSIDE THE FRAME */}
        <div className="absolute bottom-6 md:bottom-6 left-0 right-16 md:right-24 p-4 md:p-5 space-y-1.5 z-30 pointer-events-auto">
          {/* Category & Expiry Badges */}
          <div className="flex flex-row items-center gap-2 pb-0.5">
            <Badge className={cn("text-[10px] h-5 px-2 font-bold capitalize shadow-lg", categoryColors[reel.category])}>
              {reel.category}
            </Badge>
            {reel.postedAt && (
              <div 
                className={cn(
                  "text-[9px] font-bold uppercase tracking-[0.1em] text-white/90 drop-shadow-md flex items-center gap-1",
                  isReelExpiringSoon(new Date(reel.postedAt!)) && "text-orange-400"
                )}
              >
                <Clock className="h-2.5 w-2.5" />
                {getReelExpiryDisplay(new Date(reel.postedAt!))}
              </div>
            )}
          </div>

          {/* Title and location */}
          <div className="space-y-1">
            {onAskAI && (
              <div className="mb-4">
                <AskZuruButton onClick={onAskAI} isOpen={false} />
              </div>
            )}
            <h3 className="font-display text-xl font-bold text-white md:text-2xl line-clamp-1 drop-shadow-md">
              {reel.title}
            </h3>
            <p className="text-[11px] text-white/80">{reel.location}</p>
          </div>

          {/* Price & Rating */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">
              KES {reel.price.toLocaleString()}
              <span className="text-[10px] font-normal text-white/80">
                /{reel.priceUnit}
              </span>
            </span>
            <span className="flex items-center gap-1 text-[11px] text-white">
              ⭐ {reel.rating.toFixed(1)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-row gap-2 w-full pt-1.5">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                if (reel.availabilityStatus !== 'booked_out') {
                  onBook?.(reel);
                }
              }}
              disabled={reel.availabilityStatus === 'booked_out'}
              className={cn(
                "flex-1 font-semibold shadow-lg px-3 h-8 text-[12px]",
                reel.availabilityStatus === 'booked_out' 
                  ? "bg-muted text-muted-foreground shadow-none opacity-80" 
                  : "bg-[#EE7D30] hover:bg-[#EE7D30]/90 text-white shadow-orange-500/20"
              )}
            >
              {reel.availabilityStatus === 'booked_out' ? "Fully Booked" : "Book Now"}
            </Button>
            <Button
              onClick={handleEnquire}
              variant="outline"
              className="flex-1 border-white/20 bg-white/5 hover:bg-white/10 text-white font-semibold backdrop-blur-sm px-3 h-8 text-[12px]"
            >
              Enquire
            </Button>
          </div>
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none z-10" />
      </div> {/* End of Clipped Video Frame */}

      {/* Desktop Sidebar (Outside the frame) */}
      <div className="hidden md:flex absolute -right-20 bottom-12 flex-col items-center gap-6 z-30">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            const container = e.currentTarget.closest('.overflow-y-scroll, .overflow-y-auto');
            if (container) container.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
          }}
          className="rounded-full bg-white/5 hover:bg-white/10 p-2.5 transition-all border border-white/10"
        >
          <ChevronUp className="h-5 w-5 text-white/70" />
        </button>

        {renderActions()}

        <button 
          onClick={(e) => {
            e.stopPropagation();
            const container = e.currentTarget.closest('.overflow-y-scroll, .overflow-y-auto');
            if (container) container.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
          }}
          className="rounded-full bg-white/5 hover:bg-white/10 p-2.5 transition-all border border-white/10"
        >
          <ChevronDown className="h-5 w-5 text-white/70" />
        </button>
      </div>

      </div>


    </div>
  );
}
