import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Appearance,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useReels } from '@/lib/queries';
import { useWeather, type Coordinates } from '@/lib/weather';
import { WeatherCard } from '@/components/WeatherCard';
import { CityPickerSheet } from '@/components/CityPickerSheet';
import { ReelGridCard } from '@/components/ReelGridCard';
import { ReelCard } from '@/components/ReelCard';
import { ZuruAgentChat, type ReelSummary } from '@/components/ZuruAgentChat';
import { Skeleton } from '@/components/Skeleton';
import type { ReelRow } from '@/lib/supabase';

const ZURU_ORANGE = '#EE7D30';

// Mirrors web DiscoverContent's discoveryGroups.
const DISCOVERY_GROUPS = [
  { id: 'all', label: 'All', categories: ['all'] },
  {
    id: 'accommodation',
    label: 'Accommodation',
    categories: ['hotel', 'villa', 'apartment', 'parks_camps'],
  },
  { id: 'events', label: 'Events', categories: ['events', 'food', 'drinks'] },
  {
    id: 'adventure',
    label: 'Adventure',
    categories: ['land_adventure', 'air_adventure', 'water_adventure'],
  },
] as const;

type GroupId = (typeof DISCOVERY_GROUPS)[number]['id'];

function GroupIcon({ id, color }: { id: GroupId; color: string }) {
  switch (id) {
    case 'all':
      return <MaterialCommunityIcons name="creation" size={15} color={color} />;
    case 'accommodation':
      return <Feather name="home" size={15} color={color} />;
    case 'events':
      return (
        <MaterialCommunityIcons name="party-popper" size={15} color={color} />
      );
    case 'adventure':
      return (
        <MaterialCommunityIcons
          name="image-filter-hdr"
          size={15}
          color={color}
        />
      );
  }
}

const subLabel = (cat: string) =>
  cat
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

