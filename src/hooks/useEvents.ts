import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Event {
    id: string;
    title: string;
    description?: string;
    category: string;
    location: string;
    event_date: string;
    end_date?: string;
    image_url?: string;
    price?: number;
    attendees?: number;
    status: string;
}

export const useEvents = (location?: string, category?: string) => {
    return useQuery({
        queryKey: ['events', location, category],
        queryFn: async () => {
            let query = (supabase as any)
                .from('events')
                .select('*')
                .eq('status', 'active')
                .gte('event_date', new Date().toISOString())
                .order('event_date', { ascending: true });

            if (location && location !== "all") {
                query = query.ilike('location', `%${location}%`);
            }

            if (category && category !== "all") {
                query = query.eq('category', category);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching events:', error);
                return [];
            }

            return data as Event[];
        },
    });
};
