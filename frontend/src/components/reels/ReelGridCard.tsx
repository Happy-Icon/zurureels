
import { useState, useRef, useEffect } from "react";
import { CloudinaryVideo } from "@/components/media/CloudinaryVideo";
import { CloudinaryImage } from "@/components/media/CloudinaryImage";
import {
    Heart,
    Bookmark,
    Share2,
    Plus,
    MapPin,
    Star,
    Volume2,
    VolumeX,
    AlertCircle,
    RefreshCw,
    Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useReelInteractions } from "@/hooks/useReelInteractions";
import { ReelData } from "@/hooks/useReels";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ReelGridCardProps {
    reel: ReelData;
    onBook: (reel: ReelData) => void;
}

export const ReelGridCard = ({ reel, onBook }: ReelGridCardProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
        if (!reel.videoUrl) {
            setError("Video currently unavailable");
        }
    }, [reel.videoUrl]);

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

    const handleVideoError = (e: any) => {
        const videoElement = e.target as HTMLVideoElement;
        let message = "Failed to load video";
        if (videoElement.error) {
            switch (videoElement.error.code) {
                case 1: message = "Video loading aborted"; break;
                case 2: message = "Network error"; break;
                case 3: message = "Video decoding failed"; break;
                case 4: message = "Format not supported"; break;
            }
        }
        setError(message);
        setIsPlaying(false);
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
        } catch (err) { }
    };

    const categoryColors: Record<string, string> = {
        hotel: "bg-blue-500/90",
        villa: "bg-emerald-500/90",
        apartment: "bg-purple-500/90",
        boats: "bg-cyan-500/90",
        food: "bg-orange-500/90",
        drinks: "bg-pink-500/90",
        rentals: "bg-teal-500/90",
        adventure: "bg-red-500/90",
        parks_camps: "bg-green-600/90",
        tours: "bg-amber-500/90",
        events: "bg-indigo-500/90",
    };

    return (
        <div className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-muted shadow-sm hover:shadow-lg transition-all duration-300">
            {/* Video/Image Content */}
            <div className="absolute inset-0" onClick={togglePlay}>
                {reel.videoUrl ? (
                    <CloudinaryVideo
                        videoRef={videoRef}
                        src={reel.videoUrl}
                        poster={reel.thumbnailUrl !== "/placeholder.svg" ? reel.thumbnailUrl : undefined}
                        className="h-full w-full object-cover"
                        muted={isMuted}
                        playsInline
                        loop
                        preload="metadata"
                        onError={handleVideoError}
                    />
                ) : (
                    <CloudinaryImage
                        src={reel.thumbnailUrl || "/placeholder.svg"}
                        alt={reel.title}
                        className="h-full w-full object-cover"
                    />
                )}
            </div>

            {/* Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

            {/* Top Controls */}
            <div className="absolute top-2 left-2 right-2 flex justify-between items-start pointer-events-none">
                <div className="flex flex-col gap-1.5 pointer-events-auto">
                    <Badge className={cn("text-[10px] font-bold uppercase px-2 py-0.5 border-0", categoryColors[reel.category] || "bg-primary")}>
                        {reel.category.replace("_", " ")}
                    </Badge>
                    {reel.isLive && (
                        <Badge className="bg-red-500 text-white animate-pulse border-0 text-[10px] px-2 py-0.5">
                            LIVE
                        </Badge>
                    )}
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                    className="p-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white pointer-events-auto"
                >
                    {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
            </div>

            {/* Error State */}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-4 text-center">
                    <AlertCircle className="text-red-500 mb-2" size={24} />
                    <p className="text-[10px] text-white font-medium mb-2">{error}</p>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] bg-white/10 border-white/20 text-white"
                        onClick={(e) => { e.stopPropagation(); setError(null); videoRef.current?.load(); }}
                    >
                        <RefreshCw size={10} className="mr-1" /> Retry
                    </Button>
                </div>
            )}

            {/* Interaction Rack (Right Side) */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-3 items-center z-10">
                {/* Avatar + Follow */}
                <div className="relative group/avatar">
                    <Avatar className="h-8 w-8 border-2 border-primary ring-2 ring-black">
                        <AvatarImage src={reel.hostAvatar} alt={reel.hostName} />
                        <AvatarFallback className="text-[10px]">{reel.hostName.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    {!isFollowing && (
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleFollow(); }}
                            className="absolute -bottom-1 -right-1 bg-primary rounded-full p-0.5 text-white shadow-lg hover:scale-110 transition-transform"
                        >
                            <Plus size={10} strokeWidth={4} />
                        </button>
                    )}
                </div>

                {/* Like */}
                <button onClick={(e) => { e.stopPropagation(); toggleLike(); }} className="flex flex-col items-center">
                    <div className={cn("p-2 rounded-full transition-all", isLiked ? "bg-red-500/20" : "bg-black/40 hover:bg-black/60")}>
                        <Heart size={18} className={cn("transition-colors", isLiked ? "fill-red-500 text-red-500" : "text-white")} />
                    </div>
                    <span className="text-[10px] text-white font-medium drop-shadow-md">
                        {likeCount > 0 ? (likeCount > 999 ? (likeCount / 1000).toFixed(1) + "k" : likeCount) : ""}
                    </span>
                </button>

                {/* Save */}
                <button onClick={(e) => { e.stopPropagation(); toggleSave(); }}>
                    <div className={cn("p-2 rounded-full transition-all", isSaved ? "bg-primary/20" : "bg-black/40 hover:bg-black/60")}>
                        <Bookmark size={18} className={cn("transition-colors", isSaved ? "fill-primary text-primary" : "text-white")} />
                    </div>
                </button>

                {/* Share */}
                <button onClick={handleShare}>
                    <div className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-all text-white">
                        <Share2 size={18} />
                    </div>
                </button>
            </div>

            {/* Info & Booking (Bottom) */}
            <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2 pointer-events-none">
                <div className="space-y-1">
                    <h3 className="font-semibold text-primary-foreground text-xs line-clamp-1 leading-tight drop-shadow-lg">
                        {reel.title}
                    </h3>
                    <div className="flex items-center gap-1 text-[9px] text-primary-foreground/90 drop-shadow-lg">
                        <MapPin className="h-2.5 w-2.5" />
                        {reel.location}
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="text-[11px] font-bold text-primary-foreground drop-shadow-lg">
                            KES {reel.price.toLocaleString()}
                            <span className="text-[9px] font-normal opacity-80 ml-0.5">/{reel.priceUnit}</span>
                        </div>
                        <div className="flex items-center gap-0.5 text-[9px] text-primary-foreground drop-shadow-lg">
                            <Star size={10} className="fill-yellow-500 text-yellow-500" />
                            {reel.rating.toFixed(1)}
                        </div>
                    </div>
                </div>

                {/* Book Now Button - SPECIFIC CLICK AREA */}
                <Button
                    onClick={(e) => { e.stopPropagation(); onBook(reel); }}
                    className="w-full h-8 text-[11px] font-bold rounded-lg bg-primary hover:bg-primary/90 text-white shadow-lg pointer-events-auto active:scale-95 transition-transform"
                >
                    Book Now
                </Button>
            </div>

            {/* Play Overlay Hint */}
            {!isPlaying && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-opacity group-hover:bg-black/20 pointer-events-none">
                    <div className="p-2 rounded-full bg-black/30 backdrop-blur-sm">
                        <Play size={16} className="text-white fill-white" />
                    </div>
                </div>
            )}
        </div>
    );
};
