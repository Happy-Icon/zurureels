import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ReelData } from "@/components/reels/ReelCard";
import { mockReels } from "@/data/mockReels";
export type { ReelData };

/**
 * Fisher-Yates shuffle — unbiased, O(n) random ordering.
 * Ensures no host gets unfair priority regardless of upload time.
 */
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export const useReels = (category?: string, experienceId?: string, search?: string) => {
    const [reels, setReels] = useState<ReelData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    const fetchReels = useCallback(async () => {
        setLoading(true);
        try {
            // Query reels with joins to experiences and profiles
            let query = supabase
                .from("reels")
                .select(`
                    id,
                    user_id,
                    video_url,
                    thumbnail_url,
                    category,
                    created_at,
                    experience_id,
                    is_live,
                    lat,
                    lng,
                    duration,
                    experience:experiences (
                        title,
                        location,
                        current_price,
                        price_unit,
                        entity_name,
                        metadata
                    ),
                    host:profiles (
                        full_name,
                        metadata
                    )
                `)
                .eq("status", "active")
                .gt("expires_at", new Date().toISOString());

            if (category && category !== "all") {
                query = query.eq("category", category);
            }

            if (experienceId) {
                query = query.eq("experience_id", experienceId);
            }

            // Fetch all matching, we'll shuffle client-side
            const { data, error: fetchError } = await query.order("created_at", {
                ascending: false,
            });

            if (fetchError) throw fetchError;

            // Transform database records to ReelData interface
            let transformedReels: ReelData[] = (data || []).map((item: any) => ({
                id: item.id,
                experienceId: item.experience_id,
                hostUserId: item.user_id,
                videoUrl: item.video_url,
                thumbnailUrl: item.thumbnail_url || "/placeholder.svg",
                title: item.experience?.title || "Untitled Experience",
                location: item.experience?.location || "Unknown Location",
                category: item.category as ReelData["category"],
                price: item.experience?.current_price || 0,
                priceUnit: item.experience?.price_unit || "person",
                rating: item.experience?.metadata?.rating || 0,
                likes: 0,
                saved: false,
                hostName: item.host?.full_name || item.experience?.entity_name || "Host",
                hostAvatar: item.host?.metadata?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + item.id,
                postedAt: item.created_at,
                isLive: item.is_live,
                lat: item.lat,
                lng: item.lng,
            }));

            // Add mock reels for density (only in "all" or matching categories)
            const filteredMocks = mockReels.filter(m =>
                (!category || category === "all" || m.category === category) &&
                (!search || m.title.toLowerCase().includes(search.toLowerCase()) || m.location.toLowerCase().includes(search.toLowerCase()))
            );

            // Combine real + mocks
            let combinedReels = [...transformedReels, ...filteredMocks];

            // Client-side search filter (Supabase ilike on joined tables is unreliable)
            if (search && search.trim()) {
                const q = search.toLowerCase();
                combinedReels = combinedReels.filter(
                    (r) =>
                        r.title.toLowerCase().includes(q) ||
                        r.location.toLowerCase().includes(q) ||
                        r.hostName.toLowerCase().includes(q) ||
                        r.category.toLowerCase().includes(q)
                );
            }

            // Shuffle for fair, unbiased ordering
            const liveReels = combinedReels.filter((r) => r.isLive && r.lat && r.lng);
            const otherReels = combinedReels.filter((r) => !r.isLive || !r.lat || !r.lng);

            const shuffledLive = shuffleArray(liveReels);
            const shuffledOther = shuffleArray(otherReels);

            const finalReels: ReelData[] = [];
            let li = 0,
                oi = 0;
            let position = 0;

            while (li < shuffledLive.length || oi < shuffledOther.length) {
                if (position % 3 === 0 && li < shuffledLive.length) {
                    finalReels.push(shuffledLive[li++]);
                } else if (oi < shuffledOther.length) {
                    finalReels.push(shuffledOther[oi++]);
                } else if (li < shuffledLive.length) {
                    finalReels.push(shuffledLive[li++]);
                }
                position++;
            }

            setReels(finalReels);
        } catch (err) {
            console.error("Error fetching reels:", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [category, experienceId, search]);

    useEffect(() => {
        fetchReels();
    }, [fetchReels]);

    return { reels, loading, error, refetch: fetchReels };
};
