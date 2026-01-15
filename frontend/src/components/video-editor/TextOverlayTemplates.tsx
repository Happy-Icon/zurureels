import { useState } from "react";
import { cn } from "@/lib/utils";
import { Type, Sparkles, Heart, Zap, Star, PartyPopper } from "lucide-react";

interface TextOverlay {
  id: string;
  text: string;
  style: "bold" | "casual" | "minimal" | "energetic";
  emoji?: string;
  segment: "intro" | "peak" | "close" | "any";
}

interface TextOverlayTemplatesProps {
  category: string;
  onSelect?: (overlay: TextOverlay) => void;
  className?: string;
}

const CATEGORY_OVERLAYS: Record<string, TextOverlay[]> = {
  boats: [
    { id: "b1", text: "Life's better on water", emoji: "🌊", style: "casual", segment: "intro" },
    { id: "b2", text: "Feel that breeze!", emoji: "💨", style: "energetic", segment: "peak" },
    { id: "b3", text: "Sail away with us", emoji: "⛵", style: "minimal", segment: "close" },
    { id: "b4", text: "Adventure awaits!", emoji: "🚤", style: "bold", segment: "any" },
  ],
  food: [
    { id: "f1", text: "Taste paradise", emoji: "😋", style: "bold", segment: "intro" },
    { id: "f2", text: "Fresh & local", emoji: "🍳", style: "minimal", segment: "peak" },
    { id: "f3", text: "You won't believe this!", emoji: "🤤", style: "energetic", segment: "peak" },
    { id: "f4", text: "Come hungry, leave happy", emoji: "❤️", style: "casual", segment: "close" },
  ],
  drinks: [
    { id: "d1", text: "Cheers to this!", emoji: "🍻", style: "bold", segment: "intro" },
    { id: "d2", text: "Sip, sip, hooray!", emoji: "🥂", style: "energetic", segment: "peak" },
    { id: "d3", text: "The perfect pour", emoji: "🍹", style: "minimal", segment: "peak" },
    { id: "d4", text: "Good vibes only", emoji: "✨", style: "casual", segment: "close" },
  ],
  rentals: [
    { id: "r1", text: "Let's ride!", emoji: "🏍️", style: "bold", segment: "intro" },
    { id: "r2", text: "Freedom on wheels", emoji: "🛵", style: "casual", segment: "peak" },
    { id: "r3", text: "Explore your way", emoji: "🗺️", style: "minimal", segment: "close" },
    { id: "r4", text: "Born to ride", emoji: "🔥", style: "energetic", segment: "any" },
  ],
  adventure: [
    { id: "a1", text: "No limits!", emoji: "🚀", style: "bold", segment: "intro" },
    { id: "a2", text: "Are you ready?", emoji: "😱", style: "energetic", segment: "peak" },
    { id: "a3", text: "We did it!", emoji: "🎉", style: "casual", segment: "close" },
    { id: "a4", text: "Pure adrenaline", emoji: "⚡", style: "minimal", segment: "peak" },
  ],
  parks_camps: [
    { id: "p1", text: "Nature calling", emoji: "🌲", style: "minimal", segment: "intro" },
    { id: "p2", text: "Find your peace", emoji: "🧘", style: "casual", segment: "peak" },
    { id: "p3", text: "Under the stars", emoji: "⭐", style: "casual", segment: "close" },
    { id: "p4", text: "Wild & free", emoji: "🦋", style: "minimal", segment: "any" },
  ],
  tours: [
    { id: "t1", text: "Let me show you around!", emoji: "👋", style: "casual", segment: "intro" },
    { id: "t2", text: "Did you know?", emoji: "💡", style: "minimal", segment: "peak" },
    { id: "t3", text: "Hidden gem alert!", emoji: "💎", style: "energetic", segment: "peak" },
    { id: "t4", text: "See you here!", emoji: "📍", style: "bold", segment: "close" },
  ],
  events: [
    { id: "e1", text: "The energy is insane!", emoji: "🔥", style: "bold", segment: "intro" },
    { id: "e2", text: "This is the moment!", emoji: "🎤", style: "energetic", segment: "peak" },
    { id: "e3", text: "Crowd goes wild!", emoji: "🙌", style: "bold", segment: "peak" },
    { id: "e4", text: "Best night ever!", emoji: "🌙", style: "casual", segment: "close" },
  ],
};

const STYLE_CLASSES = {
  bold: "font-bold text-white bg-black/70 px-3 py-1.5 rounded-lg",
  casual: "font-medium text-white bg-gradient-to-r from-primary/80 to-primary/60 px-3 py-1.5 rounded-full",
  minimal: "font-light text-white/90 bg-black/40 px-2 py-1 rounded",
  energetic: "font-black text-yellow-300 bg-gradient-to-r from-orange-500/80 to-pink-500/80 px-3 py-1.5 rounded-xl animate-pulse",
};

export const TextOverlayTemplates = ({
  category,
  onSelect,
  className,
}: TextOverlayTemplatesProps) => {
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null);

  const overlays = CATEGORY_OVERLAYS[category.toLowerCase()] || CATEGORY_OVERLAYS.adventure;

  const handleSelect = (overlay: TextOverlay) => {
    setSelectedOverlay(overlay.id);
    onSelect?.(overlay);
  };

  const getSegmentLabel = (segment: string) => {
    switch (segment) {
      case "intro": return "Hook";
      case "peak": return "Peak";
      case "close": return "Close";
      default: return "Any";
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Type className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Text Overlays</span>
      </div>

      {/* Overlay Grid */}
      <div className="space-y-2">
        {overlays.map((overlay) => (
          <button
            key={overlay.id}
            onClick={() => handleSelect(overlay)}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
              "border-border bg-card hover:bg-accent/50",
              selectedOverlay === overlay.id && "border-primary ring-1 ring-primary"
            )}
          >
            {/* Preview */}
            <div className="flex-1 flex items-center justify-center py-2 bg-gradient-to-br from-muted/50 to-muted rounded-lg">
              <span className={cn("text-sm", STYLE_CLASSES[overlay.style])}>
                {overlay.emoji} {overlay.text}
              </span>
            </div>
            
            {/* Segment Badge */}
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full",
              overlay.segment === "intro" && "bg-orange-500/20 text-orange-600",
              overlay.segment === "peak" && "bg-emerald-500/20 text-emerald-600",
              overlay.segment === "close" && "bg-violet-500/20 text-violet-600",
              overlay.segment === "any" && "bg-muted text-muted-foreground"
            )}>
              {getSegmentLabel(overlay.segment)}
            </span>
          </button>
        ))}
      </div>

      {/* Custom Text Input */}
      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          Tap to add overlay • Drag to reposition
        </p>
      </div>
    </div>
  );
};

export type { TextOverlay };
