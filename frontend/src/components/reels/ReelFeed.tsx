/**
 * Full-Screen Reel Feed Component
  * - Displays reels in a vertical, full-screen format
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { ReelCard, ReelData } from "@/components/reels/ReelCard";
import { FullScreenReelSkeleton } from "@/components/reels/ReelSkeletons";

interface ReelFeedProps {
  reels: ReelData[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onBook?: (reel: ReelData) => void;
}

export const ReelFeed = ({
  reels,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onBook,
}: ReelFeedProps) => {
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const reelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Smooth scroll to active reel when scrolling
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const scrollPos = containerRef.current.scrollTop;
    const viewportHeight = containerRef.current.clientHeight;
    const newIndex = Math.round(scrollPos / viewportHeight);
    
    setActiveReelIndex(Math.max(0, Math.min(newIndex, reels.length - 1)));
  }, [reels.length]);

  // Initialize Intersection Observer for autoplay control and infinite scroll
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = parseInt(entry.target.getAttribute("data-index") || "0");
          // Track active reel
          if (entry.isIntersecting) {
            setActiveReelIndex(index);
          }
          // Prefetch more reels when within 3 of the end
          if (hasMore && !loadingMore && index >= reels.length - 4 && entry.isIntersecting) {
            onLoadMore();
          }
        });
      },
      {
        threshold: 0.5, // 50% of reel must be visible
        rootMargin: "0px",
      }
    );
    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, loadingMore, reels.length, onLoadMore]);

  // Observe all reel items
  useEffect(() => {
    reelRefs.current.forEach((ref, idx) => {
      if (ref) observerRef.current?.observe(ref);
    });

    return () => {
      reelRefs.current.forEach((ref) => {
        if (ref) observerRef.current?.unobserve(ref);
      });
    };
  }, [reels.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollTimeout = setTimeout(() => {
      container.addEventListener("scroll", handleScroll);
    }, 100);

    return () => {
      clearTimeout(scrollTimeout);
      container?.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  // Memory management: clear refs for offscreen reels
  useEffect(() => {
    reelRefs.current = reelRefs.current.map((ref, idx) =>
      Math.abs(idx - activeReelIndex) <= 1 ? ref : null
    );
  }, [activeReelIndex, reels.length]);

  if (loading) {
    return (
      <div ref={containerRef} className="w-full h-screen overflow-y-snap-mandatory overflow-x-hidden bg-black">
        <FullScreenReelSkeleton />
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <p className="text-lg">No reels found</p>
          <p className="text-sm text-gray-400 mt-2">Try a different category or search</p>
        </div>
      </div>
    );
  }

  // Windowing: Only render previous, current, and next reels
  // Only keep refs for windowed reels
  const windowedIndexes = reels.map((_, idx) => idx).filter(idx => Math.abs(idx - activeReelIndex) <= 1);
  const windowedReels = windowedIndexes.map(idx => reels[idx]);

  return (
    <div
      ref={containerRef}
      className="w-full h-screen overflow-y-scroll overflow-x-hidden bg-black snap-y snap-mandatory"
      style={{
        scrollBehavior: "smooth",
        scrollSnapType: "y mandatory",
      }}
    >
      {windowedReels.map((reel, i) => {
        const index = windowedIndexes[i];
        return (
          <div
            key={reel.id}
            ref={el => { reelRefs.current[index] = el; }}
            data-index={index}
            className="w-full h-screen flex-shrink-0 snap-start snap-always"
            style={{
              scrollSnapAlign: "start",
              scrollSnapStop: "always",
            }}
          >
            <ReelCard
              reel={reel}
              isActive={activeReelIndex === index}
              preloadNext={index === activeReelIndex + 1}
              onBook={onBook ? (id: string) => onBook(reel) : undefined}
            />
          </div>
        );
      })}

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="w-full h-screen flex items-center justify-center bg-black snap-start">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4 mx-auto" />
            <p className="text-white">Loading more...</p>
          </div>
        </div>
      )}

      {/* No more reels indicator */}
      {!hasMore && reels.length > 0 && (
        <div className="w-full h-screen flex items-center justify-center bg-black snap-start">
          <div className="text-center text-gray-400">
            <p className="text-lg">That's all for now!</p>
            <p className="text-sm mt-2">More reels coming soon</p>
          </div>
        </div>
      )}
    </div>
  );
};
