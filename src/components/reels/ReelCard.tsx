import { Heart, Share2, Bookmark, MessageCircle, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(reel.saved);
  const [likeCount, setLikeCount] = useState(reel.likes);

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
    <div className="relative h-full w-full snap-start">
      {/* Video/Image Background */}
      <div className="absolute inset-0 bg-overlay">
        <img
          src={reel.thumbnailUrl}
          alt={reel.title}
          className="h-full w-full object-cover"
        />
        {/* Play/Pause Overlay */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="absolute inset-0 flex items-center justify-center"
        >
          {!isPlaying && (
            <div className="rounded-full bg-overlay/30 p-4 backdrop-blur-sm">
              <Play className="h-12 w-12 text-primary-foreground fill-primary-foreground" />
            </div>
          )}
        </button>
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 gradient-overlay pointer-events-none" />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between md:hidden">
        <span className="text-xl font-display font-semibold text-primary-foreground drop-shadow-md">
          ZuruSasa
        </span>
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="rounded-full glass-dark p-2"
        >
          {isMuted ? (
            <VolumeX className="h-5 w-5 text-primary-foreground" />
          ) : (
            <Volume2 className="h-5 w-5 text-primary-foreground" />
          )}
        </button>
      </div>

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
        {/* Category Badge */}
        <Badge className={cn("text-xs capitalize", categoryColors[reel.category])}>
          {reel.category}
        </Badge>

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
            ${reel.price}
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
