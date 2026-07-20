import { useState } from "react";
import { cn } from "@/lib/utils";
import { Volume2, Music, Waves, Flame, Sparkles, PartyPopper, Wind, Drumstick } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AudioCue {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  duration: string;
  categories: string[];
}

interface AudioCuesLibraryProps {
  category: string;
  onSelect?: (cue: AudioCue) => void;
  className?: string;
}

const AUDIO_CUES: AudioCue[] = [
  {
    id: "asmr_sizzle",
    label: "ASMR Sizzle",
    description: "Hot pan, cooking sounds",
    icon: <Flame className="h-4 w-4" />,
    duration: "2-4s",
    categories: ["food"],
  },
  {
    id: "asmr_crunch",
    label: "ASMR Crunch",
    description: "Crispy bites, snack sounds",
    icon: <Drumstick className="h-4 w-4" />,
    duration: "1-2s",
    categories: ["food"],
  },
  {
    id: "ice_clink",
    label: "Ice Clink",
    description: "Glass with ice cubes",
    icon: <Sparkles className="h-4 w-4" />,
    duration: "1-2s",
    categories: ["drinks"],
  },
  {
    id: "pour_sound",
    label: "Pour Sound",
    description: "Liquid pouring into glass",
    icon: <Waves className="h-4 w-4" />,
    duration: "2-3s",
    categories: ["drinks"],
  },
  {
    id: "wave_crash",
    label: "Wave Crash",
    description: "Ocean waves hitting",
    icon: <Waves className="h-4 w-4" />,
    duration: "2-4s",
    categories: ["boats", "adventure", "parks_camps"],
  },
  {
    id: "engine_rev",
    label: "Engine Rev",
    description: "Motor/vehicle startup",
    icon: <Wind className="h-4 w-4" />,
    duration: "1-3s",
    categories: ["boats", "rentals"],
  },
  {
    id: "wind_rush",
    label: "Wind Rush",
    description: "Fast movement wind sound",
    icon: <Wind className="h-4 w-4" />,
    duration: "2-4s",
    categories: ["adventure", "rentals", "boats"],
  },
  {
    id: "crowd_cheer",
    label: "Crowd Cheer",
    description: "Excited crowd reaction",
    icon: <PartyPopper className="h-4 w-4" />,
    duration: "2-4s",
    categories: ["events", "adventure"],
  },
  {
    id: "nature_ambience",
    label: "Nature Ambience",
    description: "Birds, trees, peaceful nature",
    icon: <Wind className="h-4 w-4" />,
    duration: "3-5s",
    categories: ["parks_camps", "tours", "adventure"],
  },
  {
    id: "upbeat_drop",
    label: "Upbeat Drop",
    description: "Energetic music hit",
    icon: <Music className="h-4 w-4" />,
    duration: "1-2s",
    categories: ["events", "adventure", "drinks"],
  },
  {
    id: "chill_vibe",
    label: "Chill Vibe",
    description: "Relaxing background tune",
    icon: <Music className="h-4 w-4" />,
    duration: "4-6s",
    categories: ["parks_camps", "tours", "food"],
  },
];

export const AudioCuesLibrary = ({
  category,
  onSelect,
  className,
}: AudioCuesLibraryProps) => {
  const [selectedCue, setSelectedCue] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);

  // Filter cues relevant to the category, plus show a few universal ones
  const getRelevantCues = (): AudioCue[] => {
    const categoryLower = category.toLowerCase();
    const relevant = AUDIO_CUES.filter((cue) =>
      cue.categories.includes(categoryLower)
    );
    
    // Add some universal cues if the list is short
    if (relevant.length < 4) {
      const universal = AUDIO_CUES.filter(
        (cue) => !relevant.find((r) => r.id === cue.id)
      ).slice(0, 4 - relevant.length);
      return [...relevant, ...universal];
    }
    
    return relevant;
  };

  const cues = getRelevantCues();

  const handleSelect = (cue: AudioCue) => {
    setSelectedCue(cue.id);
    onSelect?.(cue);
    
    // Simulate playing
    setIsPlaying(cue.id);
    setTimeout(() => setIsPlaying(null), 2000);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Audio Cues</span>
      </div>

      {/* Audio Cues Grid */}
      <div className="grid grid-cols-2 gap-2">
        {cues.map((cue) => (
          <button
            key={cue.id}
            onClick={() => handleSelect(cue)}
            className={cn(
              "flex items-center gap-2 p-3 rounded-lg border transition-all text-left",
              "border-border bg-card hover:bg-accent/50",
              selectedCue === cue.id && "border-primary bg-primary/5",
              isPlaying === cue.id && "animate-pulse"
            )}
          >
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
              isPlaying === cue.id 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted"
            )}>
              {cue.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{cue.label}</p>
              <p className="text-[10px] text-muted-foreground">{cue.duration}</p>
            </div>
            {isPlaying === cue.id && (
              <div className="flex gap-0.5">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-0.5 bg-primary rounded-full animate-pulse"
                    style={{
                      height: `${8 + Math.random() * 8}px`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Selected Cue Info */}
      {selectedCue && (
        <div className="p-2 rounded-lg bg-muted/30 text-xs text-muted-foreground">
          💡 Tap again to preview. Drag to timeline to add.
        </div>
      )}
    </div>
  );
};

export type { AudioCue };
