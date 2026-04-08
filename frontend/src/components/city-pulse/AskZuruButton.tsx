import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AskZuruButtonProps {
  onClick: () => void;
  isOpen?: boolean;
}

export function AskZuruButton({ onClick, isOpen }: AskZuruButtonProps) {
  if (isOpen) return null;

  return (
    <div className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50 flex flex-col items-end pointer-events-none">
      {/* Rectangular Glassmorphic Floating Button */}
      <button
        onClick={onClick}
        className={cn(
          "pointer-events-auto group relative flex items-center gap-2.5 px-5 py-3",
          "bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-2xl",
          "rounded-2xl hover:scale-105 active:scale-95 transition-all duration-500",
          "hover:bg-primary/20 hover:border-primary/30",
          "text-white font-medium tracking-tight overflow-hidden"
        )}
      >
        {/* Subtle glow effect on hover */}
        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl -z-10" />
        
        <Sparkles className="h-5 w-5 text-primary animate-pulse group-hover:scale-110 transition-transform duration-300" />
        <span className="text-sm whitespace-nowrap">Ask Zuru AI</span>
        
        {/* Animated border segment for a premium feel */}
        <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary group-hover:w-full transition-all duration-700 delay-100" />
      </button>
    </div>
  );
}
