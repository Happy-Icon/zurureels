import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
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
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import {
  extractEventFromReel,
  extractOfferFromReel,
  useActiveSpecialOffers,
  useReels,
  useUpcomingEvents,
} from '@/lib/queries';
import { useWeather, type Coordinates } from '@/lib/weather';
import { WeatherCard } from '@/components/WeatherCard';
import { CityPickerSheet } from '@/components/CityPickerSheet';
import { ReelGridCard } from '@/components/ReelGridCard';
import { ReelCard } from '@/components/ReelCard';
import { BookingSheet } from '@/components/BookingSheet';
import { EventDetailSheet } from '@/components/modals/EventDetailSheet';
import { OfferDetailSheet } from '@/components/modals/OfferDetailSheet';
import { Skeleton } from '@/components/Skeleton';
import { OfflineState } from '@/components/OfflineState';
import { useNetworkStatus } from '@/lib/networkManager';
import type { BookingRow, EventRow, ReelRow, SpecialOfferRow } from '@/lib/supabase';
import {
  DISCOVER_CATEGORY_TABS,
  formatEventScheduleBadge,
  formatExpiryCountdown,
  resolveReelContentType,
  type DiscoverTabItem,
} from '@/constants/taxonomy';

// Advanced Search & Smart Filters Imports
import { useSearch } from '@/hooks/useSearch';
import { useFilters } from '@/hooks/useFilters';
import { expandCategoryAliases, filterService } from '@/services/filterService';
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
import { useCustomAlert } from '@/context/CustomAlertContext';

type CategoryId = DiscoverTabItem['id'];

