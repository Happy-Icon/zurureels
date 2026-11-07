import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  supabase,
  type BookingRow,
  type HostBlockedDateRow,
} from '@/lib/supabase';

export function useMyBookings(userId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery<BookingRow[]>({
    queryKey: ['bookings', userId],
    enabled: !!userId,
    staleTime: 5_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(
          `*,
          experience:experiences(id, user_id, title, location, city, formatted_address, country_code, display_latitude, display_longitude, location_precision, current_price, price_unit, image_url, entity_name, max_guests, check_in_time, check_out_time, cancellation_policy, house_rules, arrival_instructions, checkout_instructions, amenities, metadata)`,
        )
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(40);
      if (error) throw new Error(error.message);
      const rows = (data as unknown as BookingRow[]) ?? [];
      if (__DEV__) {
        console.log('[TRIPS]', {
          userId,
          bookingsReturned: rows.length,
          latestBookingId: rows[0]?.id,
          latestBookingStatus: rows[0]?.status,
        });
      }
      return rows;
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channelName = `guest_bookings_${userId}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        (payload) => {
          const newUserId = (payload.new as any)?.user_id;
          const oldUserId = (payload.old as any)?.user_id;
          if (!newUserId && !oldUserId) {
            // General update without full replica identity - invalidate to ensure sync
            queryClient.invalidateQueries({ queryKey: ['bookings', userId] });
          } else if (newUserId === userId || oldUserId === userId) {
            queryClient.invalidateQueries({ queryKey: ['bookings', userId] });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const notif = payload.new as any;
          if (
            notif?.action_type === 'booking' ||
            notif?.type === 'booking_confirmed' ||
            notif?.type === 'booking_cancelled' ||
            notif?.type === 'payment_success' ||
            notif?.type === 'refund_processed'
          ) {
            queryClient.invalidateQueries({ queryKey: ['bookings', userId] });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return query;
}

export function useExperienceBlockedDates(experienceId: string | undefined) {
  return useQuery<HostBlockedDateRow[]>({
    queryKey: ['experience-blocked-dates', experienceId],
    enabled: !!experienceId,
    queryFn: async () => {
      // 1. Query unified server-authoritative unavailable dates RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_experience_unavailable_dates', {
        p_experience_id: experienceId!,
      });

      if (!rpcError && rpcData) {
        return (rpcData as any[]).map((row, idx) => ({
          id: `unavail_${idx}`,
          experience_id: experienceId!,
          host_id: '',
          start_date: row.start_date,
          end_date: row.end_date,
          reason: row.reason || 'Unavailable',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
      }

      // 2. Fallback to host_blocked_dates table if RPC is not yet loaded
      const { data, error } = await supabase
        .from('host_blocked_dates')
        .select('id, experience_id, host_id, start_date, end_date, reason, created_at, updated_at')
        .eq('experience_id', experienceId!)
        .order('start_date', { ascending: true });
      if (error) throw new Error(error.message);
      return (data as HostBlockedDateRow[]) ?? [];
    },
  });
}

export function useGuestCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason?: string }) => {
      const { data, error } = await supabase.rpc('guest_cancel_booking', {
        p_booking_id: bookingId,
        p_reason: reason ?? 'Guest cancelled reservation',
      });
      if (error) throw new Error(error.message);
      supabase.functions
        .invoke('process-booking-refund', { body: { bookingId } })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
          queryClient.invalidateQueries({ queryKey: ['host-bookings'] });
        })
        .catch((err) => console.warn('[Refund] Scoped cancel refund trigger note:', err));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['host-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['host-calendar-bookings'] });
    },
  });
}
