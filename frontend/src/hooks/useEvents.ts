import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ZuruEvent, EventTimeFilter } from "@/types/events";

interface UseEventsResult {
    events: ZuruEvent[];
    loading: boolean;
    error: any;
    refetch: () => void;
}

/**
 * Fetches events filtered by time mode (happening now vs upcoming).
 * - "happening": event_date <= now AND (end_date IS NULL OR end_date >= now)
 * - "upcoming": event_date > now, ordered soonest first
 */
export const useEvents = (
    timeFilter: EventTimeFilter = "upcoming",
    category?: string,
    search?: string
): UseEventsResult => {
    const [events, setEvents] = useState<ZuruEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    const fetchEvents = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const now = new Date().toISOString();

            let query = supabase
                .from("events")
                .select("*")
                .eq("status", "active");

            if (timeFilter === "happening") {
                // Events that have started but not ended
                query = query
                    .lte("event_date", now)
                    .or(`end_date.is.null,end_date.gte.${now}`);
            } else {
                // Events in the future, soonest first
                query = query
                    .gt("event_date", now)
                    .order("event_date", { ascending: true });
            }

            if (category && category !== "all") {
                query = query.eq("category", category);
            }

            const { data, error: fetchError } = await query.limit(50);

            if (fetchError) throw fetchError;

            let results = (data || []) as ZuruEvent[];

            // Client-side search filter
            if (search && search.trim()) {
                const q = search.toLowerCase();
                results = results.filter(
                    (e) =>
                        e.title.toLowerCase().includes(q) ||
                        e.location.toLowerCase().includes(q) ||
                        (e.description || "").toLowerCase().includes(q)
                );
            }

            setEvents(results);
        } catch (err) {
            console.error("Error fetching events:", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [timeFilter, category, search]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    return { events, loading, error, refetch: fetchEvents };
};
