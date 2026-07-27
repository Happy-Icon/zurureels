import type { ExperienceRow, ReelRow } from '@/lib/supabase';

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

export const filterService = {
  /**
   * Filter reels/experiences based on active SearchFilters
   */
  applyFilters(reels: ReelRow[], filters: SearchFilters): ReelRow[] {
    let result = [...reels];

    // 1. Category Filter
    if (filters.category) {
      const catLower = filters.category.toLowerCase();
      result = result.filter(
        (r) =>
          r.category?.toLowerCase() === catLower ||
          (r.experience as any)?.category?.toLowerCase() === catLower,
      );
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
        return selectedCities.some((city) => loc.includes(city));
      });
    }

    // 4. Rating Filter
    if (filters.minRating != null) {
      const minR = filters.minRating;
      result = result.filter((r) => {
        const rating = (r.experience?.metadata as { rating?: number } | null)?.rating ?? 4.9;
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
      const ratingA = (a.experience?.metadata as { rating?: number } | null)?.rating ?? 4.9;
      const ratingB = (b.experience?.metadata as { rating?: number } | null)?.rating ?? 4.9;

      switch (filters.sortBy) {
        case 'price_asc':
          return priceA - priceB;
        case 'price_desc':
          return priceB - priceA;
        case 'rating':
          return ratingB - ratingA;
        case 'popular':
          return (b.duration || 0) - (a.duration || 0);
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
    if ((filters.minPrice ?? 0) > 0 || (filters.maxPrice ?? 150000) < 150000) count++;
    if (filters.cities && filters.cities.length > 0) count += filters.cities.length;
    if (filters.minRating != null) count++;
    if (filters.amenities && filters.amenities.length > 0) count += filters.amenities.length;
    if (filters.hostType && filters.hostType.length > 0) count += filters.hostType.length;
    if (filters.propertyType) count++;
    return count;
  },
};
