import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { resolveAvatarUrl } from '@/lib/avatar';
import { fetchServerCachedQuery, invalidateServerCache } from '@/lib/redis';
import { getReelExpiryCutoffIso } from '@/lib/reelExpiry';
import {
  isEventActive,
  isOfferActive,
  resolveReelContentType,
} from '@/constants/taxonomy';
import {
  supabase,
  type EventRow,
  type ExperienceRow,
  type ReelRow,
  type SpecialOfferRow,
} from '@/lib/supabase';

const REEL_EXPERIENCE_SELECT =
  'id, title, entity_name, category, description, location, city, formatted_address, country_code, display_latitude, display_longitude, location_precision, current_price, price_unit, availability_status, image_url, max_guests, min_stay_nights, max_stay_nights, check_in_time, check_out_time, booking_mode, cancellation_policy, house_rules, arrival_instructions, checkout_instructions, amenities, metadata';

export function filterActivePromotionalReels(reels: ReelRow[]): ReelRow[] {
  return reels.filter((reel) => {
    const contentType = resolveReelContentType(reel);
    const meta = (reel.experience?.metadata ?? {}) as Record<string, unknown>;

    if (contentType === 'event') {
      const evDetails = (meta.event_details ?? {}) as Record<string, unknown>;
      return isEventActive(
        reel.event?.event_date ?? (evDetails.event_date as string | undefined),
        reel.event?.end_date ?? (evDetails.end_date as string | undefined),
        reel.event?.expires_at ?? (evDetails.expires_at as string | undefined) ?? reel.expires_at,
        reel.event?.status ?? (evDetails.status as string | undefined),
      );
    }

    if (contentType === 'special_offer') {
      const offDetails = (meta.offer_details ?? {}) as Record<string, unknown>;
      return isOfferActive(
        reel.offer?.expires_at ?? (offDetails.expires_at as string | undefined) ?? reel.expires_at,
        reel.offer?.status ?? (offDetails.status as string | undefined),
      );
    }

    return true;
  });
}

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

export function extractEventFromReel(reel: ReelRow): EventRow | null {
  if (resolveReelContentType(reel) !== 'event') return null;
  const meta = (reel.experience?.metadata ?? {}) as Record<string, unknown>;
  const ev = (meta.event_details ?? {}) as Record<string, unknown>;
  const eventDate =
    reel.event?.event_date ??
    (ev.event_date as string | undefined) ??
    null;
  const endDate =
    reel.event?.end_date ??
    (ev.end_date as string | undefined) ??
    null;
  const expiresAt =
    reel.event?.expires_at ??
    (ev.expires_at as string | undefined) ??
    reel.expires_at ??
    null;
  const status =
    reel.event?.status ??
    (ev.status as string | undefined) ??
    'active';

  if (!isEventActive(eventDate, endDate, expiresAt, status)) {
    return null;
  }

  return {
    id: reel.event_id || (ev.event_id as string | undefined) || `reel-event-${reel.id}`,
    user_id: reel.user_id,
    experience_id: (ev.linked_experience_id as string | undefined) || reel.experience_id,
    title: reel.event?.title ?? reel.experience?.title ?? 'Upcoming Event',
    description: reel.event?.description ?? reel.experience?.description ?? null,
    category:
      reel.event?.category ??
      reel.subcategory ??
      (meta.subcategory as string | undefined) ??
      'events',
    event_date: eventDate,
    end_date: endDate,
    price: reel.event?.price ?? reel.experience?.current_price ?? 0,
    location: reel.event?.location ?? reel.experience?.location ?? reel.experience?.city ?? 'Kenya Coast',
    image_url: reel.event?.image_url ?? reel.thumbnail_url ?? reel.experience?.image_url ?? null,
    start_time: reel.event?.start_time ?? (ev.start_time as string | undefined) ?? null,
    organizer_name:
      reel.event?.organizer_name ??
      (ev.organizer_name as string | undefined) ??
      reel.experience?.entity_name ??
      reel.host?.full_name ??
      'Local Organizer',
    entry_conditions:
      reel.event?.entry_conditions ?? (ev.entry_conditions as string | undefined) ?? null,
    booking_instructions:
      reel.event?.booking_instructions ?? (ev.booking_instructions as string | undefined) ?? null,
    status,
    expires_at: expiresAt,
    reel_id: reel.id,
    experience: reel.experience
      ? {
          id: reel.experience.id,
          title: reel.experience.title,
          entity_name: reel.experience.entity_name,
          location: reel.experience.location,
          city: reel.experience.city,
          image_url: reel.experience.image_url,
          current_price: reel.experience.current_price,
          price_unit: reel.experience.price_unit,
          category: reel.experience.category,
        }
      : null,
  };
}

