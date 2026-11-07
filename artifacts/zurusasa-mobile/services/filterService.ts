import { resolveAvatarUrl } from '@/lib/avatar';
import { getReelExpiryCutoffIso } from '@/lib/reelExpiry';
import { supabase, type ReelRow } from '@/lib/supabase';

export interface SearchFilters {
  category?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  cities?: string[];
  minRating?: number | null;
  guests?: number | null;
  amenities?: string[];
  hostType?: ('super_host' | 'verified' | 'instant_book')[];
  propertyType?: string | null;
  sortBy?: 'recommended' | 'popular' | 'rating' | 'price_asc' | 'price_desc' | 'newest';
}

export interface ServerFilterOptions {
  searchQuery?: string;
  categories?: readonly string[];
  excludeExpired?: boolean;
  limit?: number;
}

export const DEFAULT_FILTERS: SearchFilters = {
  category: null,
  minPrice: 0,
  maxPrice: 150000,
  cities: [],
  minRating: null,
  guests: 1,
  amenities: [],
  hostType: [],
  propertyType: null,
  sortBy: 'recommended',
};

const MAX_DEFAULT_PRICE = 150000;

const CATEGORY_ALIAS_GROUPS: Record<string, readonly string[]> = {
  stay: ['stay', 'stays', 'hotel', 'villa', 'apartment', 'parks_camps'],
  stays: ['stay', 'stays', 'hotel', 'villa', 'apartment', 'parks_camps'],
  tour: ['tour', 'tours', 'land_adventure', 'air_adventure', 'water_adventure'],
  tours: ['tour', 'tours', 'land_adventure', 'air_adventure', 'water_adventure'],
  boat: ['boat', 'boats', 'water_adventure'],
  boats: ['boat', 'boats', 'water_adventure'],
  event: ['event', 'events'],
  events: ['event', 'events'],
  food: ['food', 'restaurant'],
  nightlife: ['nightlife', 'drinks'],
};

export function expandCategoryAliases(categories: readonly string[]): string[] {
  const expanded = new Set<string>();
  for (const raw of categories) {
    const normalized = raw.trim().toLowerCase();
    if (!normalized || normalized === 'all') continue;
    expanded.add(normalized);
    const aliases = CATEGORY_ALIAS_GROUPS[normalized];
    if (aliases) {
      for (const alias of aliases) {
        expanded.add(alias);
      }
    }
  }
  return Array.from(expanded);
}

function sanitizePostgrestLikeToken(value: string): string {
  return value.replace(/[,()*%\\]/g, '').trim();
}

function resolveEffectiveCategories(
  filters: SearchFilters,
  tabCategories?: readonly string[],
): string[] | null {
  const filterCats = filters.category ? expandCategoryAliases([filters.category]) : null;
  const hasTabCats =
    Boolean(tabCategories && tabCategories.length > 0 && !tabCategories.includes('all'));
  const expandedTabCats = hasTabCats ? expandCategoryAliases(tabCategories!) : null;

  if (filterCats && expandedTabCats) {
    const tabSet = new Set(expandedTabCats);
    return filterCats.filter((c) => tabSet.has(c));
  }
  return filterCats ?? expandedTabCats;
}

export function computeReelEngagementScore(reel: any): number {
  if (!reel) return 0;
  const likes = Number(reel.likes_count ?? reel.likes ?? 0);
  const saves = Number(reel.saves_count ?? reel.saves ?? 0);
  const shares = Number(reel.shares_count ?? reel.shares ?? 0);
  const views = Number(reel.views_count ?? reel.views ?? 0);
  return likes * 2 + saves * 3 + shares * 4 + views * 0.1;
}

