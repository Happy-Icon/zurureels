import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, Upload, Play, Pause, RotateCcw,
  Camera, Volume2, Type, Sparkles, Check, Video
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoTimeline, RequiredElement, TIMELINE_SEGMENTS } from "./VideoTimeline";
import { ReelScorePreview, ScoreBreakdown, calculateOverallScore } from "./ReelScorePreview";
import { ShotSuggestions } from "./ShotSuggestions";
import { AudioCuesLibrary } from "./AudioCuesLibrary";
import { TextOverlayTemplates } from "./TextOverlayTemplates";
import { ValidationScorecard, ValidationWarning } from "./ValidationScorecard";
import { GuidanceTooltip, GuidanceMessage } from "./GuidanceTooltip";
import { getReelSpecByCategory, ExperienceReelSpec } from "@/data/reelSpecifications";
import { LiveVideoRecorder } from "./LiveVideoRecorder";
import { ScoreBreakdown } from "@/types/host";

interface MiniVideoEditorProps {
  category: string;
  videoFile?: File | null;
  videoUrl?: string;
  onBack: () => void;
  onSubmit: (data: VideoEditorSubmitData) => void;
}

export interface VideoEditorSubmitData {
  category: string;
  videoFile?: File;
  videoUrl?: string;
  duration: number;
  scores: ScoreBreakdown;
  elementsSatisfied: string[];
}

// Category to icon mapping for required elements
const ELEMENT_ICONS: Record<string, string> = {
  motion: "🏃",
  water: "🌊",
  human_presence: "👤",
  food_motion: "🍳",
  texture: "✨",
  human_reaction: "😊",
  pour: "🍷",
  atmosphere: "🌃",
  social_energy: "🥳",
  vehicle_motion: "🏍️",
  rider_presence: "🧑",
  terrain: "🛤️",
  adrenaline: "⚡",
  height_or_speed: "🎢",
  nature: "🌲",
  space: "🏕️",
  calm_human_presence: "🧘",
  movement: "🚶",
  landmark: "🏛️",
  guide_context: "🎤",
  crowd: "👥",
  energy: "🔥",
  live_action: "🎵",
};

