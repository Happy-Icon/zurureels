import { useRef, useState, useEffect } from "react";
import { ReelCard, ReelData } from "./ReelCard";
import { cn } from "@/lib/utils";

interface ReelsFeedProps {
  reels: ReelData[];
  onSave?: (id: string) => void;
  onBook?: (id: string) => void;
}

export function ReelsFeed({ reels, onSave, onBook }: ReelsFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const itemHeight = container.clientHeight;
      const newIndex = Math.round(scrollTop / itemHeight);
      setActiveIndex(newIndex);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "h-[calc(100vh-4rem)] md:h-screen overflow-y-scroll snap-y-mandatory hide-scrollbar"
      )}
    >
      {reels.map((reel, index) => (
        <div key={reel.id} className="h-full w-full">
          <ReelCard
            reel={reel}
            isActive={index === activeIndex}
            onSave={onSave}
            onBook={onBook}
          />
        </div>
      ))}
    </div>
  );
}