export const filterService = {
  /**
   * Returns true when active filters/categories contain SQL-pushable predicates
   * (category, price range, cities, or opt-in 90-day expiry cutoff).
   */
  hasServerPushablePredicates(
    filters: SearchFilters,
    options?: ServerFilterOptions,
  ): boolean {
    if (options?.excludeExpired === true) return true;
    if (filters.category) return true;
    if (
      options?.categories &&
      options.categories.length > 0 &&
      !options.categories.includes('all')
    ) {
      return true;
    }
    if ((filters.minPrice ?? 0) > 0) return true;
    if ((filters.maxPrice ?? MAX_DEFAULT_PRICE) < MAX_DEFAULT_PRICE) return true;
    if (filters.cities && filters.cities.length > 0) return true;
    return false;
  },

  /**
   * Server-side PostgREST predicate pushdown for Discover & Search filters.
   * Pushes status, optional 90-day expiry cutoff, category, price range, and city
   * predicates to PostgreSQL before applying client-side JSONB refinement & sorting.
   */
  async fetchServerFilteredReels(
    filters: SearchFilters,
    options?: ServerFilterOptions,
  ): Promise<ReelRow[]> {
    const effectiveCategories = resolveEffectiveCategories(filters, options?.categories);
    if (effectiveCategories && effectiveCategories.length === 0) {
      return [];
    }

    const minPrice = filters.minPrice ?? 0;
    const maxPrice = filters.maxPrice ?? MAX_DEFAULT_PRICE;
    const sanitizedCities = (filters.cities ?? [])
      .map(sanitizePostgrestLikeToken)
      .filter((c) => c.length > 0);

    const hasExperiencePredicate =
      minPrice > 0 || maxPrice < MAX_DEFAULT_PRICE || sanitizedCities.length > 0;

    const selectClause = hasExperiencePredicate
      ? `*,
        experience:experiences!inner(id, title, entity_name, description, location, city, formatted_address, country_code, display_latitude, display_longitude, location_precision, current_price, price_unit, availability_status, image_url, max_guests, min_stay_nights, max_stay_nights, check_in_time, check_out_time, booking_mode, cancellation_policy, house_rules, arrival_instructions, checkout_instructions, amenities, metadata),
        host:profiles!reels_user_id_profiles_fkey(id, full_name, email, verification_status, is_verified, metadata, created_at, bio, role)`
      : `*,
        experience:experiences(id, title, entity_name, description, location, city, formatted_address, country_code, display_latitude, display_longitude, location_precision, current_price, price_unit, availability_status, image_url, max_guests, min_stay_nights, max_stay_nights, check_in_time, check_out_time, booking_mode, cancellation_policy, house_rules, arrival_instructions, checkout_instructions, amenities, metadata),
        host:profiles!reels_user_id_profiles_fkey(id, full_name, email, verification_status, is_verified, metadata, created_at, bio, role)`;

    let query = supabase
      .from('reels')
      .select(selectClause)
      .in('status', ['active', 'published']);

    if (options?.excludeExpired === true) {
      query = query.gte('created_at', getReelExpiryCutoffIso());
    }

    if (effectiveCategories && effectiveCategories.length > 0) {
      query = query.in('category', effectiveCategories);
    }

    if (minPrice > 0) {
      query = query.gte('experience.current_price', minPrice);
    }

    if (maxPrice < MAX_DEFAULT_PRICE) {
      query = query.lte('experience.current_price', maxPrice);
    }

    if (sanitizedCities.length > 0) {
      const orClause = sanitizedCities
        .flatMap((city) => [`location.ilike.%${city}%`, `city.ilike.%${city}%`])
        .join(',');
      query = query.or(orClause, { referencedTable: 'experience' });
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(options?.limit ?? 80);

    if (error) {
      throw new Error(error.message);
    }

    let reels = ((data ?? []) as unknown as ReelRow[]).map((reel) => {
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

    const q = (options?.searchQuery ?? '').trim().toLowerCase();
    if (q) {
      reels = reels.filter((r) => {
        const cat = (r.category ?? '').toLowerCase();
        const title = (r.experience?.title ?? '').toLowerCase();
        const desc = (r.experience?.description ?? '').toLowerCase();
        const loc = (r.experience?.location ?? '').toLowerCase();
        return title.includes(q) || desc.includes(q) || loc.includes(q) || cat.includes(q);
      });
    }

    return this.applyFilters(reels, filters);
  },

  /**
   * Filter reels/experiences based on active SearchFilters
   */
  applyFilters(reels: ReelRow[], filters: SearchFilters): ReelRow[] {
    let result = [...reels];

    // 1. Category Filter (with singular/plural & umbrella alias expansion)
    if (filters.category) {
      const allowedCategories = new Set(expandCategoryAliases([filters.category]));
      result = result.filter((r) => {
        const reelCat = (r.category ?? '').toLowerCase();
        const expCat = ((r.experience as any)?.category ?? '').toLowerCase();
        return allowedCategories.has(reelCat) || (expCat !== '' && allowedCategories.has(expCat));
      });
    }

    // 2. Price Range Filter
    if (filters.minPrice != null || filters.maxPrice != null) {
      const minP = filters.minPrice ?? 0;
      const maxP = filters.maxPrice ?? Infinity;
      result = result.filter((r) => {
        const price = r.experience?.current_price ?? 0;
        return price >= minP && price <= maxP;
      });
    }

    // 3. Cities / Locations Filter
    if (filters.cities && filters.cities.length > 0) {
      const selectedCities = filters.cities.map((c) => c.toLowerCase());
      result = result.filter((r) => {
        const loc = (r.experience?.location ?? '').toLowerCase();
        const cityCol = (r.experience?.city ?? '').toLowerCase();
        const addr = (r.experience?.formatted_address ?? '').toLowerCase();
        return selectedCities.some(
          (city) => loc.includes(city) || cityCol.includes(city) || addr.includes(city),
        );
      });
    }

    // 4. Rating Filter
    if (filters.minRating != null) {
      const minR = filters.minRating;
      result = result.filter((r) => {
        const expRating = (r.experience as any)?.rating;
        const metaRating = (r.experience?.metadata as { rating?: number } | null)?.rating;
        const rating = typeof expRating === 'number' ? expRating : typeof metaRating === 'number' ? metaRating : 0;
        return rating >= minR;
      });
    }

    // 5. Amenities Filter
    if (filters.amenities && filters.amenities.length > 0) {
      const requiredAmenities = filters.amenities.map((a) => a.toLowerCase());
      result = result.filter((r) => {
        const itemMeta = (r.experience?.metadata ?? {}) as Record<string, unknown>;
        const itemAmenities = ((itemMeta.amenities as string[]) || []).map((a) => a.toLowerCase());
        return requiredAmenities.every((req) => itemAmenities.includes(req));
      });
    }

    // 6. Host Type Filter
    if (filters.hostType && filters.hostType.length > 0) {
      result = result.filter((r) => {
        const hostMeta = (r.host?.metadata ?? {}) as Record<string, unknown>;
        const isSuperHost = Boolean(hostMeta.is_super_host ?? true);
        const isVerified = r.host?.verification_status === 'verified';
        const isInstant = Boolean(hostMeta.instant_book ?? true);

        if (filters.hostType!.includes('super_host') && !isSuperHost) return false;
        if (filters.hostType!.includes('verified') && !isVerified) return false;
        if (filters.hostType!.includes('instant_book') && !isInstant) return false;
        return true;
      });
    }

    // 7. Sorting
    result.sort((a, b) => {
      const priceA = a.experience?.current_price ?? 0;
      const priceB = b.experience?.current_price ?? 0;
      const ratingA =
        (a.experience as any)?.rating ??
        (a.experience?.metadata as { rating?: number } | null)?.rating ??
        0;
      const ratingB =
        (b.experience as any)?.rating ??
        (b.experience?.metadata as { rating?: number } | null)?.rating ??
        0;

      switch (filters.sortBy) {
        case 'price_asc':
          return priceA - priceB;
        case 'price_desc':
          return priceB - priceA;
        case 'rating':
          return ratingB - ratingA;
        case 'popular': {
          const engA = computeReelEngagementScore(a);
          const engB = computeReelEngagementScore(b);
          if (engB !== engA) return engB - engA;
          return ratingB - ratingA;
        }
        case 'newest':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case 'recommended':
        default:
          return ratingB - ratingA;
      }
    });

    return result;
  },

  /**
   * Count how many non-default filter parameters are currently applied
   */
  getAppliedFilterCount(filters: SearchFilters): number {
    let count = 0;
    if (filters.category) count++;
    if ((filters.minPrice ?? 0) > 0 || (filters.maxPrice ?? MAX_DEFAULT_PRICE) < MAX_DEFAULT_PRICE) count++;
    if (filters.cities && filters.cities.length > 0) count += filters.cities.length;
    if (filters.minRating != null) count++;
    if (filters.amenities && filters.amenities.length > 0) count += filters.amenities.length;
    if (filters.hostType && filters.hostType.length > 0) count += filters.hostType.length;
    if (filters.propertyType) count++;
    return count;
  },
};
