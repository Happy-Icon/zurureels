import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import type { BookingRow } from '@/lib/supabase';
import { googleMapsService, type LatLng, type RouteResult } from '@/services/googleMapsService';
import { SafeRouteMapView } from '@/components/map/SafeMapView';

const ORANGE = '#F26522';
const GOOGLE_BLUE = '#4285F4';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type JourneyMode = 'overview' | 'navigating';

interface JourneyCompanionSheetProps {
  visible: boolean;
  onClose: () => void;
  booking: BookingRow;
  onMessageHost: () => void;
}

export function JourneyCompanionSheet({
  visible,
  onClose,
  booking,
  onMessageHost,
}: JourneyCompanionSheetProps) {
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheet>(null);

  const [mode, setMode] = useState<JourneyMode>('overview');
  const [showNavChoice, setShowNavChoice] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteResult | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng>({ latitude: -4.0435, longitude: 39.6682 });
  const [destLocation, setDestLocation] = useState<LatLng>({ latitude: -4.2797, longitude: 39.5947 });
  const [mapReady, setMapReady] = useState(false);

  const exp = booking.experience;
  const propertyTitle = exp?.title ?? 'Coastal Sanctuary';
  const locationName = exp?.location ?? 'Diani Beach, Kenya';
  const hostName = booking.experience?.entity_name ?? 'Zuru Host';
  const checkInTime = '3:00 PM';

  const travelTimeMin = routeInfo?.durationMin ?? 42;
  const distanceKm = routeInfo?.distanceKm ?? 35;
  const trafficCond = routeInfo?.trafficCondition ?? 'Light';

  // Bottom sheet snap points: 35%, 60%, 90%
  const snapPoints = useMemo(() => ['35%', '60%', '90%'], []);

  // Geocode destination & fetch route
  useEffect(() => {
    if (!visible) return;
    let active = true;

    (async () => {
      try {
        const dest = await googleMapsService.geocodeLocation(locationName);
        if (!active) return;
        setDestLocation(dest);

        let origin = { latitude: -4.0435, longitude: 39.6682 };
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          if (pos?.coords) {
            origin = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          }
        }
        if (!active) return;
        setUserLocation(origin);

        const route = await googleMapsService.fetchRoute(origin, dest);
        if (active) setRouteInfo(route);
      } catch {
        // Fallback handled in service
      }
    })();

    return () => { active = false; };
  }, [locationName, visible]);

  const handleStartNavigation = useCallback(() => {
    setShowNavChoice(true);
  }, []);

  const handleNavigateInApp = useCallback(() => {
    setShowNavChoice(false);
    setMode('navigating');
    // Snap sheet to summary (35%)
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  const handleNavigateGoogleMaps = useCallback(() => {
    setShowNavChoice(false);
    const locStr = `${destLocation.latitude},${destLocation.longitude}`;
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(locationName)}&ll=${locStr}`,
      android: `google.navigation:q=${locStr}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${locStr}`,
    }) || '';
    if (url) Linking.openURL(url);
  }, [destLocation, locationName]);

  const handleShareETA = useCallback(() => {
    Alert.alert(
      'ETA Shared ✈️',
      `Your estimated arrival has been shared with ${hostName}. ~${travelTimeMin} min away.`,
    );
  }, [hostName, travelTimeMin]);

  const handleCallHost = useCallback(() => {
    Alert.alert('Call Host', `Calling ${hostName}…`);
  }, [hostName]);

  const trafficColor = trafficCond === 'Heavy' ? '#EF4444' : trafficCond === 'Moderate' ? '#F59E0B' : '#10B981';

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]}>
      {/* ── FULL-SCREEN GOOGLE MAP ─────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill}>
        <SafeRouteMapView
          userLocation={userLocation}
          destLocation={destLocation}
          routeInfo={routeInfo}
          propertyTitle={propertyTitle}
          isTracking={mode === 'navigating'}
          onMapReady={() => setMapReady(true)}
        />

        {/* Close button floating on map */}
        <Pressable
          onPress={onClose}
          style={[styles.mapCloseBtn, { top: insets.top + 10 }]}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={20} color="#111111" />
        </Pressable>

        {/* Live ETA Bubble floating on map */}
        <Animated.View
          entering={FadeIn.delay(300).duration(400)}
          style={[styles.etaBubble, { top: insets.top + 10 }]}
        >
          <View style={styles.etaBubbleInner}>
            <Text style={styles.etaBubbleTime}>{travelTimeMin} min</Text>
            <Text style={styles.etaBubbleDist}>{distanceKm} km</Text>
          </View>
          <View style={[styles.trafficDot, { backgroundColor: trafficColor }]} />
        </Animated.View>
      </View>

      {/* ── DRAGGABLE BOTTOM SHEET ─────────────────────────────────── */}
      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        handleIndicatorStyle={styles.sheetHandle}
        backgroundStyle={styles.sheetBg}
        style={styles.sheetShadow}
      >
        <BottomSheetScrollView
          contentContainerStyle={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── JOURNEY SUMMARY HEADER ───────────────────────────── */}
          <View style={styles.summaryHeader}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryTitle} numberOfLines={1}>{propertyTitle}</Text>
              <View style={styles.summaryLocationRow}>
                <Feather name="map-pin" size={12} color="#9CA3AF" />
                <Text style={styles.summaryLocation} numberOfLines={1}>{locationName}</Text>
              </View>
            </View>
            <View style={styles.summaryEtaPill}>
              <Feather name="clock" size={13} color={ORANGE} />
              <Text style={styles.summaryEtaText}>{travelTimeMin} min</Text>
            </View>
          </View>

          {/* ── LIVE ROUTE METRICS ────────────────────────────────── */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Feather name="navigation" size={16} color={GOOGLE_BLUE} />
              <Text style={styles.metricValue}>{distanceKm} km</Text>
              <Text style={styles.metricLabel}>Distance</Text>
            </View>
            <View style={styles.metricCard}>
              <Feather name="clock" size={16} color={ORANGE} />
              <Text style={styles.metricValue}>{travelTimeMin} min</Text>
              <Text style={styles.metricLabel}>Travel Time</Text>
            </View>
            <View style={styles.metricCard}>
              <View style={[styles.trafficIndicator, { backgroundColor: trafficColor }]} />
              <Text style={styles.metricValue}>{trafficCond}</Text>
              <Text style={styles.metricLabel}>Traffic</Text>
            </View>
            <View style={styles.metricCard}>
              <Feather name="log-in" size={16} color="#10B981" />
              <Text style={styles.metricValue}>{checkInTime}</Text>
              <Text style={styles.metricLabel}>Check-in</Text>
            </View>
          </View>

          {/* ── START NAVIGATION CTA ─────────────────────────────── */}
          {mode === 'overview' && !showNavChoice && (
            <Pressable
              onPress={handleStartNavigation}
              style={({ pressed }) => [
                styles.startNavBtn,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons name="navigate" size={20} color="#FFFFFF" />
              <Text style={styles.startNavBtnText}>START NAVIGATION</Text>
            </Pressable>
          )}

          {/* ── NAVIGATION CHOICE STRIP ──────────────────────────── */}
          {showNavChoice && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.navChoiceWrap}>
              <Text style={styles.navChoiceTitle}>Continue with…</Text>
              <View style={styles.navChoiceRow}>
                <Pressable
                  onPress={handleNavigateInApp}
                  style={({ pressed }) => [
                    styles.navChoiceBtn,
                    styles.navChoiceBtnPrimary,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <MaterialCommunityIcons name="compass-outline" size={20} color="#FFFFFF" />
                  <View>
                    <Text style={styles.navChoiceBtnTextPrimary}>Navigate in ZuruSasa</Text>
                    <Text style={styles.navChoiceBtnSub}>Live in-app guidance</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={handleNavigateGoogleMaps}
                  style={({ pressed }) => [
                    styles.navChoiceBtn,
                    styles.navChoiceBtnSecondary,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Ionicons name="map-outline" size={20} color="#111111" />
                  <View>
                    <Text style={styles.navChoiceBtnTextSecondary}>Open Google Maps</Text>
                    <Text style={styles.navChoiceBtnSubDark}>Turn-by-turn directions</Text>
                  </View>
                </Pressable>
              </View>
            </Animated.View>
          )}

          {/* ── IN-APP NAVIGATING STRIP ──────────────────────────── */}
          {mode === 'navigating' && (
            <View style={styles.navActiveStrip}>
              <View style={styles.navActiveDot} />
              <Text style={styles.navActiveText}>NAVIGATING — {travelTimeMin} min remaining</Text>
              <Pressable onPress={() => setMode('overview')} hitSlop={8}>
                <Text style={styles.navActiveStop}>End</Text>
              </Pressable>
            </View>
          )}

          {/* ── AI TRAVEL INSIGHTS ───────────────────────────────── */}
          <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <MaterialCommunityIcons name="creation" size={16} color={ORANGE} />
              <Text style={styles.insightTitle}>AI Travel Insights</Text>
            </View>
            <Text style={styles.insightBody}>
              • {trafficCond} traffic along the coastal highway. {trafficCond === 'Light' ? 'Great conditions for travel.' : 'Consider leaving 15 min early.'}
              {'\n'}• Route distance: {routeInfo?.distanceText || `${distanceKm} km`} via the main highway.
              {'\n'}• Recommended departure: 1:45 PM for a {checkInTime} check-in.
            </Text>
          </View>

          {/* ── HOST INFORMATION ──────────────────────────────────── */}
          <View style={styles.hostCard}>
            <View style={styles.hostLeft}>
              <View style={styles.hostAvatar}>
                <Text style={styles.hostAvatarText}>{hostName.charAt(0)}</Text>
              </View>
              <View>
                <Text style={styles.hostLabel}>Your Host</Text>
                <Text style={styles.hostName}>{hostName}</Text>
              </View>
            </View>
            <View style={styles.hostActions}>
              <Pressable
                onPress={onMessageHost}
                style={({ pressed }) => [styles.hostActionBtn, pressed && { opacity: 0.8 }]}
              >
                <Feather name="message-square" size={16} color={ORANGE} />
              </Pressable>
              <Pressable
                onPress={handleCallHost}
                style={({ pressed }) => [styles.hostActionBtn, pressed && { opacity: 0.8 }]}
              >
                <Feather name="phone" size={16} color="#10B981" />
              </Pressable>
            </View>
          </View>

          {/* ── SECONDARY ACTIONS ─────────────────────────────────── */}
          <View style={styles.secondaryRow}>
            <Pressable
              onPress={handleShareETA}
              style={({ pressed }) => [styles.secAction, pressed && { opacity: 0.85 }]}
            >
              <Feather name="share-2" size={16} color="#374151" />
              <Text style={styles.secActionText}>Share ETA</Text>
            </Pressable>
            <Pressable
              onPress={() => Alert.alert('Saved Offline 💾', 'Route and itinerary saved for offline access.')}
              style={({ pressed }) => [styles.secAction, pressed && { opacity: 0.85 }]}
            >
              <Feather name="download" size={16} color="#374151" />
              <Text style={styles.secActionText}>Save Offline</Text>
            </Pressable>
          </View>

        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

// ── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Map Overlay Controls
  mapCloseBtn: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 10,
  },
  etaBubble: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    zIndex: 10,
  },
  etaBubbleInner: {
    alignItems: 'center',
  },
  etaBubbleTime: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  etaBubbleDist: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },
  trafficDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Bottom Sheet
  sheetBg: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  sheetContent: {
    paddingHorizontal: 20,
    gap: 16,
  },

  // Summary Header
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLeft: {
    flex: 1,
    gap: 2,
  },
  summaryTitle: {
    fontSize: 19,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  summaryLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryLocation: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },
  summaryEtaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF5EF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDDFCB',
  },
  summaryEtaText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },

  // Metrics Row
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  metricValue: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },
  trafficIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // Start Navigation CTA
  startNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 54,
    borderRadius: 16,
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  startNavBtnText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Navigation Choice
  navChoiceWrap: {
    gap: 10,
  },
  navChoiceTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#374151',
  },
  navChoiceRow: {
    gap: 8,
  },
  navChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
  },
  navChoiceBtnPrimary: {
    backgroundColor: ORANGE,
  },
  navChoiceBtnSecondary: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  navChoiceBtnTextPrimary: {
    fontSize: 14.5,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  navChoiceBtnSub: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.8)',
  },
  navChoiceBtnTextSecondary: {
    fontSize: 14.5,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  navChoiceBtnSubDark: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },

  // Navigation Active Strip
  navActiveStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111111',
    borderRadius: 14,
    padding: 14,
  },
  navActiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  navActiveText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  navActiveStop: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#EF4444',
  },

  // AI Insight Card
  insightCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 14,
    gap: 8,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  insightTitle: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },
  insightBody: {
    fontSize: 12.5,
    fontFamily: 'DMSans_400Regular',
    color: '#4B5563',
    lineHeight: 19,
  },

  // Host Card
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    padding: 12,
  },
  hostLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hostAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
  },
  hostLabel: {
    fontSize: 10.5,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },
  hostName: {
    fontSize: 14.5,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  hostActions: {
    flexDirection: 'row',
    gap: 8,
  },
  hostActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Secondary Actions
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  secActionText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#374151',
  },
});
