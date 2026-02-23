import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HostStats } from "@/components/host/dashboard/HostStats";
import { CreateReelDialog } from "@/components/host/dashboard/CreateReelDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export const Host = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { user } = useAuth();

  // Real stats from Supabase
  const [totalReels, setTotalReels] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalBookings, setTotalBookings] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Count reels for this host
      const { count: reelCount } = await supabase
        .from("reels")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      setTotalReels(reelCount || 0);

      // Count total likes across all the host's reels
      const { data: hostReels } = await supabase
        .from("reels")
        .select("id")
        .eq("user_id", user.id);

      if (hostReels && hostReels.length > 0) {
        const reelIds = hostReels.map((r) => r.id);
        const { count: likeCount } = await supabase
          .from("reel_likes")
          .select("*", { count: "exact", head: true })
          .in("reel_id", reelIds);

        setTotalLikes(likeCount || 0);
      }

      // Bookings count — future implementation
      // The bookings table doesn't have a host_id column yet
      setTotalBookings(0);
    } catch (err) {
      console.error("Error fetching host stats:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Refetch when dialog closes (new reel might have been created)
  const handleDialogChange = (open: boolean) => {
    setIsCreateOpen(open);
    if (!open) {
      fetchStats();
    }
  };

  return (
    <MainLayout>
      <div className="pb-20 md:pb-8">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-display font-semibold">Host Dashboard</h1>
                <p className="text-sm text-muted-foreground">Welcome back! Here's your overview.</p>
              </div>

              <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create Listing</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-8">
          <HostStats
            totalReels={totalReels}
            totalViews={totalLikes}
            bookings={totalBookings}
            loading={loading}
          />

          {/* Quick Actions / Recent Activity */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-6 rounded-xl border border-border bg-card/50">
              <h3 className="font-semibold mb-2">Grow your business</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add more listings to reach more travelers.
              </p>
              <Button variant="outline" onClick={() => setIsCreateOpen(true)}>Add New Listing</Button>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card/50">
              <h3 className="font-semibold mb-2">Analyze performance</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Check your likes and booking conversion rates.
              </p>
              <Button variant="outline" disabled>View Analytics (Coming Soon)</Button>
            </div>
          </div>
        </div>

        <CreateReelDialog open={isCreateOpen} onOpenChange={handleDialogChange} />
      </div>
    </MainLayout>
  );
};

export default Host;
