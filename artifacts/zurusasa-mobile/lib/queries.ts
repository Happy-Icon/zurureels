import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  supabase,
  type BookingRow,
  type ConversationRow,
  type EventRow,
  type ExperienceRow,
  type ReelRow,
} from '@/lib/supabase';

export function useReels() {
  return useQuery<ReelRow[]>({
    queryKey: ['reels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reels')
        .select(
          `*,
          experience:experiences(id, title, description, location, current_price, price_unit, availability_status, metadata),
          host:profiles!reels_user_id_profiles_fkey(full_name, verification_status, metadata)`,
        )
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return (data as unknown as ReelRow[]) ?? [];
    },
  });
}

export function useExperiences(category?: string | null) {
  return useQuery<ExperienceRow[]>({
    queryKey: ['experiences', category ?? 'all'],
    queryFn: async () => {
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
          experience:experiences(id, title, location, current_price, price_unit, image_url)`,
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
      const { error } = await supabase.from('bookings').insert({
        user_id: input.userId,
        experience_id: input.experienceId,
        reel_id: input.reelId ?? null,
        trip_title: input.tripTitle,
        // amount + trip_title are NOT NULL in the bookings schema
        amount: input.amount ?? 0,
        guests: input.guests,
        check_in: input.checkIn ?? new Date().toISOString(),
        check_out:
          input.checkOut ?? new Date(Date.now() + 86_400_000).toISOString(),
        status: 'pending',
      });
      if (error) throw new Error(error.message);
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
      const countRes = await supabase
        .from('reel_likes')
        .select('*', { count: 'exact', head: true })
        .eq('reel_id', reelId);
      if (countRes.error) throw new Error(countRes.error.message);

      let liked = false;
      let saved = false;
      let following = false;

      if (userId) {
        const likedRes = await supabase
          .from('reel_likes')
          .select('reel_id')
          .eq('reel_id', reelId)
          .eq('user_id', userId)
          .limit(1);
        if (likedRes.error) throw new Error(likedRes.error.message);
        liked = (likedRes.data ?? []).length > 0;

        const savedRes = await supabase
          .from('reel_saves')
          .select('reel_id')
          .eq('reel_id', reelId)
          .eq('user_id', userId)
          .limit(1);
        if (savedRes.error) throw new Error(savedRes.error.message);
        saved = (savedRes.data ?? []).length > 0;

        if (hostId && hostId !== userId) {
          const followRes = await supabase
            .from('user_follows')
            .select('follower_id')
            .eq('follower_id', userId)
            .eq('following_id', hostId)
            .limit(1);
          if (followRes.error) throw new Error(followRes.error.message);
          following = (followRes.data ?? []).length > 0;
        }
      }

      return { likeCount: countRes.count ?? 0, liked, saved, following };
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
          .insert({ reel_id: reelId, user_id: userId });
        if (error) throw new Error(error.message);
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
      if (found.data?.id) return found.data.id as string;

      const created = await supabase
        .from('conversations')
        .insert({
          participant_one: participantOne,
          participant_two: participantTwo,
        })
        .select('id')
        .single();
      if (created.error) throw new Error(created.error.message);
      return created.data.id as string;
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
        .order('created_at', { ascending: false });
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
    queryFn: async () => {
      const convs = await supabase
        .from('conversations')
        .select('id, participant_one, participant_two, last_message_at')
        .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
        .order('last_message_at', { ascending: false });
      if (convs.error) throw new Error(convs.error.message);
      const rows = (convs.data ?? []) as {
        id: string;
        participant_one: string;
        participant_two: string;
        last_message_at: string | null;
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
