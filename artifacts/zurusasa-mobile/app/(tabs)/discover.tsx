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
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useReels } from '@/lib/queries';
import { useWeather, type Coordinates } from '@/lib/weather';
import { WeatherCard } from '@/components/WeatherCard';
import { CityPickerSheet } from '@/components/CityPickerSheet';
import { ReelGridCard } from '@/components/ReelGridCard';
import { ReelCard } from '@/components/ReelCard';
import { ZuruAgentChat, type ReelSummary } from '@/components/ZuruAgentChat';
import { Skeleton } from '@/components/Skeleton';
import type { ReelRow } from '@/lib/supabase';

const DISCOVERY_CATEGORIES = [
  { id: 'all', label: 'All', icon: 'grid', categories: ['all'] },
  { id: 'accommodation', label: 'Stays', icon: 'home', categories: ['hotel', 'villa', 'apartment', 'parks_camps'] },
  { id: 'events', label: 'Events', icon: 'calendar', categories: ['events', 'food', 'drinks'] },
  { id: 'experiences', label: 'Experiences', icon: 'compass', categories: ['land_adventure', 'air_adventure', 'water_adventure', 'tours'] },
] as const;

type CategoryId = (typeof DISCOVERY_CATEGORIES)[number]['id'];

export default function AirbnbDiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState('Mombasa');
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [viewerReel, setViewerReel] = useState<ReelRow | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const searchInputRef = useRef<TextInput>(null);

  const reelsQuery = useReels();
  const weatherQuery = useWeather(selectedCity, coords);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

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

  const filteredReels = useMemo(() => {
    const reels = reelsQuery.data ?? [];
    const q = debouncedSearch.trim().toLowerCase();
    return reels.filter((r) => {
      const cat = (r.category ?? '').toLowerCase();
      const title = (r.experience?.title ?? '').toLowerCase();
      const location = (r.experience?.location ?? '').toLowerCase();

      const matchesCategory =
        activeCategory === 'all'
          ? true
          : (categoryObj.categories as readonly string[]).includes(cat);

      const matchesCity =
        selectedCity === 'Current Location'
          ? true
          : location.includes(selectedCity.toLowerCase());

      const matchesSearch =
        !q || title.includes(q) || location.includes(q) || cat.includes(q);

      return matchesCategory && matchesCity && matchesSearch;
    });
  }, [
    reelsQuery.data,
    debouncedSearch,
    activeCategory,
    selectedCity,
    categoryObj,
  ]);

  const chatReels: ReelSummary[] = useMemo(
    () =>
      filteredReels.slice(0, 20).map((r) => ({
        title: r.experience?.title ?? null,
        category: r.category,
        location: r.experience?.location ?? null,
        price: r.experience?.current_price ?? null,
      })),
    [filteredReels],
  );

  const cardWidth = (winWidth - 40 - 12) / 2;
  const topPad = Platform.OS === 'web' ? 12 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 84;

  const countLabel = `${filteredReels.length} ${
    filteredReels.length === 1 ? 'experience' : 'experiences'
  } in ${selectedCity}`;

  return (
    <View style={[styles.screen, { backgroundColor: '#FFFFFF' }]}>
      {/* 1. Header & Search Integration (Airbnb Floating Search Style) */}
      <View style={[styles.headerContainer, { paddingTop: topPad + 6 }]}>
        {/* Floating Search Pill Bar */}
        <View style={styles.floatingSearchPill}>
          <Feather name="search" size={18} color="#222222" style={{ marginLeft: 4 }} />
          <Pressable
            testID="floating-search-trigger"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              searchInputRef.current?.focus();
            }}
            style={styles.searchPillTextGroup}
          >
            <Text style={styles.searchPillTitle}>Where to?</Text>
            <Text style={styles.searchPillSub} numberOfLines={1}>
              {selectedCity} · Any week · Add guests
            </Text>
          </Pressable>

          <Pressable
            testID="filter-button"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCityPickerOpen(true);
            }}
            style={({ pressed }) => [
              styles.filterCircleBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="sliders" size={15} color="#222222" />
          </Pressable>
        </View>

        {/* Hidden TextInput for keyboard search */}
        <TextInput
          ref={searchInputRef}
          value={search}
          onChangeText={setSearch}
          style={styles.hiddenSearchInput}
        />

        {/* 2. Horizontal Category Scroll Bar (Airbnb Icon + Text Underline Pattern) */}
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
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveCategory(cat.id);
                }}
                style={styles.categoryItem}
              >
                <Feather
                  name={cat.icon as any}
                  size={20}
                  color={isActive ? '#222222' : '#717171'}
                />
                <Text
                  style={[
                    styles.categoryLabelText,
                    isActive ? styles.categoryLabelActive : styles.categoryLabelInactive,
                  ]}
                >
                  {cat.label}
                </Text>
                {isActive ? <View style={styles.activeUnderline} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. Media Feed Card Grid Architecture */}
      <FlatList
        data={reelsQuery.isPending ? [] : filteredReels}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridColumnWrapper}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: bottomPad,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.feedHeaderWrap}>
            {/* 3. Weather & Coastal Conditions Widget (Compact Single-Row Strip) */}
            <WeatherCard
              weather={weatherQuery.data}
              loading={weatherQuery.isPending}
              city={selectedCity}
            />

            <View style={styles.countRow}>
              <Text style={styles.countText}>{countLabel}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          reelsQuery.isPending ? (
            <View style={styles.skeletonGrid}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton
                  key={i}
                  style={{
                    width: cardWidth,
                    height: cardWidth * 1.5,
                    borderRadius: 16,
                  }}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="creation"
                size={38}
                color="#717171"
              />
              <Text style={styles.emptyHeadline}>No experiences found</Text>
              <Text style={styles.emptyBody}>
                Try adjusting your search terms or city location filter.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          <Pressable
            testID="ask-zuru-discover"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setChatOpen(true);
            }}
            style={({ pressed }) => [
              styles.zuruFabBtn,
              { opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="creation" size={18} color="#FFFFFF" />
            <Text style={styles.zuruFabBtnText}>Ask Zuru Concierge</Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <ReelGridCard
            reel={item}
            width={cardWidth}
            onOpen={() => setViewerReel(item)}
          />
        )}
      />

      {/* Full Reel Viewer Modal */}
      <Modal
        visible={!!viewerReel}
        animationType="fade"
        onRequestClose={() => setViewerReel(null)}
      >
        <View style={styles.viewerContainer}>
          {viewerReel ? (
            <ReelCard reel={viewerReel} isActive height={winHeight} />
          ) : null}
          <Pressable
            testID="viewer-back"
            onPress={() => setViewerReel(null)}
            style={[styles.viewerBackBtn, { top: Math.max(insets.top, 14) + 6 }]}
          >
            <Feather name="chevron-left" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>

      {/* Coastal City Picker Sheet */}
      <CityPickerSheet
        visible={cityPickerOpen}
        selectedCity={selectedCity}
        onClose={() => setCityPickerOpen(false)}
        onUseMyLocation={() => {
          setCityPickerOpen(false);
          applyMyLocation(true);
        }}
        onSelectCity={(city) => {
          setCityPickerOpen(false);
          setSelectedCity(city);
        }}
      />

      {/* Concierge Agent Chat */}
      <ZuruAgentChat
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        city={selectedCity}
        reels={chatReels}
        placeholder="Ask Zuru concierge about coastal stays..."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  floatingSearchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    marginBottom: 14,
  },
  searchPillTextGroup: {
    flex: 1,
    gap: 1,
  },
  searchPillTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  searchPillSub: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  filterCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenSearchInput: {
    height: 0,
    width: 0,
    opacity: 0,
  },
  categoryBarScroll: {
    gap: 28,
    paddingRight: 20,
  },
  categoryItem: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: 10,
    position: 'relative',
  },
  categoryLabelText: {
    fontSize: 12,
  },
  categoryLabelActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  categoryLabelInactive: {
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  activeUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#222222',
    borderRadius: 1,
  },
  feedHeaderWrap: {
    gap: 12,
    marginBottom: 16,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  countText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  gridColumnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyHeadline: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
    lineHeight: 18,
  },
  zuruFabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    backgroundColor: '#222222',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  zuruFabBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  viewerBackBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