export function extractOfferFromReel(reel: ReelRow): SpecialOfferRow | null {
  if (resolveReelContentType(reel) !== 'special_offer') return null;
  const meta = (reel.experience?.metadata ?? {}) as Record<string, unknown>;
  const off = (meta.offer_details ?? {}) as Record<string, unknown>;
  const expiresAt =
    reel.offer?.expires_at ??
    (off.expires_at as string | undefined) ??
    reel.expires_at ??
    new Date(Date.now() + 7 * 86_400_000).toISOString();
  const status =
    reel.offer?.status ??
    (off.status as string | undefined) ??
    'active';

  if (!isOfferActive(expiresAt, status)) {
    return null;
  }

  return {
    id: reel.offer_id || (off.offer_id as string | undefined) || `reel-offer-${reel.id}`,
    user_id: reel.user_id ?? '',
    experience_id: (off.linked_experience_id as string | undefined) || reel.experience_id,
    title: reel.offer?.title ?? reel.experience?.title ?? 'Special Offer',
    description: reel.offer?.description ?? reel.experience?.description ?? null,
    offer_type:
      reel.offer?.offer_type ??
      (off.offer_type as string | undefined) ??
      reel.subcategory ??
      'happy_hour',
    discount_label:
      reel.offer?.discount_label ??
      (off.discount_label as string | undefined) ??
      'Limited Deal',
    original_price:
      reel.offer?.original_price ??
      (typeof off.original_price === 'number' ? off.original_price : null),
    offer_price:
      reel.offer?.offer_price ??
      (typeof off.offer_price === 'number' ? off.offer_price : reel.experience?.current_price ?? null),
    applicable_schedule:
      reel.offer?.applicable_schedule ??
      (off.applicable_schedule as string | undefined) ??
      null,
    terms_conditions:
      reel.offer?.terms_conditions ?? (off.terms_conditions as string | undefined) ?? null,
    redemption_instructions:
      reel.offer?.redemption_instructions ??
      (off.redemption_instructions as string | undefined) ??
      null,
    image_url: reel.offer?.image_url ?? reel.thumbnail_url ?? reel.experience?.image_url ?? null,
    expires_at: expiresAt,
    status,
    reel_id: reel.id,
    location: reel.experience?.location ?? reel.experience?.city ?? 'Kenya Coast',
    experience: reel.experience
      ? {
          id: reel.experience.id,
          title: (off.linked_experience_title as string | undefined) || reel.experience.title,
          entity_name: reel.experience.entity_name,
          location: reel.experience.location,
          city: reel.experience.city,
          image_url: reel.experience.image_url,
          current_price: reel.experience.current_price,
          price_unit: reel.experience.price_unit,
          category: reel.experience.category,
        }
      : null,
  };
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
              experience:experiences(${REEL_EXPERIENCE_SELECT}),
              host:profiles!reels_user_id_profiles_fkey(id, full_name, email, verification_status, is_verified, metadata, created_at, bio, role)`,
            )
            .in('status', ['active', 'published']);

          if (excludeExpired) {
            query = query.gte('created_at', getReelExpiryCutoffIso());
          }

          const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(40);
          if (error) throw new Error(error.message);
          return (data as unknown as ReelRow[]) ?? [];
        },
        excludeExpired ? { excludeExpired: true } : undefined,
      );

      const reels = (rawReels as unknown as ReelRow[]) ?? [];
      if (reels.length === 0) return [];

      return filterActivePromotionalReels(enrichReelHosts(reels));
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
        experience:experiences(${REEL_EXPERIENCE_SELECT}),
        host:profiles!reels_user_id_profiles_fkey(id, full_name, email, verification_status, is_verified, metadata, created_at, bio, role)`,
      )
      .in('status', ['active', 'published']);

    if (excludeExpired) {
      query = query.gte('created_at', getReelExpiryCutoffIso());
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(40);

    if (error) throw new Error(error.message);

    let reels = filterActivePromotionalReels(
      enrichReelHosts((data as unknown as ReelRow[]) ?? []),
    );
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
              'id, title, description, location, city, formatted_address, country_code, display_latitude, display_longitude, location_precision, current_price, price_unit, entity_name, category, availability_status, image_url, metadata',
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

export function useHostEstablishments(userId?: string | null) {
  return useQuery<ExperienceRow[]>({
    queryKey: ['host-establishments', userId ?? 'none'],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('experiences')
        .select('id, title, entity_name, category, location, city, current_price, price_unit, image_url, metadata')
        .eq('user_id', userId)
        .order('id', { ascending: false })
        .limit(40);
      if (error) return [];
      return ((data as ExperienceRow[]) ?? []).filter((exp) => {
        const metaType = String((exp.metadata as Record<string, unknown> | null)?.content_type || '').toLowerCase();
        return metaType !== 'event' && metaType !== 'special_offer';
      });
    },
  });
}

