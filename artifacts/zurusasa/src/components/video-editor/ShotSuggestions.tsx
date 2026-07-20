import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Eye, Camera, User, Zap, Smile, Star, 
  Waves, ArrowRight, Sparkles 
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShotSuggestion {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  example?: string;
  segment: "intro" | "peak" | "close" | "any";
}

interface ShotSuggestionsProps {
  category: string;
  onSelect?: (shot: ShotSuggestion) => void;
  className?: string;
}

const BASE_SHOTS: ShotSuggestion[] = [
  {
    id: "pov_entry",
    label: "POV Entry",
    description: "First-person perspective entering the scene",
    icon: <Eye className="h-4 w-4" />,
    segment: "intro",
  },
  {
    id: "wide_environment",
    label: "Wide Shot",
    description: "Establish the full environment",
    icon: <Camera className="h-4 w-4" />,
    segment: "intro",
  },
  {
    id: "close_up_detail",
    label: "Close-up Detail",
    description: "Focus on texture, steam, or signature element",
    icon: <Sparkles className="h-4 w-4" />,
    segment: "peak",
  },
  {
    id: "motion_action",
    label: "Motion Action",
    description: "Dynamic movement – riding, splashing, cooking",
    icon: <Zap className="h-4 w-4" />,
    segment: "peak",
  },
  {
    id: "human_reaction",
    label: "Human Reaction",
    description: "Show genuine emotion – joy, surprise, satisfaction",
    icon: <Smile className="h-4 w-4" />,
    segment: "peak",
  },
  {
    id: "signature_moment",
    label: "Signature Moment",
    description: "The unforgettable climax – splash, bite, drop",
    icon: <Star className="h-4 w-4" />,
    segment: "peak",
  },
  {
    id: "calm_contrast",
    label: "Calm Contrast",
    description: "Peaceful ending after the action",
    icon: <Waves className="h-4 w-4" />,
    segment: "close",
  },
  {
    id: "end_frame",
    label: "End Frame",
    description: "Strong final shot – CTA, smile, or scenic",
    icon: <ArrowRight className="h-4 w-4" />,
    segment: "close",
  },
];

const CATEGORY_EXAMPLES: Record<string, Record<string, string>> = {
  boats: {
    pov_entry: "Camera entering boat from dock",
    motion_action: "Boat speeding through waves",
    signature_moment: "Big splash or wake jump",
    calm_contrast: "Floating peacefully at sunset",
  },
  food: {
    close_up_detail: "Steam rising, cheese pull",
    motion_action: "Cooking action, flame burst",
    human_reaction: "First bite expression",
    signature_moment: "The perfect bite close-up",
  },
  drinks: {
    pov_entry: "Approaching the bar counter",
    close_up_detail: "Pour with ice clink",
    motion_action: "Shaking cocktail, pour",
    signature_moment: "Cheers clink moment",
  },
  rentals: {
    pov_entry: "Mounting bike/scooter",
    motion_action: "Riding along scenic path",
    signature_moment: "Speed shot or trick",
    human_reaction: "Rider's excited expression",
  },
  adventure: {
    wide_environment: "Height/scale reveal",
    motion_action: "The jump, climb, or descent",
    signature_moment: "Peak adrenaline moment",
    human_reaction: "Victory celebration",
  },
  parks_camps: {
    wide_environment: "Panoramic nature reveal",
    motion_action: "Walking through trails",
    calm_contrast: "Peaceful campfire scene",
    end_frame: "Sunset or starry sky",
  },
  tours: {
    wide_environment: "Iconic landmark entrance",
    motion_action: "Moving between stops",
    human_reaction: "Group enjoying the moment",
    end_frame: "Final landmark shot",
  },
  events: {
    wide_environment: "Crowd and stage energy",
    motion_action: "Live performance action",
    signature_moment: "Climax moment – drop, cheer",
    human_reaction: "Crowd going wild",
  },
};

const SEGMENT_COLORS = {
  intro: "border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20",
  peak: "border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20",
  close: "border-violet-500/50 bg-violet-500/10 hover:bg-violet-500/20",
  any: "border-muted bg-muted/30 hover:bg-muted/50",
};

export const ShotSuggestions = ({
  category,
  onSelect,
  className,
}: ShotSuggestionsProps) => {
  const [selectedShot, setSelectedShot] = useState<string | null>(null);

  const getShotsWithExamples = (): ShotSuggestion[] => {
    const categoryExamples = CATEGORY_EXAMPLES[category.toLowerCase()] || {};
    return BASE_SHOTS.map((shot) => ({
      ...shot,
      example: categoryExamples[shot.id] || shot.description,
    }));
  };

  const shots = getShotsWithExamples();

  const handleSelect = (shot: ShotSuggestion) => {
    setSelectedShot(shot.id);
    onSelect?.(shot);
    
    // Reset selection after brief highlight
    setTimeout(() => setSelectedShot(null), 1500);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Camera className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Shot Suggestions</span>
      </div>

      {/* Horizontal Scrollable Carousel */}
      <div className="overflow-x-auto pb-2 -mx-2 px-2">
        <div className="flex gap-2" style={{ minWidth: "max-content" }}>
          {shots.map((shot) => (
            <button
              key={shot.id}
              onClick={() => handleSelect(shot)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all min-w-[100px]",
                SEGMENT_COLORS[shot.segment],
                selectedShot === shot.id && "ring-2 ring-primary scale-105"
              )}
            >
              <div className="h-8 w-8 rounded-full bg-background/50 flex items-center justify-center">
                {shot.icon}
              </div>
              <span className="text-xs font-medium text-center whitespace-nowrap">
                {shot.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Shot Detail */}
      {selectedShot && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 animate-in fade-in slide-in-from-bottom-2">
          {(() => {
            const shot = shots.find((s) => s.id === selectedShot);
            if (!shot) return null;
            return (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {shot.icon}
                  <span className="font-medium">{shot.label}</span>
                </div>
                <p className="text-sm text-muted-foreground">{shot.example}</p>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export type { ShotSuggestion };
