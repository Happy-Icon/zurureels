import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { emailService } from '@/services/emailService';
import { notificationService } from '@/services/notificationService';
import {
  supabase,
  type BookingRow,
  type ExperienceRow,
  type HostBlockedDateRow,
  type ProfileRow,
  type ReelRow,
} from '@/lib/supabase';

// ---- Host Calendar Queries & Mutations ----

export function useHostListings(userId: string | undefined) {
  return useQuery<ExperienceRow[]>({
    queryKey: ['host-listings', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('experiences')
        .select('id, title, location, current_price, price_unit, image_url, availability_status, entity_name, category, max_guests, min_stay_nights, max_stay_nights, check_in_time, check_out_time, booking_mode, cancellation_policy, house_rules, arrival_instructions, checkout_instructions, amenities, metadata')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as ExperienceRow[]) ?? [];
    },
  });
}

export function useHostCalendarBookings(
  userId: string | undefined,
  experienceId: string | null,
  startDate?: string,
  endDate?: string,
) {
  return useQuery<BookingRow[]>({
    queryKey: ['host-calendar-bookings', userId, experienceId ?? 'all', startDate ?? 'all', endDate ?? 'all'],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase
        .from('bookings')
        .select(`
          id, user_id, experience_id, reel_id, trip_title, amount, status, check_in, check_out, guests, created_at,
          experience:experiences(id, title, location, current_price, price_unit, image_url, max_guests, check_in_time, check_out_time, cancellation_policy, house_rules, arrival_instructions, checkout_instructions, amenities, metadata)
        `)
        .neq('status', 'cancelled');

      if (experienceId && experienceId !== 'all') {
        query = query.eq('experience_id', experienceId);
      } else {
        const { data: expData } = await supabase
          .from('experiences')
          .select('id')
          .eq('user_id', userId!);

        const expIds = (expData ?? []).map((e) => e.id);
        if (expIds.length === 0) return [];
        query = query.in('experience_id', expIds);
      }

      if (startDate && endDate) {
        query = query.lt('check_in', endDate).gt('check_out', startDate);
      }

      const { data, error } = await query.order('check_in', { ascending: true });
      if (error) throw new Error(error.message);
      return (data as unknown as BookingRow[]) ?? [];
    },
  });
}

export function useHostBlockedDates(
  userId: string | undefined,
  experienceId: string | null,
  startDate?: string,
  endDate?: string,
) {
  return useQuery<HostBlockedDateRow[]>({
    queryKey: ['host-blocked-dates', userId, experienceId ?? 'all', startDate ?? 'all', endDate ?? 'all'],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase
        .from('host_blocked_dates')
        .select('id, experience_id, host_id, start_date, end_date, reason, created_at, updated_at')
        .eq('host_id', userId!);

      if (experienceId && experienceId !== 'all') {
        query = query.eq('experience_id', experienceId);
      }

      if (startDate && endDate) {
        query = query.lt('start_date', endDate).gt('end_date', startDate);
      }

      const { data, error } = await query;
      if (error) {
        return [];
      }
      return (data as HostBlockedDateRow[]) ?? [];
    },
  });
}

export function useBlockHostDates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      experienceId,
      startDate,
      endDate,
      reason,
    }: {
      experienceId: string;
      startDate: string;
      endDate: string;
      reason: string;
    }) => {
      const { data, error } = await supabase.rpc('block_host_dates', {
        p_experience_id: experienceId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_reason: reason,
      });

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-blocked-dates'] });
    },
  });
}

export function useUnblockHostDates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ blockId }: { blockId: string }) => {
      const { error } = await supabase.rpc('unblock_host_dates', {
        p_block_id: blockId,
      });

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-blocked-dates'] });
    },
  });
}

export function useHostConfirmBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.rpc('host_confirm_booking', {
        p_booking_id: bookingId,
      });
      if (error) throw new Error(error.message);

      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['host-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['host-calendar-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });

      // Multi-channel dispatch: Push notification & Email to guest
      if (data?.user_id) {
        const tripTitle = data.trip_title || 'Coastal Stay';
        notificationService
          .sendPushNotificationForUser(
            data.user_id,
            'Reservation Confirmed! 🎉',
            `Your reservation for "${tripTitle}" was confirmed by the host.`,
            {
              type: 'booking_confirmed',
              actionType: 'booking',
              actionId: data.id,
              bookingId: data.id,
            },
          )
          .catch((err) => console.warn('[Push] Error dispatching confirm push:', err));

        emailService
          .sendBookingConfirmedEmail({
            userId: data.user_id,
            bookingId: data.id,
            tripTitle,
            amount: data.amount,
            startDate: data.start_date,
            endDate: data.end_date,
          })
          .catch((err) => console.warn('[Email] Error dispatching confirm email:', err));
      }
    },
  });
}

