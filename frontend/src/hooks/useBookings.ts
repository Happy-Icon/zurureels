import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export interface Booking {
    id: string;
    experience_id: string;
    trip_title: string;
    amount: number;
    status: string;
    check_in: string;
    check_out: string;
    guests: number;
    created_at: string;
    experience?: {
        image_url: string;
        location: string;
    };
}

export const useBookings = (mode: "guest" | "host" = "guest") => {
    const { user } = useAuth();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    useEffect(() => {
        if (!user) return;

        const fetchBookings = async () => {
            setLoading(true);
            try {
                let query = supabase
                    .from("bookings")
                    .select(`
                        *,
                        experience:experiences (
                            image_url,
                            location
                        )
                    `);

                if (mode === "guest") {
                    query = query.eq("user_id", user.id);
                } else {
                    const { data: hostExperiences } = await supabase
                        .from("experiences")
                        .select("id")
                        .eq("user_id", user.id);

                    const experienceIds = (hostExperiences as { id: string }[] | null)?.map(e => e.id) || [];
                    query = query.in("experience_id", experienceIds);
                }

                const { data, error: fetchError } = await query.order("created_at", { ascending: false });

                if (fetchError) throw fetchError;

                setBookings(data as Booking[] || []);
            } catch (err) {
                console.error("Error fetching bookings:", err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchBookings();
    }, [user, mode]);

    const updateBookingStatus = async (bookingId: string, status: string) => {
        try {
            const { error } = await supabase
                .from("bookings")
                .update({ status } as any)
                .eq("id", bookingId);

            if (error) throw error;

            setBookings(prev =>
                prev.map(b => b.id === bookingId ? { ...b, status } : b)
            );
            return { success: true };
        } catch (err) {
            console.error("Error updating booking:", err);
            return { success: false, error: err };
        }
    };

    const cancelBooking = async (bookingId: string) => {
        return updateBookingStatus(bookingId, 'cancelled');
    };

    return { bookings, loading, error, updateBookingStatus, cancelBooking };
};
