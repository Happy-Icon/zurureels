import { Sparkles, MessageSquareText, HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface AskZuruButtonProps {
  onClick: () => void;
  isOpen?: boolean;
}

export function AskZuruButton({ onClick, isOpen }: AskZuruButtonProps) {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    // Show a small hint message after a delay to feel proactive
    const timer = setTimeout(() => setShowHint(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (isOpen) return null;

  return (
    <div className="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-50 flex flex-col items-end gap-3 pointer-events-none">
      {/* Proactive Hint Message */}
      {showHint && (
        <div 
          className={cn(
            "bg-background/95 backdrop-blur-xl border border-border/50 px-4 py-3 rounded-2xl shadow-2xl",
            "text-sm font-medium text-foreground max-w-[200px] pointer-events-auto",
            "animate-in fade-in slide-in-from-right-4 duration-500 relative group"
          )}
        >
          <button 
            onClick={() => setShowHint(false)}
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-secondary border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
          <p className="pr-2 text-xs sm:text-sm">Need a hand finding the best boat tour? I'm Zuru, your AI guide! 🌴</p>
        </div>
      )}

      {/* The Floating Assistant Widget */}
      <button
        onClick={onClick}
        className={cn(
          "pointer-events-auto group relative",
          "h-14 w-14 sm:h-16 sm:w-16 rounded-3xl overflow-hidden",
          "bg-primary shadow-[0_8px_32px_rgba(var(--primary-rgb),0.3)]",
          "hover:scale-110 active:scale-95 transition-all duration-300",
          "flex items-center justify-center border border-white/20"
        )}
      >
        {/* Animated Background Pulse */}
        <div className="absolute inset-0 bg-white/20 animate-pulse group-hover:animate-none" />
        
        {/* Glassmorphism Shine */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none" />

        {/* AI Icon with Glint Effect */}
        <div className="relative">
          <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 text-white animate-pulse" />
          <div className="absolute inset-0 bg-white blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
        </div>

        {/* Status Indicator */}
        <div className="absolute top-2 right-2 h-3 w-3 rounded-full bg-emerald-400 border-2 border-primary animate-bounce" />
      </button>
    </div>
  );
}