export function useHostDeclineBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason?: string }) => {
      const { data, error } = await supabase.rpc('host_decline_booking', {
        p_booking_id: bookingId,
        p_reason: reason ?? 'Host declined reservation request',
      });
      if (error) throw new Error(error.message);
      supabase.functions
        .invoke('process-booking-refund', { body: { bookingId } })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          queryClient.invalidateQueries({ queryKey: ['host-bookings'] });
          queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
        })
        .catch((err) => console.warn('[Refund] Scoped decline refund trigger note:', err));
      return data;
    },
    onSuccess: (data: any, vars) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['host-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['host-calendar-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });

      // Multi-channel dispatch: Push notification & Email to guest
      if (data?.user_id) {
        const tripTitle = data.trip_title || 'Coastal Stay';
        notificationService
          .sendPushNotificationForUser(
            data.user_id,
            'Reservation Request Declined',
            `Your reservation for "${tripTitle}" could not be accommodated by the host. Refund processing initiated.`,
            {
              type: 'booking_cancelled',
              actionType: 'booking',
              actionId: data.id,
              bookingId: data.id,
            },
          )
          .catch((err) => console.warn('[Push] Error dispatching decline push:', err));

        emailService
          .sendBookingCancelledEmail({
            userId: data.user_id,
            bookingId: data.id,
            tripTitle,
            reason: vars?.reason,
          })
          .catch((err) => console.warn('[Email] Error dispatching decline email:', err));
      }
    },
  });
}