export default function DiscoverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scheme = useColorScheme();
  const { user, profile } = useAuth();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const [selectedGroup, setSelectedGroup] = useState<GroupId>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
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

  // Debounce search like web (500ms).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(t);
  }, [search]);

  // Web parity: CityPulse auto-detects location on mount.
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
            'Location',
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
        Alert.alert('Location', 'Could not get your location right now.');
      }
    }
  }, []);

  useEffect(() => {
    applyMyLocation(false);
  }, [applyMyLocation]);

  const group = DISCOVERY_GROUPS.find((g) => g.id === selectedGroup)!;

  const filteredReels = useMemo(() => {
    const reels = reelsQuery.data ?? [];
    const q = debouncedSearch.trim().toLowerCase();
    return reels.filter((r) => {
      const cat = (r.category ?? '').toLowerCase();
      const title = (r.experience?.title ?? '').toLowerCase();
      const location = (r.experience?.location ?? '').toLowerCase();

      const matchesGroup =
        selectedCategory !== 'all'
          ? cat === selectedCategory
          : selectedGroup === 'all'
            ? true
            : (group.categories as readonly string[]).includes(cat);

      const matchesCity =
        selectedCity === 'Current Location'
          ? true
          : location.includes(selectedCity.toLowerCase());

      const matchesSearch =
        !q || title.includes(q) || location.includes(q) || cat.includes(q);

      return matchesGroup && matchesCity && matchesSearch;
    });
  }, [
    reelsQuery.data,
    debouncedSearch,
    selectedCategory,
    selectedGroup,
    selectedCity,
    group,
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

  const isHost = profile?.role === 'host';
  const cardWidth = (winWidth - 32 - 12) / 2;
  const topPad = Platform.OS === 'web' ? 10 : insets.top;
  const bottomPad = (Platform.OS === 'web' ? 104 : 92) + insets.bottom;

  const onToggleTheme = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (typeof Appearance.setColorScheme === 'function') {
        Appearance.setColorScheme(scheme === 'dark' ? 'light' : 'dark');
      }
    } catch {
      // not supported on this platform — leave system theme
    }
  };

  const onNotifications = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const msg = "You're all caught up — no new notifications.";
    if (Platform.OS === 'web') {
      // RN Web's Alert is a no-op.
      (globalThis as { alert?: (m: string) => void }).alert?.(msg);
    } else {
      Alert.alert('Notifications', msg);
    }
  };

  const onSelectGroup = (id: GroupId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGroup(id);
    setSelectedCategory('all');
  };

  const secondary50 = `${colors.secondary}80`;
  const secondary30 = `${colors.secondary}4D`;

  const showSubcategories = selectedGroup !== 'all';

  const countLabel = `${filteredReels.length} reel${
    filteredReels.length === 1 ? '' : 's'
  } found${selectedCategory !== 'all' ? ` in ${subLabel(selectedCategory)}` : ''}`;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* ---- Sticky header (web: MainLayout bar + CityPulse explore header) ---- */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: topPad + 10,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.logo, { color: colors.foreground }]}>
          ZuruSasa
        </Text>
        <View style={styles.topBarCenter}>
          <Pressable
            testID="header-search"
            onPress={() => searchInputRef.current?.focus()}
            style={({ pressed }) => [
              styles.searchCircle,
              { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="search" size={18} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={styles.topBarRight}>
          <Pressable
            testID="theme-toggle"
            onPress={onToggleTheme}
            hitSlop={6}
            style={styles.iconButton}
          >
            <Feather
              name={scheme === 'dark' ? 'moon' : 'sun'}
              size={19}
              color={colors.foreground}
            />
          </Pressable>
          <Pressable
            testID="notifications-button"
            onPress={onNotifications}
            hitSlop={6}
            style={styles.iconButton}
          >
            <Feather name="bell" size={19} color={colors.foreground} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        {/* Segmented ZuruFlow | Discover + location */}
        <View style={styles.segmentRow}>
          <View
            style={[styles.segment, { backgroundColor: colors.secondary }]}
          >
            <Pressable
              testID="segment-zuruflow"
              onPress={() => router.navigate('/')}
              style={styles.segmentButton}
            >
              <Text
                style={[styles.segmentText, { color: colors.mutedForeground }]}
              >
                ZuruFlow
              </Text>
            </Pressable>
            <Pressable
              testID="segment-discover"
              style={[styles.segmentButton, styles.segmentActive]}
            >
              <Text style={[styles.segmentText, { color: '#ffffff' }]}>
                Discover
              </Text>
            </Pressable>
          </View>

          <Pressable
            testID="city-pill"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCityPickerOpen(true);
            }}
            style={({ pressed }) => [
              styles.cityPill,
              { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="map-pin" size={14} color={colors.primary} />
            <Text
              numberOfLines={1}
              style={[styles.cityText, { color: colors.foreground }]}
            >
              {selectedCity}
            </Text>
            <Feather
              name="chevron-down"
              size={14}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>

        {/* Search + filter */}
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Feather
              name="search"
              size={16}
              color={colors.mutedForeground}
              style={styles.searchIcon}
            />
            <TextInput
              ref={searchInputRef}
              testID="discover-search-input"
              value={search}
              onChangeText={setSearch}
              placeholder="Search villas, hotels, locations..."
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.searchInput,
                { backgroundColor: secondary50, color: colors.foreground },
              ]}
              returnKeyType="search"
            />
          </View>
          <Pressable
            testID="filter-button"
            style={({ pressed }) => [
              styles.filterButton,
              { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="filter" size={17} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Discovery group toggle */}
        <View style={[styles.groups, { backgroundColor: secondary30 }]}>
          {DISCOVERY_GROUPS.map((g) => {
            const active = selectedGroup === g.id;
            return (
              <Pressable
                key={g.id}
                testID={`group-${g.id}`}
                onPress={() => onSelectGroup(g.id)}
                style={[
                  styles.groupButton,
                  active ? { backgroundColor: ZURU_ORANGE } : null,
                ]}
              >
                <GroupIcon
                  id={g.id}
                  color={active ? '#ffffff' : colors.mutedForeground}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.groupText,
                    { color: active ? '#ffffff' : colors.mutedForeground },
                  ]}
                >
                  {g.label.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Sub-category chips */}
        {showSubcategories ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {['all', ...group.categories].map((cat) => {
              const active = selectedCategory === cat;
              const label =
                cat === 'all' ? `All ${selectedGroup}` : subLabel(cat);
              return (
                <Pressable
                  key={cat}
                  testID={`subcat-${cat}`}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedCategory(cat);
                  }}
                  style={[
                    styles.chip,
                    active
                      ? {
                          backgroundColor: `${ZURU_ORANGE}33`,
                          borderColor: `${ZURU_ORANGE}4D`,
                        }
                      : {
                          backgroundColor: `${colors.secondary}CC`,
                          borderColor: 'transparent',
                        },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: active
                          ? colors.primary
                          : colors.secondaryForeground,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {/* ---- Scrollable content: weather, count, reel grid ---- */}
      <FlatList
        data={reelsQuery.isPending ? [] : filteredReels}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <WeatherCard
              weather={weatherQuery.data}
              loading={weatherQuery.isPending}
              city={selectedCity}
            />
            <Text style={[styles.countText, { color: colors.mutedForeground }]}>
              {countLabel}
            </Text>
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
            <View style={styles.empty}>
              <MaterialCommunityIcons
                name="creation"
                size={44}
                color={colors.mutedForeground}
                style={{ opacity: 0.35 }}
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No reels found
              </Text>
              <Text
                style={[styles.emptySub, { color: colors.mutedForeground }]}
              >
                Try a different search or category
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          !isHost ? (
            <Pressable
              testID="ask-zuru-discover"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setChatOpen(true);
              }}
              style={({ pressed }) => [
                styles.zuruButton,
                { transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              <MaterialCommunityIcons name="creation" size={17} color="#fff" />
              <Text style={styles.zuruButtonText}>Zuru Agent</Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item }) => (
          <ReelGridCard
            reel={item}
            width={cardWidth}
            onOpen={() => setViewerReel(item)}
          />
        )}
      />

      {/* ---- Full-screen reel viewer (web: selectedReel overlay) ---- */}
      <Modal
        visible={!!viewerReel}
        animationType="fade"
        onRequestClose={() => setViewerReel(null)}
      >
        <View style={styles.viewer}>
          {viewerReel ? (
            <ReelCard reel={viewerReel} isActive height={winHeight} />
          ) : null}
          <Pressable
            testID="viewer-back"
            onPress={() => setViewerReel(null)}
            style={[
              styles.viewerBack,
              { top: Math.max(insets.top, 14) + 6 },
            ]}
          >
            <Feather name="chevron-left" size={22} color="#ffffff" />
          </Pressable>
        </View>
      </Modal>

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

      <ZuruAgentChat
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        city="Discover"
        reels={chatReels}
        placeholder="Ask Zuru about these listings..."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  logo: {
    fontSize: 21,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  searchCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: 1,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  segmentActive: {
    backgroundColor: ZURU_ORANGE,
  },
  segmentText: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: 150,
    flexShrink: 1,
  },
  cityText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    flexShrink: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  searchInput: {
    height: 44,
    borderRadius: 12,
    paddingLeft: 36,
    paddingRight: 12,
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groups: {
    flexDirection: 'row',
    borderRadius: 24,
    padding: 4,
  },
  groupButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 19,
  },
  groupText: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  chipsRow: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
  },
  listHeader: {
    paddingHorizontal: 16,
    gap: 14,
    paddingBottom: 14,
  },
  countText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
  },
  gridRow: {
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 56,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
  },
  zuruButton: {
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: 'rgba(238,125,48,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: ZURU_ORANGE,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  zuruButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  viewer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  viewerBack: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
