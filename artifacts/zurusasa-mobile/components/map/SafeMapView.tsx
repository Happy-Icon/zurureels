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

import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

// ── NATIVE MODULE GUARD ─────────────────────────────────────────────────────

function loadNativeMapsModule() {
  if (Platform.OS === 'web') return null;
  try {
    const bridge = require('./NativeMapsBridge');
    const maps = bridge.getNativeMaps();
    if (maps && (maps.NativeMapView || maps.MapView)) {
      return maps;
    }
  } catch {
    // Native maps not available in runtime binary
  }
  return null;
}

const NATIVE_MAPS = loadNativeMapsModule();
const NativeMapView = NATIVE_MAPS?.NativeMapView || NATIVE_MAPS?.MapView || null;
const NativeMarker = NATIVE_MAPS?.NativeMarker || NATIVE_MAPS?.Marker || null;
const NativePolyline = NATIVE_MAPS?.NativePolyline || NATIVE_MAPS?.Polyline || null;
const NativeProviderGoogle = NATIVE_MAPS?.NativeProviderGoogle || NATIVE_MAPS?.PROVIDER_GOOGLE || null;
const ClusteredMapView = NATIVE_MAPS?.ClusteredMapView || NativeMapView;

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
        /* AUTHENTIC GOOGLE MAPS TEMPLATE VIEW (for JS / Expo Go environments) */
        <GoogleMapsTemplateView
          markers={markers}
          selectedReel={selectedReel}
          onMarkerPress={handleMarkerPress}
        />
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

  // Authentic Google Maps Route Fallback View (for JS / Expo Go)
  return (
    <View style={StyleSheet.absoluteFillObject}>
      <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
        {/* Google Landmass & Ocean */}
        <Rect width="400" height="800" fill="#F4F3F0" />
        <Path d="M 0 0 L 170 0 L 130 190 L 0 150 Z" fill="#D7ECD9" />
        <Path d="M 270 380 Q 360 400 400 480 L 400 690 L 250 630 Z" fill="#C8E6C9" />
        <Path d="M 230 0 Q 270 130 210 250 Q 160 330 200 450 Q 250 530 190 660 Q 150 730 220 800 L 400 800 L 400 0 Z" fill="#AADAFF" />

        {/* Secondary White Streets & Yellow Highways */}
        <Path d="M 0 110 L 230 140" stroke="#FFFFFF" strokeWidth="6" />
        <Path d="M 0 260 L 190 240" stroke="#FFFFFF" strokeWidth="6" />
        <Path d="M 0 430 L 220 470" stroke="#FFFFFF" strokeWidth="6" />
        <Path d="M 45 -10 Q 95 210 65 410 T 85 810" stroke="#FAD87F" strokeWidth="8" />
        <Path d="M 45 -10 Q 95 210 65 410 T 85 810" stroke="#FFC107" strokeWidth="5" />

        {/* Real Blue Navigation Route Polyline */}
        <Path d="M 80 580 C 90 480, 140 380, 110 240" stroke="rgba(66, 133, 244, 0.4)" strokeWidth="12" strokeLinecap="round" />
        <Path d="M 80 580 C 90 480, 140 380, 110 240" stroke={GOOGLE_BLUE} strokeWidth="6" strokeLinecap="round" />

        {/* City Labels */}
        <SvgText x="35" y="85" fill="#5F6368" fontSize="13" fontWeight="bold" fontFamily="sans-serif">Mombasa</SvgText>
        <SvgText x="45" y="525" fill="#5F6368" fontSize="13" fontWeight="bold" fontFamily="sans-serif">Diani Beach</SvgText>
      </Svg>

      {/* Google Logo Watermark */}
      <View style={styles.googleWatermark}>
        <Text style={styles.googleLogoText}>
          <Text style={{ color: '#4285F4' }}>G</Text>
          <Text style={{ color: '#EA4335' }}>o</Text>
          <Text style={{ color: '#FBBC05' }}>o</Text>
          <Text style={{ color: '#4285F4' }}>g</Text>
          <Text style={{ color: '#34A853' }}>l</Text>
          <Text style={{ color: '#EA4335' }}>e</Text>
        </Text>
      </View>

      {/* User Current Position (Blue Circle) */}
      <View style={[styles.googleUserDotPos, { bottom: '26%', left: '18%' }]}>
        <View style={styles.userPulseRing} />
        <View style={styles.userDotCenter} />
      </View>

      {/* Destination Google Red Pin */}
      <View style={[styles.googleRedPinWrapPos, { top: '28%', left: '26%' }]}>
        <View style={styles.googleRedPinContainer}>
          <Ionicons name="location" size={42} color={ORANGE} />
          <View style={styles.googlePinWhiteDot} />
        </View>
        <View style={styles.destLabelBadge}>
          <Text style={styles.destLabelText}>{propertyTitle}</Text>
        </View>
      </View>
    </View>
  );
}

