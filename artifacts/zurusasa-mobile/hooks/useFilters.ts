import { useState, useCallback, useMemo } from 'react';
import { filterService, DEFAULT_FILTERS, type SearchFilters } from '@/services/filterService';

export function useFilters(initialFilters: SearchFilters = DEFAULT_FILTERS) {
  const [filters, setFiltersState] = useState<SearchFilters>(initialFilters);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  const updateFilters = useCallback((updater: Partial<SearchFilters> | ((prev: SearchFilters) => SearchFilters)) => {
    setFiltersState((prev) => {
      if (typeof updater === 'function') {
        return updater(prev);
      }
      return { ...prev, ...updater };
    });
  }, []);

  const activeFilterCount = useMemo(() => {
    return filterService.getAppliedFilterCount(filters);
  }, [filters]);

  return {
    filters,
    updateFilters,
    resetFilters,
    activeFilterCount,
  };
}
