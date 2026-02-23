import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Experience {
    id: string;
    user_id: string;
    category: string;
    entity_name: string;
    title: string;
    description: string | null;
    location: string;
    image_url: string | null;
    base_price: number | null;
    current_price: number;
    price_unit: string;
    availability_status: string;
    metadata: any;
    created_at: string;
}

export const useExperiences = (category?: string, city?: string, search?: string) => {
    const [experiences, setExperiences] = useState<Experience[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    useEffect(() => {
        const fetchExperiences = async () => {
            setLoading(true);
            try {
                let query = supabase.from("experiences").select("*");

                if (category && category !== "all") {
                    query = query.eq("category", category);
                }

                if (city && city !== "Current Location") {
                    query = query.ilike("location", `%${city}%`);
                }

                if (search) {
                    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,entity_name.ilike.%${search}%`);
                }

                const { data, error: fetchError } = await query.order("created_at", { ascending: false });

                if (fetchError) throw fetchError;

                setExperiences(data || []);
            } catch (err) {
                console.error("Error fetching experiences:", err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchExperiences();
    }, [category, city, search]);

    return { experiences, loading, error };
};
