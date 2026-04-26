import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ReelData } from "@/components/reels/ReelCard";
import { mockReels } from "@/data/mockReels";
export type { ReelData };

function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export const useReels = (category?: string | string[], experienceId?: string, search?: string) => {
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

        const showMocks = (cat?: string | string[]) => {
            const filtered = mockReels.filter(m =>
                !cat || cat === "all" || m.category === cat ||
                (Array.isArray(cat) && cat.includes(m.category))
            );
            return shuffleArray(filtered);
        };

        try {
            let query = supabase
                .from("reels")
                .select(`
                    id,
                    video_url,
                    thumbnail_url,
                    category,
                    created_at,
                    experience_id,
                    is_live,
                    lat,
                    lng,
                    user_id,
                    experience:experiences (id, user_id, title, location, current_price, price_unit, entity_name, metadata),
                    host:profiles (full_name, username, metadata)
                `)
                .eq("status", "active")
                .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
                .order("created_at", { ascending: false });

            if (category && category !== "all") {
                if (Array.isArray(category)) {
                    query = query.in("category", category);
                } else {
                    query = query.eq("category", category);
                }
            }
            if (experienceId) query = query.eq("experience_id", experienceId);

            const start = pageNum * pageSize;
            query = query.range(start, start + pageSize - 1);

            const { data, error: fetchError } = await query;

            if (fetchError) {
                console.warn("[useReels] DB error, using mock fallback:", fetchError.message);
                if (pageNum === 0) setReels(showMocks(category));
                return;
            }

            setHasMore((data?.length ?? 0) >= pageSize);

            const transformedReels: ReelData[] = (data || []).map((item: any) => {
                let videoUrl = item.video_url;
                let processedUrl = item.processed_video_url;
                if (videoUrl?.includes("res.cloudinary.com") && !videoUrl.includes("q_auto")) {
                    videoUrl = videoUrl.replace("/upload/", "/upload/q_auto,f_auto/");
                }
                if (processedUrl?.includes("res.cloudinary.com") && !processedUrl.includes("q_auto")) {
                    processedUrl = processedUrl.replace("/upload/", "/upload/q_auto,f_auto/");
                }
                return {
                    id: item.id,
                    experienceId: item.experience_id,
                    hostUserId: item.user_id || item.experience?.user_id,
                    videoUrl,
                    thumbnailUrl: item.thumbnail_url || "/placeholder.svg",
                    title: item.experience?.title || "Untitled Experience",
                    location: item.experience?.location || "Unknown Location",
                    category: item.category as ReelData["category"],
                    price: item.experience?.current_price || 0,
                    priceUnit: item.experience?.price_unit || "person",
                    rating: item.experience?.metadata?.rating || 0,
                    likes: 0,
                    saved: false,
                    hostName: item.host?.full_name || item.host?.username || item.experience?.entity_name || "Zuru Host",
                    hostAvatar: item.host?.metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.host?.username || item.id}`,
                    postedAt: item.created_at,
                    isLive: item.is_live,
                    lat: item.lat,
                    lng: item.lng,
                    processingStatus: item.processing_status,
                    processedVideoUrl: processedUrl,
                };
            });

            // Always merge mocks on page 0 so feed is never empty
            let finalReels = transformedReels;
            if (pageNum === 0) {
                const realIds = new Set(transformedReels.map(r => r.id));
                const mocks = mockReels.filter(m =>
                    !realIds.has(m.id) &&
                    (!category || category === "all" || m.category === category) &&
                    (!search || m.title.toLowerCase().includes(search.toLowerCase()) || m.location.toLowerCase().includes(search.toLowerCase()))
                );
                finalReels = [...transformedReels, ...mocks];
            }

            if (search?.trim()) {
                const q = search.toLowerCase();
                finalReels = finalReels.filter(r =>
                    r.title.toLowerCase().includes(q) ||
                    r.location.toLowerCase().includes(q) ||
                    r.hostName.toLowerCase().includes(q) ||
                    r.category.toLowerCase().includes(q)
                );
            }

            const liveReels = finalReels.filter(r => r.isLive && r.lat && r.lng);
            const otherReels = finalReels.filter(r => !r.isLive || !r.lat || !r.lng);
            const shuffledLive = shuffleArray(liveReels);
            const shuffledOther = shuffleArray(otherReels);
            const processedReels: ReelData[] = [];
            let li = 0, oi = 0, position = 0;

            while (li < shuffledLive.length || oi < shuffledOther.length) {
                if (position % 3 === 0 && li < shuffledLive.length) {
                    processedReels.push(shuffledLive[li++]);
                } else if (oi < shuffledOther.length) {
                    processedReels.push(shuffledOther[oi++]);
                } else {
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
            console.error("[useReels] Unexpected error:", err);
            setError(err);
            // Safety net — ALWAYS show mocks, never blank
            if (pageNum === 0) setReels(showMocks(category));
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
