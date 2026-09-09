import { useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchServerCachedQuery, invalidateServerCache } from '@/lib/redis';
import { notificationService } from '@/services/notificationService';
import { emailService } from '@/services/emailService';
import { resolveAvatarUrl } from '@/lib/avatar';
import {
  supabase,
  type BookingRow,
  type ConversationRow,
  type EventRow,
  type ExperienceRow,
  type HostBlockedDateRow,
  type MessageRow,
  type ProfileRow,
  type ReelRow,
} from '@/lib/supabase';

export function useReels() {
  return useQuery<ReelRow[]>({
    queryKey: ['reels'],
    queryFn: async () => {
      const rawReels = await fetchServerCachedQuery('get_reels_feed', async () => {
        const { data, error } = await supabase
          .from('reels')
          .select(
            `*,
            experience:experiences(id, title, description, location, current_price, price_unit, availability_status, metadata),
            host:profiles!reels_user_id_profiles_fkey(id, full_name, email, verification_status, is_verified, metadata, created_at, role)`,
          )
          .in('status', ['active', 'published'])
          .order('created_at', { ascending: false })
          .limit(30);
        if (error) throw new Error(error.message);
        return (data as unknown as ReelRow[]) ?? [];
      });

      const reels = (rawReels as unknown as ReelRow[]) ?? [];
      if (reels.length === 0) return [];

      // Collect host IDs to enrich with complete profile data (guaranteeing email, metadata, avatar)
      const hostIds = Array.from(
        new Set(
          reels
            .map((r) => r.user_id || r.host?.id)
            .filter(Boolean) as string[]
        )
      );

      if (hostIds.length > 0) {
        try {
          const { data: profiles, error: pErr } = await supabase
            .from('profiles')
            .select('id, full_name, email, verification_status, is_verified, metadata, created_at, role')
            .in('id', hostIds);

          if (!pErr && profiles) {
            const profileMap = new Map<string, ProfileRow>();
            for (const p of profiles) {
              profileMap.set(p.id, p as ProfileRow);
            }

            for (const reel of reels) {
              const hid = reel.user_id || reel.host?.id;
              const fullProfile = hid ? profileMap.get(hid) : null;
              const mergedHost = {
                ...(reel.host || {}),
                ...(fullProfile || {}),
                id: hid || (reel.host?.id ?? ''),
              };
              const resolvedAvatar = resolveAvatarUrl(mergedHost);
              reel.host = {
                ...mergedHost,
                avatar_url: resolvedAvatar || (mergedHost as any).avatar_url || null,
              } as ReelRow['host'];
            }
          }
        } catch (err) {
          console.warn('[useReels] Error enriching host profiles:', err);
        }
      }

      return reels;
    },
  });
}

