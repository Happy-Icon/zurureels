import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { MapCanvas } from '@/components/map/MapCanvas';
import type {
  MapCanvasRef,
  MapPriceMarker,
  MapViewportEvent,
} from '@/components/map/MapCanvas.types';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';
import type { ReelRow } from '@/lib/supabase';
import type { SearchFilters } from '@/services/filterService';
import {
  DEFAULT_KENYA_COAST_CENTER,
  formatShortKesPrice,
  mapService,
  resolveExperienceCoords,
  type LatLng,
  type MapBounds,
} from '@/services/mapService';

const ORANGE = '#F26522';

export interface DiscoverMapViewProps {
  reels: ReelRow[];
  filters?: SearchFilters;
  activeCategories?: readonly string[];
  initialUserCoords?: { lat: number; lon: number } | null;
  onSelectReel?: (reel: ReelRow) => void;
  onOpenDirections?: (reel: ReelRow) => void;
}

interface TownGroup {
  id: string;
  city: string;
  center: LatLng;
  reels: ReelRow[];
}

function formatPriceUnitLabel(unit?: string | null, category?: string | null): string {
  const raw = String(unit ?? '').trim().toLowerCase();
  if (raw) {
    if (raw.startsWith('/')) return ` ${raw}`;
    if (raw.startsWith('per ')) return ` /${raw.slice(4)}`;
    return ` /${raw}`;
  }
  const cat = String(category ?? '').toLowerCase();
  if (['stay', 'stays', 'hotel', 'villa', 'apartment'].includes(cat)) return ' /night';
  if (['event', 'events'].includes(cat)) return ' /ticket';
  return ' /person';
}

function resolveRatingDisplay(reel: ReelRow): string | null {
  const expAny = reel.experience as Record<string, unknown> | null | undefined;
  const meta = (reel.experience?.metadata ?? {}) as Record<string, unknown>;
  const r = Number(expAny?.rating ?? meta.rating ?? 0);
  if (Number.isFinite(r) && r > 0) return r.toFixed(1);
  return null;
}

