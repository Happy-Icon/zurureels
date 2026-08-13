import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchServerCachedQuery } from '@/lib/redis';
import { notificationService } from '@/services/notificationService';
import {
  supabase,
  type BookingRow,
  type ConversationRow,
  type EventRow,
  type ExperienceRow,
  type HostBlockedDateRow,
  type ReelRow,
} from '@/lib/supabase';

export function useReels() {
  return useQuery<ReelRow[]>({
    queryKey: ['reels'],
    queryFn: async () => {
      return fetchServerCachedQuery('get_reels_feed', async () => {
        const { data, error } = await supabase
          .from('reels')
          .select(
            `*,
            experience:experiences(id, title, description, location, current_price, price_unit, availability_status, metadata),
            host:profiles!reels_user_id_profiles_fkey(full_name, verification_status, metadata)`,
          )
          .in('status', ['active', 'published'])
          .order('created_at', { ascending: false })
          .limit(30);
        if (error) throw new Error(error.message);
        return (data as unknown as ReelRow[]) ?? [];
      });
    },
  });
}

export function useExperiences(category?: string | null) {
  return useQuery<ExperienceRow[]>({
    queryKey: ['experiences', category ?? 'all'],
    queryFn: async () => {
      return fetchServerCachedQuery(
        'get_experiences',
        async () => {
          let query = supabase
            .from('experiences')
            .select(
              'id, title, description, location, current_price, price_unit, entity_name, category, availability_status, metadata',
            )
            .limit(50);
          if (category) {
            query = query.eq('category', category);
          }
          const { data, error } = await query;
          if (error) throw new Error(error.message);
          return (data as ExperienceRow[]) ?? [];
        },
        { category: category ?? 'all' }
      );
    },
  });
}

export function useMyBookings(userId: string | undefined) {
  return useQuery<BookingRow[]>({
    queryKey: ['bookings', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(
          `*,
          experience:experiences(id, title, location, current_price, price_unit, image_url, entity_name)`,
        )
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return (data as unknown as BookingRow[]) ?? [];
    },
  });
}

interface CreateBookingInput {
  userId: string;
  experienceId: string;
  reelId?: string | null;
  tripTitle: string;
  amount: number | null;
  guests: number;
  checkIn?: string;
  checkOut?: string;
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBookingInput) => {
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          user_id: input.userId,
          experience_id: input.experienceId,
          reel_id: input.reelId ?? null,
          trip_title: input.tripTitle,
          amount: input.amount ?? 0,
          guests: input.guests,
          check_in: input.checkIn ?? new Date().toISOString(),
          check_out:
            input.checkOut ?? new Date(Date.now() + 86_400_000).toISOString(),
          status: 'pending',
        })
        .select('id, experience_id, trip_title')
        .single();

      if (error) throw new Error(error.message);

      // Notify Host of new booking request
      if (data?.experience_id) {
        const { data: exp } = await supabase
          .from('experiences')
          .select('user_id')
          .eq('id', data.experience_id)
          .maybeSingle();

        if (exp?.user_id && exp.user_id !== input.userId) {
          notificationService
            .createNotification({
              userId: exp.user_id,
              type: 'booking_request',
              title: 'New Booking Request 📅',
              message: `You have a new booking request for "${input.tripTitle || 'your experience'}"`,
              actionType: 'booking',
              actionId: data.id,
            })
            .catch((e) => console.warn('Booking request notification warning:', e));
        }
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

// ---- Reel interactions (mirrors web useReelInteractions: reel_likes / reel_saves / user_follows) ----

export interface ReelInteractions {
  likeCount: number;
  liked: boolean;
  saved: boolean;
  following: boolean;
}

const interactionsKey = (reelId: string, userId: string | undefined) => [
  'reel-interactions',
  reelId,
  userId ?? 'anon',
];

export function useBatchReelInteractions(
  reelIds: string[],
  userId: string | undefined,
  enabled = true
) {
  return useQuery<Record<string, ReelInteractions>>({
    queryKey: ['batch-reel-interactions', reelIds.slice().sort().join(','), userId ?? 'anon'],
    enabled: enabled && reelIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_reel_interactions', {
        p_reel_ids: reelIds,
      });

      if (error) {
        // Fallback gracefully if RPC is not yet applied
        const resultMap: Record<string, ReelInteractions> = {};
        for (const id of reelIds) {
          resultMap[id] = { likeCount: 0, liked: false, saved: false, following: false };
        }
        return resultMap;
      }

      const resultMap: Record<string, ReelInteractions> = {};
      ((data ?? []) as any[]).forEach((row) => {
        resultMap[row.reel_id] = {
          likeCount: Number(row.like_count || 0),
          liked: Boolean(row.liked),
          saved: Boolean(row.saved),
          following: Boolean(row.following),
        };
      });

      return resultMap;
    },
  });
}

