import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Plus, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HostStats } from "@/components/host/dashboard/HostStats";
import { HostReelsList } from "@/components/host/dashboard/HostReelsList";
import { CreateReelDialog } from "@/components/host/dashboard/CreateReelDialog";
import { HostBookings } from "@/components/host/dashboard/HostBookings";
import { ReelData } from "@/types/host";

const mockHostReels: ReelData[] = [
  {
    id: "h1",
    title: "Beachfront Paradise Villa",
    location: "Diani Beach",
    category: "villa",
    price: 280,
    views: 1234,
    status: "published",
    thumbnail: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop",
    expiresAt: "2026-05-01T00:00:00Z", // Future
  },
  {
    id: "h2",
    title: "Sunset Dhow Cruise",
    location: "Lamu Old Town",
    category: "boat",
    price: 150,
    views: 856,
    status: "published",
    thumbnail: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=300&fit=crop",
    expiresAt: "2026-01-26T00:00:00Z", // Expiring soon (assuming current date is ~21st Jan 2026)
  },
  {
    id: "h3",
    title: "Coral Reef Diving Tour",
    location: "Watamu",
    category: "tour",
    price: 95,
    views: 423,
    status: "published", // Changed to published to show expired state clearly, usually drafts don't expire? Or they do.
    thumbnail: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&h=300&fit=crop",
    expiresAt: "2026-01-10T00:00:00Z", // Expired
  },
];

export const Host = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"published" | "drafts" | "requests">("published");

  const publishedReels = mockHostReels.filter(r => r.status === "published");
  const draftReels = mockHostReels.filter(r => r.status === "draft");

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
                <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full">2</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <HostStats totalReels={3} totalViews={2500} bookings={12} />

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
