import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

interface UseEventSubscriptionResult {
    isSubscribed: boolean;
    subscriberCount: number;
    loading: boolean;
    toggling: boolean;
    subscribe: () => Promise<void>;
    unsubscribe: () => Promise<void>;
    toggle: () => Promise<void>;
}

/**
 * Manages a user's opt-in subscription to an event's reminder notifications.
 * Handles subscribe/unsubscribe with optimistic UI and subscriber count.
 */
export const useEventSubscription = (eventId: string): UseEventSubscriptionResult => {
    const { user } = useAuth();
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subscriberCount, setSubscriberCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);

    // Fetch initial state
    useEffect(() => {
        if (!eventId) return;

        const fetchState = async () => {
            setLoading(true);
            try {
                // Get subscriber count
                const { count, error: countError } = await supabase
                    .from("event_subscribers")
                    .select("*", { count: "exact", head: true })
                    .eq("event_id", eventId);

                if (!countError) {
                    setSubscriberCount(count || 0);
                }

                // Check if current user is subscribed
                if (user) {
                    const { data, error } = await supabase
                        .from("event_subscribers")
                        .select("id")
                        .eq("event_id", eventId)
                        .eq("user_id", user.id)
                        .maybeSingle();

                    if (!error) {
                        setIsSubscribed(!!data);
                    }
                }
            } catch (err) {
                console.error("Error fetching subscription state:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchState();
    }, [eventId, user]);

    const subscribe = useCallback(async () => {
        if (!user || !eventId || toggling) return;

        setToggling(true);
        // Optimistic update
        setIsSubscribed(true);
        setSubscriberCount((prev) => prev + 1);

        try {
            const { error } = await supabase
                .from("event_subscribers")
                .insert({
                    event_id: eventId,
                    user_id: user.id,
                    channels: ["in_app"],
                });

            if (error) {
                // Revert on error
                setIsSubscribed(false);
                setSubscriberCount((prev) => Math.max(0, prev - 1));

                if (error.code === "23505") {
                    // Already subscribed (unique constraint), just set state
                    setIsSubscribed(true);
                } else {
                    throw error;
                }
            } else {
                toast.success("You'll be notified about this event! 🔔");
            }
        } catch (err: any) {
            console.error("Subscribe error:", err);
            toast.error("Failed to subscribe. Please try again.");
        } finally {
            setToggling(false);
        }
    }, [user, eventId, toggling]);

    const unsubscribe = useCallback(async () => {
        if (!user || !eventId || toggling) return;

        setToggling(true);
        // Optimistic update
        setIsSubscribed(false);
        setSubscriberCount((prev) => Math.max(0, prev - 1));

        try {
            const { error } = await supabase
                .from("event_subscribers")
                .delete()
                .eq("event_id", eventId)
                .eq("user_id", user.id);

            if (error) {
                // Revert on error
                setIsSubscribed(true);
                setSubscriberCount((prev) => prev + 1);
                throw error;
            }
        } catch (err: any) {
            console.error("Unsubscribe error:", err);
            toast.error("Failed to unsubscribe. Please try again.");
        } finally {
            setToggling(false);
        }
    }, [user, eventId, toggling]);

    const toggle = useCallback(async () => {
        if (isSubscribed) {
            await unsubscribe();
        } else {
            await subscribe();
        }
    }, [isSubscribed, subscribe, unsubscribe]);

    return {
        isSubscribed,
        subscriberCount,
        loading,
        toggling,
        subscribe,
        unsubscribe,
        toggle,
    };
};
