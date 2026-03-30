import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AskZuruButtonProps {
  onClick: () => void;
  isOpen?: boolean;
}

export function AskZuruButton({ onClick, isOpen }: AskZuruButtonProps) {
  if (isOpen) return null;

  return (
    <div className="fixed bottom-24 left-4 md:bottom-8 md:right-8 z-50 flex flex-col items-end gap-3 pointer-events-none">
      {/* Main Floating Button */}
      <button
        onClick={onClick}
        className={cn(
          "pointer-events-auto group relative",
          "h-14 w-14 rounded-full overflow-hidden",
          "bg-primary shadow-lg hover:scale-110 active:scale-95 transition-all duration-300",
          "flex items-center justify-center border border-white/20"
        )}
      >
        <Sparkles className="h-7 w-7 text-white" />
      </button>
    </div>
  );
}
