import AsyncStorage from '@react-native-async-storage/async-storage';
import { type SearchFilters } from '@/services/filterService';

const RECENT_SEARCHES_KEY = 'zurusasa_recent_searches_v1';

export interface RecentSearchItem {
  id: string;
  query: string;
  timestamp: number;
}

export const POPULAR_DESTINATIONS = [
  { id: 'diani', name: 'Diani Beach', count: '142 stays', image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400' },
  { id: 'mombasa', name: 'Mombasa City', count: '98 stays', image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400' },
  { id: 'watamu', name: 'Watamu', count: '64 stays', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400' },
  { id: 'lamu', name: 'Lamu Island', count: '38 stays', image: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=400' },
  { id: 'nairobi', name: 'Nairobi', count: '210 stays', image: 'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=400' },
];

export const TRENDING_TAGS = [
  'Luxury Villa',
  'Boat Ride',
  'Snorkeling',
  'Safari',
  'Beachfront Apartment',
  'Sunset Cruise',
  'Private Pool',
  'Deep Sea Fishing',
];

export const searchService = {
  /**
   * Intelligently convert AI natural language prompt into structured SearchFilters
   * Example: "beachfront villa in Diani for 4 people under 15k"
   */
  parseNaturalLanguageQuery(query: string): Partial<SearchFilters> {
    const q = query.toLowerCase();
    const parsed: Partial<SearchFilters> = {};

    // 1. Detect City
    const cities = ['diani', 'mombasa', 'watamu', 'lamu', 'nairobi', 'kisumu', 'malindi'];
    const matchedCity = cities.find((c) => q.includes(c));
    if (matchedCity) {
      const formatted = matchedCity.charAt(0).toUpperCase() + matchedCity.slice(1);
      parsed.cities = [formatted];
    }

    // 2. Detect Max Price (e.g., "under 15k", "under 15000", "below 20,000")
    const priceMatch = q.match(/(?:under|below|less than|<|max)\s*kes?\s*(\d+)(k)?/i) || q.match(/(\d+)\s*k\b/i);
    if (priceMatch) {
      let num = parseInt(priceMatch[1], 10);
      if (priceMatch[2] || q.includes('k')) num *= 1000;
      parsed.maxPrice = num;
    }

    // 3. Detect Category / Property Type
    if (q.includes('villa') || q.includes('house')) parsed.category = 'stay';
    else if (q.includes('boat') || q.includes('cruise')) parsed.category = 'boat';
    else if (q.includes('tour') || q.includes('safari') || q.includes('snorkeling')) parsed.category = 'tour';
    else if (q.includes('event') || q.includes('concert')) parsed.category = 'event';

    // 4. Detect Amenities
    const amenities: string[] = [];
    if (q.includes('beach') || q.includes('beachfront')) amenities.push('Beach Front');
    if (q.includes('pool')) amenities.push('Pool');
    if (q.includes('wifi') || q.includes('internet')) amenities.push('Wi-Fi');
    if (q.includes('ac') || q.includes('air conditioning')) amenities.push('Air Conditioning');
    if (amenities.length > 0) parsed.amenities = amenities;

    // 5. Detect Guests
    const guestMatch = q.match(/(\d+)\s*(?:people|guests|persons|adults)/i);
    if (guestMatch) {
      parsed.guests = parseInt(guestMatch[1], 10);
    }

    return parsed;
  },

  /**
   * Fetch recent search history from AsyncStorage
   */
  async getRecentSearches(): Promise<RecentSearchItem[]> {
    try {
      const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /**
   * Save a new search query to history
   */
  async addRecentSearch(query: string): Promise<RecentSearchItem[]> {
    if (!query.trim()) return this.getRecentSearches();

    try {
      const current = await this.getRecentSearches();
      const filtered = current.filter((item) => item.query.toLowerCase() !== query.trim().toLowerCase());
      const updated: RecentSearchItem[] = [
        { id: `search-${Date.now()}`, query: query.trim(), timestamp: Date.now() },
        ...filtered,
      ].slice(0, 8); // Keep top 8 recent searches

      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    } catch {
      return [];
    }
  },

  /**
   * Clear all recent searches
   */
  async clearRecentSearches(): Promise<void> {
    try {
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (err) {
      console.warn('Error clearing recent searches:', err);
    }
  },
};
