import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AskZuruButtonProps {
  onClick: () => void;
  isOpen?: boolean;
}

export function AskZuruButton({ onClick, isOpen }: AskZuruButtonProps) {
  if (isOpen) return null;

  return (
    <div className="fixed bottom-[220px] right-4 md:bottom-8 md:right-8 z-50 flex flex-col items-end pointer-events-none">
      {/* Lumorphic/Glassmorphic Floating Button */}
      <button
        onClick={onClick}
        className={cn(
          "pointer-events-auto group relative flex items-center justify-center gap-2.5",
          "w-14 h-14 rounded-full md:w-auto md:h-auto md:px-5 md:py-3 md:rounded-2xl",
          "bg-primary/90 backdrop-blur-xl border border-white/30 shadow-[0_0_30px_rgba(238,125,48,0.4)]",
          "hover:scale-105 active:scale-95 transition-all duration-500",
          "hover:bg-primary hover:shadow-[0_0_40px_rgba(238,125,48,0.6)]",
          "text-white font-bold tracking-tight overflow-hidden"
        )}
      >
        {/* Animated glow pulse */}
        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
        <div className="absolute -inset-1 bg-primary blur-md opacity-20 animate-pulse -z-20" />
        
        <Sparkles className="h-6 w-6 md:h-5 md:w-5 text-white animate-pulse group-hover:scale-110 transition-transform duration-300" />
        <span className="hidden md:inline font-semibold tracking-wide uppercase text-[10px]">Zuru Agent</span>
        
        {/* Interactive light ray effect */}
        <div className="absolute top-0 -left-[100%] h-full w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-25deg] group-hover:left-[150%] transition-all duration-1000 ease-in-out" />
      </button>
    </div>
  );
}
