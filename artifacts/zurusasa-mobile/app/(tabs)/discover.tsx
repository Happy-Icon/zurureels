import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useReels } from '@/lib/queries';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationBadge } from '@/components/NotificationBadge';
import { useWeather, type Coordinates } from '@/lib/weather';
import { WeatherCard } from '@/components/WeatherCard';
import { CityPickerSheet } from '@/components/CityPickerSheet';
import { ReelGridCard } from '@/components/ReelGridCard';
import { ReelCard } from '@/components/ReelCard';
import { ZuruAgentChat, type ReelSummary } from '@/components/ZuruAgentChat';
import { Skeleton } from '@/components/Skeleton';
import type { BookingRow, ReelRow } from '@/lib/supabase';

// Advanced Search & Smart Filters Imports
import { useSearch } from '@/hooks/useSearch';
import { useFilters } from '@/hooks/useFilters';
import { filterService } from '@/services/filterService';
import { SearchBar } from '@/components/search/SearchBar';
import { FilterChip } from '@/components/search/FilterChip';
import { FilterSheet } from '@/components/search/FilterSheet';
import { SortSheet } from '@/components/search/SortSheet';
import { SearchSuggestions } from '@/components/search/SearchSuggestions';
import { SearchEmptyState } from '@/components/search/SearchEmptyState';
import { AIFloatingButton } from '@/components/ai/AIFloatingButton';
import { DiscoverMapView } from '@/components/map/DiscoverMapView';
import { JourneyCompanionSheet } from '@/components/journey/JourneyCompanionSheet';

import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

const DISCOVERY_CATEGORIES = [
  { id: 'all', label: 'All', icon: 'grid', categories: ['all'] },
  { id: 'accommodation', label: 'Stays', icon: 'home', categories: ['hotel', 'villa', 'apartment', 'stay', 'parks_camps'] },
  { id: 'events', label: 'Events', icon: 'calendar', categories: ['events', 'food', 'drinks'] },
  { id: 'experiences', label: 'Experiences', icon: 'compass', categories: ['land_adventure', 'air_adventure', 'water_adventure', 'tours', 'boat'] },
  { id: 'ai', label: 'Zuru AI', icon: 'zap', categories: [] },
] as const;

type CategoryId = (typeof DISCOVERY_CATEGORIES)[number]['id'];

