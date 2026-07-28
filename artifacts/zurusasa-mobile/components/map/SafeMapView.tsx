import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  NativeModules,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TurboModuleRegistry,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ReelRow } from '@/lib/supabase';
import { googleMapsService, type LatLng, type RouteResult } from '@/services/googleMapsService';

const ORANGE = '#F26522';
const GOOGLE_BLUE = '#4285F4';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── NATIVE MODULE GUARD ─────────────────────────────────────────────────────

function isNativeMapsAvailable(): boolean {
  try {
    if (Platform.OS === 'web') return false;
    const turbo = (TurboModuleRegistry as any)?.get?.('RNMapsAirModule');
    const legacy = (NativeModules as any)?.RNMapsAirModule;
    return Boolean(turbo || legacy);
  } catch {
    return false;
  }
}

let NativeMapView: any = null;
let NativeMarker: any = null;
let NativePolyline: any = null;
let NativeProviderGoogle: any = null;
let ClusteredMapView: any = null;

if (isNativeMapsAvailable()) {
  try {
    const maps = require('react-native-maps');
    NativeMapView = maps.default;
    NativeMarker = maps.Marker;
    NativePolyline = maps.Polyline;
    NativeProviderGoogle = maps.PROVIDER_GOOGLE;

    try {
      ClusteredMapView = require('react-native-map-clustering').default;
    } catch {
      // Clustering not available, use normal MapView
    }
  } catch {
    // Native maps not available
  }
}

// ── DISCOVER MAP VIEW ───────────────────────────────────────────────────────

interface DiscoverMapViewProps {
  reels: ReelRow[];
  onSelectReel?: (reel: ReelRow) => void;
  onOpenDirections?: (reel: ReelRow) => void;
}

interface MarkerData {
  reel: ReelRow;
  coords: LatLng;
}

