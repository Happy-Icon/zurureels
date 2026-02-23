import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { HostReelsList } from "@/components/host/dashboard/HostReelsList";
import { CreateReelDialog } from "@/components/host/dashboard/CreateReelDialog";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { ReelData } from "@/types/host";

const Listings = () => {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"published" | "drafts">("published");
    const [reels, setReels] = useState<ReelData[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const fetchReels = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from("reels")
                .select(`
                    id,
                    category,
                    video_url,
                    thumbnail_url,
                    status,
                    created_at,
                    expires_at,
                    experience:experiences (
                        title,
                        location,
                        current_price
                    )
                `)
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (error) throw error;

            // Get like counts for each reel
            const reelIds = (data || []).map((r) => r.id);
            let likeCounts: Record<string, number> = {};

            if (reelIds.length > 0) {
                // Count likes per reel
                const { data: likes } = await supabase
                    .from("reel_likes")
                    .select("reel_id")
                    .in("reel_id", reelIds);

                if (likes) {
                    for (const like of likes) {
                        likeCounts[like.reel_id] = (likeCounts[like.reel_id] || 0) + 1;
                    }
                }
            }

            const transformed: ReelData[] = (data || []).map((item: any) => ({
                id: item.id,
                title: item.experience?.title || "Untitled Experience",
                location: item.experience?.location || "Unknown",
                category: item.category,
                price: item.experience?.current_price || 0,
                views: likeCounts[item.id] || 0,
                status: item.status === "active" ? "published" : "draft",
                thumbnail: item.thumbnail_url || "",
                expiresAt: item.expires_at,
            }));

            setReels(transformed);
        } catch (err) {
            console.error("Error fetching host reels:", err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchReels();
    }, [fetchReels]);

    const handleDialogChange = (open: boolean) => {
        setIsCreateOpen(open);
        if (!open) {
            fetchReels(); // refetch when dialog closes
        }
    };

    const publishedReels = reels.filter(r => r.status === "published");
    const draftReels = reels.filter(r => r.status === "draft");

    return (
        <MainLayout>
            <div className="pb-20 md:pb-8">
                <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
                    <div className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-display font-semibold">Your Listings</h1>
                                <p className="text-sm text-muted-foreground">Manage your properties and experiences</p>
                            </div>
                            <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                                <Plus className="h-4 w-4" />
                                <span className="hidden sm:inline">Add New</span>
                            </Button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-4 mt-4 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => setActiveTab("published")}
                                className={cn(
                                    "pb-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                                    activeTab === "published"
                                        ? "border-primary text-foreground"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Published ({publishedReels.length})
                            </button>
                            <button
                                onClick={() => setActiveTab("drafts")}
                                className={cn(
                                    "pb-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                                    activeTab === "drafts"
                                        ? "border-primary text-foreground"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Drafts ({draftReels.length})
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <HostReelsList
                            reels={activeTab === "published" ? publishedReels : draftReels}
                            type={activeTab}
                        />
                    )}
                </div>

                <CreateReelDialog open={isCreateOpen} onOpenChange={handleDialogChange} />
            </div>
        </MainLayout>
    );
};

export default Listings;