export function useReelInteractions(
  reelId: string,
  hostId: string | null | undefined,
  userId: string | undefined,
  enabled: boolean,
) {
  return useQuery<ReelInteractions>({
    queryKey: interactionsKey(reelId, userId),
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_reel_interactions', {
        p_reel_ids: [reelId],
      });

      if (error || !data || data.length === 0) {
        // Fallback for missing RPC
        const countRes = await supabase
          .from('reel_likes')
          .select('id', { count: 'exact', head: true })
          .eq('reel_id', reelId);
        return { likeCount: countRes.count ?? 0, liked: false, saved: false, following: false };
      }

      const row = (data as any[])[0];
      return {
        likeCount: Number(row.like_count || 0),
        liked: Boolean(row.liked),
        saved: Boolean(row.saved),
        following: Boolean(row.following),
      };
    },
  });
}

interface ToggleInput {
  reelId: string;
  userId: string;
}

export function useToggleLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reelId,
      userId,
      liked,
    }: ToggleInput & { liked: boolean }) => {
      if (liked) {
        const { error } = await supabase
          .from('reel_likes')
          .delete()
          .eq('reel_id', reelId)
          .eq('user_id', userId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from('reel_likes')
          .upsert({ reel_id: reelId, user_id: userId }, { onConflict: 'user_id,reel_id' });
        if (error && error.code !== '23505') throw new Error(error.message);
      }
    },
    onMutate: async ({ reelId, userId, liked }) => {
      const key = interactionsKey(reelId, userId);
      const prev = queryClient.getQueryData<ReelInteractions>(key);
      if (prev) {
        queryClient.setQueryData<ReelInteractions>(key, {
          ...prev,
          liked: !liked,
          likeCount: Math.max(0, prev.likeCount + (liked ? -1 : 1)),
        });
      }
      return { key, prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['reel-interactions', vars.reelId],
      });
    },
  });
}

export function useToggleSave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reelId,
      userId,
      saved,
    }: ToggleInput & { saved: boolean }) => {
      if (saved) {
        const { error } = await supabase
          .from('reel_saves')
          .delete()
          .eq('reel_id', reelId)
          .eq('user_id', userId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from('reel_saves')
          .insert({ reel_id: reelId, user_id: userId });
        if (error) throw new Error(error.message);
      }
    },
    onMutate: async ({ reelId, userId, saved }) => {
      const key = interactionsKey(reelId, userId);
      const prev = queryClient.getQueryData<ReelInteractions>(key);
      if (prev) {
        queryClient.setQueryData<ReelInteractions>(key, { ...prev, saved: !saved });
      }
      return { key, prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['reel-interactions', vars.reelId],
      });
      // Keep the Saved tab in sync with save/unsave from anywhere in the app.
      queryClient.invalidateQueries({ queryKey: ['saved-reels'] });
    },
  });
}

export function useToggleFollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      hostId,
      userId,
      following,
    }: {
      reelId: string;
      hostId: string;
      userId: string;
      following: boolean;
    }) => {
      if (following) {
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', userId)
          .eq('following_id', hostId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from('user_follows')
          .insert({ follower_id: userId, following_id: hostId });
        if (error) throw new Error(error.message);
      }
    },
    onMutate: async ({ reelId, userId, following }) => {
      const key = interactionsKey(reelId, userId);
      const prev = queryClient.getQueryData<ReelInteractions>(key);
      if (prev) {
        queryClient.setQueryData<ReelInteractions>(key, {
          ...prev,
          following: !following,
        });
      }
      return { key, prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['reel-interactions', vars.reelId],
      });
    },
  });
}

