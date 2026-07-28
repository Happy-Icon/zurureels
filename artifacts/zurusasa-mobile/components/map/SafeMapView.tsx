import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

/**
 * Safely checks if the native RNMapsAirModule is linked in the native binary.
 */
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

if (isNativeMapsAvailable()) {
  try {
    const maps = require('react-native-maps');
    NativeMapView = maps.default;
    NativeMarker = maps.Marker;
    NativePolyline = maps.Polyline;
    NativeProviderGoogle = maps.PROVIDER_GOOGLE;
  } catch {
    // Fallback gracefully
  }
}

// ── DISCOVER MAP SAFE VIEW ──────────────────────────────────────────────────

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

  const initialRegion = {
    latitude: -4.15,
    longitude: 39.65,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const list: MarkerData[] = [];
      for (let i = 0; i < reels.length; i++) {
        const reel = reels[i];
        const locationStr = reel.experience?.location || 'Mombasa';
        const baseCoords = await googleMapsService.geocodeLocation(locationStr);
        const offsetLat = baseCoords.latitude + (Math.random() - 0.5) * 0.04;
        const offsetLng = baseCoords.longitude + (Math.random() - 0.5) * 0.04;

        list.push({
          reel,
          coords: { latitude: offsetLat, longitude: offsetLng },
        });
      }

      if (active) {
        setMarkers(list);
        setLoading(false);
        if (list.length > 0) setSelectedReel(list[0].reel);
      }
    })();

    return () => {
      active = false;
    };
  }, [reels]);

  const handleSelectMarker = (m: MarkerData) => {
    setSelectedReel(m.reel);
    if (mapRef.current?.animateToRegion) {
      mapRef.current.animateToRegion(
        {
          latitude: m.coords.latitude,
          longitude: m.coords.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        },
        400,
      );
    }
  };

  const selectedExp = selectedReel?.experience;
  const selectedPrice = selectedExp?.current_price;

  const hasNativeMaps = Boolean(NativeMapView);

  return (
    <View style={styles.container}>
      {hasNativeMaps ? (
        /* NATIVE GOOGLE MAPS SDK (WHEN RUNNING IN BUILT APK/IPA) */
        <NativeMapView
          ref={mapRef}
          provider={NativeProviderGoogle}
          style={StyleSheet.absoluteFillObject}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
        >
          {markers.map((m) => {
            const isSelected = selectedReel?.id === m.reel.id;
            const price = m.reel.experience?.current_price;
            const label = price ? `KES ${(price / 1000).toFixed(1)}k` : 'Stay';

            return (
              <NativeMarker
                key={m.reel.id}
                coordinate={m.coords}
                onPress={() => handleSelectMarker(m)}
                zIndex={isSelected ? 100 : 1}
              >
                <View
                  style={[
                    styles.markerBubble,
                    isSelected && styles.markerBubbleSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.markerText,
                      isSelected && styles.markerTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              </NativeMarker>
            );
          })}
        </NativeMapView>
      ) : (
        /* INTERACTIVE EXPANSIVE MAP CANVAS (FOR EXPO GO & JS CONTAINERS) */
        <View style={styles.fallbackCanvas}>
          <View style={styles.gridLinesWrap}>
            <View style={styles.coastlinePath} />
            <Text style={styles.waterLabel}>INDIAN OCEAN</Text>
          </View>

          {/* Render Interactive Listing Pins */}
          {markers.map((m, idx) => {
            const isSelected = selectedReel?.id === m.reel.id;
            const price = m.reel.experience?.current_price;
            const label = price ? `KES ${(price / 1000).toFixed(1)}k` : 'Stay';

            // Spread out markers across canvas for interactive map feel
            const topPct = 20 + ((idx * 17) % 55);
            const leftPct = 15 + ((idx * 23) % 65);

            return (
              <Pressable
                key={m.reel.id}
                onPress={() => handleSelectMarker(m)}
                style={[
                  styles.fallbackMarker,
                  { top: `${topPct}%`, left: `${leftPct}%` },
                ]}
              >
                <View
                  style={[
                    styles.markerBubble,
                    isSelected && styles.markerBubbleSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.markerText,
                      isSelected && styles.markerTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {loading ? (
        <View style={styles.loadingPill}>
          <ActivityIndicator size="small" color={ORANGE} />
          <Text style={styles.loadingText}>Loading Map Listings…</Text>
        </View>
      ) : null}

      {/* ── SELECTED LISTING PREVIEW CARD DOCK ──────────────────────── */}
      {selectedReel ? (
        <View style={styles.previewCard}>
          <View style={styles.cardImageWrap}>
            {selectedReel.thumbnail_url || selectedExp?.image_url ? (
              <Image
                source={{
                  uri: selectedReel.thumbnail_url || selectedExp?.image_url || '',
                }}
                style={styles.cardImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.cardImage, styles.cardImageFallback]}>
                <Feather name="image" size={24} color="#D1D5DB" />
              </View>
            )}
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>
                {(selectedReel.category || 'Stay').replace(/_/g, ' ')}
              </Text>
            </View>
          </View>

          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {selectedExp?.title ?? 'Coastal Experience'}
            </Text>

            <View style={styles.locationRow}>
              <Feather name="map-pin" size={11} color="#9CA3AF" />
              <Text style={styles.locationText} numberOfLines={1}>
                {selectedExp?.location ?? 'Kenyan Coast'}
              </Text>
            </View>

            <View style={styles.priceRatingRow}>
              {selectedPrice != null ? (
                <Text style={styles.priceText}>
                  KES {Number(selectedPrice).toLocaleString()}
                </Text>
              ) : null}

              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.ratingText}>4.9</Text>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => onOpenDirections?.(selectedReel)}
                style={styles.directionsBtn}
              >
                <Feather name="navigation" size={13} color="#374151" />
                <Text style={styles.directionsBtnText}>Directions</Text>
              </Pressable>

              <Pressable
                onPress={() => onSelectReel?.(selectedReel)}
                style={styles.viewBtn}
              >
                <Text style={styles.viewBtnText}>View</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ── SAFE ROUTE MAP VIEW (FOR JOURNEY COMPANION SHEET) ────────────────────────

interface SafeRouteMapViewProps {
  destLocation: LatLng;
  routeInfo: RouteResult | null;
  propertyTitle: string;
}

export function SafeRouteMapView({
  destLocation,
  routeInfo,
  propertyTitle,
}: SafeRouteMapViewProps) {
  const hasNativeMaps = Boolean(NativeMapView);

  if (hasNativeMaps) {
    return (
      <NativeMapView
        provider={NativeProviderGoogle}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: destLocation.latitude,
          longitude: destLocation.longitude,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
        showsUserLocation
        showsCompass={false}
      >
        {routeInfo?.polylineCoords ? (
          <NativePolyline
            coordinates={routeInfo.polylineCoords}
            strokeColor={ORANGE}
            strokeWidth={4}
          />
        ) : null}
        <NativeMarker coordinate={destLocation} title={propertyTitle}>
          <View style={styles.destMarker}>
            <Ionicons name="location" size={20} color="#FFFFFF" />
          </View>
        </NativeMarker>
      </NativeMapView>
    );
  }

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.fallbackCanvas]}>
      <View style={styles.routePathFallback} />
      <View style={styles.destMarker}>
        <Ionicons name="location" size={20} color="#FFFFFF" />
      </View>
    </View>
  );
}

// ── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingPill: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  loadingText: { fontSize: 12.5, fontFamily: 'DMSans_600SemiBold', color: '#374151' },

  // Fallback Canvas
  fallbackCanvas: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  gridLinesWrap: { ...StyleSheet.absoluteFillObject, opacity: 0.3 },
  coastlinePath: {
    position: 'absolute',
    left: -40,
    top: 0,
    bottom: 0,
    width: 140,
    backgroundColor: '#F0FDF4',
    borderRightWidth: 3,
    borderRightColor: '#86EFAC',
  },
  waterLabel: {
    position: 'absolute',
    right: 24,
    bottom: 40,
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#0284C7',
    letterSpacing: 2,
    opacity: 0.4,
  },
  fallbackMarker: {
    position: 'absolute',
    zIndex: 10,
  },
  routePathFallback: {
    width: 180,
    height: 3,
    backgroundColor: ORANGE,
    borderRadius: 2,
    transform: [{ rotate: '-35deg' }],
  },

  // Markers
  markerBubble: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  markerBubbleSelected: {
    backgroundColor: '#111111',
    borderColor: '#111111',
    transform: [{ scale: 1.1 }],
  },
  markerText: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: '#111111' },
  markerTextSelected: { color: '#FFFFFF' },
  destMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  // Preview Card Dock
  previewCard: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cardImageWrap: {
    width: 100,
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  cardImage: { width: '100%', height: '100%' },
  cardImageFallback: { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  categoryBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 100,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  categoryText: { color: '#FFFFFF', fontSize: 9, fontFamily: 'DMSans_700Bold', textTransform: 'capitalize' },
  cardInfo: { flex: 1, justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: '#111111' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  locationText: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#6B7280' },
  priceRatingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  priceText: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: ORANGE },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: { fontSize: 11.5, fontFamily: 'DMSans_700Bold', color: '#92400E' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  directionsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  directionsBtnText: { fontSize: 11.5, fontFamily: 'DMSans_600SemiBold', color: '#374151' },
  viewBtn: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewBtnText: { fontSize: 11.5, fontFamily: 'DMSans_700Bold', color: '#FFFFFF' },
});
