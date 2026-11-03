import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

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
  enabled = true,
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
        },
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
        },
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
        },
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
