import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ReelData } from "@/components/reels/ReelCard";
export type { ReelData };

export const useReels = (category?: string, experienceId?: string, search?: string) => {
    const [reels, setReels] = useState<ReelData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    useEffect(() => {
        const fetchReels = async () => {
            setLoading(true);
            try {
                // Query reels with joins to experiences and profiles
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

                if (search) {
                    // Use ilike on the joined experience title
                    // Note: Supabase filtering on joined tables can be tricky, 
                    // but since we want to search the title, we'll apply it to the main query if possible
                    // or use a structured search if supported.
                    query = query.ilike('experience.title', `%${search}%`);
                }

                const { data, error: fetchError } = await query.order("created_at", {
                    ascending: false,
                });

                if (fetchError) throw fetchError;

                // Transform database records to ReelData interface
                const transformedReels: ReelData[] = (data || []).map((item: any) => ({
                    id: item.id,
                    videoUrl: item.video_url,
                    thumbnailUrl: item.thumbnail_url || "/placeholder.svg",
                    title: item.experience?.title || "Untitled Experience",
                    location: item.experience?.location || "Unknown Location",
                    category: item.category as ReelData["category"],
                    price: item.experience?.current_price || 0,
                    priceUnit: item.experience?.price_unit || "person",
                    rating: item.experience?.metadata?.rating || 5.0,
                    likes: 0, // In production, this would come from a 'likes' table or counter
                    saved: false, // In production, this would be checked against user's saved items
                    hostName: item.host?.full_name || item.experience?.entity_name || "Host",
                    hostAvatar: item.host?.metadata?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + item.id,
                    postedAt: item.created_at,
                    isLive: item.is_live,
                    lat: item.lat,
                    lng: item.lng,
                }));

                setReels(transformedReels);
            } catch (err) {
                console.error("Error fetching reels:", err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchReels();
    }, [category, experienceId]);

    return { reels, loading, error };
};