export default function AirbnbDiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const { isDark } = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');
  const [selectedCity, setSelectedCity] = useState('Mombasa');
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [viewerReel, setViewerReel] = useState<ReelRow | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [discoverViewMode, setDiscoverViewMode] = useState<'grid' | 'map'>('grid');
  const [journeyBooking, setJourneyBooking] = useState<BookingRow | null>(null);

  // Advanced Search & Filter Hooks
  const {
    query,
    setQuery,
    recentSearches,
    popularDestinations,
    trendingTags,
    addSearch,
    clearHistory,
    parseAiQuery,
  } = useSearch();

  const { filters, updateFilters, resetFilters, activeFilterCount } = useFilters();

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  const searchInputRef = useRef<TextInput>(null);

  const reelsQuery = useReels();
  const weatherQuery = useWeather(selectedCity, coords);
  const { unreadCount } = useNotifications();

  // Handle AI Natural Language Query submission
  const handleSearchSubmit = (text: string) => {
    if (!text.trim()) return;
    addSearch(text);
    const aiParsed = parseAiQuery(text);
    if (Object.keys(aiParsed).length > 0) {
      updateFilters(aiParsed);
    }
    setIsSearchFocused(false);
  };

  const applyMyLocation = useCallback(async (interactive: boolean) => {
    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted') {
        if (interactive) {
          Alert.alert(
            'Location Required',
            'Location permission was denied. Pick a coastal city instead.',
          );
        }
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      setSelectedCity('Current Location');
    } catch {
      if (interactive) {
        Alert.alert('Location Error', 'Could not retrieve your current location.');
      }
    }
  }, []);

  useEffect(() => {
    applyMyLocation(false);
  }, [applyMyLocation]);

  const categoryObj = DISCOVERY_CATEGORIES.find((c) => c.id === activeCategory)!;

  // Filter & Search Execution Pipeline
  const filteredReels = useMemo(() => {
    const rawReels = reelsQuery.data ?? [];

    // 1. Text Search Filter (title, description, location, category)
    const q = query.trim().toLowerCase();
    let searchFiltered = rawReels;
    if (q) {
      searchFiltered = rawReels.filter((r) => {
        const cat = (r.category ?? '').toLowerCase();
        const title = (r.experience?.title ?? '').toLowerCase();
        const desc = (r.experience?.description ?? '').toLowerCase();
        const loc = (r.experience?.location ?? '').toLowerCase();
        return title.includes(q) || desc.includes(q) || loc.includes(q) || cat.includes(q);
      });
    }

    // 2. Category Tab Filter
    if (activeCategory !== 'all') {
      const catSubList = categoryObj.categories as readonly string[];
      searchFiltered = searchFiltered.filter((r) => {
        const cat = (r.category ?? '').toLowerCase();
        return catSubList.includes(cat);
      });
    }

    // 3. Multi-faceted Smart Filters (Price, Rating, Amenities, Host Type, Sorting)
    return filterService.applyFilters(searchFiltered, filters);
  }, [reelsQuery.data, query, activeCategory, categoryObj, filters]);

  const chatReels: ReelSummary[] = useMemo(
    () =>
      filteredReels.slice(0, 20).map((r) => ({
        title: r.experience?.title ?? null,
        category: r.category,
        location: r.experience?.location ?? null,
        price: r.experience?.current_price ?? null,
        rating: null,
      })),
    [filteredReels],
  );

  const cardWidth = (winWidth - 40 - 12) / 2;
  const topPad = Platform.OS === 'web' ? 12 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 84;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* 1. Header & Search Integration */}
      <View style={[styles.headerContainer, { paddingTop: topPad + 6, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <SearchBar
              inputRef={searchInputRef}
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                if (text.length > 0 && !isSearchFocused) setIsSearchFocused(true);
              }}
              onFocus={() => setIsSearchFocused(true)}
              onFilterPress={() => setFilterSheetOpen(true)}
              onSortPress={() => setSortSheetOpen(true)}
              activeFilterCount={activeFilterCount}
            />
          </View>
        </View>

        {/* Active Filter Chips Row */}
        <FilterChip
          filters={filters}
          onRemoveCategory={() => updateFilters({ category: null })}
          onRemoveCity={(c) => updateFilters({ cities: (filters.cities || []).filter((x) => x !== c) })}
          onRemovePrice={() => updateFilters({ minPrice: 0, maxPrice: 150000 })}
          onRemoveRating={() => updateFilters({ minRating: null })}
          onRemoveAmenity={(a) => updateFilters({ amenities: (filters.amenities || []).filter((x) => x !== a) })}
          onResetAll={resetFilters}
        />

        {/* 2. Horizontal Category Scroll Bar */}
        {!isSearchFocused ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryBarScroll}
          >
            {DISCOVERY_CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  testID={`category-${cat.id}`}
                  onPress={() => {
                    if (cat.id === 'ai') {
                      router.push('/ai' as any);
                    } else {
                      setActiveCategory(cat.id);
                    }
                  }}
                  style={styles.categoryItem}
                >
                  <Feather
                    name={cat.icon as any}
                    size={20}
                    color={isActive ? colors.text : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.categoryLabelText,
                      {
                        color: isActive ? colors.text : colors.mutedForeground,
                        fontFamily: isActive ? 'DMSans_700Bold' : 'DMSans_500Medium',
                      },
                    ]}
                  >
                    {cat.label}
                  </Text>
                  {isActive ? <View style={[styles.categoryUnderline, { backgroundColor: colors.text }]} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {/* MAIN VIEW CONTENT: MAP MODE vs GRID MODE */}
      {isSearchFocused ? (
        <View style={[styles.suggestionsOverlay, { backgroundColor: colors.background, paddingBottom: bottomPad }]}>
          <View style={[styles.suggestionsHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.suggestionsTitle, { color: colors.text }]}>Search Suggestions</Text>
            <Pressable onPress={() => setIsSearchFocused(false)} hitSlop={8}>
              <Text style={styles.closeSuggestionsText}>Done</Text>
            </Pressable>
          </View>

          <SearchSuggestions
            recentSearches={recentSearches}
            popularDestinations={popularDestinations}
            trendingTags={trendingTags}
            onSelectQuery={(q) => {
              setQuery(q);
              handleSearchSubmit(q);
            }}
            onSelectCity={(city) => {
              setSelectedCity(city);
              updateFilters({ cities: [city] });
              setIsSearchFocused(false);
            }}
            onClearHistory={clearHistory}
          />
        </View>
      ) : discoverViewMode === 'map' ? (
        /* REAL GOOGLE MAPS DISCOVER VIEW */
        <View style={{ flex: 1 }}>
          <DiscoverMapView
            reels={filteredReels}
            onSelectReel={(reel) => setViewerReel(reel)}
            onOpenDirections={(reel) => setJourneyBooking(reel as any)}
          />
        </View>
      ) : (
        /* MAIN REELS & EXPERIENCES GRID LIST */
        <FlatList
          data={filteredReels}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridColumnWrapper}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: bottomPad,
            gap: 16,
          }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={{ gap: 16, marginBottom: 8 }}>
              {/* Weather Widget */}
              <WeatherCard
                weather={weatherQuery.data}
                loading={weatherQuery.isLoading}
                city={selectedCity}
              />
            </View>
          }
          renderItem={({ item }) => (
            <ReelGridCard
              reel={item}
              width={cardWidth}
              onOpen={() => setViewerReel(item)}
            />
          )}
          ListEmptyComponent={
            reelsQuery.isLoading ? (
              <View style={styles.gridColumnWrapper}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={{ width: cardWidth, gap: 8 }}>
                    <Skeleton style={{ width: '100%', height: 220, borderRadius: 16 }} />
                    <Skeleton style={{ width: '80%', height: 16, borderRadius: 4 }} />
                    <Skeleton style={{ width: '50%', height: 14, borderRadius: 4 }} />
                  </View>
                ))}
              </View>
            ) : (
              <SearchEmptyState
                onResetFilters={resetFilters}
                onExploreAll={() => {
                  setQuery('');
                  resetFilters();
                  setActiveCategory('all');
                }}
              />
            )
          }
        />
      )}

      {/* Journey Companion Sheet for Map Directions */}
      {journeyBooking ? (
        <JourneyCompanionSheet
          visible={Boolean(journeyBooking)}
          booking={journeyBooking}
          onClose={() => setJourneyBooking(null)}
          onMessageHost={() => setJourneyBooking(null)}
        />
      ) : null}

      {/* Full Reel Video Player Viewer Modal */}
      <Modal visible={Boolean(viewerReel)} animationType="slide" onRequestClose={() => setViewerReel(null)}>
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
          <Pressable onPress={() => setViewerReel(null)} style={styles.closeViewerBtn} hitSlop={10}>
            <Feather name="x" size={24} color="#FFFFFF" />
          </Pressable>
          {viewerReel ? (
            <ReelCard reel={viewerReel} isActive={true} height={winHeight} />
          ) : null}
        </View>
      </Modal>

      {/* City Picker Modal Sheet */}
      <CityPickerSheet
        visible={cityPickerOpen}
        selectedCity={selectedCity}
        onSelectCity={(city) => {
          setSelectedCity(city);
          updateFilters({ cities: [city] });
          setCityPickerOpen(false);
        }}
        onClose={() => setCityPickerOpen(false)}
        onUseMyLocation={() => {
          applyMyLocation(true);
          setCityPickerOpen(false);
        }}
      />

      {/* Filter Bottom Sheet Modal */}
      <FilterSheet
        visible={filterSheetOpen}
        filters={filters}
        onClose={() => setFilterSheetOpen(false)}
        onApply={(newFilters) => updateFilters(newFilters)}
        onReset={resetFilters}
      />

      {/* Sort Options Bottom Sheet Modal */}
      <SortSheet
        visible={sortSheetOpen}
        selectedSort={filters.sortBy}
        onClose={() => setSortSheetOpen(false)}
        onSelectSort={(sort) => updateFilters({ sortBy: sort })}
      />

      {/* Zuru AI Concierge Modal Chat */}
      <ZuruAgentChat
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        reels={chatReels}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerContainer: {
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    gap: 8,
    paddingBottom: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  categoryBarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    paddingVertical: 8,
  },
  categoryItem: {
    alignItems: 'center',
    gap: 4,
    position: 'relative',
    paddingBottom: 6,
  },
  categoryLabelText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
  },
  categoryLabelActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  categoryLabelInactive: {
    color: '#717171',
  },
  categoryUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#222222',
    borderRadius: 1,
  },
  suggestionsOverlay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  suggestionsTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  closeSuggestionsText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  gridColumnWrapper: {
    justifyContent: 'space-between',
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    backgroundColor: '#F26522',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 26,
    shadowColor: '#F26522',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  mapToggleFab: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    backgroundColor: '#111111',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 26,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 100,
  },
  mapToggleFabText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
  },
  closeViewerBtn: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
