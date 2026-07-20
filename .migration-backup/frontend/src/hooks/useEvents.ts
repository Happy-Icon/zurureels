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
                // Fetch events that have started OR are marked as live
                query = query.or(`event_date.lte.${now},is_live.eq.true`);
            } else {
                // Events in the future that are not currently live, soonest first
                query = query
                    .gt("event_date", now)
                    .neq("is_live", true)
                    .order("event_date", { ascending: true });
            }

            if (category && category !== "all") {
                query = query.eq("category", category);
            }

            const { data, error: fetchError } = await query.limit(50);

            if (fetchError) throw fetchError;

            // Fetch host profiles in a second stage to avoid database relationship cache issues
            const hostIds = Array.from(new Set((data || []).map((e: any) => e.user_id).filter(Boolean)));
            const hostProfilesMap: Record<string, any> = {};

            if (hostIds.length > 0) {
                const { data: profilesData } = await supabase
                    .from("profiles")
                    .select("id, full_name, username, metadata")
                    .in("id", hostIds);

                if (profilesData) {
                    profilesData.forEach(p => {
                        hostProfilesMap[p.id] = p;
                    });
                }
            }
            
            // Map results to include host data correctly
            let results = (data || []).map((e: any) => {
                const hostProfile = hostProfilesMap[e.user_id];
                return {
                    ...e,
                    host: hostProfile ? {
                        full_name: hostProfile.full_name,
                        username: hostProfile.username,
                        avatar_url: hostProfile.metadata?.avatar_url
                    } : undefined
                };
            }) as ZuruEvent[];

            // Client-side filtering for "happening" events (currently live, or started and not ended / within 3 hour fallback)
            if (timeFilter === "happening") {
                const nowTime = Date.now();
                const defaultDurationMs = 3 * 60 * 60 * 1000; // 3 hours fallback
                results = results.filter(e => {
                    if (e.is_live) return true; // Actively live events are always happening now
                    if (e.end_date) {
                        return new Date(e.end_date).getTime() >= nowTime;
                    }
                    const startTime = new Date(e.event_date).getTime();
                    return startTime + defaultDurationMs >= nowTime;
                });
            }

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

            // Custom priority sorting: pinned (1) -> boosted (2) -> free (3)
            results = results.sort((a, b) => {
                const priorityA = a.promotion_type === "pinned" ? 1 : (a.promotion_type === "boosted" ? 2 : 3);
                const priorityB = b.promotion_type === "pinned" ? 1 : (b.promotion_type === "boosted" ? 2 : 3);
                
                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }
                
                // Fallback secondary sorts
                if (timeFilter === "happening") {
                    if (a.is_live && !b.is_live) return -1;
                    if (!a.is_live && b.is_live) return 1;
                    return (b.viewer_count || 0) - (a.viewer_count || 0);
                } else {
                    return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
                }
            });

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