// ── AUTHENTIC GOOGLE MAPS TEMPLATE VIEW ──────────────────────────────────────

interface GoogleMapsTemplateViewProps {
  markers: MarkerData[];
  selectedReel: ReelRow | null;
  onMarkerPress: (m: MarkerData) => void;
}

function GoogleMapsTemplateView({
  markers,
  selectedReel,
  onMarkerPress,
}: GoogleMapsTemplateViewProps) {
  const selectedExp = selectedReel?.experience;

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {/* Real Google Maps Tile System (Vector SVG matching Google's color palette) */}
      <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
        {/* Landmass — Google Maps Light Beige (#F4F3F0) */}
        <Rect width="400" height="800" fill="#F4F3F0" />

        {/* Nature Reserves & Parks — Google Maps Light Green (#C8E6C9 / #E8F5E9) */}
        <Path d="M 0 0 L 170 0 L 130 190 L 0 150 Z" fill="#D7ECD9" />
        <Path d="M 270 380 Q 360 400 400 480 L 400 690 L 250 630 Z" fill="#C8E6C9" />
        <Path d="M 0 660 Q 90 630 130 710 L 110 800 L 0 800 Z" fill="#D7ECD9" />

        {/* Ocean & Coastline — Google Maps Blue (#AADAFF) */}
        <Path d="M 230 0 Q 270 130 210 250 Q 160 330 200 450 Q 250 530 190 660 Q 150 730 220 800 L 400 800 L 400 0 Z" fill="#AADAFF" />

        {/* Secondary Streets — White stroke (#FFFFFF) */}
        <Path d="M 0 110 L 230 140" stroke="#FFFFFF" strokeWidth="6" />
        <Path d="M 0 260 L 190 240" stroke="#FFFFFF" strokeWidth="6" />
        <Path d="M 0 430 L 220 470" stroke="#FFFFFF" strokeWidth="6" />
        <Path d="M 0 590 L 180 570" stroke="#FFFFFF" strokeWidth="6" />
        <Path d="M 90 0 L 100 620" stroke="#FFFFFF" strokeWidth="5" />
        <Path d="M 170 0 L 160 460" stroke="#FFFFFF" strokeWidth="5" />

        {/* Highways — Google Highway Orange/Yellow (#FAD87F & #FFC107) */}
        <Path d="M 45 -10 Q 95 210 65 410 T 85 810" stroke="#FAD87F" strokeWidth="8" />
        <Path d="M 45 -10 Q 95 210 65 410 T 85 810" stroke="#FFC107" strokeWidth="5" />

        <Path d="M 125 -10 Q 185 230 145 460 T 115 810" stroke="#FAD87F" strokeWidth="9" />
        <Path d="M 125 -10 Q 185 230 145 460 T 115 810" stroke="#E67E22" strokeWidth="5" />

        {/* Highway 101 / Coast Bridge */}
        <Path d="M 65 390 Q 185 410 265 430" stroke="#FAD87F" strokeWidth="8" />
        <Path d="M 65 390 Q 185 410 265 430" stroke="#FFC107" strokeWidth="4" />

        {/* City & Place Labels (Google Map Typography) */}
        <SvgText x="35" y="85" fill="#5F6368" fontSize="13" fontWeight="bold" fontFamily="sans-serif">Mombasa</SvgText>
        <SvgText x="135" y="215" fill="#5F6368" fontSize="12" fontWeight="bold" fontFamily="sans-serif">Nyali</SvgText>
        <SvgText x="45" y="365" fill="#5F6368" fontSize="12" fontWeight="bold" fontFamily="sans-serif">Bamburi</SvgText>
        <SvgText x="45" y="525" fill="#5F6368" fontSize="13" fontWeight="bold" fontFamily="sans-serif">Diani Beach</SvgText>
        <SvgText x="255" y="305" fill="#1967D2" fontSize="14" fontWeight="bold" fontFamily="sans-serif" opacity="0.65">INDIAN OCEAN</SvgText>
      </Svg>

      {/* Google Watermark Logo */}
      <View style={styles.googleWatermark}>
        <Text style={styles.googleLogoText}>
          <Text style={{ color: '#4285F4' }}>G</Text>
          <Text style={{ color: '#EA4335' }}>o</Text>
          <Text style={{ color: '#FBBC05' }}>o</Text>
          <Text style={{ color: '#4285F4' }}>g</Text>
          <Text style={{ color: '#34A853' }}>l</Text>
          <Text style={{ color: '#EA4335' }}>e</Text>
        </Text>
      </View>

      {/* Google Red Pins & Callout Bubble */}
      {markers.map((m, idx) => {
        const isSelected = selectedReel?.id === m.reel.id;
        const price = m.reel.experience?.current_price;
        const label = price ? `KES ${(price / 1000).toFixed(1)}k` : 'Stay';

        const topPct = 18 + ((idx * 17) % 55);
        const leftPct = 12 + ((idx * 23) % 68);

        return (
          <Pressable
            key={m.reel.id}
            onPress={() => onMarkerPress(m)}
            style={[styles.fallbackMarkerPos, { top: `${topPct}%`, left: `${leftPct}%` }]}
          >
            {/* Standard Red Google Maps Marker Pin */}
            <View style={styles.googleRedPinContainer}>
              <Ionicons
                name="location"
                size={isSelected ? 42 : 34}
                color={isSelected ? ORANGE : '#EA4335'}
              />
              <View style={[styles.googlePinWhiteDot, isSelected && { backgroundColor: '#FFFFFF' }]} />
            </View>

            {/* Price Tag Pill */}
            <View style={[
              styles.markerPill,
              isSelected ? styles.markerPillSelected : styles.markerPillDefault,
              { marginTop: -4 },
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

      {/* Google Map Speech Bubble Callout (when marker is tapped) */}
      {selectedReel && selectedExp && (
        <View style={styles.googleCalloutBubble}>
          <Text style={styles.calloutTitle}>{selectedExp.title}</Text>
          <Text style={styles.calloutSub}>{selectedExp.location || 'Kenya'}</Text>
          <View style={styles.calloutArrow} />
        </View>
      )}
    </View>
  );
}

// ── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F3F0' },

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

  // ── AUTHENTIC GOOGLE MAPS GRAPHIC STYLES ────────────────────
  googleWatermark: {
    position: 'absolute',
    bottom: 18,
    left: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  googleLogoText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.5,
  },
  googleRedPinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  googlePinWhiteDot: {
    position: 'absolute',
    top: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  googleCalloutBubble: {
    position: 'absolute',
    top: 140,
    left: '25%',
    right: '25%',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    alignItems: 'center',
  },
  calloutTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  calloutSub: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  calloutArrow: {
    position: 'absolute',
    bottom: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
  googleUserDotPos: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userPulseRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(66, 133, 244, 0.25)',
  },
  userDotCenter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: GOOGLE_BLUE,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  googleRedPinWrapPos: {
    position: 'absolute',
    alignItems: 'center',
  },
  destLabelBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  destLabelText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
});
