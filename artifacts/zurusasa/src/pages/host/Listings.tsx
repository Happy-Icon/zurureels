import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { HostReelsList } from "@/components/host/dashboard/HostReelsList";
import { CreateReelDialog } from "@/components/host/dashboard/CreateReelDialog";
import { CreateEventDialog } from "@/components/host/dashboard/CreateEventDialog";
import { HostLiveDialog } from "@/components/host/dashboard/HostLiveDialog";
import { LivePromotionDialog } from "@/components/host/dashboard/LivePromotionDialog";
import { EditEventDialog } from "@/components/host/dashboard/EditEventDialog";
import { EditReelDialog } from "@/components/host/dashboard/EditReelDialog";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Trash2, Radio, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import { ReelData } from "@/types/host";

const Listings = () => {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
    const [liveStreamEvent, setLiveStreamEvent] = useState<any | null>(null);
    const [promotionEvent, setPromotionEvent] = useState<any | null>(null);
    const [activeTab, setActiveTab] = useState<"published" | "drafts" | "events">("published");
    const [reels, setReels] = useState<ReelData[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [editingEvent, setEditingEvent] = useState<any | null>(null);
    const [editingReel, setEditingReel] = useState<ReelData | null>(null);
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
                        id,
                        title,
                        location,
                        current_price,
                        availability_status
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
                experienceId: item.experience?.id || "",
                title: item.experience?.title || "Untitled Experience",
                location: item.experience?.location || "Unknown",
                category: item.category,
                price: item.experience?.current_price || 0,
                views: likeCounts[item.id] || 0,
                status: item.status === "active" ? "published" : "draft",
                thumbnail: item.thumbnail_url || "",
                expiresAt: item.expires_at,
                availabilityStatus: item.experience?.availability_status || 'available'
            }));

            setReels(transformed);

            // Fetch Events
            const { data: eventsData, error: eventsError } = await supabase
                .from("events")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (!eventsError && eventsData) {
                // Fetch subscriber counts
                const eventIds = eventsData.map(e => e.id);
                let subCounts: Record<string, number> = {};
                
                if (eventIds.length > 0) {
                    const { data: subs } = await supabase
                        .from("event_subscribers")
                        .select("event_id")
                        .in("event_id", eventIds);
                    
                    if (subs) {
                        for (const sub of subs) {
                            subCounts[sub.event_id] = (subCounts[sub.event_id] || 0) + 1;
                        }
                    }
                }

                setEvents(eventsData.map(e => ({ ...e, subscriberCount: subCounts[e.id] || 0 })));
            }
        } catch (err) {
            console.error("Error fetching host listings:", err);
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

    const handleStopLiveStream = async (eventId: string) => {
        try {
            const { error } = await supabase
                .from("events")
                .update({ is_live: false, viewer_count: 0 })
                .eq("id", eventId);
            if (error) throw error;
            toast.success("Live stream stopped");
            fetchReels();
        } catch (error: any) {
            toast.error(error.message || "Failed to stop live stream");
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (!confirm("Are you sure you want to delete this event? All subscribers will be notified of cancellation.")) return;
        
        try {
            // First update event status to cancelled (optional, for notifications)
            await supabase.from("events").update({ status: "cancelled" }).eq("id", eventId);
            
            // Then delete it
            const { error } = await supabase.from("events").delete().eq("id", eventId);
            if (error) throw error;
            
            toast.success("Event deleted successfully");
            setEvents(events.filter(e => e.id !== eventId));
        } catch (error: any) {
            console.error("Error deleting event:", error);
            toast.error(error.message || "Failed to delete event");
        }
    };

    const handleDeleteReel = async (id: string) => {
        if (!confirm("Are you sure you want to delete this listing?")) return;
        try {
            const { error } = await supabase.from("reels").delete().eq("id", id);
            if (error) throw error;
            toast.success("Listing deleted successfully");
            setReels(reels.filter(r => r.id !== id));
        } catch (error: any) {
            console.error("Error deleting reel:", error);
            toast.error(error.message || "Failed to delete listing");
        }
    };

    const handleToggleReelStatus = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'published' ? 'draft' : 'active';
        try {
            const { error } = await supabase.from("reels").update({ status: newStatus }).eq("id", id);
            if (error) throw error;
            toast.success(`Listing ${newStatus === 'active' ? 'published' : 'unpublished'}`);
            fetchReels();
        } catch (error: any) {
            console.error("Error updating status:", error);
            toast.error(error.message || "Failed to update listing status");
        }
    };

    const handleToggleAvailability = async (experienceId: string, currentStatus: string | undefined) => {
        if (!experienceId) return;
        const newStatus = currentStatus === 'booked_out' ? 'available' : 'booked_out';
        try {
            const { error } = await supabase.from("experiences").update({ availability_status: newStatus }).eq("id", experienceId);
            if (error) throw error;
            toast.success(`Listing marked as ${newStatus === 'booked_out' ? 'Fully Booked' : 'Available'}`);
            fetchReels();
        } catch (error: any) {
            console.error("Error updating availability:", error);
            toast.error(error.message || "Failed to update availability");
        }
    };

    const handleEditReel = (reel: ReelData) => {
        setEditingReel(reel);
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
                            <div className="flex gap-2">
                                {activeTab === "events" && (
                                    <Button onClick={() => setIsCreateEventOpen(true)} variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5">
                                        <Plus className="h-4 w-4 text-primary" />
                                        <span>Schedule Event</span>
                                    </Button>
                                )}
                                <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden sm:inline">Add New Reel</span>
                                </Button>
                            </div>
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
                                onClick={() => setActiveTab("events")}
                                className={cn(
                                    "pb-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                                    activeTab === "events"
                                        ? "border-primary text-foreground"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Events ({events.length})
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : activeTab === "events" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                             {events.map((event) => (
                                <div key={event.id} className="border border-border rounded-xl bg-card p-4 space-y-4 relative overflow-hidden">
                                    {event.is_live && (
                                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 animate-pulse" />
                                    )}
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <h3 className="font-bold text-lg leading-tight line-clamp-1">{event.title}</h3>
                                            {event.is_live && (
                                                <span className="inline-flex items-center gap-1 bg-red-500 text-white font-bold text-[9px] uppercase px-2 py-0.5 rounded-full animate-pulse">
                                                    ● LIVE
                                                </span>
                                            )}
                                        </div>
                                        <div className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-bold">
                                            {event.subscriberCount} Subs
                                        </div>
                                    </div>
                                    <div className="space-y-1 text-sm text-muted-foreground">
                                        <p>📅 {new Date(event.event_date).toLocaleDateString()}</p>
                                        <p>📍 {event.location}</p>
                                        {event.is_live && event.viewer_count !== undefined && (
                                            <p className="text-red-500 font-medium text-xs flex items-center gap-1">
                                                👥 {event.viewer_count} watching now
                                            </p>
                                        )}
                                    </div>
                                    <div className="pt-2 border-t flex justify-between items-center">
                                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteEvent(event.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <div className="flex gap-2">
                                            {event.is_live ? (
                                                <Button 
                                                    variant="destructive" 
                                                    size="sm" 
                                                    onClick={() => handleStopLiveStream(event.id)}
                                                    className="gap-1.5 rounded-xl font-semibold h-8"
                                                >
                                                    <Square size={12} className="fill-white" />
                                                    End Live
                                                </Button>
                                            ) : (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => setPromotionEvent(event)}
                                                    className="gap-1.5 border-red-500/20 text-red-500 hover:bg-red-500/5 rounded-xl font-semibold h-8"
                                                >
                                                    <Radio size={12} className="animate-pulse" />
                                                    Go Live
                                                </Button>
                                            )}
                                            <Button variant="outline" size="sm" className="rounded-xl h-8 animate-fade-in" onClick={() => setEditingEvent(event)}>
                                                Edit
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {events.length === 0 && (
                                <div className="col-span-full text-center py-12 text-muted-foreground">
                                    <p>You haven't created any events yet.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <HostReelsList
                            reels={activeTab === "published" ? publishedReels : draftReels}
                            type={activeTab}
                            onDelete={handleDeleteReel}
                            onToggleStatus={handleToggleReelStatus}
                            onEdit={handleEditReel}
                            onToggleAvailability={handleToggleAvailability}
                        />
                    )}
                </div>

                <CreateReelDialog open={isCreateOpen} onOpenChange={handleDialogChange} />
                <CreateEventDialog 
                    open={isCreateEventOpen} 
                    onOpenChange={setIsCreateEventOpen} 
                    onSuccess={fetchReels} 
                />
                 <HostLiveDialog 
                    open={!!liveStreamEvent} 
                    onOpenChange={(open) => !open && setLiveStreamEvent(null)} 
                    eventId={liveStreamEvent?.id || ""} 
                    eventTitle={liveStreamEvent?.title || ""} 
                    onSuccess={fetchReels} 
                />
                <LivePromotionDialog
                    open={!!promotionEvent}
                    onOpenChange={(open) => !open && setPromotionEvent(null)}
                    eventId={promotionEvent?.id || ""}
                    eventTitle={promotionEvent?.title || ""}
                    onSuccess={(promoType) => {
                        const eventObj = promotionEvent;
                        setPromotionEvent(null);
                        setLiveStreamEvent(eventObj);
                        fetchReels();
                    }}
                />
                <EditReelDialog 
                    open={!!editingReel} 
                    onOpenChange={(open) => !open && setEditingReel(null)} 
                    reel={editingReel}
                    onSuccess={fetchReels}
                />
                <EditEventDialog 
                    open={!!editingEvent} 
                    onOpenChange={(open) => !open && setEditingEvent(null)} 
                    event={editingEvent}
                    onSuccess={fetchReels}
                />
            </div>
        </MainLayout>
    );
};

export default Listings;