export default function AirbnbDiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const { isDark } = useTheme();
  const { showAlert } = useCustomAlert();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const { isOnline } = useNetworkStatus();

  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');
  const [selectedCity, setSelectedCity] = useState('Mombasa');
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [viewerReel, setViewerReel] = useState<ReelRow | null>(null);
  const [bookingSheetReel, setBookingSheetReel] = useState<ReelRow | null>(null);
  const [selectedEventSheet, setSelectedEventSheet] = useState<{
    event: EventRow;
    reel: ReelRow | null;
  } | null>(null);
  const [selectedOfferSheet, setSelectedOfferSheet] = useState<{
    offer: SpecialOfferRow;
    reel: ReelRow | null;
  } | null>(null);
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
    parseAiQueryAsync,
  } = useSearch();

  const { filters, updateFilters, resetFilters, activeFilterCount } = useFilters();

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  const searchInputRef = useRef<TextInput>(null);

  const reelsQuery = useReels();
  const weatherQuery = useWeather(selectedCity, coords);

  const cityFilter = filters.cities?.[0] ?? null;
  const upcomingEventsQuery = useUpcomingEvents({
    city: cityFilter,
    fallbackReels: reelsQuery.data,
  });
  const activeOffersQuery = useActiveSpecialOffers({
    city: cityFilter,
    fallbackReels: reelsQuery.data,
  });

  // Merge DB table results with cached/live reel-backed events & offers for instant responsiveness
  const upcomingEvents = useMemo(() => {
    const merged = new Map<string, EventRow>();
    for (const ev of upcomingEventsQuery.data ?? []) {
      merged.set(ev.id, ev);
    }
    for (const r of reelsQuery.data ?? []) {
      const ev = extractEventFromReel(r);
      if (ev && !merged.has(ev.id)) {
        merged.set(ev.id, ev);
      }
    }
    return Array.from(merged.values()).sort((a, b) => {
      const ta = a.event_date ? new Date(a.event_date).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = b.event_date ? new Date(b.event_date).getTime() : Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });
  }, [upcomingEventsQuery.data, reelsQuery.data]);

  const activeOffers = useMemo(() => {
    const merged = new Map<string, SpecialOfferRow>();
    for (const off of activeOffersQuery.data ?? []) {
      merged.set(off.id, off);
    }
    for (const r of reelsQuery.data ?? []) {
      const off = extractOfferFromReel(r);
      if (off && !merged.has(off.id)) {
        merged.set(off.id, off);
      }
    }
    return Array.from(merged.values());
  }, [activeOffersQuery.data, reelsQuery.data]);

  const findReelForEvent = useCallback(
    (ev: EventRow): ReelRow | null => {
      const all = reelsQuery.data ?? [];
      return (
        all.find(
          (r) =>
            r.id === ev.reel_id ||
            r.event_id === ev.id ||
            (ev.experience_id &&
              r.experience_id === ev.experience_id &&
              resolveReelContentType(r) === 'event'),
        ) ?? null
      );
    },
    [reelsQuery.data],
  );

  const findReelForOffer = useCallback(
    (off: SpecialOfferRow): ReelRow | null => {
      const all = reelsQuery.data ?? [];
      return (
        all.find(
          (r) =>
            r.id === off.reel_id ||
            r.offer_id === off.id ||
            (off.experience_id &&
              r.experience_id === off.experience_id &&
              resolveReelContentType(r) === 'special_offer'),
        ) ?? null
      );
    },
    [reelsQuery.data],
  );

  const handleOpenEstablishment = useCallback(
    (experienceId: string) => {
      const all = reelsQuery.data ?? [];
      const primaryMatch =
        all.find(
          (r) => r.experience_id === experienceId && resolveReelContentType(r) === 'experience',
        ) || all.find((r) => r.experience_id === experienceId);

      if (primaryMatch) {
        setBookingSheetReel(primaryMatch);
      }
    },
    [reelsQuery.data],
  );

  // Handle AI Natural Language Query submission
  const handleSearchSubmit = async (text: string) => {
    if (!text.trim()) return;
    addSearch(text);
    const syncParsed = parseAiQuery(text);
    if (Object.keys(syncParsed).length > 0) {
      updateFilters(syncParsed);
    }
    setIsSearchFocused(false);

    try {
      const aiParsed = await parseAiQueryAsync(text);
      if (Object.keys(aiParsed).length > 0) {
        updateFilters(aiParsed);
      }
    } catch {
      // Offline or fallback already applied
    }
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
          showAlert({
            title: 'Location Required',
            message: 'Location permission was denied. Pick a coastal city instead.',
            variant: 'warning',
            icon: 'map-pin',
          });
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
        showAlert({
          title: 'Location Error',
          message: 'Could not retrieve your current location.',
          variant: 'error',
          icon: 'navigation',
        });
      }
    }
  }, [showAlert]);

  useEffect(() => {
    applyMyLocation(false);
  }, [applyMyLocation]);

  const categoryObj = DISCOVER_CATEGORY_TABS.find((c) => c.id === activeCategory)!;

  const hasServerFilters = useMemo(
    () =>
      filterService.hasServerPushablePredicates(filters, {
        categories: activeCategory !== 'all' ? categoryObj.categories : undefined,
      }),
    [filters, activeCategory, categoryObj],
  );

  const serverFilteredQuery = useQuery<ReelRow[]>({
    queryKey: [
      'discover-filtered-reels',
      activeCategory,
      filters.category ?? null,
      filters.subcategory ?? null,
      filters.onlySpecialOffers ?? false,
      filters.onlyUpcomingEvents ?? false,
      filters.minPrice ?? 0,
      filters.maxPrice ?? 150000,
      (filters.cities ?? []).join('|'),
    ],
    enabled: hasServerFilters && isOnline,
    staleTime: 30_000,
    queryFn: () =>
      filterService.fetchServerFilteredReels(filters, {
        categories: activeCategory !== 'all' ? categoryObj.categories : undefined,
        limit: 80,
      }),
  });

  // Filter & Search Execution Pipeline
  const filteredReels = useMemo(() => {
    const rawReels =
      hasServerFilters && serverFilteredQuery.data
        ? serverFilteredQuery.data
        : (reelsQuery.data ?? []);

    // 1. Text Search Filter
    const q = query.trim().toLowerCase();
    let searchFiltered = rawReels;
    if (q) {
      searchFiltered = rawReels.filter((r) => {
        const cat = (r.category ?? '').toLowerCase();
        const sub = (r.subcategory ?? '').toLowerCase();
        const title = (r.experience?.title ?? '').toLowerCase();
        const desc = (r.experience?.description ?? '').toLowerCase();
        const loc = (r.experience?.location ?? '').toLowerCase();
        return (
          title.includes(q) ||
          desc.includes(q) ||
          loc.includes(q) ||
          cat.includes(q) ||
          sub.includes(q)
        );
      });
    }

    // 2. Category Tab Filter
    if (activeCategory === 'events') {
      searchFiltered = searchFiltered.filter((r) => resolveReelContentType(r) === 'event');
    } else if (activeCategory === 'offers') {
      searchFiltered = searchFiltered.filter((r) => resolveReelContentType(r) === 'special_offer');
    } else if (activeCategory !== 'all') {
      const catSubList = expandCategoryAliases(categoryObj.categories as readonly string[]);
      searchFiltered = searchFiltered.filter((r) => {
        const reelCat = (r.category ?? '').toLowerCase();
        const expCat = (r.experience?.category ?? '').toLowerCase();
        const metaPrimary = String(
          ((r.experience?.metadata as Record<string, unknown> | null)?.primary_category) || '',
        ).toLowerCase();
        return (
          catSubList.includes(reelCat) ||
          (expCat !== '' && catSubList.includes(expCat)) ||
          (metaPrimary !== '' && catSubList.includes(metaPrimary))
        );
      });
    }

    // 3. Multi-faceted Smart Filters (Expiry, Price, Subcategory, Rating, Amenities, Host Type, Sorting)
    return filterService.applyFilters(searchFiltered, filters);
  }, [
    hasServerFilters,
    serverFilteredQuery.data,
    reelsQuery.data,
    query,
    activeCategory,
    categoryObj,
    filters,
  ]);

  const cardWidth = (winWidth - 40 - 12) / 2;
  const topPad = Platform.OS === 'web' ? 12 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 84;

  const showEventsCarousel =
    !query.trim() &&
    (activeCategory === 'all' || activeCategory === 'events') &&
    upcomingEvents.length > 0;
  const showOffersCarousel =
    !query.trim() &&
    (activeCategory === 'all' || activeCategory === 'offers') &&
    activeOffers.length > 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* 1. Header & Search Integration */}
      <View
        style={[
          styles.headerContainer,
          {
            paddingTop: topPad + 6,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
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
          onRemoveCategory={() => updateFilters({ category: null, subcategory: null })}
          onRemoveSubcategory={() => updateFilters({ subcategory: null })}
          onRemoveOnlySpecialOffers={() => updateFilters({ onlySpecialOffers: false })}
          onRemoveOnlyUpcomingEvents={() => updateFilters({ onlyUpcomingEvents: false })}
          onRemoveCity={(c) =>
            updateFilters({ cities: (filters.cities || []).filter((x) => x !== c) })
          }
          onRemovePrice={() => updateFilters({ minPrice: 0, maxPrice: 150000 })}
          onRemoveRating={() => updateFilters({ minRating: null })}
          onRemoveAmenity={(a) =>
            updateFilters({ amenities: (filters.amenities || []).filter((x) => x !== a) })
          }
          onResetAll={resetFilters}
        />

        {/* 2. Horizontal Category Scroll Bar */}
        {!isSearchFocused ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryBarScroll}
          >
            {DISCOVER_CATEGORY_TABS.map((cat) => {
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
                  <Ionicons
                    name={isActive ? cat.activeIcon : cat.icon}
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
                  {isActive ? (
                    <View style={[styles.categoryUnderline, { backgroundColor: colors.text }]} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {/* MAIN VIEW CONTENT: SEARCH vs MAP MODE vs GRID MODE */}
      {isSearchFocused ? (
        <View
          style={[
            styles.suggestionsOverlay,
            { backgroundColor: colors.background, paddingBottom: bottomPad },
          ]}
        >
          <View style={[styles.suggestionsHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.suggestionsTitle, { color: colors.text }]}>
              Search Suggestions
            </Text>
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
        <View style={{ flex: 1 }}>
          <DiscoverMapView
            reels={filteredReels}
            filters={filters}
            activeCategories={activeCategory !== 'all' ? categoryObj.categories : undefined}
            initialUserCoords={coords}
            onSelectReel={(reel) => setViewerReel(reel)}
            onOpenDirections={(reel) =>
              setJourneyBooking({
                id: '',
                user_id: null,
                experience_id: reel.experience_id,
                reel_id: reel.id,
                trip_title: reel.experience?.title ?? 'ZuruSasa Destination',
                amount: reel.experience?.current_price ?? 0,
                status: 'preview',
                check_in: null,
                check_out: null,
                guests: 1,
                experience: (reel.experience as any) ?? null,
                host: (reel.host as any) ?? null,
              })
            }
          />
        </View>
      ) : (
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
            <View style={{ gap: 18, marginBottom: 8 }}>
              {/* Weather Widget */}
              <WeatherCard
                weather={weatherQuery.data}
                loading={weatherQuery.isLoading}
                city={selectedCity}
              />

              {/* Section: Happening Around You (Upcoming Events) */}
              {showEventsCarousel ? (
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleRow}>
                      <Ionicons name="calendar-outline" size={18} color="#F26522" />
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        Happening around you
                      </Text>
                    </View>
                    {activeCategory !== 'events' ? (
                      <Pressable
                        onPress={() => setActiveCategory('events')}
                        style={styles.seeAllBtn}
                        hitSlop={8}
                      >
                        <Text style={[styles.seeAllText, { color: '#F26522' }]}>See all</Text>
                        <Ionicons name="chevron-forward" size={14} color="#F26522" />
                      </Pressable>
                    ) : null}
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.carouselScrollContent}
                  >
                    {upcomingEvents.map((ev) => {
                      const matchedReel = findReelForEvent(ev);
                      const imageUrl =
                        ev.image_url ||
                        matchedReel?.thumbnail_url ||
                        matchedReel?.experience?.image_url ||
                        null;
                      const scheduleLabel = formatEventScheduleBadge(
                        ev.event_date,
                        ev.start_time,
                      );
                      const evPrice =
                        typeof ev.price === 'number'
                          ? ev.price
                          : matchedReel?.experience?.current_price ?? 0;

                      return (
                        <Pressable
                          key={ev.id}
                          onPress={() =>
                            setSelectedEventSheet({ event: ev, reel: matchedReel })
                          }
                          style={({ pressed }) => [
                            styles.promoCard,
                            {
                              backgroundColor: colors.card,
                              borderColor: colors.border,
                              opacity: pressed ? 0.9 : 1,
                            },
                          ]}
                        >
                          <View style={styles.promoMediaWrap}>
                            {imageUrl ? (
                              <Image
                                source={{ uri: imageUrl }}
                                style={styles.promoMediaImg}
                                contentFit="cover"
                              />
                            ) : (
                              <View
                                style={[
                                  styles.promoMediaPlaceholder,
                                  { backgroundColor: isDark ? '#27272A' : '#F7F7F7' },
                                ]}
                              >
                                <Ionicons name="calendar-outline" size={28} color="#F26522" />
                              </View>
                            )}
                            <View style={[styles.promoPill, { backgroundColor: 'rgba(17, 24, 39, 0.78)' }]}>
                              <Ionicons name="calendar-outline" size={11} color="#FFFFFF" />
                              <Text style={styles.promoPillText} numberOfLines={1}>
                                {scheduleLabel}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.promoCardBody}>
                            <Text style={[styles.promoCardTitle, { color: colors.text }]} numberOfLines={1}>
                              {ev.title || 'Upcoming Event'}
                            </Text>
                            <View style={styles.promoMetaRow}>
                              <Ionicons
                                name="location-outline"
                                size={12}
                                color={colors.mutedForeground}
                              />
                              <Text
                                style={[styles.promoCardSub, { color: colors.mutedForeground }]}
                                numberOfLines={1}
                              >
                                {ev.location || ev.experience?.city || 'Kenya Coast'}
                              </Text>
                            </View>
                            <Text style={[styles.promoPriceText, { color: colors.text }]}>
                              {evPrice === 0 ? 'Free Entry' : `KES ${evPrice.toLocaleString()}`}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {/* Section: Deals Worth Exploring (Active Special Offers) */}
              {showOffersCarousel ? (
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleRow}>
                      <Ionicons name="pricetag-outline" size={18} color="#F26522" />
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        Deals worth exploring
                      </Text>
                    </View>
                    {activeCategory !== 'offers' ? (
                      <Pressable
                        onPress={() => setActiveCategory('offers')}
                        style={styles.seeAllBtn}
                        hitSlop={8}
                      >
                        <Text style={[styles.seeAllText, { color: '#F26522' }]}>See all</Text>
                        <Ionicons name="chevron-forward" size={14} color="#F26522" />
                      </Pressable>
                    ) : null}
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.carouselScrollContent}
                  >
                    {activeOffers.map((off) => {
                      const matchedReel = findReelForOffer(off);
                      const imageUrl =
                        off.image_url ||
                        matchedReel?.thumbnail_url ||
                        matchedReel?.experience?.image_url ||
                        null;
                      const countdownLabel = formatExpiryCountdown(off.expires_at);

                      return (
                        <Pressable
                          key={off.id}
                          onPress={() =>
                            setSelectedOfferSheet({ offer: off, reel: matchedReel })
                          }
                          style={({ pressed }) => [
                            styles.promoCard,
                            {
                              backgroundColor: colors.card,
                              borderColor: colors.border,
                              opacity: pressed ? 0.9 : 1,
                            },
                          ]}
                        >
                          <View style={styles.promoMediaWrap}>
                            {imageUrl ? (
                              <Image
                                source={{ uri: imageUrl }}
                                style={styles.promoMediaImg}
                                contentFit="cover"
                              />
                            ) : (
                              <View
                                style={[
                                  styles.promoMediaPlaceholder,
                                  { backgroundColor: isDark ? '#27272A' : '#F7F7F7' },
                                ]}
                              >
                                <Ionicons name="pricetag-outline" size={28} color="#F26522" />
                              </View>
                            )}
                            <View style={[styles.promoPill, { backgroundColor: 'rgba(17, 24, 39, 0.78)' }]}>
                              <Ionicons name="pricetag-outline" size={11} color="#FFFFFF" />
                              <Text style={styles.promoPillText} numberOfLines={1}>
                                {off.discount_label}
                              </Text>
                            </View>
                            <View style={styles.expiryPill}>
                              <Ionicons name="alarm-outline" size={10} color="#FFFFFF" />
                              <Text style={styles.expiryPillText} numberOfLines={1}>
                                {countdownLabel}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.promoCardBody}>
                            <Text style={[styles.promoCardTitle, { color: colors.text }]} numberOfLines={1}>
                              {off.title}
                            </Text>
                            <View style={styles.promoMetaRow}>
                              <Ionicons
                                name="business-outline"
                                size={12}
                                color={colors.mutedForeground}
                              />
                              <Text
                                style={[styles.promoCardSub, { color: colors.mutedForeground }]}
                                numberOfLines={1}
                              >
                                {off.experience?.title || off.location || 'Limited Offer'}
                              </Text>
                            </View>
                            <View style={styles.offerPriceRow}>
                              {off.original_price != null && off.original_price > 0 ? (
                                <Text
                                  style={[
                                    styles.offerOriginalPrice,
                                    { color: colors.mutedForeground },
                                  ]}
                                >
                                  KES {off.original_price.toLocaleString()}
                                </Text>
                              ) : null}
                              <Text style={[styles.promoPriceText, { color: colors.text }]}>
                                {off.offer_price != null && off.offer_price > 0
                                  ? `KES ${off.offer_price.toLocaleString()}`
                                  : off.discount_label}
                              </Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
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
              <View style={styles.skeletonGridWrapper}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <View key={i} style={[styles.skeletonCard, { width: cardWidth }]}>
                    <Skeleton
                      style={{
                        width: '100%',
                        height: Math.round(cardWidth * 1.25),
                        borderRadius: 16,
                      }}
                    />
                    <View style={styles.skeletonTitleRow}>
                      <Skeleton style={{ width: '68%', height: 16, borderRadius: 4 }} />
                      <Skeleton style={{ width: '24%', height: 14, borderRadius: 4 }} />
                    </View>
                    <Skeleton style={{ width: '50%', height: 13, borderRadius: 4 }} />
                    <Skeleton style={{ width: '60%', height: 14, borderRadius: 4 }} />
                  </View>
                ))}
              </View>
            ) : (!isOnline && filteredReels.length === 0) ||
              (reelsQuery.isError && filteredReels.length === 0) ? (
              <OfflineState
                fullScreen={false}
                onRetry={reelsQuery.refetch}
                message="Check your internet connection to explore stays, villas, and experiences across the coast."
              />
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

      {/* Floating Map / List Mode Toggle Pill */}
      {!isSearchFocused && activeCategory !== 'ai' ? (
        <Pressable
          testID="discover-map-toggle"
          accessibilityRole="button"
          accessibilityLabel={discoverViewMode === 'map' ? 'Show list view' : 'Show map view'}
          onPress={() =>
            setDiscoverViewMode((prev) => (prev === 'grid' ? 'map' : 'grid'))
          }
          style={({ pressed }) => [
            styles.mapToggleFab,
            {
              bottom: Platform.OS === 'web' ? 28 : insets.bottom + 90,
              backgroundColor: isDark ? '#F9FAFB' : '#111827',
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
        >
          <Ionicons
            name={discoverViewMode === 'map' ? 'grid-outline' : 'map-outline'}
            size={16}
            color={isDark ? '#111827' : '#FFFFFF'}
          />
          <Text
            style={[
              styles.mapToggleFabText,
              { color: isDark ? '#111827' : '#FFFFFF' },
            ]}
          >
            {discoverViewMode === 'map' ? 'List' : 'Map'}
          </Text>
        </Pressable>
      ) : null}

      {/* Zuru Agent AI Floating Button */}
      {!isSearchFocused && activeCategory !== 'ai' && discoverViewMode === 'grid' ? (
        <AIFloatingButton
          onPress={() => router.push('/ai' as any)}
          label="Ask Zuru Agent"
          visible={true}
        />
      ) : null}

      {/* Journey Companion Sheet for Map Directions */}
      {journeyBooking ? (
        <JourneyCompanionSheet
          visible={Boolean(journeyBooking)}
          booking={journeyBooking}
          onClose={() => setJourneyBooking(null)}
          onMessageHost={() => setJourneyBooking(null)}
        />
      ) : null}

      {/* Event Detail Sheet */}
      {selectedEventSheet ? (
        <EventDetailSheet
          visible={Boolean(selectedEventSheet)}
          event={selectedEventSheet.event}
          reel={selectedEventSheet.reel}
          onClose={() => setSelectedEventSheet(null)}
          onBookTicket={
            selectedEventSheet.reel
              ? () => {
                  const target = selectedEventSheet.reel!;
                  setSelectedEventSheet(null);
                  setBookingSheetReel(target);
                }
              : undefined
          }
          onOpenEstablishment={(expId) => handleOpenEstablishment(expId)}
        />
      ) : null}

      {/* Special Offer Detail Sheet */}
      {selectedOfferSheet ? (
        <OfferDetailSheet
          visible={Boolean(selectedOfferSheet)}
          offer={selectedOfferSheet.offer}
          reel={selectedOfferSheet.reel}
          onClose={() => setSelectedOfferSheet(null)}
          onClaimOffer={
            selectedOfferSheet.reel
              ? () => {
                  const target = selectedOfferSheet.reel!;
                  setSelectedOfferSheet(null);
                  setBookingSheetReel(target);
                }
              : undefined
          }
          onOpenEstablishment={(expId) => handleOpenEstablishment(expId)}
        />
      ) : null}

      {/* Direct Booking Sheet for Events / Offers / Linked Establishments */}
      {bookingSheetReel ? (
        <BookingSheet
          visible={Boolean(bookingSheetReel)}
          reel={bookingSheetReel}
          onClose={() => setBookingSheetReel(null)}
        />
      ) : null}

      {/* Full Reel Video Player Viewer Modal */}
      <Modal visible={Boolean(viewerReel)} animationType="slide" onRequestClose={() => setViewerReel(null)}>
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
          <Pressable onPress={() => setViewerReel(null)} style={styles.closeViewerBtn} hitSlop={10}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
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
  categoryUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#222222',
    borderRadius: 1,
  },
  sectionContainer: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    fontSize: 16.5,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.2,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_700Bold',
  },
  carouselScrollContent: {
    gap: 12,
    paddingRight: 4,
  },
  promoCard: {
    width: 236,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  promoMediaWrap: {
    width: '100%',
    height: 126,
    position: 'relative',
  },
  promoMediaImg: {
    width: '100%',
    height: '100%',
  },
  promoMediaPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: '72%',
  },
  promoPillText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontFamily: 'DMSans_700Bold',
  },
  expiryPill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(17, 24, 39, 0.78)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  expiryPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'DMSans_600SemiBold',
  },
  promoCardBody: {
    padding: 11,
    gap: 4,
  },
  promoCardTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  promoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  promoCardSub: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    flex: 1,
  },
  offerPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  offerOriginalPrice: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    textDecorationLine: 'line-through',
  },
  promoPriceText: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    marginTop: 2,
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
  skeletonGridWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 20,
  },
  skeletonCard: {
    gap: 7,
  },
  skeletonTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
