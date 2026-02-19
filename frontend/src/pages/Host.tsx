import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HostStats } from "@/components/host/dashboard/HostStats";
import { CreateReelDialog } from "@/components/host/dashboard/CreateReelDialog";
import { mockHostReels } from "@/data/mockHostData";

export const Host = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Calculate stats from mock data (in real app, fetch from API)
  const totalReels = mockHostReels.length;
  const totalViews = mockHostReels.reduce((acc, curr) => acc + curr.views, 0);
  const bookings = 12; // increased for demo

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
          <HostStats totalReels={totalReels} totalViews={totalViews} bookings={bookings} />

          {/* Quick Actions / Recent Activity Placeholder */}
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
                Check your views and booking conversion rates.
              </p>
              <Button variant="outline" disabled>View Analytics (Coming Soon)</Button>
            </div>
          </div>
        </div>

        <CreateReelDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      </div>
    </MainLayout>
  );
};

export default Host;