// ---- Enquire: find or create the buyer<->host conversation (mirrors web handleEnquire) ----

export function useEnquire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      hostId,
    }: {
      userId: string;
      hostId: string;
    }) => {
      const [participantOne, participantTwo] = [userId, hostId].sort();
      const found = await supabase
        .from('conversations')
        .select('id')
        .eq('participant_one', participantOne)
        .eq('participant_two', participantTwo)
        .maybeSingle();
      if (found.error) throw new Error(found.error.message);
      if (found.data?.id) {
        await supabase
          .from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', found.data.id);
        return found.data.id as string;
      }

      const created = await supabase
        .from('conversations')
        .insert({
          participant_one: participantOne,
          participant_two: participantTwo,
          last_message_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (created.error) throw new Error(created.error.message);
      return created.data.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

// ---- Saved tab (mirrors web Saved.tsx: reel_saves -> reels join + event_subscribers) ----

export function useSavedReels(userId: string | undefined) {
  return useQuery<ReelRow[]>({
    queryKey: ['saved-reels', userId],
    enabled: !!userId,
    queryFn: async () => {
      const saves = await supabase
        .from('reel_saves')
        .select('reel_id')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (saves.error) throw new Error(saves.error.message);
      const reelIds = (saves.data ?? []).map((s) => s.reel_id as string);
      if (reelIds.length === 0) return [];

      const { data, error } = await supabase
        .from('reels')
        .select(
          `*,
          experience:experiences(id, title, description, location, current_price, price_unit, availability_status, metadata),
          host:profiles!reels_user_id_profiles_fkey(full_name, verification_status, metadata)`,
        )
        .in('id', reelIds);
      if (error) throw new Error(error.message);

      // Preserve most-recently-saved-first ordering from reel_saves.
      const byId = new Map(
        ((data ?? []) as unknown as ReelRow[]).map((r) => [r.id, r]),
      );
      return reelIds
        .map((id) => byId.get(id))
        .filter((r): r is ReelRow => Boolean(r));
    },
  });
}

export function useSavedEvents(userId: string | undefined) {
  return useQuery<EventRow[]>({
    queryKey: ['saved-events', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_subscribers')
        .select('event_id, events(*)')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as { events: EventRow | null }[])
        .map((row) => row.events)
        .filter((e): e is EventRow => Boolean(e));
    },
  });
}

// ---- Inbox (mirrors web MessagingSystem conversation list) ----

export function useConversations(userId: string | undefined) {
  return useQuery<ConversationRow[]>({
    queryKey: ['conversations', userId],
    enabled: !!userId,
    staleTime: 0,
    queryFn: async () => {
      const convs = await supabase
        .from('conversations')
        .select('id, participant_one, participant_two, last_message_at, created_at')
        .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(50);
      if (convs.error) throw new Error(convs.error.message);
      const rows = (convs.data ?? []) as {
        id: string;
        participant_one: string;
        participant_two: string;
        last_message_at: string | null;
        created_at?: string | null;
      }[];
      if (rows.length === 0) return [];

      const otherIds = Array.from(
        new Set(
          rows.map((c) =>
            c.participant_one === userId ? c.participant_two : c.participant_one,
          ),
        ),
      );
      const profs = await supabase
        .from('profiles')
        .select('id, full_name, username, role, metadata')
        .in('id', otherIds);
      if (profs.error) throw new Error(profs.error.message);
      const profById = new Map(
        (profs.data ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      return rows.map((c) => {
        const otherId =
          c.participant_one === userId ? c.participant_two : c.participant_one;
        const p = profById.get(otherId);
        const metadata = (p?.metadata ?? null) as { avatar_url?: string } | null;
        return {
          ...c,
          last_message_at: c.last_message_at || c.created_at || new Date().toISOString(),
          other: {
            id: otherId,
            full_name: (p?.full_name as string) || 'Zuru User',
            username: (p?.username as string) || 'user',
            role: (p?.role as string) || 'guest',
            avatar_url: metadata?.avatar_url ?? null,
          },
        };
      });
    },
  });
}

export function useUnreadMessageCount(userId: string | undefined) {
  return useQuery<number>({
    queryKey: ['unread-messages-count', userId],
    enabled: !!userId,
    staleTime: 5000,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data: convs, error: convErr } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_one.eq.${userId},participant_two.eq.${userId}`);

      if (convErr || !convs || convs.length === 0) return 0;
      const convIds = convs.map((c) => c.id);

      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .neq('sender_id', userId!)
        .eq('is_read', false);

      if (error) return 0;
      return count ?? 0;
    },
  });
}

// ---- Host Calendar Queries & Mutations ----

export function useHostListings(userId: string | undefined) {
  return useQuery<ExperienceRow[]>({
    queryKey: ['host-listings', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('experiences')
        .select('id, title, location, current_price, price_unit, image_url, availability_status, entity_name, category')
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
  endDate?: string
) {
  return useQuery<BookingRow[]>({
    queryKey: ['host-calendar-bookings', userId, experienceId ?? 'all', startDate ?? 'all', endDate ?? 'all'],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase
        .from('bookings')
        .select(`
          id, user_id, experience_id, reel_id, trip_title, amount, status, check_in, check_out, guests, created_at,
          experience:experiences(id, title, location, current_price, price_unit, image_url)
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
  endDate?: string
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

      if (error) {
        if (error.code === 'P0001') {
          throw new Error(error.message || 'Dates contain active or pending reservations and cannot be blocked.');
        }
        const { data: userRes } = await supabase.auth.getUser();
        const hostId = userRes.user?.id;
        if (!hostId) throw new Error('Authentication required');

        const { error: insertErr } = await supabase.from('host_blocked_dates').insert({
          experience_id: experienceId,
          host_id: hostId,
          start_date: startDate,
          end_date: endDate,
          reason,
        });
        if (insertErr) throw new Error(insertErr.message);
        return data;
      }
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

      if (error) {
        const { error: delErr } = await supabase.from('host_blocked_dates').delete().eq('id', blockId);
        if (delErr) throw new Error(delErr.message);
      }
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

      // Trigger push notification to guest safely (non-blocking)
      const bookingData = data as BookingRow;
      if (bookingData?.user_id) {
        notificationService
          .sendPushNotificationForUser(
            bookingData.user_id,
            'Reservation Confirmed! 🎉',
            `Your reservation for "${bookingData.trip_title || 'your trip'}" was confirmed by the host.`,
            { actionType: 'booking', bookingId },
          )
          .catch((e) => console.warn('Push delivery warning:', e));
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['host-calendar-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
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

      // Trigger push notification to guest safely (non-blocking)
      const bookingData = data as BookingRow;
      if (bookingData?.user_id) {
        notificationService
          .sendPushNotificationForUser(
            bookingData.user_id,
            'Reservation Declined',
            `Your reservation for "${bookingData.trip_title || 'your trip'}" was declined by the host.`,
            { actionType: 'booking', bookingId },
          )
          .catch((e) => console.warn('Push delivery warning:', e));
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['host-calendar-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
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

      // Trigger push notification to host safely (non-blocking)
      const bookingData = data as BookingRow;
      if (bookingData?.experience_id) {
        (async () => {
          try {
            const { data: exp } = await supabase
              .from('experiences')
              .select('user_id')
              .eq('id', bookingData.experience_id)
              .maybeSingle();

            if (exp?.user_id) {
              await notificationService.sendPushNotificationForUser(
                exp.user_id,
                'Reservation Cancelled',
                `Reservation for "${bookingData.trip_title || 'your trip'}" was cancelled by the guest.`,
                { actionType: 'booking', bookingId },
              );
            }
          } catch (e) {
            console.warn('Host notification dispatch warning:', e);
          }
        })();
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['host-calendar-bookings'] });
    },
  });
}
