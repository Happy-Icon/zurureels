import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type RealtimeChannel } from "@supabase/supabase-js";
import { useToast } from "@/components/ui/use-toast";

export interface Notification {
    id: string;
    user_id: string;
    type: "booking_request" | "booking_confirmed" | "booking_declined" | "payout" | "system" | "message";
    title: string;
    body: string;
    data: any;
    is_read: boolean;
    created_at: string;
}

export const useNotifications = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        let channel: RealtimeChannel;

        const setupNotifications = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // 1. Fetch initial notifications
                const { data, error } = await (supabase as any)
                    .from("notifications")
                    .select("*")
                    .eq("user_id", user.id)
                    .order("created_at", { ascending: false })
                    .limit(50); // Pagination in v2

                if (error) throw error;

                setNotifications(data as Notification[]);
                // @ts-ignore - is_read exists in the database table
                setUnreadCount(data?.filter((n: any) => !n.is_read).length || 0);

                // 2. Subscribe to Realtime changes
                channel = supabase
                    .channel("notifications_channel")
                    .on(
                        "postgres_changes",
                        {
                            event: "*",
                            schema: "public",
                            table: "notifications",
                            filter: `user_id=eq.${user.id}`,
                        },
                        (payload) => {
                            if (payload.eventType === "INSERT") {
                                const newNotif = payload.new as Notification;
                                setNotifications((prev) => [newNotif, ...prev]);
                                setUnreadCount((prev) => prev + 1);

                                // Show toast for high priority alerts
                                toast({
                                    title: newNotif.title,
                                    description: newNotif.body,
                                    duration: 5000,
                                });
                            } else if (payload.eventType === "UPDATE") {
                                const updatedNotif = payload.new as Notification;
                                setNotifications((prev) =>
                                    prev.map((n) => (n.id === updatedNotif.id ? updatedNotif : n))
                                );
                                // Re-calc unread count locally (or fetch count again)
                                setUnreadCount((prev) =>
                                    updatedNotif.is_read ? Math.max(0, prev - 1) : prev
                                );
                            }
                        }
                    )
                    .subscribe();

            } catch (error) {
                console.error("Error setting up notifications:", error);
            } finally {
                setLoading(false);
            }
        };

        setupNotifications();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, []);

    const markAsRead = async (id: string) => {
        try {
            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));

            // @ts-ignore - notifications table exists
            const { error } = await (supabase as any)
                .from("notifications")
                .update({ is_read: true })
                .eq("id", id);

            if (error) throw error;
        } catch (error) {
            console.error("Error marking as read:", error);
            // Revert if needed, but low priority for read status
        }
    };

    const markAllAsRead = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);

            // @ts-ignore - notifications table exists
            await (supabase as any)
                .from("notifications")
                .update({ is_read: true })
                .eq("user_id", user.id)
                .eq("is_read", false);

        } catch (error) {
            console.error("Error marking all as read:", error);
        }
    };

    return { notifications, unreadCount, loading, markAsRead, markAllAsRead };
};
