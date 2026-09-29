/**
 * usePersonalizedFeed Hook
 * AI-assisted personalization of real ZuruSasa reels.
 *
 * Architecture:
 * - Uses existing Reel metadata and real user interaction data (likes, saves).
 * - Fable 5.1 computes category & location affinities server-side (cached for 1 hour in Redis).
 * - Normal ranking logic on client/DB handles high-frequency feed retrieval.
 * - ZERO Fable API calls on reel swipes.
 * - ZERO fake reels generated.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReels } from '@/lib/queries';
import { zuruAIService } from '@/services/zuruAIService';
import type { ReelRow } from '@/lib/supabase';

export function usePersonalizedReels(userId?: string) {
  const reelsQuery = useReels();

  const affinitiesQuery = useQuery({
    queryKey: ['ai-personalization-affinities', userId],
    enabled: Boolean(userId),
    staleTime: 60 * 60 * 1000, // 1 hour
    queryFn: async () => {
      if (!userId) return { categoryAffinities: {}, locationAffinities: {} };
      return await zuruAIService.getPersonalizationAffinities(userId);
    },
  });

  const personalizedReels = useMemo<ReelRow[]>(() => {
    const rawReels = reelsQuery.data ?? [];
    if (!rawReels.length) return rawReels;

    const affinities = affinitiesQuery.data;
    const catAffinities = affinities?.categoryAffinities ?? {};
    const locAffinities = affinities?.locationAffinities ?? {};

    const hasAffinities =
      Object.keys(catAffinities).length > 0 ||
      Object.keys(locAffinities).length > 0;

    if (!hasAffinities) {
      return rawReels;
    }

    // Rank candidate real reels based on user AI affinity weights
    return [...rawReels].sort((a, b) => {
      const catA = (a.category || (a.experience as any)?.category || '').toLowerCase();
      const catB = (b.category || (b.experience as any)?.category || '').toLowerCase();
      const locA = (a.experience?.location || '').toLowerCase();
      const locB = (b.experience?.location || '').toLowerCase();


      const weightCatA = catAffinities[catA] || 0;
      const weightCatB = catAffinities[catB] || 0;

      let weightLocA = 0;
      let weightLocB = 0;
      for (const [loc, w] of Object.entries(locAffinities)) {
        const l = loc.toLowerCase();
        if (locA.includes(l)) weightLocA = Math.max(weightLocA, w);
        if (locB.includes(l)) weightLocB = Math.max(weightLocB, w);
      }

      const scoreA = weightCatA * 2.0 + weightLocA * 1.5;
      const scoreB = weightCatB * 2.0 + weightLocB * 1.5;

      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      // Secondary sort: keep newer reels first
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [reelsQuery.data, affinitiesQuery.data]);

  return {
    reels: personalizedReels,
    isLoading: reelsQuery.isLoading,
    isError: reelsQuery.isError,
    refetch: reelsQuery.refetch,
    persona: affinitiesQuery.data?.persona,
  };
}
