import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Lightbulb, X } from "lucide-react";

interface GuidanceMessage {
  id: string;
  message: string;
  type: "success" | "tip" | "warning";
  segment?: "intro" | "peak" | "close";
}

interface GuidanceTooltipProps {
  message: GuidanceMessage | null;
  onDismiss?: () => void;
  autoHideDuration?: number;
}

export const GuidanceTooltip = ({
  message,
  onDismiss,
  autoHideDuration = 4000,
}: GuidanceTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onDismiss?.(), 300);
      }, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [message, autoHideDuration, onDismiss]);

  if (!message) return null;

  return (
    <div
      className={cn(
        "fixed bottom-28 left-1/2 -translate-x-1/2 z-50 transition-all duration-300",
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg backdrop-blur-sm max-w-xs",
          message.type === "success" && "bg-emerald-500/90 text-white",
          message.type === "tip" && "bg-blue-500/90 text-white",
          message.type === "warning" && "bg-amber-500/90 text-white"
        )}
      >
        <Lightbulb className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium">{message.message}</span>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(() => onDismiss?.(), 300);
          }}
          className="ml-1 p-0.5 rounded-full hover:bg-white/20 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

export type { GuidanceMessage };