export const MiniVideoEditor = ({
  category,
  videoFile,
  videoUrl,
  onBack,
  onSubmit,
}: MiniVideoEditorProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeToolTab, setActiveToolTab] = useState("shots");
  const [showScorecard, setShowScorecard] = useState(false);
  const [guidanceMessage, setGuidanceMessage] = useState<GuidanceMessage | null>(null);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);

  // Mock scores - in production, these would be calculated from video analysis
  const [scores, setScores] = useState<ScoreBreakdown>({
    hook_strength: 75,
    motion_quality: 80,
    human_emotion: 65,
    visual_clarity: 85,
    signature_moment: 70,
    viral_potential: 60,
  });

  // Get spec for this category
  const spec = getReelSpecByCategory(category);

  // Generate required elements from spec
  const getRequiredElements = (): RequiredElement[] => {
    if (!spec) return [];

    return spec.required_elements.map((element, index) => ({
      id: element,
      icon: ELEMENT_ICONS[element] || "✓",
      label: element.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      // Mock: randomly mark some as satisfied based on playback progress
      satisfied: currentTime > (index + 1) * 3,
    }));
  };

  // Create local URL for uploaded file
  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setLocalVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (videoUrl) {
      setLocalVideoUrl(videoUrl);
    }
  }, [videoFile, videoUrl]);

  // Handle video metadata loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // Handle time update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);

      // Trigger guidance messages based on playback position
      triggerGuidance(time);
    }
  };

  const handleRecordingComplete = (file: File) => {
    const url = URL.createObjectURL(file);
    setLocalVideoUrl(url);
    if (videoRef.current) {
      videoRef.current.load();
    }
    // Note: We might want to persist the file back to the parent if needed, 
    // but for now we store it locally implicitly via the URL logic or we could update a state.
    // Ideally we should update a 'videoFile' state if we want to submit it.
    // Let's assume we pass the file on submit, so we need to track it.
  };

  // We need to track the file if it comes from recorder
  const [recordedFile, setRecordedFile] = useState<File | null>(null);


  // Trigger contextual guidance
  const triggerGuidance = useCallback((time: number) => {
    // Only show guidance occasionally
    if (Math.random() > 0.02) return;

    const segment = TIMELINE_SEGMENTS.find(
      (s) => time >= s.startTime && time < s.endTime
    );

    if (!segment) return;

    const messages: Record<string, GuidanceMessage[]> = {
      hook: [
        { id: "hook1", message: "Great hook! Motion detected in first 3s → +hook_strength", type: "success" },
        { id: "hook2", message: "Start with action to grab attention!", type: "tip" },
      ],
      peak: [
        { id: "peak1", message: "Add human reaction for better emotion score!", type: "tip" },
        { id: "peak2", message: "Signature moment detected! 🎉", type: "success" },
      ],
      close: [
        { id: "close1", message: "End with a smile or CTA for higher engagement!", type: "tip" },
        { id: "close2", message: "Strong closing frame detected!", type: "success" },
      ],
    };

    const segmentMessages = messages[segment.id] || [];
    if (segmentMessages.length > 0) {
      const randomMessage = segmentMessages[Math.floor(Math.random() * segmentMessages.length)];
      setGuidanceMessage(randomMessage);
    }
  }, []);

  // Play/Pause toggle
  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Seek to time
  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Reset playback
  const handleReset = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.pause();
      setCurrentTime(0);
      setIsPlaying(false);
    }
  };

  // Generate warnings based on spec validation
  const getValidationWarnings = (): ValidationWarning[] => {
    const warnings: ValidationWarning[] = [];

    if (duration > 20) {
      warnings.push({
        id: "duration",
        message: `Clip is ${duration.toFixed(1)}s – reels over 20s perform 50% worse.`,
        severity: "warning",
        action: "Trim to 20s for optimal performance",
      });
    }

    if (spec?.validation_rules.must_have_motion && scores.motion_quality < 50) {
      warnings.push({
        id: "motion",
        message: `Low motion detected for ${category} reel.`,
        severity: "warning",
        action: "Add more dynamic movement",
      });
    }

    if (spec?.validation_rules.must_have_human_presence && scores.human_emotion < 50) {
      warnings.push({
        id: "human",
        message: "Human presence recommended for this category.",
        severity: "suggestion",
        action: "Add reaction shots for 2x engagement",
      });
    }

    if (scores.signature_moment < 60) {
      warnings.push({
        id: "signature",
        message: "Signature moment missing – this category needs a wow factor!",
        severity: "suggestion",
        action: getCategorySignatureTip(category),
      });
    }

    // Category-specific warnings
    if (category === "rentals" && scores.hook_strength < 70) {
      warnings.push({
        id: "helmet",
        message: "Safety gear not clearly visible – confirm override?",
        severity: "critical",
        action: "Show helmet/gear in intro for trust",
      });
    }

    return warnings;
  };

  const getCategorySignatureTip = (cat: string): string => {
    const tips: Record<string, string> = {
      boats: "Add a big splash or wake jump!",
      food: "Capture the perfect bite close-up!",
      drinks: "Show the cheers moment!",
      rentals: "Include a speed shot or scenic stop!",
      adventure: "Capture the peak adrenaline moment!",
      parks_camps: "Show the peaceful campfire or sunrise!",
      tours: "Reveal the iconic landmark!",
      events: "Capture crowd going wild!",
    };
    return tips[cat.toLowerCase()] || "Add your signature wow moment!";
  };

  // Handle submit
  const handleSubmit = () => {
    const elementsSatisfied = getRequiredElements()
      .filter((e) => e.satisfied)
      .map((e) => e.id);

    onSubmit({
      category,
      videoFile: recordedFile || videoFile || undefined,
      videoUrl: videoUrl || undefined,
      duration,
      scores,
      elementsSatisfied,
    });
  };

  const overallScore = calculateOverallScore(scores);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <ReelScorePreview scores={scores} compact />

        <Button size="sm" onClick={() => setShowScorecard(true)}>
          <Upload className="h-4 w-4 mr-1" />
          Submit
        </Button>
      </div>

      {/* Video Preview - 9:16 aspect ratio */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="relative flex-1 bg-black flex items-center justify-center">
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
            />
          ) : (
            <LiveVideoRecorder
              onRecordingComplete={(file) => {
                setRecordedFile(file);
                handleRecordingComplete(file);
              }}
              onCancel={onBack}
            />
          )}

          {/* Playback Controls Overlay */}
          {localVideoUrl && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
              <div className="flex items-center gap-4">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={handleReset}
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>
                <Button
                  size="icon"
                  className="h-16 w-16 rounded-full"
                  onClick={togglePlayback}
                >
                  {isPlaying ? (
                    <Pause className="h-7 w-7" />
                  ) : (
                    <Play className="h-7 w-7 ml-1" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="px-4 py-3 bg-background border-t border-border">
          <VideoTimeline
            currentTime={currentTime}
            duration={duration || 20}
            onSeek={handleSeek}
            requiredElements={getRequiredElements()}
          />
        </div>

        {/* Tools Tray */}
        <div className="h-48 bg-card border-t border-border">
          <Tabs value={activeToolTab} onValueChange={setActiveToolTab} className="h-full flex flex-col">
            <TabsList className="grid grid-cols-3 mx-4 mt-2">
              <TabsTrigger value="shots" className="gap-1.5 text-xs">
                <Camera className="h-3.5 w-3.5" />
                Shots
              </TabsTrigger>
              <TabsTrigger value="audio" className="gap-1.5 text-xs">
                <Volume2 className="h-3.5 w-3.5" />
                Audio
              </TabsTrigger>
              <TabsTrigger value="text" className="gap-1.5 text-xs">
                <Type className="h-3.5 w-3.5" />
                Text
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto px-4 py-2">
              <TabsContent value="shots" className="mt-0">
                <ShotSuggestions category={category} />
              </TabsContent>
              <TabsContent value="audio" className="mt-0">
                <AudioCuesLibrary category={category} />
              </TabsContent>
              <TabsContent value="text" className="mt-0">
                <TextOverlayTemplates category={category} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Guidance Tooltip */}
      <GuidanceTooltip
        message={guidanceMessage}
        onDismiss={() => setGuidanceMessage(null)}
      />

      {/* Validation Scorecard Modal */}
      <ValidationScorecard
        open={showScorecard}
        onClose={() => setShowScorecard(false)}
        onSubmit={handleSubmit}
        onReRecord={() => {
          setShowScorecard(false);
          handleReset();
        }}
        scores={scores}
        warnings={getValidationWarnings()}
        category={category}
      />
    </div>
  );
};
