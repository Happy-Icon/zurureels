import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AskZuruButtonProps {
  onClick: () => void;
  isOpen?: boolean;
}

export function AskZuruButton({ onClick, isOpen }: AskZuruButtonProps) {
  if (isOpen) return null;

  return (
    <div className="fixed bottom-28 right-4 md:bottom-8 md:right-8 z-50 flex flex-col items-end pointer-events-none">
      {/* Rectangular Lumorphic/Glassmorphic Floating Button */}
      <button
        onClick={onClick}
        className={cn(
          "pointer-events-auto group relative flex items-center gap-2.5 px-5 py-3",
          "bg-primary/90 backdrop-blur-xl border border-white/30 shadow-[0_0_30px_rgba(238,125,48,0.4)]",
          "rounded-2xl hover:scale-105 active:scale-95 transition-all duration-500",
          "hover:bg-primary hover:shadow-[0_0_40px_rgba(238,125,48,0.6)]",
          "text-white font-bold tracking-tight overflow-hidden"
        )}
      >
        {/* Animated glow pulse */}
        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
        <div className="absolute -inset-1 bg-primary blur-md opacity-20 animate-pulse -z-20" />
        
        <Sparkles className="h-5 w-5 text-white animate-pulse group-hover:scale-110 transition-transform duration-300" />
        <span className="font-semibold tracking-wide uppercase text-[10px]">Zuru Agent</span>
        
        {/* Interactive light ray effect */}
        <div className="absolute top-0 -left-[100%] h-full w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-25deg] group-hover:left-[150%] transition-all duration-1000 ease-in-out" />
      </button>
    </div>
  );
}
