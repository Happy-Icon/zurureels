import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Plus, Video, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HostStats } from "@/components/host/dashboard/HostStats";
import { HostReelsList } from "@/components/host/dashboard/HostReelsList";
import { CreateReelDialog } from "@/components/host/dashboard/CreateReelDialog";
import { HostBookings } from "@/components/host/dashboard/HostBookings";
import { useHostReels } from "@/hooks/useHostReels";
import { useAuth } from "@/components/AuthProvider";

export const Host = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"published" | "drafts" | "requests">("published");
  const { user } = useAuth();

  const { reels: allReels, loading } = useHostReels();

  const publishedReels = allReels.filter(r => r.status === "active" || r.status === "published");
  const draftReels = allReels.filter(r => r.status === "draft");

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="pb-20 md:pb-8">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-display font-semibold">Host Dashboard</h1>
                <p className="text-sm text-muted-foreground">Manage your listings and reels</p>
              </div>

              <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Reel</span>
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
              <button
                onClick={() => setActiveTab("requests")}
                className={cn(
                  "pb-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2",
                  activeTab === "requests"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Requests
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <HostStats
            totalReels={allReels.length}
            totalViews={allReels.reduce((acc, curr) => acc + (curr.views || 0), 0)}
            bookings={0} // To be connected via useBookings
          />

          {activeTab === "requests" ? (
            <HostBookings />
          ) : (
            <>
              <HostReelsList
                reels={activeTab === "published" ? publishedReels : draftReels}
                type={activeTab === "published" ? "published" : "drafts"}
              />

              {(activeTab === "published" ? publishedReels : draftReels).length === 0 && (
                <div className="text-center py-12">
                  <Video className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">
                    No {activeTab === "drafts" ? "drafts" : "published reels"} yet
                  </p>
                  <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Reel
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <CreateReelDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      </div>
    </MainLayout>
  );
};

export default Host;
