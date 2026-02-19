import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { HostReelsList } from "@/components/host/dashboard/HostReelsList";
import { CreateReelDialog } from "@/components/host/dashboard/CreateReelDialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockHostReels } from "@/data/mockHostData";

const Listings = () => {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"published" | "drafts">("published");

    const publishedReels = mockHostReels.filter(r => r.status === "published");
    const draftReels = mockHostReels.filter(r => r.status === "draft");

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
                    <HostReelsList
                        reels={activeTab === "published" ? publishedReels : draftReels}
                        type={activeTab}
                    />
                </div>

                <CreateReelDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
            </div>
        </MainLayout>
    );
};

export default Listings;
