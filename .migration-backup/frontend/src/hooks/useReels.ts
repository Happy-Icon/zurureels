import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mockReels } from "@/data/mockReels";

export interface ReelData {
    id: string;
    experienceId: string;
    hostUserId: string;
    videoUrl: string;
    thumbnailUrl: string;
    title: string;
    description?: string;
    location: string;
    category: "boats" | "food" | "nightlife" | "activities" | "bikes" | "drinks" | "hotel" | "villa" | "apartment" | "rentals" | "adventure" | "parks_camps" | "tours" | "events" | "land_adventure" | "air_adventure" | "water_adventure";
    price: number;
    priceUnit: string;
    rating: number;
    bookingsCount?: number;
    availabilityStatus?: 'available' | 'booked_out' | 'limited';
    likes: number;
    saved: boolean;
    hostName: string;
    hostAvatar: string;
    postedAt: string;
    isLive?: boolean;
    lat?: number;
    lng?: number;
    processingStatus?: string;
    processedVideoUrl?: string;
    verificationStatus?: string;
}

const shuffleArray = <T>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

export const useReels = (category?: string | string[], experienceId?: string, search?: string) => {
    const [reels, setReels] = useState<ReelData[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<any>(null);
    const [page, setPage] = useState(0);

    const fetchReels = useCallback(async (pageNum: number = 0, signal?: AbortSignal) => {
        try {
            if (pageNum === 0) setLoading(true);
            else setLoadingMore(true);

            // Optimized query with relations and abort signal option
            let query = supabase
                .from("reels")
                .select(`
                    *,
                    experience:experiences(id, title, description, location, current_price, price_unit, entity_name, metadata, availability_status),
                    host:profiles!reels_user_id_profiles_fkey(full_name, username, metadata, verification_status)
                `, { abortSignal: signal })
                .eq("status", "active")
                .order("created_at", { ascending: false });

            if (category && category !== "all") {
                const categoriesArray = Array.isArray(category) ? category : [category];
                const resolvedCategories: string[] = [];

                categoriesArray.forEach(cat => {
                    if (cat === "land_adventure") {
                        resolvedCategories.push("land_adventure", "adventure", "tours", "rentals", "bikes");
                    } else if (cat === "water_adventure") {
                        resolvedCategories.push("water_adventure", "boats");
                    } else if (cat === "air_adventure") {
                        resolvedCategories.push("air_adventure");
                    } else {
                        resolvedCategories.push(cat);
                    }
                });

                console.log("useReels query category in:", { category, resolvedCategories });
                query = query.in("category", resolvedCategories);
            } else {
                console.log("useReels query category all: category is", category);
            }

            if (experienceId) {
                query = query.eq("experience_id", experienceId);
            }

            if (search && search.trim() !== "") {
                const searchPattern = `%${search.trim()}%`;
                query = query.or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`, { foreignTable: 'experience' });
            }

            const { data, error: fetchError } = await query;

            if (signal?.aborted) return;

            console.log("useReels result:", {
                success: !fetchError,
                count: data?.length,
                error: fetchError
            });

            if (fetchError) throw fetchError;

            const transformedReels: ReelData[] = (data || []).map((item: any) => ({
                id: item.id,
                experienceId: item.experience_id,
                hostUserId: item.user_id,
                videoUrl: item.processed_video_url || item.video_url,
                thumbnailUrl: item.thumbnail_url || "/placeholder.svg",
                title: item.experience?.title || "Coastal Experience",
                description: item.experience?.description || "Experience the best of ZuruSasa.",
                location: item.experience?.location || "Mombasa",
                category: item.category as ReelData["category"],
                price: item.experience?.current_price || 0,
                priceUnit: item.experience?.price_unit || "person",
                rating: item.experience?.metadata?.rating || 5,
                bookingsCount: Math.floor(Math.random() * 50) + 10,
                availabilityStatus: item.experience?.availability_status || 'available',
                likes: 0,
                saved: false,
                hostName: item.host?.full_name || item.host?.username || item.experience?.entity_name || "Zuru Host",
                hostAvatar: item.host?.metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.id}`,
                postedAt: item.created_at,
                isLive: item.is_live,
                lat: item.lat,
                lng: item.lng,
                verificationStatus: item.host?.verification_status || 'none',
                metadata: item.experience?.metadata || {},
            }));

            // Combine with mocks
            const filteredMocks = mockReels.filter(m => {
                let matchesCategory = true;
                if (category && category !== "all") {
                    const categoriesArray = Array.isArray(category) ? category : [category];
                    const resolvedCategories: string[] = [];

                    categoriesArray.forEach(cat => {
                        if (cat === "land_adventure") {
                            resolvedCategories.push("land_adventure", "adventure", "tours", "rentals", "bikes");
                        } else if (cat === "water_adventure") {
                            resolvedCategories.push("water_adventure", "boats");
                        } else if (cat === "air_adventure") {
                            resolvedCategories.push("air_adventure");
                        } else {
                            resolvedCategories.push(cat);
                        }
                    });

                    matchesCategory = resolvedCategories.includes(m.category);
                }

                let matchesSearch = true;
                if (search && search.trim() !== "") {
                    const searchLower = search.toLowerCase().trim();
                    const titleMatch = m.title?.toLowerCase().includes(searchLower);
                    const descMatch = m.description?.toLowerCase().includes(searchLower);
                    const locMatch = m.location?.toLowerCase().includes(searchLower);
                    matchesSearch = titleMatch || descMatch || locMatch;
                }

                return matchesCategory && matchesSearch;
            });

            const combined = pageNum === 0 
                ? [...transformedReels, ...filteredMocks]
                : transformedReels;

            setReels(shuffleArray(combined));
        } catch (err: any) {
            if (signal?.aborted || err?.name === 'AbortError') return;
            console.error("Error fetching reels:", err);
            setError(err);
            // Fallback to mocks
            const filteredMocks = mockReels.filter(m => {
                let matchesCategory = true;
                if (category && category !== "all") {
                    const categoriesArray = Array.isArray(category) ? category : [category];
                    const resolvedCategories: string[] = [];

                    categoriesArray.forEach(cat => {
                        if (cat === "land_adventure") {
                            resolvedCategories.push("land_adventure", "adventure", "tours", "rentals", "bikes");
                        } else if (cat === "water_adventure") {
                            resolvedCategories.push("water_adventure", "boats");
                        } else if (cat === "air_adventure") {
                            resolvedCategories.push("air_adventure");
                        } else {
                            resolvedCategories.push(cat);
                        }
                    });

                    matchesCategory = resolvedCategories.includes(m.category);
                }

                let matchesSearch = true;
                if (search && search.trim() !== "") {
                    const searchLower = search.toLowerCase().trim();
                    const titleMatch = m.title?.toLowerCase().includes(searchLower);
                    const descMatch = m.description?.toLowerCase().includes(searchLower);
                    const locMatch = m.location?.toLowerCase().includes(searchLower);
                    matchesSearch = titleMatch || descMatch || locMatch;
                }

                return matchesCategory && matchesSearch;
            });
            setReels(shuffleArray(filteredMocks));
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [category, experienceId, search]);

    useEffect(() => {
        const controller = new AbortController();
        fetchReels(0, controller.signal);
        return () => {
            controller.abort();
        };
    }, [fetchReels]);

    return { reels, loading, loadingMore, error, fetchMore: () => fetchReels(page + 1) };
};
