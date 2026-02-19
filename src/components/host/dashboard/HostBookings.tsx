import { useState } from "react";
import { Check, X, Calendar, User, Clock, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { BookingRequest } from "@/types/host";

export const HostBookings = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: requests = [], isLoading } = useQuery({
        queryKey: ['host-bookings', user?.id],
        queryFn: async () => {
            if (!user) return [];
            // We join experiences to filter by host (user.id)
            // We join profiles to get guest info (requires FK or we assume we can join on user_id)
            const { data, error } = await (supabase as any)
                .from('bookings')
                .select(`
                    *,
                    experiences!inner (
                        title,
                        user_id
                    ),
                    profiles (
                        full_name,
                        email
                    )
                `)
                .eq('experiences.user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching host bookings:", error);
                return [];
            }

            // Map DB result to BookingRequest type
            return data.map((b: any) => ({
                id: b.id,
                guestName: b.profiles?.full_name || b.profiles?.email || "Guest",
                guestImage: "", // Avatar not in profile schema yet?
                experienceTitle: b.experiences?.title,
                checkIn: b.check_in,
                checkOut: b.check_out, // using check_in time for 'time'
                time: b.check_in ? new Date(b.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD',
                guests: b.guests || 1,
                totalPrice: b.amount,
                status: b.status,
                message: "", // No message column in bookings yet
                createdAt: b.created_at
            }));
        },
        enabled: !!user
    });

    const updateStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string, status: string }) => {
            const { error } = await (supabase as any)
                .from('bookings')
                .update({ status })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['host-bookings'] });
            toast({
                title: variables.status === "approved" ? "Booking Accepted! 🎉" : "Booking Declined",
                description: `Request has been updated.`,
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: "Failed to update booking: " + error.message,
                variant: "destructive"
            });
        }
    });

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />Loading requests...</div>;
    }

    if (requests.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <Check className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold">All Caught Up!</h3>
                <p className="text-muted-foreground">You have no pending booking requests.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {requests.map((req: any) => (
                <Card key={req.id} className="overflow-hidden border-border bg-card">
                    <div className="p-4 space-y-4">
                        {/* Header: Guest Info */}
                        <div className="flex items-start justify-between">
                            <div className="flex gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={req.guestImage} />
                                    <AvatarFallback>{req.guestName[0]?.toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h4 className="font-semibold text-sm">{req.guestName}</h4>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Requested {new Date(req.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <Badge variant="outline" className={
                                req.status === 'paid' ? "bg-yellow-500/10 text-yellow-600 border-yellow-200" :
                                    req.status === 'approved' ? "bg-green-500/10 text-green-600 border-green-200" :
                                        "bg-secondary text-secondary-foreground"
                            }>
                                {req.status === 'paid' ? 'New Request' : req.status}
                            </Badge>
                        </div>

                        {/* Body: Experience Details */}
                        <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-sm">
                            <p className="font-medium text-foreground">{req.experienceTitle}</p>
                            <div className="flex items-center gap-4 text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>{req.checkIn ? new Date(req.checkIn).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'TBD'}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>{req.time}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    <span>{req.guests} guests</span>
                                </div>
                            </div>
                            <p className="font-semibold text-primary">KES {req.totalPrice?.toLocaleString()}</p>

                            {req.message && (
                                <div className="mt-2 text-xs bg-background p-2 rounded border border-border flex gap-2">
                                    <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                    <p className="italic text-muted-foreground">"{req.message}"</p>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        {req.status === 'paid' && (
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    className="h-12 border-red-200 hover:bg-red-50 hover:text-red-600 text-red-600"
                                    onClick={() => updateStatus.mutate({ id: req.id, status: "declined" })}
                                    disabled={updateStatus.isPending}
                                >
                                    <X className="h-5 w-5 mr-2" />
                                    Decline
                                </Button>
                                <Button
                                    className="h-12 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => updateStatus.mutate({ id: req.id, status: "approved" })}
                                    disabled={updateStatus.isPending}
                                >
                                    <Check className="h-5 w-5 mr-2" />
                                    Accept
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>
            ))}
        </div>
    );
};
