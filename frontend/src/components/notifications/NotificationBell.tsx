import { Bell, Check, X, ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";

export const NotificationBell = () => {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [isOpen, setIsOpen] = useState(false);

    const handleNotificationClick = (notif: Notification) => {
        markAsRead(notif.id);
        setIsOpen(false);
        
        // Navigation logic based on notification type and data
        switch (notif.type) {
            case "booking_request":
            case "booking_confirmed":
            case "booking_declined":
                navigate("/bookings");
                break;
            case "payout":
                navigate("/host");
                break;
            case "message":
                navigate("/profile/messages");
                break;
            case "event_reminder":
                // Navigate to Discover or a specific event modal if data link exists
                if (notif.data?.event_id) {
                    navigate(`/discover?event=${notif.data.event_id}`);
                } else {
                    navigate("/discover");
                }
                break;
            default:
                // Default fallback if a custom data link exists
                if (notif.data?.link) navigate(notif.data.link);
                break;
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative group">
                    <Bell className="h-5 w-5 transition-transform group-hover:rotate-12" />
                    {unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground border-2 border-background">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </div>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent 
                side="right" 
                className={cn(
                    "p-0 flex flex-col transition-all duration-300",
                    isMobile ? "w-full h-full border-none" : "w-[450px] sm:max-w-[450px]"
                )}
            >
                <div className="p-4 border-b flex items-center gap-4 sticky top-0 bg-background/95 backdrop-blur-md z-10 shrink-0">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setIsOpen(false)}
                        className="shrink-0"
                    >
                        <X className="h-5 w-5 text-muted-foreground" />
                    </Button>
                    <div className="flex-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <SheetTitle className="text-xl font-display font-bold">Notifications</SheetTitle>
                            {unreadCount > 0 && (
                                <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    {unreadCount} New
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-8 text-primary font-bold hover:text-primary hover:bg-primary/5 px-2"
                                    onClick={() => markAllAsRead()}
                                >
                                    <Check className="h-3.5 w-3.5 mr-1" />
                                    {isMobile ? "Read" : "Mark read"}
                                </Button>
                            )}
                            {notifications.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-8 text-muted-foreground font-bold hover:text-destructive hover:bg-destructive/5 px-2"
                                    onClick={() => {
                                        if (confirm("Clear all notifications?")) {
                                            // Mock clear all - search for a real one if exists
                                            notifications.forEach(n => handleNotificationClick(n));
                                            setIsOpen(false);
                                        }
                                    }}
                                >
                                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                                    {isMobile ? "Clear" : "Clear all"}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center space-y-4">
                            <div className="h-20 w-20 rounded-full bg-secondary/50 flex items-center justify-center text-4xl animate-bounce">
                                📭
                            </div>
                            <div className="space-y-1">
                                <p className="text-foreground font-display font-bold text-lg">All caught up!</p>
                                <p className="text-xs text-muted-foreground/60 max-w-[240px] mx-auto">
                                    When you get updates about your bookings or messages, they'll appear here.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/30 pb-24">
                            {notifications.map((notif) => (
                                <NotificationItem
                                    key={notif.id}
                                    notification={notif}
                                    onClick={() => handleNotificationClick(notif)}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>
                
                {isMobile && notifications.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border flex justify-center pb-[calc(1rem+env(safe-area-inset-bottom))]">
                         <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">Zuru Pulse Notifications</p>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
};

const NotificationItem = ({
    notification,
    onClick
}: {
    notification: Notification;
    onClick: () => void;
}) => {
    const typeIcons = {
        booking_request: "📅",
        booking_confirmed: "✨",
        booking_declined: "⚠️",
        payout: "💰",
        system: "🔔",
        message: "💬",
        event_reminder: "⏰",
    };

    const typeColors = {
        booking_request: "bg-blue-500/10 text-blue-600",
        booking_confirmed: "bg-emerald-500/10 text-emerald-600",
        booking_declined: "bg-red-500/10 text-red-600",
        payout: "bg-amber-500/10 text-amber-600",
        system: "bg-zinc-500/10 text-zinc-600",
        message: "bg-primary/10 text-primary",
        event_reminder: "bg-purple-500/10 text-purple-600",
    };

    return (
        <div
            className={cn(
                "p-4 hover:bg-secondary/50 transition-all cursor-pointer relative group flex gap-4 items-start",
                !notification.is_read && "bg-primary/[0.03]"
            )}
            onClick={onClick}
        >
            <div className={cn(
                "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-lg transform transition-transform group-hover:scale-110",
                typeColors[notification.type] || "bg-secondary text-foreground"
            )}>
                {typeIcons[notification.type] || "🔔"}
            </div>
            
            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex justify-between items-center gap-2">
                    <p className={cn(
                        "text-sm leading-tight transition-colors", 
                        notification.is_read ? "text-foreground font-medium" : "text-primary font-bold"
                    )}>
                        {notification.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {notification.body}
                </p>
                {!notification.is_read && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-primary mt-2">
                        <span>View Details</span>
                        <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-1" />
                    </div>
                )}
            </div>
            
            {!notification.is_read && (
                <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
            )}
        </div>
    );
};
