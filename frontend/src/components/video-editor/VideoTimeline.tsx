import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, AlertCircle } from "lucide-react";

interface TimelineSegment {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  color: string;
  bgColor: string;
  borderColor: string;
  hint: string;
}

interface RequiredElement {
  id: string;
  icon: string;
  label: string;
  satisfied: boolean;
}

interface VideoTimelineProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  requiredElements?: RequiredElement[];
  onSegmentHover?: (segment: TimelineSegment | null) => void;
}

const TIMELINE_SEGMENTS: TimelineSegment[] = [
  {
    id: "hook",
    label: "HOOK",
    startTime: 0,
    endTime: 5,
    color: "text-orange-600",
    bgColor: "bg-orange-500/20",
    borderColor: "border-orange-500/50",
    hint: "Grab attention fast! Start with splash / pov entry / sizzle",
  },
  {
    id: "peak",
    label: "PEAK",
    startTime: 5,
    endTime: 15,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/20",
    borderColor: "border-emerald-500/50",
    hint: "Show the thrill! Motion action + your reaction / bite / riding",
  },
  {
    id: "close",
    label: "CLOSE",
    startTime: 15,
    endTime: 20,
    color: "text-violet-600",
    bgColor: "bg-violet-500/20",
    borderColor: "border-violet-500/50",
    hint: "End strong! Smile / scenic / CTA / toast",
  },
];

export const VideoTimeline = ({
  currentTime,
  duration,
  onSeek,
  requiredElements = [],
  onSegmentHover,
}: VideoTimelineProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredSegment, setHoveredSegment] = useState<TimelineSegment | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const maxDuration = Math.max(duration, 20);
  const isOverLimit = duration > 20;

  const getSegmentForTime = (time: number): TimelineSegment | null => {
    return TIMELINE_SEGMENTS.find(
      (seg) => time >= seg.startTime && time < seg.endTime
    ) || null;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = Math.max(0, Math.min(percentage * maxDuration, duration));
    onSeek(newTime);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const hoverTime = percentage * maxDuration;
    
    const segment = getSegmentForTime(hoverTime);
    if (segment !== hoveredSegment) {
      setHoveredSegment(segment);
      onSegmentHover?.(segment);
    }

    if (isDragging) {
      const newTime = Math.max(0, Math.min(percentage * maxDuration, duration));
      onSeek(newTime);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mouseup", handleMouseUp);
      return () => window.removeEventListener("mouseup", handleMouseUp);
    }
  }, [isDragging]);

  const scrubberPosition = (currentTime / maxDuration) * 100;
  const currentSegment = getSegmentForTime(currentTime);

  return (
    <div className="space-y-2">
      {/* Over-limit Warning */}
      {isOverLimit && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Clip is {duration.toFixed(1)}s – Trim to 20s for best performance?</span>
        </div>
      )}

      {/* Timeline Track */}
      <div
        ref={timelineRef}
        className="relative h-16 rounded-xl overflow-hidden cursor-pointer select-none border border-border"
        onClick={handleTimelineClick}
        onMouseMove={handleMouseMove}
        onMouseDown={() => setIsDragging(true)}
        onMouseLeave={() => {
          setHoveredSegment(null);
          onSegmentHover?.(null);
        }}
      >
        {/* Segment Backgrounds */}
        <div className="absolute inset-0 flex">
          {TIMELINE_SEGMENTS.map((segment) => {
            const width = ((segment.endTime - segment.startTime) / maxDuration) * 100;
            const left = (segment.startTime / maxDuration) * 100;
            return (
              <div
                key={segment.id}
                className={cn(
                  "absolute h-full border-r transition-opacity",
                  segment.bgColor,
                  segment.borderColor,
                  hoveredSegment?.id === segment.id && "opacity-100",
                  hoveredSegment && hoveredSegment.id !== segment.id && "opacity-60"
                )}
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                {/* Segment Label */}
                <div className="absolute top-1 left-2 flex items-center gap-1">
                  <span className={cn("text-xs font-bold", segment.color)}>
                    {segment.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {segment.startTime}-{segment.endTime}s
                  </span>
                </div>
                
                {/* Segment Hint */}
                <div className="absolute bottom-1 left-2 right-2">
                  <p className="text-[10px] text-muted-foreground truncate">
                    {segment.hint}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Playback Progress */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-foreground/10 pointer-events-none"
          style={{ width: `${scrubberPosition}%` }}
        />

        {/* Scrubber */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground shadow-lg pointer-events-none"
          style={{ left: `${scrubberPosition}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-foreground shadow-md" />
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs font-medium text-foreground bg-background px-1 rounded">
            {currentTime.toFixed(1)}s
          </div>
        </div>
      </div>

      {/* Required Elements Indicators */}
      {requiredElements.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {requiredElements.map((element) => (
            <div
              key={element.id}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors",
                element.satisfied
                  ? "bg-emerald-500/20 text-emerald-600"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <span>{element.icon}</span>
              <span>{element.label}</span>
              {element.satisfied && <Check className="h-3 w-3" />}
            </div>
          ))}
        </div>
      )}

      {/* Segment Tooltip */}
      {hoveredSegment && (
        <div className={cn(
          "p-2 rounded-lg text-sm",
          hoveredSegment.bgColor,
          hoveredSegment.borderColor,
          "border"
        )}>
          <p className={cn("font-semibold", hoveredSegment.color)}>
            {hoveredSegment.label} Zone ({hoveredSegment.startTime}-{hoveredSegment.endTime}s)
          </p>
          <p className="text-muted-foreground text-xs">{hoveredSegment.hint}</p>
        </div>
      )}
    </div>
  );
};

export { TIMELINE_SEGMENTS };
export type { TimelineSegment, RequiredElement };
