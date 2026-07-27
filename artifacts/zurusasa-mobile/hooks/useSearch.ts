import { useState, useEffect, useCallback } from 'react';
import { searchService, type RecentSearchItem, POPULAR_DESTINATIONS, TRENDING_TAGS } from '@/services/searchService';
import { type SearchFilters } from '@/services/filterService';

export function useSearch() {
  const [query, setQuery] = useState<string>('');
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    const list = await searchService.getRecentSearches();
    setRecentSearches(list);
    setIsLoadingHistory(false);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const addSearch = async (text: string) => {
    if (!text.trim()) return;
    const updated = await searchService.addRecentSearch(text);
    setRecentSearches(updated);
  };

  const clearHistory = async () => {
    setRecentSearches([]);
    await searchService.clearRecentSearches();
  };

  const parseAiQuery = useCallback((text: string): Partial<SearchFilters> => {
    return searchService.parseNaturalLanguageQuery(text);
  }, []);

  return {
    query,
    setQuery,
    recentSearches,
    popularDestinations: POPULAR_DESTINATIONS,
    trendingTags: TRENDING_TAGS,
    isLoadingHistory,
    addSearch,
    clearHistory,
    parseAiQuery,
  };
}
