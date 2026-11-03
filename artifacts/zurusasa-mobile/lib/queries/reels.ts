import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { resolveAvatarUrl } from '@/lib/avatar';
import { fetchServerCachedQuery, invalidateServerCache } from '@/lib/redis';
import { getReelExpiryCutoffIso } from '@/lib/reelExpiry';
import {
  supabase,
  type EventRow,
  type ExperienceRow,
  type ReelRow,
} from '@/lib/supabase';

export function enrichReelHosts(reels: ReelRow[]): ReelRow[] {
  return reels.map((reel) => {
    const hid = reel.user_id || reel.host?.id;
    if (!reel.host && !hid) return reel;
    const mergedHost = {
      ...(reel.host || {}),
      id: hid || (reel.host?.id ?? ''),
    };
    const resolvedAvatar = resolveAvatarUrl(mergedHost);
    return {
      ...reel,
      host: {
        ...mergedHost,
        avatar_url: resolvedAvatar || (mergedHost as any).avatar_url || null,
      } as ReelRow['host'],
    };
  });
}

export function useReels(options?: { excludeExpired?: boolean }) {
  const excludeExpired = options?.excludeExpired === true;
  return useQuery<ReelRow[]>({
    queryKey: excludeExpired ? ['reels', { excludeExpired: true }] : ['reels'],
    queryFn: async () => {
      const rawReels = await fetchServerCachedQuery(
        'get_reels_feed',
        async () => {
          let query = supabase
            .from('reels')
            .select(
              `*,
              experience:experiences(id, title, description, location, current_price, price_unit, availability_status, metadata),
              host:profiles!reels_user_id_profiles_fkey(id, full_name, email, verification_status, is_verified, metadata, created_at, role)`,
            )
            .in('status', ['active', 'published']);

          if (excludeExpired) {
            query = query.gte('created_at', getReelExpiryCutoffIso());
          }

          const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(30);
          if (error) throw new Error(error.message);
          return (data as unknown as ReelRow[]) ?? [];
        },
        excludeExpired ? { excludeExpired: true } : undefined,
      );

      const reels = (rawReels as unknown as ReelRow[]) ?? [];
      if (reels.length === 0) return [];

      return enrichReelHosts(reels);
    },
  });
}

export function useRefreshReels() {
  const queryClient = useQueryClient();

  return useCallback(async (currentActiveId?: string, options?: { excludeExpired?: boolean }) => {
    const excludeExpired = options?.excludeExpired === true;

    // 1. Invalidate Redis server cache
    invalidateServerCache('invalidate_reels_feed').catch(() => {});

    // 2. Query fresh reels directly from PostgreSQL database with joined host profile
    let query = supabase
      .from('reels')
      .select(
        `*,
        experience:experiences(id, title, description, location, current_price, price_unit, availability_status, metadata),
        host:profiles!reels_user_id_profiles_fkey(id, full_name, email, verification_status, is_verified, metadata, created_at, role)`,
      )
      .in('status', ['active', 'published']);

    if (excludeExpired) {
      query = query.gte('created_at', getReelExpiryCutoffIso());
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw new Error(error.message);

    let reels = enrichReelHosts((data as unknown as ReelRow[]) ?? []);
    if (reels.length > 1) {
      // Dynamic Feed Rotation (TikTok-style):
      // When refreshed, guarantee that the new active feed displays a DIFFERENT reel at index 0
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

    // 3. Update React Query cache immediately with fresh rotated reels
    queryClient.setQueryData(
      excludeExpired ? ['reels', { excludeExpired: true }] : ['reels'],
      reels,
    );
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
        { category: category ?? 'all' },
      );
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
          host:profiles!reels_user_id_profiles_fkey(id, full_name, email, verification_status, is_verified, metadata, created_at, role)
        `,
        )
        .in('id', reelIds);
      if (error) throw new Error(error.message);

      // Enrich host avatar URLs consistently
      const resolvedRows = ((data ?? []) as unknown as ReelRow[]).map((r) => {
        if (r.host) {
          r.host = {
            ...r.host,
            avatar_url: resolveAvatarUrl(r.host),
          };
        }
        return r;
      });

      // Preserve most-recently-saved-first ordering from reel_saves.
      const byId = new Map(
        resolvedRows.map((r) => [r.id, r]),
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
