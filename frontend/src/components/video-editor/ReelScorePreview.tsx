import { cn } from "@/lib/utils";
import { Sparkles, TrendingUp, Smile, Eye, Star, Zap } from "lucide-react";

interface ScoreBreakdown {
  hook_strength: number;
  motion_quality: number;
  human_emotion: number;
  visual_clarity: number;
  signature_moment: number;
  viral_potential: number;
}

interface ReelScorePreviewProps {
  scores: ScoreBreakdown;
  className?: string;
  compact?: boolean;
}

const SCORE_CONFIG = {
  hook_strength: {
    label: "Hook",
    icon: Zap,
    weight: 0.25,
    color: "text-orange-500",
    bgColor: "bg-orange-500",
  },
  motion_quality: {
    label: "Motion",
    icon: TrendingUp,
    weight: 0.25,
    color: "text-blue-500",
    bgColor: "bg-blue-500",
  },
  human_emotion: {
    label: "Emotion",
    icon: Smile,
    weight: 0.20,
    color: "text-pink-500",
    bgColor: "bg-pink-500",
  },
  visual_clarity: {
    label: "Clarity",
    icon: Eye,
    weight: 0.15,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500",
  },
  signature_moment: {
    label: "Signature",
    icon: Star,
    weight: 0.10,
    color: "text-amber-500",
    bgColor: "bg-amber-500",
  },
  viral_potential: {
    label: "Viral",
    icon: Sparkles,
    weight: 0.05,
    color: "text-violet-500",
    bgColor: "bg-violet-500",
  },
};

export const calculateOverallScore = (scores: ScoreBreakdown): number => {
  let total = 0;
  Object.entries(scores).forEach(([key, value]) => {
    const config = SCORE_CONFIG[key as keyof ScoreBreakdown];
    if (config) {
      total += value * config.weight;
    }
  });
  return Math.round(total);
};

export const getScoreMessage = (score: number): string => {
  if (score >= 90) return "🔥 Viral-ready! This will grab attention!";
  if (score >= 80) return "✨ Strong reel! Ready to shine!";
  if (score >= 70) return "👍 Good foundation – small tweaks for greatness!";
  if (score >= 60) return "🎯 Solid start – add more energy!";
  return "💪 Keep building – you've got this!";
};

export const getScoreColor = (score: number): string => {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-amber-500";
  return "text-orange-500";
};

export const ReelScorePreview = ({
  scores,
  className,
  compact = false,
}: ReelScorePreviewProps) => {
  const overallScore = calculateOverallScore(scores);
  const scoreColor = getScoreColor(overallScore);

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="relative h-10 w-10">
          {/* Circular Progress */}
          <svg className="h-10 w-10 -rotate-90">
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-muted/30"
            />
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${overallScore} 100`}
              strokeLinecap="round"
              className={scoreColor}
            />
          </svg>
          <span className={cn("absolute inset-0 flex items-center justify-center text-xs font-bold", scoreColor)}>
            {overallScore}
          </span>
        </div>
        <div className="text-xs">
          <p className="font-medium">Reel Score</p>
          <p className="text-muted-foreground">{overallScore}% ready</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 p-4 rounded-xl bg-card border border-border", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold">Reel Score</span>
        </div>
        <div className={cn("text-2xl font-bold", scoreColor)}>
          {overallScore}%
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="h-3 rounded-full bg-muted/30 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", 
            overallScore >= 80 ? "bg-emerald-500" : 
            overallScore >= 60 ? "bg-amber-500" : "bg-orange-500"
          )}
          style={{ width: `${overallScore}%` }}
        />
      </div>

      {/* Score Message */}
      <p className="text-sm text-center text-muted-foreground">
        {getScoreMessage(overallScore)}
      </p>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(SCORE_CONFIG).map(([key, config]) => {
          const value = scores[key as keyof ScoreBreakdown];
          const Icon = config.icon;
          return (
            <div
              key={key}
              className="flex items-center gap-2 p-2 rounded-lg bg-muted/30"
            >
              <Icon className={cn("h-4 w-4", config.color)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{config.label}</span>
                  <span className={config.color}>{value}%</span>
                </div>
                <div className="h-1 mt-1 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", config.bgColor)}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export type { ScoreBreakdown };
