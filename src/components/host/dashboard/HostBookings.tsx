import { useState } from "react";
import { Check, X, Calendar, User, Clock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";

import { BookingRequest } from "@/types/host";

const mockBookings: BookingRequest[] = [
    {
        id: "b1",
        guestName: "Sarah Johnson",
        guestImage: "https://i.pravatar.cc/150?u=sarah",
        experienceTitle: "Sunset Dhow Cruise",
        date: "2024-03-25",
        time: "17:00",
        guests: 2,
        totalPrice: 16000,
        status: "pending",
        message: "Is it okay if we bring a small cake? It's my husband's birthday!",
        createdAt: "2024-03-20T10:00:00Z"
    },
    {
        id: "b2",
        guestName: "Michael Chang",
        guestImage: "https://i.pravatar.cc/150?u=michael",
        experienceTitle: "Glass Bottom Boat Tour",
        date: "2024-03-26",
        time: "09:00",
        guests: 4,
        totalPrice: 14000,
        status: "pending",
        createdAt: "2024-03-20T14:30:00Z"
    }
];

export const HostBookings = () => {
    const [requests, setRequests] = useState<BookingRequest[]>(mockBookings);
    const { toast } = useToast();

    const handleAction = (id: string, action: "approve" | "decline") => {
        // In a real app, this would call Supabase
        setRequests(prev => prev.filter(req => req.id !== id));

        // Simulate Notification Trigger
        const request = requests.find(r => r.id === id);
        if (!request) return;

        toast({
            title: action === "approve" ? "Booking Accepted! 🎉" : "Booking Declined",
            description: `You ${action}d ${request.guestName}'s request.`,
            variant: action === "approve" ? "default" : "destructive",
        });
    };

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
            {requests.map((req) => (
                <Card key={req.id} className="overflow-hidden border-border bg-card">
                    <div className="p-4 space-y-4">
                        {/* Header: Guest Info */}
                        <div className="flex items-start justify-between">
                            <div className="flex gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={req.guestImage} />
                                    <AvatarFallback>{req.guestName[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h4 className="font-semibold text-sm">{req.guestName}</h4>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Requested 2h ago
                                    </p>
                                </div>
                            </div>
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                                New Request
                            </Badge>
                        </div>

                        {/* Body: Experience Details */}
                        <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-sm">
                            <p className="font-medium text-foreground">{req.experienceTitle}</p>
                            <div className="flex items-center gap-4 text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>{new Date(req.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
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
                            <p className="font-semibold text-primary">KES {req.totalPrice.toLocaleString()}</p>

                            {req.message && (
                                <div className="mt-2 text-xs bg-background p-2 rounded border border-border flex gap-2">
                                    <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                    <p className="italic text-muted-foreground">"{req.message}"</p>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons (Big Touch Targets) */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <Button
                                variant="outline"
                                className="h-12 border-red-200 hover:bg-red-50 hover:text-red-600 text-red-600"
                                onClick={() => handleAction(req.id, "decline")}
                            >
                                <X className="h-5 w-5 mr-2" />
                                Decline
                            </Button>
                            <Button
                                className="h-12 bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => handleAction(req.id, "approve")}
                            >
                                <Check className="h-5 w-5 mr-2" />
                                Accept
                            </Button>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
};
