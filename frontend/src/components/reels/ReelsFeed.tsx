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
  const suggestedReels = reels.filter(r => r.id !== activeReel?.id).slice(0, 6);

  return (
    <div className="w-full h-screen md:h-screen bg-background overflow-hidden relative flex flex-col">
      {/* Blurred Background - Only visible in dark/active cases, or themed */}
      <div className="hidden md:block absolute inset-0 z-0 transition-opacity duration-700 opacity-20 dark:opacity-40">
        {activeReel && (
          <>
            <img
              src={activeReel.thumbnailUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-[100px] scale-110"
            />
            <div className="absolute inset-0 bg-background/50" />
          </>
        )}
      </div>

      {/* Top Bar (Hamburger, Logo, Search) */}
      <div className="relative z-40 w-full px-4 py-3 flex items-center justify-between pointer-events-none md:pointer-events-auto">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 rounded-full bg-background/20 md:bg-secondary/40 backdrop-blur-md text-foreground hover:bg-secondary/60 transition pointer-events-auto"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="text-xl font-display font-semibold text-foreground drop-shadow-sm hidden md:block pointer-events-auto">
          ZuruSasa
        </span>
        <button className="p-2 rounded-full bg-background/20 md:bg-secondary/40 backdrop-blur-md text-foreground hover:bg-secondary/60 transition pointer-events-auto hidden md:block">
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
          "fixed top-0 left-0 h-full w-[260px] bg-background/95 backdrop-blur-xl border-r border-border z-50 transform transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-5 flex items-center justify-between border-b border-border">
          <span className="text-xl font-display font-semibold text-foreground">
            ZuruSasa
          </span>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 flex-1 overflow-y-auto space-y-1">
          {sidebarLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="flex items-center gap-4 px-4 py-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors font-medium"
              onClick={() => setIsSidebarOpen(false)}
            >
              <link.icon className="w-5 h-5" />
              {link.label}
            </Link>
          ))}
        </div>
        <div className="p-4 border-t border-border">
          <button className="flex items-center gap-4 px-4 py-3 w-full rounded-xl text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors font-medium">
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex justify-center items-start w-full z-10 -mt-16 md:mt-2 relative h-full pointer-events-none md:pointer-events-auto overflow-hidden">
        {/* Reel Container */}
        <div className="w-full h-full md:h-[calc(100vh-6rem)] relative pointer-events-auto flex items-start justify-center gap-8 px-4">
          
          {/* Central Video Frame */}
          <div className="w-full h-full md:max-w-[340px] md:aspect-[9/18] relative pointer-events-auto">
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
                        <div className="w-full h-full bg-secondary/20 flex items-center justify-center">
                          <img src={reel.thumbnailUrl} className="opacity-20 blur-xl w-full h-full object-cover" alt="" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </InfiniteScroll>
          </div>

          {/* Suggestions Sidebar - Desktop Only */}
          <div className="hidden lg:flex flex-col w-80 h-full py-4 space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground px-2">Other Suggestions</h3>
              <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[calc(100vh-12rem)] pr-2 hide-scrollbar">
                {suggestedReels.map((reel) => (
                  <div key={reel.id} className="flex gap-3 group cursor-pointer p-2 rounded-xl hover:bg-secondary transition-colors">
                    <div className="relative w-20 h-32 flex-shrink-0 rounded-lg overflow-hidden bg-secondary">
                      <img src={reel.thumbnailUrl} alt={reel.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-6 h-6 text-white fill-white" />
                      </div>
                    </div>
                    <div className="flex flex-col justify-center py-1">
                      <h4 className="text-sm font-medium line-clamp-2 leading-snug">{reel.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {reel.location}
                      </p>
                      <div className="mt-2 text-xs font-semibold text-primary">
                        KES {reel.price.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-secondary/30 rounded-2xl border border-border mt-auto">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Zuru Pulse Pro
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Unlock exclusive coastal experiences and premium listings with our verified membership.
              </p>
              <button className="w-full mt-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90 transition-opacity">
                Learn More
              </button>
            </div>
          </div>
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
