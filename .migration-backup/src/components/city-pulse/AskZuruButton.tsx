import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AskZuruButtonProps {
  onClick: () => void;
  isOpen?: boolean;
}

export function AskZuruButton({ onClick, isOpen }: AskZuruButtonProps) {
  if (isOpen) return null;

  return (
    <Button
      onClick={onClick}
      className={cn(
        "fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50",
        "h-14 px-5 rounded-full shadow-lg",
        "bg-primary hover:bg-primary/90 text-primary-foreground",
        "flex items-center gap-2",
        "animate-in slide-in-from-bottom-4 duration-300",
        "hover:scale-105 transition-transform"
      )}
    >
      <img src="/favicon.png" alt="Zuru" className="h-6 w-6 rounded-full" />
      <span className="font-semibold">Ask Zuru</span>
    </Button>
  );
}