export function DiscoverMapView({
  reels,
  onSelectReel,
  onOpenDirections,
}: DiscoverMapViewProps) {
  const mapRef = useRef<any>(null);
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [selectedReel, setSelectedReel] = useState<ReelRow | null>(null);
  const [loading, setLoading] = useState(true);

  // Slide-up animation for preview card
  const cardSlideAnim = useRef(new Animated.Value(200)).current;
  const cardOpacityAnim = useRef(new Animated.Value(0)).current;

  const initialRegion = {
    latitude: -4.15,
    longitude: 39.65,
    latitudeDelta: 0.6,
    longitudeDelta: 0.6,
  };

  // Geocode all listings
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const list: MarkerData[] = [];
      for (const reel of reels) {
        const locationStr = reel.experience?.location || 'Mombasa';
        const baseCoords = await googleMapsService.geocodeLocation(locationStr);
        // Subtle offset to avoid exact overlap
        const offsetLat = baseCoords.latitude + (Math.random() - 0.5) * 0.025;
        const offsetLng = baseCoords.longitude + (Math.random() - 0.5) * 0.025;
        list.push({ reel, coords: { latitude: offsetLat, longitude: offsetLng } });
      }
      if (active) {
        setMarkers(list);
        setLoading(false);
        // Do NOT auto-select — card only appears on marker tap
      }
    })();
    return () => { active = false; };
  }, [reels]);

  // Animate card in/out
  const showCard = useCallback(() => {
    Animated.parallel([
      Animated.spring(cardSlideAnim, {
        toValue: 0,
        damping: 22,
        stiffness: 280,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardSlideAnim, cardOpacityAnim]);

  const hideCard = useCallback(() => {
    Animated.parallel([
      Animated.spring(cardSlideAnim, {
        toValue: 200,
        damping: 22,
        stiffness: 280,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => setSelectedReel(null));
  }, [cardSlideAnim, cardOpacityAnim]);

  const handleMarkerPress = useCallback((m: MarkerData) => {
    setSelectedReel(m.reel);
    showCard();

    // Smooth camera animation
    if (mapRef.current?.animateCamera) {
      mapRef.current.animateCamera(
        {
          center: { latitude: m.coords.latitude, longitude: m.coords.longitude },
          zoom: 13,
        },
        { duration: 350 },
      );
    } else if (mapRef.current?.animateToRegion) {
      mapRef.current.animateToRegion(
        {
          latitude: m.coords.latitude,
          longitude: m.coords.longitude,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        },
        350,
      );
    }
  }, [showCard]);

  const handleMapPress = useCallback(() => {
    if (selectedReel) hideCard();
  }, [selectedReel, hideCard]);

  const selectedExp = selectedReel?.experience;
  const selectedPrice = selectedExp?.current_price;
  const hasNativeMaps = Boolean(NativeMapView);

  // Use ClusteredMapView if available, otherwise fall back to regular MapView
  const MapComponent = ClusteredMapView || NativeMapView;

  const renderMarker = useCallback((m: MarkerData) => {
    const isSelected = selectedReel?.id === m.reel.id;
    const price = m.reel.experience?.current_price;
    const label = price ? `KES ${(price / 1000).toFixed(1)}k` : 'Stay';

    return (
      <NativeMarker
        key={m.reel.id}
        identifier={m.reel.id}
        coordinate={m.coords}
        onPress={() => handleMarkerPress(m)}
        tracksViewChanges={false}
        zIndex={isSelected ? 100 : 1}
      >
        <View style={[
          styles.markerPill,
          isSelected ? styles.markerPillSelected : styles.markerPillDefault,
          !isSelected && selectedReel ? styles.markerPillFaded : null,
        ]}>
          <Text style={[
            styles.markerPillText,
            isSelected ? styles.markerPillTextSelected : null,
          ]}>
            {label}
          </Text>
        </View>
        {isSelected && <View style={styles.markerArrow} />}
      </NativeMarker>
    );
  }, [selectedReel, handleMarkerPress]);

  return (
    <View style={styles.container}>
      {hasNativeMaps ? (
        <MapComponent
          ref={mapRef}
          provider={NativeProviderGoogle}
          style={StyleSheet.absoluteFillObject}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          showsPointsOfInterest={false}
          onPress={handleMapPress}
          // Clustering props (only effective with ClusteredMapView)
          clusterColor={ORANGE}
          clusterTextColor="#FFFFFF"
          clusterFontFamily="DMSans_700Bold"
          radius={60}
          minZoomLevel={5}
          maxZoomLevel={18}
          animationEnabled
        >
          {markers.map(renderMarker)}
        </MapComponent>
      ) : (
        /* FALLBACK: Interactive Canvas for Expo Go */
        <View style={styles.fallbackCanvas}>
          <View style={styles.fallbackGradientTop} />
          <View style={styles.fallbackGradientBottom} />
          <Text style={styles.fallbackWaterLabel}>INDIAN OCEAN</Text>

          {markers.map((m, idx) => {
            const isSelected = selectedReel?.id === m.reel.id;
            const price = m.reel.experience?.current_price;
            const label = price ? `KES ${(price / 1000).toFixed(1)}k` : 'Stay';
            const topPct = 15 + ((idx * 19) % 58);
            const leftPct = 10 + ((idx * 27) % 72);

            return (
              <Pressable
                key={m.reel.id}
                onPress={() => handleMarkerPress(m)}
                style={[styles.fallbackMarkerPos, { top: `${topPct}%`, left: `${leftPct}%` }]}
              >
                <View style={[
                  styles.markerPill,
                  isSelected ? styles.markerPillSelected : styles.markerPillDefault,
                  !isSelected && selectedReel ? styles.markerPillFaded : null,
                ]}>
                  <Text style={[
                    styles.markerPillText,
                    isSelected ? styles.markerPillTextSelected : null,
                  ]}>
                    {label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Loading Pill */}
      {loading && (
        <View style={styles.loadingPill}>
          <ActivityIndicator size="small" color={ORANGE} />
          <Text style={styles.loadingText}>Loading listings…</Text>
        </View>
      )}

      {/* ── ANIMATED PREVIEW CARD ───────────────────────────────────────── */}
      <Animated.View
        pointerEvents={selectedReel ? 'auto' : 'none'}
        style={[
          styles.previewCardWrap,
          {
            opacity: cardOpacityAnim,
            transform: [{ translateY: cardSlideAnim }],
          },
        ]}
      >
        {selectedReel && (
          <View style={styles.previewCard}>
            {/* Cover Image */}
            <View style={styles.cardCoverWrap}>
              {(selectedReel.thumbnail_url || selectedExp?.image_url) ? (
                <Image
                  source={{ uri: selectedReel.thumbnail_url || selectedExp?.image_url || '' }}
                  style={styles.cardCover}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[styles.cardCover, styles.cardCoverFallback]}>
                  <Feather name="image" size={28} color="#D1D5DB" />
                </View>
              )}
              {/* Category Tag */}
              <View style={styles.cardCategoryTag}>
                <Text style={styles.cardCategoryText}>
                  {(selectedReel.category || 'Stay').replace(/_/g, ' ')}
                </Text>
              </View>
            </View>

            {/* Info Section */}
            <View style={styles.cardBody}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {selectedExp?.title ?? 'Coastal Experience'}
                </Text>
                <View style={styles.ratingChip}>
                  <Ionicons name="star" size={11} color="#F59E0B" />
                  <Text style={styles.ratingText}>4.9</Text>
                </View>
              </View>

              <View style={styles.cardLocationRow}>
                <Feather name="map-pin" size={11} color="#9CA3AF" />
                <Text style={styles.cardLocationText} numberOfLines={1}>
                  {selectedExp?.location ?? 'Kenyan Coast'}
                </Text>
              </View>

              <View style={styles.cardBottomRow}>
                {selectedPrice != null && (
                  <Text style={styles.cardPrice}>
                    KES {Number(selectedPrice).toLocaleString()}
                    <Text style={styles.cardPriceUnit}> /night</Text>
                  </Text>
                )}

                <Pressable
                  onPress={() => onSelectReel?.(selectedReel)}
                  style={({ pressed }) => [
                    styles.viewCta,
                    pressed && { transform: [{ scale: 0.96 }] },
                  ]}
                >
                  <Text style={styles.viewCtaText}>View</Text>
                  <Feather name="arrow-right" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ── SAFE ROUTE MAP VIEW (for Journey Companion) ─────────────────────────────

interface SafeRouteMapViewProps {
  userLocation: LatLng;
  destLocation: LatLng;
  routeInfo: RouteResult | null;
  propertyTitle: string;
  isTracking?: boolean;
  onMapReady?: () => void;
}

export function SafeRouteMapView({
  userLocation,
  destLocation,
  routeInfo,
  propertyTitle,
  isTracking,
  onMapReady,
}: SafeRouteMapViewProps) {
  const mapRef = useRef<any>(null);
  const hasNativeMaps = Boolean(NativeMapView);

  // Fit map to show both origin and destination
  useEffect(() => {
    if (hasNativeMaps && mapRef.current && routeInfo?.polylineCoords?.length) {
      try {
        mapRef.current.fitToCoordinates(
          [userLocation, destLocation],
          { edgePadding: { top: 80, right: 60, bottom: 200, left: 60 }, animated: true },
        );
      } catch {
        // fitToCoordinates not available
      }
    }
  }, [routeInfo, hasNativeMaps]);

  // Follow user when tracking
  useEffect(() => {
    if (isTracking && hasNativeMaps && mapRef.current) {
      mapRef.current.animateCamera(
        { center: userLocation, zoom: 16, heading: 0, pitch: 45 },
        { duration: 500 },
      );
    }
  }, [isTracking, userLocation, hasNativeMaps]);

  if (hasNativeMaps) {
    return (
      <NativeMapView
        ref={mapRef}
        provider={NativeProviderGoogle}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: (userLocation.latitude + destLocation.latitude) / 2,
          longitude: (userLocation.longitude + destLocation.longitude) / 2,
          latitudeDelta: Math.abs(userLocation.latitude - destLocation.latitude) * 2.2 + 0.05,
          longitudeDelta: Math.abs(userLocation.longitude - destLocation.longitude) * 2.2 + 0.05,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        showsTraffic
        onMapReady={onMapReady}
      >
        {/* Route Polyline — Google Maps blue */}
        {routeInfo?.polylineCoords && routeInfo.polylineCoords.length > 1 && (
          <>
            {/* Shadow polyline for depth */}
            <NativePolyline
              coordinates={routeInfo.polylineCoords}
              strokeColor="rgba(66, 133, 244, 0.3)"
              strokeWidth={8}
            />
            {/* Main polyline */}
            <NativePolyline
              coordinates={routeInfo.polylineCoords}
              strokeColor={GOOGLE_BLUE}
              strokeWidth={5}
            />
          </>
        )}

        {/* Destination Marker */}
        <NativeMarker
          coordinate={destLocation}
          title={propertyTitle}
          tracksViewChanges={false}
        >
          <View style={styles.destPinOuter}>
            <View style={styles.destPinInner}>
              <Ionicons name="location" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.destPinShadow} />
          </View>
        </NativeMarker>
      </NativeMapView>
    );
  }

  // Fallback for Expo Go / JS-only environments
  return (
    <View style={[StyleSheet.absoluteFillObject, styles.fallbackRoute]}>
      <View style={styles.fallbackRouteGrad} />
      <View style={styles.fallbackRouteLine} />
      <View style={styles.destPinOuter}>
        <View style={styles.destPinInner}>
          <Ionicons name="location" size={18} color="#FFFFFF" />
        </View>
      </View>
      <View style={styles.fallbackUserDot} />
    </View>
  );
}

// ── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Loading
  loadingPill: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  loadingText: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#374151' },

  // ── MARKER PILLS ──────────────────────────────────────────────
  markerPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  markerPillDefault: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  markerPillSelected: {
    backgroundColor: ORANGE,
    borderWidth: 0,
    transform: [{ scale: 1.12 }],
    shadowColor: ORANGE,
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  markerPillFaded: {
    opacity: 0.55,
  },
  markerPillText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  markerPillTextSelected: {
    color: '#FFFFFF',
  },
  markerArrow: {
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: ORANGE,
    marginTop: -1,
  },

  // ── FALLBACK CANVAS ───────────────────────────────────────────
  fallbackCanvas: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#DBEAFE',
    overflow: 'hidden',
  },
  fallbackGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '35%',
    backgroundColor: '#E8F5E9',
    opacity: 0.6,
  },
  fallbackGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '25%',
    backgroundColor: '#B3E5FC',
    opacity: 0.4,
  },
  fallbackWaterLabel: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#0284C7',
    letterSpacing: 3,
    opacity: 0.25,
  },
  fallbackMarkerPos: {
    position: 'absolute',
    zIndex: 10,
  },

  // ── PREVIEW CARD ──────────────────────────────────────────────
  previewCardWrap: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cardCoverWrap: {
    width: '100%',
    height: 140,
    position: 'relative',
  },
  cardCover: {
    width: '100%',
    height: '100%',
  },
  cardCoverFallback: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCategoryTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  cardCategoryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    textTransform: 'capitalize',
  },
  cardBody: {
    padding: 14,
    gap: 6,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#92400E',
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardLocationText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardPrice: {
    fontSize: 17,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  cardPriceUnit: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },
  viewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111111',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
  },
  viewCtaText: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },

  // ── DESTINATION PIN ───────────────────────────────────────────
  destPinOuter: {
    alignItems: 'center',
  },
  destPinInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  destPinShadow: {
    width: 12,
    height: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginTop: 2,
  },

  // ── FALLBACK ROUTE VIEW ───────────────────────────────────────
  fallbackRoute: {
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fallbackRouteGrad: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#DBEAFE',
    opacity: 0.5,
  },
  fallbackRouteLine: {
    width: 200,
    height: 4,
    backgroundColor: GOOGLE_BLUE,
    borderRadius: 2,
    transform: [{ rotate: '-30deg' }],
    opacity: 0.7,
  },
  fallbackUserDot: {
    position: 'absolute',
    bottom: '35%',
    left: '30%',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: GOOGLE_BLUE,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
});
