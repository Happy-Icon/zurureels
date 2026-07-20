import { cn } from "@/lib/utils";
import { 
  Check, AlertCircle, Sparkles, Zap, TrendingUp, 
  Smile, Eye, Star, X, ChevronRight 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScoreBreakdown, calculateOverallScore, getScoreMessage, getScoreColor } from "./ReelScorePreview";

interface ValidationWarning {
  id: string;
  message: string;
  severity: "critical" | "warning" | "suggestion";
  action?: string;
}

interface ValidationScorecardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onReRecord?: () => void;
  scores: ScoreBreakdown;
  warnings: ValidationWarning[];
  category: string;
}

const SCORE_ICONS = {
  hook_strength: Zap,
  motion_quality: TrendingUp,
  human_emotion: Smile,
  visual_clarity: Eye,
  signature_moment: Star,
  viral_potential: Sparkles,
};

const SCORE_LABELS = {
  hook_strength: "Hook Strength",
  motion_quality: "Motion Quality",
  human_emotion: "Human Emotion",
  visual_clarity: "Visual Clarity",
  signature_moment: "Signature Moment",
  viral_potential: "Viral Potential",
};

export const ValidationScorecard = ({
  open,
  onClose,
  onSubmit,
  onReRecord,
  scores,
  warnings,
  category,
}: ValidationScorecardProps) => {
  const overallScore = calculateOverallScore(scores);
  const scoreColor = getScoreColor(overallScore);
  const hasCriticalWarnings = warnings.some((w) => w.severity === "critical");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Reel Scorecard
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Overall Score Circle */}
          <div className="flex flex-col items-center py-4">
            <div className="relative h-24 w-24">
              <svg className="h-24 w-24 -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-muted/30"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeDasharray={`${(overallScore / 100) * 251.2} 251.2`}
                  strokeLinecap="round"
                  className={cn(
                    "transition-all duration-1000",
                    overallScore >= 80 ? "text-emerald-500" :
                    overallScore >= 60 ? "text-amber-500" : "text-orange-500"
                  )}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-3xl font-bold", scoreColor)}>
                  {overallScore}%
                </span>
              </div>
            </div>
            <p className="mt-2 text-sm text-center text-muted-foreground">
              {getScoreMessage(overallScore)}
            </p>
          </div>

          {/* Score Breakdown */}
          <div className="space-y-2">
            {Object.entries(scores).map(([key, value]) => {
              const Icon = SCORE_ICONS[key as keyof typeof SCORE_ICONS];
              const label = SCORE_LABELS[key as keyof typeof SCORE_LABELS];
              const isGood = value >= 70;
              const isMedium = value >= 50 && value < 70;
              
              return (
                <div
                  key={key}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                >
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center",
                    isGood ? "bg-emerald-500/20 text-emerald-600" :
                    isMedium ? "bg-amber-500/20 text-amber-600" :
                    "bg-orange-500/20 text-orange-600"
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{label}</span>
                      <span className={cn(
                        "font-bold",
                        isGood ? "text-emerald-600" :
                        isMedium ? "text-amber-600" : "text-orange-600"
                      )}>
                        {value}%
                      </span>
                    </div>
                    <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          isGood ? "bg-emerald-500" :
                          isMedium ? "bg-amber-500" : "bg-orange-500"
                        )}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((warning) => (
                <div
                  key={warning.id}
                  className={cn(
                    "flex items-start gap-2 p-3 rounded-lg text-sm",
                    warning.severity === "critical" && "bg-red-500/10 border border-red-500/30",
                    warning.severity === "warning" && "bg-amber-500/10 border border-amber-500/30",
                    warning.severity === "suggestion" && "bg-blue-500/10 border border-blue-500/30"
                  )}
                >
                  <AlertCircle className={cn(
                    "h-4 w-4 mt-0.5 flex-shrink-0",
                    warning.severity === "critical" && "text-red-500",
                    warning.severity === "warning" && "text-amber-500",
                    warning.severity === "suggestion" && "text-blue-500"
                  )} />
                  <div className="flex-1">
                    <p className={cn(
                      warning.severity === "critical" && "text-red-700 dark:text-red-400",
                      warning.severity === "warning" && "text-amber-700 dark:text-amber-400",
                      warning.severity === "suggestion" && "text-blue-700 dark:text-blue-400"
                    )}>
                      {warning.message}
                    </p>
                    {warning.action && (
                      <p className="text-xs text-muted-foreground mt-1">
                        💡 {warning.action}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {overallScore < 70 && onReRecord && (
            <Button
              variant="outline"
              onClick={onReRecord}
              className="w-full"
            >
              🔄 Quick Re-record for 2x Views
            </Button>
          )}
          
          <Button
            onClick={onSubmit}
            disabled={hasCriticalWarnings}
            className="w-full"
          >
            {hasCriticalWarnings ? (
              <>
                <X className="h-4 w-4 mr-2" />
                Fix Critical Issues First
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Upload to ZuruSasa
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export type { ValidationWarning };