export function DiscoverMapView({
  reels,
  filters,
  activeCategories,
  initialUserCoords,
  onSelectReel,
  onOpenDirections,
}: DiscoverMapViewProps) {
  const { isDark } = useTheme();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const mapRef = useRef<MapCanvasRef>(null);
  const carouselRef = useRef<FlatList<ReelRow>>(null);

  const [viewportReels, setViewportReels] = useState<ReelRow[] | null>(null);
  const [pendingBounds, setPendingBounds] = useState<MapBounds | null>(null);
  const [searchingArea, setSearchingArea] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(
    initialUserCoords
      ? { latitude: initialUserCoords.lat, longitude: initialUserCoords.lon }
      : null,
  );

  const [visitedIds, setVisitedIds] = useState<Set<string>>(() => new Set());
  const [carouselReels, setCarouselReels] = useState<ReelRow[]>([]);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [selectedReelId, setSelectedReelId] = useState<string | null>(null);

  useEffect(() => {
    if (initialUserCoords && !userLocation) {
      setUserLocation({ latitude: initialUserCoords.lat, longitude: initialUserCoords.lon });
    }
  }, [initialUserCoords, userLocation]);

  // Reset viewport override whenever top-level filters or category tabs change
  useEffect(() => {
    setViewportReels(null);
    setPendingBounds(null);
  }, [reels]);

  const effectiveReels = useMemo(() => {
    if (!viewportReels) return reels;
    // Merge viewport-fetched pinned reels with current reels by id
    const byId = new Map<string, ReelRow>();
    for (const r of viewportReels) byId.set(r.id, r);
    for (const r of reels) {
      if (!byId.has(r.id)) byId.set(r.id, r);
    }
    return Array.from(byId.values());
  }, [reels, viewportReels]);

  // Partition into real pinned coordinates vs honest town-level summary groups (ZERO Math.random())
  const { pinnedItems, townGroups } = useMemo(() => {
    const pinned: Array<{
      reel: ReelRow;
      coords: LatLng;
      precision: 'exact' | 'approximate';
      city: string;
    }> = [];
    const groupsMap = new Map<string, TownGroup>();

    for (const reel of effectiveReels) {
      const resolved = resolveExperienceCoords(reel.experience, {
        lat: reel.lat,
        lng: reel.lng,
      });

      if (resolved.hasPin && resolved.latitude !== null && resolved.longitude !== null) {
        pinned.push({
          reel,
          coords: { latitude: resolved.latitude, longitude: resolved.longitude },
          precision: resolved.precision === 'approximate' ? 'approximate' : 'exact',
          city: resolved.city,
        });
      } else {
        const key = resolved.city.toLowerCase();
        const existing = groupsMap.get(key);
        if (existing) {
          existing.reels.push(reel);
        } else {
          groupsMap.set(key, {
            id: `town_${key}`,
            city: resolved.city,
            center: resolved.townCenter,
            reels: [reel],
          });
        }
      }
    }

    return {
      pinnedItems: pinned,
      townGroups: Array.from(groupsMap.values()),
    };
  }, [effectiveReels]);

  const initialCenter = useMemo<LatLng>(() => {
    if (pinnedItems.length > 0) return pinnedItems[0].coords;
    if (townGroups.length > 0) return townGroups[0].center;
    if (userLocation) return userLocation;
    return DEFAULT_KENYA_COAST_CENTER;
  }, [pinnedItems, townGroups, userLocation]);

  const priceMarkers = useMemo<MapPriceMarker[]>(() => {
    const markers: MapPriceMarker[] = [];

    for (const item of pinnedItems) {
      const id = `pin_${item.reel.id}`;
      const isSelected = activeMarkerId === id || selectedReelId === item.reel.id;
      const isVisited = visitedIds.has(item.reel.id);

      markers.push({
        id,
        coordinate: item.coords,
        label: formatShortKesPrice(item.reel.experience?.current_price),
        state: isSelected ? 'selected' : isVisited ? 'visited' : 'default',
        badgeType: 'price',
      });
    }

    for (const group of townGroups) {
      const isSelected = activeMarkerId === group.id;
      markers.push({
        id: group.id,
        coordinate: group.center,
        label: `${group.city} · ${group.reels.length}`,
        state: isSelected ? 'selected' : 'default',
        badgeType: 'town_summary',
      });
    }

    return markers;
  }, [pinnedItems, townGroups, activeMarkerId, selectedReelId, visitedIds]);

  const selectedPrivacyCircle = useMemo(() => {
    if (!selectedReelId) return null;
    const match = pinnedItems.find((p) => p.reel.id === selectedReelId);
    if (match && match.precision === 'approximate') {
      return { center: match.coords, radiusMeters: 450 };
    }
    return null;
  }, [pinnedItems, selectedReelId]);

  const handlePressMarker = useCallback(
    (markerId: string) => {
      if (markerId.startsWith('town_')) {
        const group = townGroups.find((g) => g.id === markerId);
        if (!group || group.reels.length === 0) return;
        setActiveMarkerId(group.id);
        setCarouselReels(group.reels);
        setSelectedReelId(group.reels[0].id);
        setVisitedIds((prev) => new Set(prev).add(group.reels[0].id));
        carouselRef.current?.scrollToOffset({ offset: 0, animated: false });
        mapRef.current?.flyTo(group.center, 12.6, 420);
        return;
      }

      const reelId = markerId.replace(/^pin_/, '');
      const idx = pinnedItems.findIndex((p) => p.reel.id === reelId);
      if (idx === -1) return;

      const allPinnedReels = pinnedItems.map((p) => p.reel);
      const target = pinnedItems[idx];

      setActiveMarkerId(markerId);
      setCarouselReels(allPinnedReels);
      setSelectedReelId(reelId);
      setVisitedIds((prev) => new Set(prev).add(reelId));

      requestAnimationFrame(() => {
        carouselRef.current?.scrollToIndex({
          index: idx,
          animated: true,
        });
      });

      mapRef.current?.flyTo(target.coords, 14.2, 400);
    },
    [pinnedItems, townGroups],
  );

  const handleDismissCarousel = useCallback(() => {
    setActiveMarkerId(null);
    setSelectedReelId(null);
    setCarouselReels([]);
  }, []);

  const handleViewportChange = useCallback((ev: MapViewportEvent) => {
    if (ev.userInteraction) {
      setPendingBounds(ev.bounds);
    }
  }, []);

  const handleSearchThisArea = useCallback(async () => {
    if (!pendingBounds) return;
    setSearchingArea(true);
    try {
      const results = await mapService.fetchReelsInBounds(
        pendingBounds,
        filters,
        activeCategories,
      );
      setViewportReels(results);
      setPendingBounds(null);
    } catch {
      // Keep existing markers on transient error
      setPendingBounds(null);
    } finally {
      setSearchingArea(false);
    }
  }, [pendingBounds, filters, activeCategories]);

  const handleLocateMe = useCallback(async () => {
    setLocatingUser(true);
    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Needed',
          'Enable location access in Settings to center the map on your current position.',
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setUserLocation(next);
      mapRef.current?.flyTo(next, 13.5, 500);
    } catch {
      Alert.alert('Location Unavailable', 'Unable to determine your current GPS position.');
    } finally {
      setLocatingUser(false);
    }
  }, []);

  const cardWidth = Math.min(screenWidth - 32, 360);
  const cardSnapInterval = cardWidth + 12;
  const bottomOffset = Platform.OS === 'web' ? 92 : insets.bottom + 84;

  const handleCarouselMomentumEnd = useCallback(
    (offsetX: number) => {
      if (carouselReels.length === 0) return;
      const idx = Math.max(
        0,
        Math.min(Math.round(offsetX / cardSnapInterval), carouselReels.length - 1),
      );
      const item = carouselReels[idx];
      if (!item) return;

      setSelectedReelId(item.id);
      setVisitedIds((prev) => new Set(prev).add(item.id));

      const resolved = resolveExperienceCoords(item.experience, {
        lat: item.lat,
        lng: item.lng,
      });
      if (resolved.hasPin && resolved.latitude !== null && resolved.longitude !== null) {
        setActiveMarkerId(`pin_${item.id}`);
        mapRef.current?.flyTo(
          { latitude: resolved.latitude, longitude: resolved.longitude },
          14.2,
          360,
        );
      }
    },
    [carouselReels, cardSnapInterval],
  );

  return (
    <View style={styles.container}>
      <MapCanvas
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialCenter={initialCenter}
        initialZoom={10.4}
        theme={isDark ? 'dark' : 'light'}
        interactive
        userLocation={userLocation}
        priceMarkers={priceMarkers}
        enableClustering
        privacyCircle={selectedPrivacyCircle}
        onPressMarker={handlePressMarker}
        onPressMap={handleDismissCarousel}
        onViewportChange={handleViewportChange}
      />

      {/* Top "Search this area" Viewport Pill */}
      {pendingBounds && (
        <Pressable
          onPress={handleSearchThisArea}
          disabled={searchingArea}
          style={[
            styles.searchAreaPill,
            { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' },
          ]}
        >
          {searchingArea ? (
            <ActivityIndicator size="small" color={ORANGE} />
          ) : (
            <Feather name="refresh-cw" size={13} color={ORANGE} />
          )}
          <Text
            style={[
              styles.searchAreaText,
              { color: isDark ? '#F9FAFB' : '#111827' },
            ]}
          >
            {searchingArea ? 'Searching area…' : 'Search this area'}
          </Text>
        </Pressable>
      )}

      {/* Honest Legend Chip when Town Summary Badges are visible */}
      {!pendingBounds && townGroups.length > 0 && carouselReels.length === 0 && (
        <View
          pointerEvents="none"
          style={[
            styles.infoBannerPill,
            { backgroundColor: isDark ? 'rgba(17,24,39,0.88)' : 'rgba(255,255,255,0.92)' },
          ]}
        >
          <Ionicons name="compass-outline" size={14} color={ORANGE} />
          <Text
            style={[
              styles.infoBannerText,
              { color: isDark ? '#E5E7EB' : '#374151' },
            ]}
          >
            Tap a town badge or price pin to preview stays & reels
          </Text>
        </View>
      )}

      {/* Right-Edge Zoom & Locate Me Controls */}
      <View
        style={[
          styles.controlsColumn,
          { bottom: carouselReels.length > 0 ? bottomOffset + 158 : bottomOffset + 12 },
        ]}
      >
        <Pressable
          accessibilityLabel="Center on my location"
          onPress={handleLocateMe}
          style={[
            styles.controlBtn,
            { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' },
          ]}
        >
          {locatingUser ? (
            <ActivityIndicator size="small" color={ORANGE} />
          ) : (
            <Ionicons
              name="locate"
              size={19}
              color={userLocation ? ORANGE : isDark ? '#F9FAFB' : '#111827'}
            />
          )}
        </Pressable>

        <View
          style={[
            styles.zoomGroup,
            {
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
            },
          ]}
        >
          <Pressable
            accessibilityLabel="Zoom in"
            onPress={() => mapRef.current?.zoomIn()}
            style={styles.zoomBtn}
          >
            <Feather name="plus" size={18} color={isDark ? '#F9FAFB' : '#111827'} />
          </Pressable>
          <View
            style={[
              styles.zoomDivider,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' },
            ]}
          />
          <Pressable
            accessibilityLabel="Zoom out"
            onPress={() => mapRef.current?.zoomOut()}
            style={styles.zoomBtn}
          >
            <Feather name="minus" size={18} color={isDark ? '#F9FAFB' : '#111827'} />
          </Pressable>
        </View>
      </View>

      {/* Bottom Swipeable Preview Card Carousel */}
      {carouselReels.length > 0 && (
        <View style={[styles.carouselWrap, { bottom: bottomOffset }]}>
          <FlatList
            ref={carouselRef}
            data={carouselReels}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            snapToInterval={cardSnapInterval}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            getItemLayout={(_, index) => ({
              length: cardSnapInterval,
              offset: cardSnapInterval * index,
              index,
            })}
            onMomentumScrollEnd={(e) =>
              handleCarouselMomentumEnd(e.nativeEvent.contentOffset.x)
            }
            renderItem={({ item }) => {
              const exp = item.experience;
              const resolved = resolveExperienceCoords(exp, {
                lat: item.lat,
                lng: item.lng,
              });
              const ratingStr = resolveRatingDisplay(item);
              const price = exp?.current_price;
              const unitLabel = formatPriceUnitLabel(exp?.price_unit, item.category);
              const thumb = item.thumbnail_url || exp?.image_url || '';

              return (
                <Pressable
                  onPress={() => onSelectReel?.(item)}
                  style={[
                    styles.previewCard,
                    {
                      width: cardWidth,
                      backgroundColor: isDark ? '#18181B' : '#FFFFFF',
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.thumbWrap}>
                    {thumb ? (
                      <Image
                        source={{ uri: thumb }}
                        style={styles.thumbImg}
                        contentFit="cover"
                        transition={180}
                      />
                    ) : (
                      <View style={[styles.thumbImg, styles.thumbFallback]}>
                        <Feather name="video" size={22} color="#9CA3AF" />
                      </View>
                    )}
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>
                        {(item.category || 'Experience').replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardInfo}>
                    <View style={styles.cardHeaderRow}>
                      <Text
                        style={[styles.cardTitle, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {exp?.title || 'ZuruSasa Listing'}
                      </Text>

                      {ratingStr ? (
                        <View style={styles.ratingBadge}>
                          <Ionicons name="star" size={11} color="#F59E0B" />
                          <Text style={styles.ratingText}>{ratingStr}</Text>
                        </View>
                      ) : (
                        <View style={styles.newBadge}>
                          <Text style={styles.newBadgeText}>New</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.locationRow}>
                      <Feather name="map-pin" size={11} color={ORANGE} />
                      <Text
                        style={[styles.locationText, { color: colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {resolved.hasPin
                          ? resolved.precision === 'approximate'
                            ? `${resolved.city} · Approximate area`
                            : resolved.formattedAddress
                          : `${resolved.city} · Town area`}
                      </Text>
                    </View>

                    <View style={styles.cardFooterRow}>
                      <Text style={[styles.priceText, { color: colors.text }]}>
                        {price && price > 0
                          ? `KES ${Number(price).toLocaleString()}`
                          : 'Free / Inquire'}
                        {price && price > 0 ? (
                          <Text
                            style={[styles.priceUnitText, { color: colors.mutedForeground }]}
                          >
                            {unitLabel}
                          </Text>
                        ) : null}
                      </Text>

                      <View style={styles.cardActions}>
                        {onOpenDirections && (
                          <Pressable
                            hitSlop={6}
                            onPress={(e) => {
                              e.stopPropagation();
                              onOpenDirections(item);
                            }}
                            style={[
                              styles.iconActionBtn,
                              {
                                backgroundColor: isDark
                                  ? 'rgba(255,255,255,0.08)'
                                  : '#F3F4F6',
                              },
                            ]}
                          >
                            <Ionicons name="navigate-outline" size={15} color={ORANGE} />
                          </Pressable>
                        )}

                        <Pressable
                          onPress={() => onSelectReel?.(item)}
                          style={styles.watchBtn}
                        >
                          <Text style={styles.watchBtnText}>View</Text>
                          <Feather name="arrow-up-right" size={13} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  <Pressable
                    hitSlop={8}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDismissCarousel();
                    }}
                    style={styles.dismissCardBtn}
                  >
                    <Feather name="x" size={13} color="#9CA3AF" />
                  </Pressable>
                </Pressable>
              );
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchAreaPill: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 20,
  },
  searchAreaText: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
  },
  infoBannerPill: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    zIndex: 10,
  },
  infoBannerText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_500Medium',
  },
  controlsColumn: {
    position: 'absolute',
    right: 14,
    alignItems: 'center',
    gap: 10,
    zIndex: 25,
  },
  controlBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  zoomGroup: {
    width: 42,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  zoomBtn: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: 1,
    width: '100%',
  },
  carouselWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
  },
  previewCard: {
    flexDirection: 'row',
    height: 134,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  thumbWrap: {
    width: 112,
    height: '100%',
    position: 'relative',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbFallback: {
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.68)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontFamily: 'DMSans_700Bold',
    textTransform: 'capitalize',
  },
  cardInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    justifyContent: 'space-between',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingRight: 18,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: 'DMSans_700Bold',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#D97706',
  },
  newBadge: {
    backgroundColor: 'rgba(242, 101, 34, 0.14)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newBadgeText: {
    fontSize: 10.5,
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  priceText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  priceUnitText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  watchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  dismissCardBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
