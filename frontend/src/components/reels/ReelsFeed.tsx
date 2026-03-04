import { useRef, useState, useEffect } from "react";
import { ReelCard, ReelData } from "./ReelCard";
import { cn } from "@/lib/utils";
import InfiniteScroll from 'react-infinite-scroll-component';

interface ReelsFeedProps {
  reels: ReelData[];
  onSave?: (id: string) => void;
  onBook?: (id: string) => void;
}

  const [activeIndex, setActiveIndex] = useState(0);
  const [displayedReels, setDisplayedReels] = useState<ReelData[]>(reels.slice(0, 10));
  const [hasMore, setHasMore] = useState(reels.length > 10);

  useEffect(() => {
    setDisplayedReels(reels.slice(0, 10));
    setHasMore(reels.length > 10);
  }, [reels]);

  const fetchMoreReels = () => {
    const nextLength = displayedReels.length + 10;
    setDisplayedReels(reels.slice(0, nextLength));
    setHasMore(reels.length > nextLength);
  };

  return (
    <InfiniteScroll
      dataLength={displayedReels.length}
      next={fetchMoreReels}
      hasMore={hasMore}
      loader={<SkeletonLoader />}
      scrollableTarget="reels-scroll-container"
    >
      <div
        id="reels-scroll-container"
        className={cn(
          "h-[calc(100vh-4rem)] md:h-screen overflow-y-scroll snap-y-mandatory hide-scrollbar"
        )}
      >
        {displayedReels.map((reel, index) => (
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
    </InfiniteScroll>
  );
}

function SkeletonLoader() {
  return (
    <div className="h-full w-full flex flex-col gap-4 p-8">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-96 w-full bg-gray-200 animate-pulse rounded-xl" />
      ))}
    </div>
  );
}