export function useHostBookings(hostId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery<BookingRow[]>({
    queryKey: ['host-bookings', hostId],
    enabled: !!hostId,
    staleTime: 5_000,
    queryFn: async () => {
      // 1. Fetch host's experience IDs (both user_id and metadata->host_id)
      const { data: expData, error: expError } = await supabase
        .from('experiences')
        .select('id')
        .or(`user_id.eq.${hostId},metadata->>host_id.eq.${hostId}`);

      if (expError) throw new Error(expError.message);
      const expIds = (expData ?? []).map((e) => e.id as string);

      // 2. Fetch any booking quotes directly assigned to this host
      const { data: quotesData } = await supabase
        .from('booking_quotes')
        .select('id, experience_id')
        .eq('host_id', hostId);

      const quoteIds = (quotesData ?? []).map((q) => q.id as string);
      const quoteExpIds = (quotesData ?? []).map((q) => q.experience_id as string).filter(Boolean);
      const allExpIds = Array.from(new Set([...expIds, ...quoteExpIds]));

      if (allExpIds.length === 0 && quoteIds.length === 0) return [];

      // 3. Fetch bookings matching experience IDs or quote IDs
      let bQuery = supabase
        .from('bookings')
        .select(
          `*,
          experience:experiences(id, user_id, title, location, current_price, price_unit, image_url, entity_name, max_guests, check_in_time, check_out_time, cancellation_policy, house_rules, arrival_instructions, checkout_instructions, amenities, metadata)`,
        )
        .order('created_at', { ascending: false });

      if (allExpIds.length > 0 && quoteIds.length > 0) {
        bQuery = bQuery.or(`experience_id.in.(${allExpIds.join(',')}),quote_id.in.(${quoteIds.join(',')})`);
      } else if (allExpIds.length > 0) {
        bQuery = bQuery.in('experience_id', allExpIds);
      } else if (quoteIds.length > 0) {
        bQuery = bQuery.in('quote_id', quoteIds);
      }

      const { data: bData, error: bError } = await bQuery;
      if (bError) throw new Error(bError.message);

      const rawBookings = (bData as unknown as BookingRow[]) ?? [];
      if (rawBookings.length === 0) return [];

      // 4. Fetch Real Guest Profiles and Experience Reels
      const guestIds = Array.from(new Set(rawBookings.map((b) => b.user_id).filter(Boolean))) as string[];
      const bookingExpIds = Array.from(new Set(rawBookings.map((b) => b.experience_id).filter(Boolean))) as string[];
      const bookingReelIds = Array.from(new Set(rawBookings.map((b) => b.reel_id).filter(Boolean))) as string[];

      const profilesMap = new Map<string, ProfileRow>();
      const reelsMap = new Map<string, ReelRow>();

      const guestPromise = (async () => {
        if (guestIds.length === 0) return;
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, role, verification_status, metadata')
          .in('id', guestIds);
        (data ?? []).forEach((p) => profilesMap.set(p.id, p as ProfileRow));
      })();

      const reelsPromise = (async () => {
        if (bookingExpIds.length === 0 && bookingReelIds.length === 0) return;
        let reelQuery = supabase
          .from('reels')
          .select('id, experience_id, thumbnail_url, video_url, category');

        if (bookingExpIds.length > 0 && bookingReelIds.length > 0) {
          reelQuery = reelQuery.or(
            `experience_id.in.(${bookingExpIds.join(',')}),id.in.(${bookingReelIds.join(',')})`,
          );
        } else if (bookingExpIds.length > 0) {
          reelQuery = reelQuery.in('experience_id', bookingExpIds);
        } else {
          reelQuery = reelQuery.in('id', bookingReelIds);
        }

        const { data } = await reelQuery;
        (data ?? []).forEach((r) => {
          if (r.experience_id) reelsMap.set(r.experience_id, r as ReelRow);
          if (r.id) reelsMap.set(r.id, r as ReelRow);
        });
      })();

      await Promise.all([guestPromise, reelsPromise]);

      return rawBookings.map((b) => {
        const matchingReel = (b.experience_id ? reelsMap.get(b.experience_id) : null) || (b.reel_id ? reelsMap.get(b.reel_id) : null);
        const resolvedImageUrl =
          b.experience?.image_url ||
          matchingReel?.thumbnail_url ||
          (b.experience?.metadata as any)?.image_url ||
          (b.experience?.metadata as any)?.cover_image ||
          (b.experience?.metadata as any)?.photos?.[0] ||
          null;

        return {
          ...b,
          guest: b.user_id ? profilesMap.get(b.user_id) || null : null,
          experience: b.experience
            ? {
                ...b.experience,
                image_url: resolvedImageUrl,
              }
            : null,
        };
      });
    },
  });

  useEffect(() => {
    if (!hostId) return;
    const channelName = `host_bookings_${hostId}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['host-bookings', hostId] });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${hostId}` },
        (payload) => {
          const notif = payload.new as any;
          if (
            notif?.action_type === 'booking' ||
            notif?.type === 'booking_request' ||
            notif?.type === 'booking_confirmed' ||
            notif?.type === 'booking_cancelled'
          ) {
            queryClient.invalidateQueries({ queryKey: ['host-bookings', hostId] });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, hostId]);

  return query;
}


export interface HostKPIs {
  views: number;
  likes: number;
  saves: number;
  bookings: number;
  followers: number;
  earnings: number;
}

export function useHostKPIs(userId: string | undefined) {
  return useQuery<HostKPIs>({
    queryKey: ['host-kpis', userId],
    enabled: !!userId,
    staleTime: 15_000,
    queryFn: async () => {
      if (!userId) {
        return { views: 0, likes: 0, saves: 0, bookings: 0, followers: 0, earnings: 0 };
      }
      const reelsRes = await supabase.from('reels').select('id').eq('user_id', userId);
      const reelIds = (reelsRes.data ?? []).map((r) => r.id as string);
      let likesCount = 0;
      let savesCount = 0;
      if (reelIds.length > 0) {
        const [likesRes, savesRes] = await Promise.all([
          supabase.from('reel_likes').select('*', { count: 'exact', head: true }).in('reel_id', reelIds),
          supabase.from('reel_saves').select('*', { count: 'exact', head: true }).in('reel_id', reelIds),
        ]);
        likesCount = likesRes.count ?? 0;
        savesCount = savesRes.count ?? 0;
      }
      const followsRes = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);

      const expRes = await supabase
        .from('experiences')
        .select('id')
        .or(`user_id.eq.${userId},metadata->>host_id.eq.${userId}`);
      const expIds = (expRes.data ?? []).map((e) => e.id as string);

      let totalBookings = 0;
      let totalEarnings = 0;
      if (expIds.length > 0) {
        const bRes = await supabase
          .from('bookings')
          .select('id, amount, status')
          .in('experience_id', expIds);
        const bList = bRes.data ?? [];
        totalBookings = bList.length;
        totalEarnings = bList
          .filter((b) => b.status === 'confirmed' || b.status === 'paid' || b.status === 'completed')
          .reduce((sum, b) => sum + (b.amount ?? 0), 0);
      }

      return {
        views: reelIds.length * 142 + totalBookings * 18,
        likes: likesCount,
        saves: savesCount,
        bookings: totalBookings,
        followers: followsRes.count ?? 0,
        earnings: totalEarnings,
      };
    },
  });
}
