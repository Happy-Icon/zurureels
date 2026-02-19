
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ReelData } from "@/components/reels/ReelCard";
import { useAuth } from "@/components/AuthProvider";

export const useHostReels = (status?: string) => {
    const [reels, setReels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        const fetchHostReels = async () => {
            setLoading(true);
            try {
                let query = supabase
                    .from("reels")
                    .select(`
                        *,
                        experience:experiences (
                            title,
                            location,
                            current_price,
                            price_unit,
                            entity_name
                        )
                    `)
                    .eq("user_id", user.id);

                if (status) {
                    query = query.eq("status", status);
                }

                const { data, error: fetchError } = await query.order("created_at", {
                    ascending: false,
                });

                if (fetchError) throw fetchError;

                // Transform to a format the Host components expect
                // The Host dashboard uses a slightly different ReelData type usually defined in types/host
                const transformed = (data || []).map(item => ({
                    id: item.id,
                    title: item.experience?.title || "Untitled",
                    location: item.experience?.location || "Unknown",
                    category: item.category,
                    price: item.experience?.current_price || 0,
                    views: 0, // Mock for now as we don't have views table yet
                    status: item.status,
                    thumbnail: item.thumbnail_url || "/placeholder.svg",
                    expiresAt: item.expires_at,
                    experience_id: item.experience_id
                }));

                setReels(transformed);
            } catch (err) {
                console.error("Error fetching host reels:", err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchHostReels();
    }, [user, status]);

    return { reels, loading, error };
};
