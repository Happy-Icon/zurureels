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
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<any>(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const pageSize = 10;

    const fetchReels = useCallback(async (pageNum: number = 0) => {
        if (pageNum === 0) setLoading(true);
        else setLoadingMore(true);
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
                    processing_status,
                    processed_video_url,
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
                // Allow reels with no expiry (NULL) OR a future expiry date
                .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
                .order("created_at", { ascending: false });

            if (category && category !== "all") {
                query = query.eq("category", category);
            }

            if (experienceId) {
                query = query.eq("experience_id", experienceId);
            }

            // Pagination: use range
            const start = pageNum * pageSize;
            const end = start + pageSize - 1;
            query = query.range(start, end);

            // Fetch batch
            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;

            // Check if we have more results
            setHasMore((data?.length ?? 0) >= pageSize);

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
                processingStatus: item.processing_status,
                processedVideoUrl: item.processed_video_url,
            }));

            // Add mock reels for density (only in first page)
            let finalReels = transformedReels;
            if (pageNum === 0) {
                const filteredMocks = mockReels.filter(m =>
                    (!category || category === "all" || m.category === category) &&
                    (!search || m.title.toLowerCase().includes(search.toLowerCase()) || m.location.toLowerCase().includes(search.toLowerCase()))
                );
                finalReels = [...transformedReels, ...filteredMocks];
            }

            // Client-side search filter (Supabase ilike on joined tables is unreliable)
            if (search && search.trim()) {
                const q = search.toLowerCase();
                finalReels = finalReels.filter(
                    (r) =>
                        r.title.toLowerCase().includes(q) ||
                        r.location.toLowerCase().includes(q) ||
                        r.hostName.toLowerCase().includes(q) ||
                        r.category.toLowerCase().includes(q)
                );
            }

            // Shuffle for fair, unbiased ordering
            const liveReels = finalReels.filter((r) => r.isLive && r.lat && r.lng);
            const otherReels = finalReels.filter((r) => !r.isLive || !r.lat || !r.lng);

            const shuffledLive = shuffleArray(liveReels);
            const shuffledOther = shuffleArray(otherReels);

            const processedReels: ReelData[] = [];
            let li = 0,
                oi = 0;
            let position = 0;

            while (li < shuffledLive.length || oi < shuffledOther.length) {
                if (position % 3 === 0 && li < shuffledLive.length) {
                    processedReels.push(shuffledLive[li++]);
                } else if (oi < shuffledOther.length) {
                    processedReels.push(shuffledOther[oi++]);
                } else if (li < shuffledLive.length) {
                    processedReels.push(shuffledLive[li++]);
                }
                position++;
            }

            if (pageNum === 0) {
                setReels(processedReels);
            } else {
                setReels(prev => [...prev, ...processedReels]);
            }
        } catch (err) {
            console.error("Error fetching reels:", err);
            setError(err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [category, experienceId, search]);

    useEffect(() => {
        setPage(0);
        setReels([]);
        fetchReels(0);
    }, [fetchReels]);

    const loadMore = useCallback(() => {
        if (!loadingMore && hasMore) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchReels(nextPage);
        }
    }, [page, loadingMore, hasMore, fetchReels]);

    return { reels, loading, loadingMore, error, hasMore, refetch: fetchReels, loadMore };
};
