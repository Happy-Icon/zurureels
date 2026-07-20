import { useState } from "react";
import { Check, X, Calendar, User, Clock, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useBookings } from "@/hooks/useBookings";

// Host dashboard components

export const HostBookings = () => {
    const { bookings, loading, updateBookingStatus } = useBookings("host");
    const [activeTab, setActiveTab] = useState<"requests" | "upcoming" | "history">("requests");
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const filteredBookings = bookings.filter(b => {
        if (activeTab === "requests") return b.status === "paid" || b.status === "pending";
        if (activeTab === "upcoming") return b.status === "confirmed";
        return b.status === "completed" || b.status === "cancelled";
    });

    const handleAction = async (id: string, action: "approve" | "decline") => {
        setActionLoading(id);
        const status = action === "approve" ? "confirmed" : "cancelled";
        const result = await updateBookingStatus(id, status);

        if (result.success) {
            toast.success(action === "approve" ? "Booking Accepted! 🎉" : "Booking Declined");
        } else {
            toast.error("Failed to update booking");
        }
        setActionLoading(null);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <p className="text-muted-foreground text-sm">Loading requests...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Host Tabs */}
            <div className="flex gap-2 p-1 bg-muted rounded-xl">
                {(["requests", "upcoming", "history"] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                            activeTab === tab
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <span className="capitalize">{tab}</span>
                        {tab === "requests" && bookings.filter(b => b.status === "paid").length > 0 && (
                            <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full">
                                {bookings.filter(b => b.status === "paid").length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {filteredBookings.length === 0 ? (
                <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                        <Calendar className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">No {activeTab} yet</h3>
                    <p className="text-muted-foreground text-sm px-8">
                        {activeTab === "requests" 
                            ? "You don't have any new booking requests to review right now."
                            : activeTab === "upcoming"
                            ? "Confirmed trips will appear here once you accept them."
                            : "Your past and cancelled bookings will be listed here."}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredBookings.map((req) => (
                        <Card key={req.id} className="overflow-hidden border-border bg-card">
                            <div className="p-4 space-y-4">
                                {/* Header: Guest Info */}
                                <div className="flex items-start justify-between">
                                    <div className="flex gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarFallback>G</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h4 className="font-semibold text-sm">Guest Reservation</h4>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                Requested {new Date(req.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                                        {req.status === 'paid' ? 'Confirmed' : 'Pending'}
                                    </Badge>
                                </div>

                                {/* Body: Experience Details */}
                                <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-sm">
                                    <p className="font-medium text-foreground">{req.trip_title}</p>
                                    <div className="flex items-center gap-4 text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            <span>{new Date(req.check_in).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            <span>{req.guests} guests</span>
                                        </div>
                                    </div>
                                    <p className="font-semibold text-primary">KES {req.amount.toLocaleString()}</p>
                                </div>

                                {/* Status Label for non-request tabs */}
                                {activeTab !== "requests" && (
                                    <div className="flex justify-between items-center pt-2 border-t border-border">
                                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Status</span>
                                        <Badge 
                                            variant="outline" 
                                            className={`capitalize ${
                                                req.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                                req.status === 'cancelled' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                                                'bg-muted text-muted-foreground'
                                            }`}
                                        >
                                            {req.status}
                                        </Badge>
                                    </div>
                                )}

                                {/* Action Buttons for Requests tab only */}
                                {activeTab === "requests" && (
                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <Button
                                            variant="outline"
                                            className="h-11 border-red-100 hover:bg-red-50 hover:text-red-600 text-red-600"
                                            onClick={() => handleAction(req.id, "decline")}
                                            disabled={actionLoading === req.id}
                                        >
                                            <X className="h-5 w-5 mr-2" />
                                            Decline
                                        </Button>
                                        <Button
                                            className="h-11 bg-primary hover:bg-primary/90 text-primary-foreground"
                                            onClick={() => handleAction(req.id, "approve")}
                                            disabled={actionLoading === req.id}
                                        >
                                            {actionLoading === req.id ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <>
                                                    <Check className="h-5 w-5 mr-2" />
                                                    Accept
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};
