import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

export const NotificationBell = () => {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="p-4 border-b flex items-center justify-between bg-card">
                    <span className="font-semibold">Notifications</span>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-auto py-1 px-2"
                            onClick={() => markAllAsRead()}
                        >
                            Mark all read
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[400px]">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            No notifications yet
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((notif) => (
                                <NotificationItem
                                    key={notif.id}
                                    notification={notif}
                                    onRead={() => markAsRead(notif.id)}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

const NotificationItem = ({
    notification,
    onRead
}: {
    notification: Notification;
    onRead: () => void;
}) => {
    const typeIcons = {
        booking_request: "📅",
        booking_confirmed: "✅",
        booking_declined: "❌",
        payout: "💰",
        system: "🔔",
        message: "💬",
    };

    return (
        <div
            className={cn(
                "p-4 hover:bg-muted/50 transition-colors cursor-pointer relative group",
                !notification.is_read && "bg-primary/5"
            )}
            onClick={onRead}
        >
            <div className="flex gap-3">
                <div className="text-xl select-none">
                    {typeIcons[notification.type] || "🔔"}
                </div>
                <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-start">
                        <p className={cn("text-sm font-medium leading-none", !notification.is_read && "text-primary")}>
                            {notification.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.body}
                    </p>
                </div>
                {!notification.is_read && (
                    <div className="flex flex-col justify-center">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                    </div>
                )}
            </div>
        </div>
    );
};