export function useRefreshReels() {
  const queryClient = useQueryClient();

  return useCallback(async (currentActiveId?: string) => {
    // 1. Invalidate Redis server cache
    invalidateServerCache('invalidate_reels_feed').catch(() => {});

    // 2. Query fresh reels directly from PostgreSQL database to guarantee absolute latest data
    const { data, error } = await supabase
      .from('reels')
      .select(
        `*,
        experience:experiences(id, title, description, location, current_price, price_unit, availability_status, metadata),
        host:profiles!reels_user_id_profiles_fkey(id, full_name, email, verification_status, is_verified, metadata, created_at, role)`,
      )
      .in('status', ['active', 'published'])
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw new Error(error.message);

    let reels = (data as unknown as ReelRow[]) ?? [];
    if (reels.length > 0) {
      const hostIds = Array.from(
        new Set(
          reels
            .map((r) => r.user_id || r.host?.id)
            .filter(Boolean) as string[]
        )
      );

      if (hostIds.length > 0) {
        try {
          const { data: profiles, error: pErr } = await supabase
            .from('profiles')
            .select('id, full_name, email, verification_status, is_verified, metadata, created_at, role')
            .in('id', hostIds);

          if (!pErr && profiles) {
            const profileMap = new Map<string, ProfileRow>();
            for (const p of profiles) {
              profileMap.set(p.id, p as ProfileRow);
            }

            for (const reel of reels) {
              const hid = reel.user_id || reel.host?.id;
              const fullProfile = hid ? profileMap.get(hid) : null;
              const mergedHost = {
                ...(reel.host || {}),
                ...(fullProfile || {}),
                id: hid || (reel.host?.id ?? ''),
              };
              const resolvedAvatar = resolveAvatarUrl(mergedHost);
              reel.host = {
                ...mergedHost,
                avatar_url: resolvedAvatar || (mergedHost as any).avatar_url || null,
              } as ReelRow['host'];
            }
          }
        } catch (err) {
          console.warn('[useRefreshReels] Error enriching host profiles:', err);
        }
      }

      // Dynamic Feed Rotation (TikTok-style):
      // When refreshed, guarantee that the new active feed displays a DIFFERENT reel at index 0
      if (reels.length > 1) {
        const candidateIndices: number[] = [];
        for (let i = 0; i < reels.length; i++) {
          if (!currentActiveId || reels[i].id !== currentActiveId) {
            candidateIndices.push(i);
          }
        }
        if (candidateIndices.length > 0) {
          const chosenIndex =
            candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
          if (chosenIndex > 0) {
            reels = [...reels.slice(chosenIndex), ...reels.slice(0, chosenIndex)];
          }
        }
      }
    }

    // 3. Update React Query cache immediately with fresh rotated reels
    queryClient.setQueryData(['reels'], reels);
    return reels;
  }, [queryClient]);
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
          experience:experiences(id, title, location, current_price, price_unit, image_url, entity_name, max_guests, check_in_time, check_out_time, cancellation_policy, house_rules, arrival_instructions, checkout_instructions, amenities, metadata)`,
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
    const channel = supabase.channel(channelName)
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
      const nextLiked = !liked;
      if (prev) {
        queryClient.setQueryData<ReelInteractions>(key, {
          ...prev,
          liked: nextLiked,
          likeCount: Math.max(0, prev.likeCount + (nextLiked ? 1 : -1)),
        });
      }
      queryClient.setQueriesData<Record<string, ReelInteractions>>(
        { queryKey: ['batch-reel-interactions'] },
        (old) => {
          if (!old) return old;
          const current = old[reelId] ?? { likeCount: 0, liked: false, saved: false, following: false };
          return {
            ...old,
            [reelId]: {
              ...current,
              liked: nextLiked,
              likeCount: Math.max(0, current.likeCount + (nextLiked ? 1 : -1)),
            },
          };
        }
      );
      return { key, prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['reel-interactions', vars.reelId],
      });
      queryClient.invalidateQueries({
        queryKey: ['batch-reel-interactions'],
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
          .upsert({ reel_id: reelId, user_id: userId }, { onConflict: 'user_id,reel_id' });
        if (error && error.code !== '23505') throw new Error(error.message);
      }
    },
    onMutate: async ({ reelId, userId, saved }) => {
      const key = interactionsKey(reelId, userId);
      const prev = queryClient.getQueryData<ReelInteractions>(key);
      const nextSaved = !saved;
      if (prev) {
        queryClient.setQueryData<ReelInteractions>(key, { ...prev, saved: nextSaved });
      }
      queryClient.setQueriesData<Record<string, ReelInteractions>>(
        { queryKey: ['batch-reel-interactions'] },
        (old) => {
          if (!old) return old;
          const current = old[reelId] ?? { likeCount: 0, liked: false, saved: false, following: false };
          return {
            ...old,
            [reelId]: {
              ...current,
              saved: nextSaved,
            },
          };
        }
      );
      return { key, prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['reel-interactions', vars.reelId],
      });
      queryClient.invalidateQueries({
        queryKey: ['batch-reel-interactions'],
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
          .upsert({ follower_id: userId, following_id: hostId }, { onConflict: 'follower_id,following_id' });
        if (error && error.code !== '23505') throw new Error(error.message);
      }
    },
    onMutate: async ({ reelId, userId, following }) => {
      const key = interactionsKey(reelId, userId);
      const prev = queryClient.getQueryData<ReelInteractions>(key);
      const nextFollowing = !following;
      if (prev) {
        queryClient.setQueryData<ReelInteractions>(key, {
          ...prev,
          following: nextFollowing,
        });
      }
      queryClient.setQueriesData<Record<string, ReelInteractions>>(
        { queryKey: ['batch-reel-interactions'] },
        (old) => {
          if (!old) return old;
          const updated = { ...old };
          for (const rid of Object.keys(updated)) {
            if (rid === reelId) {
              updated[rid] = { ...updated[rid], following: nextFollowing };
            }
          }
          return updated;
        }
      );
      return { key, prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['reel-interactions', vars.reelId],
      });
      queryClient.invalidateQueries({
        queryKey: ['batch-reel-interactions'],
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


export function useSavedReels(userId: string | undefined) {
  return useQuery<ReelRow[]>({
    queryKey: ['saved-reels', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: saves, error: savesErr } = await supabase
        .from('reel_saves')
        .select('reel_id')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (savesErr) throw new Error(savesErr.message);
      const reelIds = (saves ?? []).map((s) => s.reel_id).filter(Boolean);
      if (reelIds.length === 0) return [];

      const { data, error } = await supabase
        .from('reels')
        .select(
          `
          *,
          experience:experiences(*),
          host:profiles!reels_user_id_fkey(*)
        `,
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
            avatar_url: resolveAvatarUrl(p as any) ?? metadata?.avatar_url ?? null,
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

// ---- Direct Chat Room Queries & Mutations ----

export function useMessages(conversationId: string | undefined) {
  return useQuery<MessageRow[]>({
    queryKey: ['messages', conversationId],
    enabled: !!conversationId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true });

      if (error) throw new Error(error.message);
      return (data as unknown as MessageRow[]) ?? [];
    },
  });
}

export interface SendMessageInput {
  conversationId: string;
  senderId: string;
  content: string;
  imageUrl?: string | null;
  recipientId?: string;
  senderName?: string;
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      const now = new Date().toISOString();

      // 1. Insert message
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: input.conversationId,
          sender_id: input.senderId,
          content: input.content,
          image_url: input.imageUrl ?? null,
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);

      // 2. Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: now })
        .eq('id', input.conversationId);

      // 3. Resolve recipient if not provided
      let recipientId = input.recipientId;
      if (!recipientId) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('participant_one, participant_two')
          .eq('id', input.conversationId)
          .maybeSingle();

        if (conv) {
          recipientId = conv.participant_one === input.senderId ? conv.participant_two : conv.participant_one;
        }
      }

      // 4. Trigger In-App + Push notification (non-blocking)
      if (recipientId && recipientId !== input.senderId) {
        const senderName = input.senderName || 'Someone';
        notificationService
          .createNotification({
            userId: recipientId,
            type: 'message',
            title: `New message from ${senderName}`,
            message: input.content || (input.imageUrl ? 'Sent a photo' : 'New message'),
            actionType: 'chat',
            actionId: input.conversationId,
            metadata: {
              conversation_id: input.conversationId,
              sender_id: input.senderId,
              sender_name: senderName,
            },
          })
          .catch((e) => console.warn('Message notification warning:', e));
      }

      return data as unknown as MessageRow;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['messages', data.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
    },
  });
}

export function useMarkMessagesRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, userId }: { conversationId: string; userId: string }) => {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
        .eq('is_read', false);

      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['messages', vars.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
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

export function useGuestCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason?: string }) => {
      const { data, error } = await supabase.rpc('guest_cancel_booking', {
        p_booking_id: bookingId,
        p_reason: reason ?? 'Guest cancelled reservation',
      });
      if (error) throw new Error(error.message);

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
          experience:experiences(id, title, location, current_price, price_unit, image_url, entity_name, max_guests, check_in_time, check_out_time, cancellation_policy, house_rules, arrival_instructions, checkout_instructions, amenities, metadata)`
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
            `experience_id.in.(${bookingExpIds.join(',')}),id.in.(${bookingReelIds.join(',')})`
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
    const channel = supabase.channel(channelName)
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
