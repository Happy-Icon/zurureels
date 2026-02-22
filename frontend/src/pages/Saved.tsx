import { MainLayout } from "@/components/layout/MainLayout";
import { Bookmark, Grid, List, FolderPlus, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useNavigate } from "react-router-dom";
import { ReelData } from "@/components/reels/ReelCard";

const Saved = () => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [savedReels, setSavedReels] = useState<ReelData[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  const categoryColors: Record<string, string> = {
    hotel: "bg-blue-500/90",
    villa: "bg-emerald-500/90",
    boats: "bg-cyan-500/90",
    tours: "bg-amber-500/90",
    events: "bg-purple-500/90",
    apartment: "bg-indigo-500/90",
    food: "bg-orange-500/90",
    drinks: "bg-pink-500/90",
    rentals: "bg-teal-500/90",
    adventure: "bg-red-500/90",
    parks_camps: "bg-green-600/90",
  };

  useEffect(() => {
    const fetchSavedReels = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch saved reel IDs then join with reels + experiences + profiles
        const { data: saves, error: savesError } = await supabase
          .from("reel_saves")
          .select("reel_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (savesError) throw savesError;

        if (!saves || saves.length === 0) {
          setSavedReels([]);
          setLoading(false);
          return;
        }

        const reelIds = saves.map((s: any) => s.reel_id);

        const { data: reels, error: reelsError } = await supabase
          .from("reels")
          .select(`
            id,
            user_id,
            video_url,
            thumbnail_url,
            category,
            created_at,
            experience_id,
            is_live,
            lat,
            lng,
            experience:experiences (
              title,
              location,
              current_price,
              price_unit,
              entity_name,
              metadata
            ),
            host:profiles (
              full_name,
              metadata
            )
          `)
          .in("id", reelIds);

        if (reelsError) throw reelsError;

        const transformed: ReelData[] = (reels || []).map((item: any) => ({
          id: item.id,
          experienceId: item.experience_id,
          hostUserId: item.user_id,
          videoUrl: item.video_url,
          thumbnailUrl: item.thumbnail_url || "/placeholder.svg",
          title: item.experience?.title || "Untitled Experience",
          location: item.experience?.location || "Unknown Location",
          category: item.category,
          price: item.experience?.current_price || 0,
          priceUnit: item.experience?.price_unit || "person",
          rating: item.experience?.metadata?.rating || 5.0,
          likes: 0,
          saved: true,
          hostName: item.host?.full_name || item.experience?.entity_name || "Host",
          hostAvatar: item.host?.metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.id}`,
          postedAt: item.created_at,
          isLive: item.is_live,
          lat: item.lat,
          lng: item.lng,
        }));

        setSavedReels(transformed);
      } catch (err) {
        console.error("Error fetching saved reels:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSavedReels();
  }, [user]);

  const handleUnsave = async (reelId: string) => {
    if (!user) return;
    try {
      await supabase
        .from("reel_saves")
        .delete()
        .eq("reel_id", reelId)
        .eq("user_id", user.id);

      setSavedReels((prev) => prev.filter((r) => r.id !== reelId));
    } catch (err) {
      console.error("Unsave error:", err);
    }
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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !user ? (
            <div className="text-center py-12">
              <Bookmark className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Sign in to see saved</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Sign in to save hotels, tours, and experiences you love.
              </p>
              <Button onClick={() => navigate("/auth")}>Sign In</Button>
            </div>
          ) : savedReels.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Nothing saved yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Save hotels, tours, and experiences you love for easy access later.
              </p>
              <Button onClick={() => navigate("/discover")}>Start Exploring</Button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {savedReels.map((reel) => (
                <div
                  key={reel.id}
                  className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-muted cursor-pointer"
                  onClick={() => navigate(`/`)}
                >
                  <img
                    src={reel.thumbnailUrl}
                    alt={reel.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-overlay/80 via-transparent to-transparent" />

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnsave(reel.id);
                    }}
                    className="absolute top-3 right-3 p-2 rounded-full glass-dark z-10"
                  >
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
                  {reel.isLive && (
                    <div className="absolute top-10 right-3 flex gap-1 items-center">
                      <div className="bg-red-500 text-[10px] font-bold text-white px-1.5 py-0.5 rounded shadow-lg animate-pulse">
                        LIVE
                      </div>
                      {reel.lat && (
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
                      KES {reel.price.toLocaleString()}
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
                  onClick={() => navigate(`/`)}
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
                      {reel.isLive && (
                        <Badge variant="outline" className="text-[10px] h-5 border-red-500 text-red-500 py-0 animate-pulse">
                          LIVE
                        </Badge>
                      )}
                      {reel.lat && (
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      )}
                    </div>
                    <h3 className="font-semibold truncate">{reel.title}</h3>
                    <p className="text-sm text-muted-foreground">{reel.location}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="font-semibold">
                        KES {reel.price.toLocaleString()}
                        <span className="text-sm font-normal text-muted-foreground">
                          /{reel.priceUnit}
                        </span>
                      </p>
                      <span className="text-sm text-muted-foreground">⭐ {reel.rating}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnsave(reel.id);
                    }}
                    className="self-center p-2"
                  >
                    <Bookmark className="h-5 w-5 fill-primary text-primary" />
                  </button>
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
