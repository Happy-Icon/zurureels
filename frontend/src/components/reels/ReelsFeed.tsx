import { useRef, useState, useEffect } from "react";
import { ReelCard, ReelData } from "./ReelCard";
import { cn } from "@/lib/utils";
import InfiniteScroll from 'react-infinite-scroll-component';
import { Menu, Search, Home, Compass, MapPin, Bookmark, PlusSquare, User, Settings, LogOut, X } from "lucide-react";
import { Link } from "react-router-dom";

interface ReelsFeedProps {
  reels: ReelData[];
  onSave?: (id: string) => void;
  onBook?: (id: string) => void;
}

const sidebarLinks = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Compass, label: "Explore", href: "/explore" },
  { icon: MapPin, label: "Destinations", href: "/destinations" },
  { icon: Bookmark, label: "Saved Reels", href: "/saved" },
  { icon: PlusSquare, label: "Upload Reel", href: "/host/dashboard" },
  { icon: User, label: "Profile", href: "/profile" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function ReelsFeed({ reels, onSave, onBook }: ReelsFeedProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [displayedReels, setDisplayedReels] = useState<ReelData[]>(reels.slice(0, 10));
  const [hasMore, setHasMore] = useState(reels.length > 10);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute("data-index") || "0");
            setActiveIndex(index);
          }
        });
      },
      { threshold: 0.6 }
    );
    return () => observerRef.current?.disconnect();
  }, []);

  const observeRef = (el: HTMLDivElement | null, index: number) => {
    if (el) {
      el.setAttribute("data-index", index.toString());
      observerRef.current?.observe(el);
    }
  };

  useEffect(() => {
    setDisplayedReels(reels.slice(0, 10));
    setHasMore(reels.length > 10);
  }, [reels]);

  const fetchMoreReels = () => {
    const nextLength = displayedReels.length + 10;
    setDisplayedReels(reels.slice(0, nextLength));
    setHasMore(reels.length > nextLength);
  };

  const activeReel = displayedReels[activeIndex];

  return (
    <div className="w-full h-screen md:h-screen bg-black overflow-hidden relative flex flex-col">
      {/* Blurred Background completely covering the screen on desktop */}
      <div className="hidden md:block absolute inset-0 z-0 transition-opacity duration-700">
        {activeReel && (
          <>
            <img
              src={activeReel.thumbnailUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-[60px] opacity-40 scale-110"
            />
            <div className="absolute inset-0 bg-black/50" />
          </>
        )}
      </div>

      {/* Top Bar (Hamburger, Logo, Search) */}
      <div className="relative z-40 w-full px-4 py-3 flex items-center justify-between pointer-events-none md:pointer-events-auto">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 rounded-full bg-black/20 md:bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition pointer-events-auto"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="text-xl font-display font-semibold text-white drop-shadow-md hidden md:block pointer-events-auto">
          ZuruSasa
        </span>
        <button className="p-2 rounded-full bg-black/20 md:bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition pointer-events-auto hidden md:block">
          <Search className="w-5 h-5" />
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-[260px] bg-zinc-950/95 backdrop-blur-xl border-r border-zinc-800 z-50 transform transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-5 flex items-center justify-between border-b border-zinc-800/50">
          <span className="text-xl font-display font-semibold text-white">
            ZuruSasa
          </span>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 flex-1 overflow-y-auto space-y-1">
          {sidebarLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="flex items-center gap-4 px-4 py-3 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800/50 transition-colors font-medium"
              onClick={() => setIsSidebarOpen(false)}
            >
              <link.icon className="w-5 h-5" />
              {link.label}
            </Link>
          ))}
        </div>
        <div className="p-4 border-t border-zinc-800/50">
          <button className="flex items-center gap-4 px-4 py-3 w-full rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors font-medium">
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </div>

      {/* Reel Container */}
      <div className="flex-1 flex justify-center w-full z-10 -mt-16 md:mt-2 md:pb-6 relative h-full pointer-events-none md:pointer-events-auto">
        <div className="w-full h-full md:h-[calc(100vh-6rem)] md:max-w-[420px] md:aspect-[9/16] relative bg-black shadow-2xl md:rounded-2xl overflow-hidden pointer-events-auto border-0 md:border border-white/10">
          <InfiniteScroll
            dataLength={displayedReels.length}
            next={fetchMoreReels}
            hasMore={hasMore}
            loader={<SkeletonLoader />}
            scrollableTarget="reels-scroll-container"
            className="h-full w-full"
          >
            <div
              id="reels-scroll-container"
              className={cn(
                "h-[100vh] md:h-full w-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar"
              )}
            >
              {displayedReels.map((reel, index) => {
                const isWindowed = Math.abs(index - activeIndex) <= 1;
                return (
                  <div key={reel.id} className="h-full w-full snap-start snap-always" ref={(el) => observeRef(el, index)}>
                    {isWindowed ? (
                      <ReelCard
                        reel={reel}
                        isActive={index === activeIndex}
                        preloadNext={index === activeIndex + 1}
                        onSave={onSave}
                        onBook={onBook}
                      />
                    ) : (
                      <div className="w-full h-full bg-black flex items-center justify-center">
                        <img src={reel.thumbnailUrl} className="opacity-20 blur-xl w-full h-full object-cover" alt="" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </InfiniteScroll>
        </div>
      </div>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="h-full w-full flex flex-col gap-4 p-8">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-96 w-full bg-zinc-900 animate-pulse rounded-xl" />
      ))}
    </div>
  );
}