export function useUpcomingEvents(options?: { city?: string | null; fallbackReels?: ReelRow[] }) {
  const city = options?.city ?? null;
  return useQuery<EventRow[]>({
    queryKey: ['upcoming-events', city ?? 'all'],
    staleTime: 60_000,
    queryFn: async () => {
      const merged = new Map<string, EventRow>();

      // 1. Query normalized events table directly (handles both migrated and legacy schema)
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('event_date', { ascending: true })
          .limit(30);

        if (!error && Array.isArray(data)) {
          for (const row of data as unknown as EventRow[]) {
            if (isEventActive(row.event_date, row.end_date, row.expires_at, row.status)) {
              merged.set(row.id, row);
            }
          }
        }
      } catch {
        // Fallback silently to reel-derived events below
      }

      // 2. Also include event reels cached or returned directly
      const sourceReels = options?.fallbackReels ?? [];
      for (const reel of sourceReels) {
        const ev = extractEventFromReel(reel);
        if (ev && !merged.has(ev.id)) {
          merged.set(ev.id, ev);
        }
      }

      let list = Array.from(merged.values());
      if (city && city !== 'Current Location') {
        const q = city.trim().toLowerCase();
        const cityFiltered = list.filter((e) =>
          (e.location || '').toLowerCase().includes(q) ||
          (e.experience?.city || '').toLowerCase().includes(q),
        );
        if (cityFiltered.length > 0) {
          list = cityFiltered;
        }
      }

      return list.sort((a, b) => {
        const ta = a.event_date ? new Date(a.event_date).getTime() : Number.MAX_SAFE_INTEGER;
        const tb = b.event_date ? new Date(b.event_date).getTime() : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      });
    },
  });
}

export function useActiveSpecialOffers(options?: {
  city?: string | null;
  experienceId?: string | null;
  fallbackReels?: ReelRow[];
}) {
  const city = options?.city ?? null;
  const experienceId = options?.experienceId ?? null;

  return useQuery<SpecialOfferRow[]>({
    queryKey: ['active-special-offers', city ?? 'all', experienceId ?? 'all'],
    staleTime: 60_000,
    queryFn: async () => {
      const merged = new Map<string, SpecialOfferRow>();

      // 1. Try normalized special_offers table (graceful if migration not yet applied remotely)
      try {
        let query = supabase
          .from('special_offers')
          .select(
            '*, experience:experiences(id, title, entity_name, location, city, image_url, current_price, price_unit, category)',
          )
          .eq('status', 'active')
          .order('expires_at', { ascending: true })
          .limit(30);

        if (experienceId) {
          query = query.eq('experience_id', experienceId);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          for (const row of data as unknown as SpecialOfferRow[]) {
            if (isOfferActive(row.expires_at, row.status)) {
              merged.set(row.id, row);
            }
          }
        }
      } catch {
        // Fallback to reel/experience metadata below
      }

      // 2. Include special offer reels from fallbackReels
      for (const reel of options?.fallbackReels ?? []) {
        const off = extractOfferFromReel(reel);
        if (off && !merged.has(off.id)) {
          if (!experienceId || off.experience_id === experienceId) {
            merged.set(off.id, off);
          }
        }
      }

      let list = Array.from(merged.values());
      if (city && city !== 'Current Location') {
        const q = city.trim().toLowerCase();
        const cityFiltered = list.filter(
          (o) =>
            (o.location || '').toLowerCase().includes(q) ||
            (o.experience?.location || '').toLowerCase().includes(q) ||
            (o.experience?.city || '').toLowerCase().includes(q),
        );
        if (cityFiltered.length > 0) {
          list = cityFiltered;
        }
      }

      return list;
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
