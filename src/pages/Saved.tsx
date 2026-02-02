import { MainLayout } from "@/components/layout/MainLayout";
import { useReels } from "@/hooks/useReels";
import { Bookmark, Grid, List, FolderPlus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState } from "react";

const Saved = () => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { reels: liveReels, loading } = useReels("all");
  // Filter for saved property (currently not in DB, so will be empty/mocked if added)
  const savedReels = liveReels.filter((reel) => (reel as any).saved);

  const categoryColors: Record<string, string> = {
    hotel: "bg-blue-500/90",
    villa: "bg-emerald-500/90",
    boat: "bg-cyan-500/90",
    tour: "bg-amber-500/90",
    event: "bg-purple-500/90",
  };

  return (
    <MainLayout>
      <div className="pb-20 md:pb-8">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-display font-semibold">Saved</h1>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <FolderPlus className="h-5 w-5" />
                </Button>
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-2 transition-colors",
                      viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-background"
                    )}
                  >
                    <Grid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "p-2 transition-colors",
                      viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-background"
                    )}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {savedReels.length} items saved
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {savedReels.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Nothing saved yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Save hotels, tours, and experiences you love for easy access later.
              </p>
              <Button>Start Exploring</Button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {savedReels.map((reel) => (
                <div
                  key={reel.id}
                  className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-muted cursor-pointer"
                >
                  <img
                    src={reel.thumbnailUrl}
                    alt={reel.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-overlay/80 via-transparent to-transparent" />

                  <button className="absolute top-3 right-3 p-2 rounded-full glass-dark">
                    <Bookmark className="h-4 w-4 fill-primary text-primary" />
                  </button>

                  <Badge
                    className={cn(
                      "absolute top-3 left-3 text-xs capitalize",
                      categoryColors[reel.category]
                    )}
                  >
                    {reel.category}
                  </Badge>

                  {/* Verification Badges */}
                  {(reel as any).isLive && (
                    <div className="absolute top-3 right-3 flex gap-1 items-center">
                      <div className="bg-red-500 text-[10px] font-bold text-white px-1.5 py-0.5 rounded shadow-lg animate-pulse">
                        LIVE
                      </div>
                      {(reel as any).lat && (
                        <div className="bg-emerald-500 p-0.5 rounded-full shadow-lg">
                          <ShieldCheck className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1">
                    <h3 className="font-semibold text-primary-foreground text-sm line-clamp-2">
                      {reel.title}
                    </h3>
                    <p className="text-xs text-primary-foreground/80">{reel.location}</p>
                    <p className="text-sm font-semibold text-primary-foreground">
                      ${reel.price}
                      <span className="text-xs font-normal">/{reel.priceUnit}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {savedReels.map((reel) => (
                <div
                  key={reel.id}
                  className="flex gap-4 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer"
                >
                  <img
                    src={reel.thumbnailUrl}
                    alt={reel.title}
                    className="h-24 w-24 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={cn("text-xs capitalize", categoryColors[reel.category])}>
                        {reel.category}
                      </Badge>
                      {(reel as any).isLive && (
                        <Badge variant="outline" className="text-[10px] h-5 border-red-500 text-red-500 py-0 animate-pulse">
                          LIVE
                        </Badge>
                      )}
                      {(reel as any).lat && (
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      )}
                    </div>
                    <h3 className="font-semibold truncate">{reel.title}</h3>
                    <p className="text-sm text-muted-foreground">{reel.location}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="font-semibold">
                        ${reel.price}
                        <span className="text-sm font-normal text-muted-foreground">
                          /{reel.priceUnit}
                        </span>
                      </p>
                      <span className="text-sm text-muted-foreground">⭐ {reel.rating}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Saved;
