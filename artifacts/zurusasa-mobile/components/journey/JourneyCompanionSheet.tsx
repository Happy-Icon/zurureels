import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import type { BookingRow, LocationPrecision } from '@/lib/supabase';
import { SafeRouteMapView } from '@/components/map/SafeMapView';
import { useCustomAlert } from '@/context/CustomAlertContext';
import {
  haversineDistanceKm,
  mapService,
  resolveExperienceCoords,
  type LatLng,
  type RoadRouteResult,
} from '@/services/mapService';

const ORANGE = '#F26522';
const ROUTE_BLUE = '#2563EB';

export type JourneyMode = 'overview' | 'navigating';

export function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr) return 15 * 60;
  const trimmed = timeStr.trim().toLowerCase();

  const match12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    const period = match12[3];
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }

  return 15 * 60;
}

export function formatMinutesTo12Hour(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minuteStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours12}:${minuteStr} ${period}`;
}

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
  const { showAlert } = useCustomAlert();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const lastRoutedOriginRef = useRef<LatLng | null>(null);

  const exp = booking.experience;
  const fallbackResolved = useMemo(() => resolveExperienceCoords(exp), [exp]);

  const [mode, setMode] = useState<JourneyMode>('overview');
  const [showNavChoice, setShowNavChoice] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RoadRouteResult | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [destLocation, setDestLocation] = useState<LatLng>(
    fallbackResolved.hasPin &&
      fallbackResolved.latitude !== null &&
      fallbackResolved.longitude !== null
      ? { latitude: fallbackResolved.latitude, longitude: fallbackResolved.longitude }
      : fallbackResolved.townCenter,
  );
  const [destPrecision, setDestPrecision] = useState<LocationPrecision>(
    fallbackResolved.precision,
  );
  const [resolvedAddress, setResolvedAddress] = useState<string>(
    fallbackResolved.formattedAddress,
  );
  const [directionsNote, setDirectionsNote] = useState<string | null>(
    exp?.arrival_instructions?.directions ?? null,
  );

  const propertyTitle = exp?.title ?? booking.trip_title ?? 'Destination';
  const hostName = exp?.entity_name ?? booking.host?.full_name ?? 'Zuru Host';

  const travelTimeMin = routeInfo?.durationMinutes ?? 0;
  const distanceKm = routeInfo?.distanceKm ?? 0;

  const rawCheckIn =
    exp?.check_in_time || booking.terms_snapshot?.check_in_time || '15:00';
  const checkInMinutes = parseTimeToMinutes(rawCheckIn);
  const formattedCheckIn = formatMinutesTo12Hour(checkInMinutes);
  const recommendedDeparture = formatMinutesTo12Hour(
    checkInMinutes - (travelTimeMin || 35) - 15,
  );

  const snapPoints = useMemo(() => ['36%', '62%', '90%'], []);

  // 1. Resolve Confirmed Booking Exact Coordinates + Initial GPS + OSRM Route
  useEffect(() => {
    if (!visible) {
      setMode('overview');
      setShowNavChoice(false);
      return;
    }

    let active = true;

    (async () => {
      setLoadingRoute(true);
      try {
        let targetDest: LatLng =
          fallbackResolved.hasPin &&
          fallbackResolved.latitude !== null &&
          fallbackResolved.longitude !== null
            ? {
                latitude: fallbackResolved.latitude,
                longitude: fallbackResolved.longitude,
              }
            : fallbackResolved.townCenter;
        let targetPrecision: LocationPrecision = fallbackResolved.precision;
        let targetAddr = fallbackResolved.formattedAddress;

        // If linked to a real booking ID, fetch exact post-booking coordinates via RPC
        if (booking.id) {
          const confirmed = await mapService.fetchConfirmedBookingCoords(booking.id);
          if (confirmed && confirmed.latitude !== null && confirmed.longitude !== null) {
            targetDest = {
              latitude: Number(confirmed.latitude),
              longitude: Number(confirmed.longitude),
            };
            targetPrecision = confirmed.location_precision;
            if (confirmed.formatted_address) {
              targetAddr = confirmed.formatted_address;
            }
            if (confirmed.directions_note) {
              setDirectionsNote(confirmed.directions_note);
            }
          }
        }

        if (!active) return;
        setDestLocation(targetDest);
        setDestPrecision(targetPrecision);
        setResolvedAddress(targetAddr);

        // Request foreground GPS permission if not yet granted
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'undetermined') {
          const req = await Location.requestForegroundPermissionsAsync();
          status = req.status;
        }

        let origin: LatLng | null = null;
        if (status === 'granted') {
          try {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            origin = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            };
          } catch {
            origin = null;
          }
        }

        if (!active) return;
        setUserLocation(origin);

        if (origin) {
          lastRoutedOriginRef.current = origin;
          const roadRoute = await mapService.fetchRoadRoute(origin, targetDest);
          if (active) setRouteInfo(roadRoute);
        } else {
          setRouteInfo(null);
        }
      } finally {
        if (active) setLoadingRoute(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [visible, booking.id, fallbackResolved]);

  // 2. Live GPS Tracking (`watchPositionAsync`) when `mode === 'navigating'`
  useEffect(() => {
    if (!visible || mode !== 'navigating' || Platform.OS === 'web') return;

    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted' || cancelled) return;

      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 20,
          timeInterval: 5000,
        },
        async (loc) => {
          if (cancelled) return;
          const current: LatLng = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setUserLocation(current);

          const prevRouted = lastRoutedOriginRef.current;
          if (!prevRouted || haversineDistanceKm(prevRouted, current) >= 0.18) {
            lastRoutedOriginRef.current = current;
            const updatedRoute = await mapService.fetchRoadRoute(current, destLocation);
            if (!cancelled) setRouteInfo(updatedRoute);
          }
        },
      );
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [visible, mode, destLocation]);

  const handleNavigateInApp = useCallback(() => {
    setShowNavChoice(false);
    setMode('navigating');
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  const handleOpenExternalApp = useCallback(
    (app: 'google' | 'apple' | 'waze') => {
      setShowNavChoice(false);
      mapService.openExternalNavigation(destLocation, propertyTitle, app).catch(() => {
        showAlert({
          title: 'Navigation App Unavailable',
          message: 'Could not open external maps app.',
          variant: 'error',
          icon: 'navigation',
        });
      });
    },
    [destLocation, propertyTitle, showAlert],
  );

  const handleShareETA = useCallback(() => {
    const etaText = travelTimeMin > 0 ? `~${travelTimeMin} min away` : 'on the way';
    showAlert({
      title: 'ETA Shared',
      message: `Your arrival update (${etaText}) has been prepared for ${hostName}.`,
      variant: 'success',
      icon: 'navigation',
    });
  }, [hostName, travelTimeMin, showAlert]);

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]}>
      {/* Full-Screen Interactive MapLibre Route Map */}
      <View style={StyleSheet.absoluteFill}>
        <SafeRouteMapView
          userLocation={userLocation}
          destLocation={destLocation}
          destPrecision={destPrecision}
          routeInfo={routeInfo}
          propertyTitle={propertyTitle}
          isTracking={mode === 'navigating'}
        />

        {/* Back Button */}
        <Pressable
          onPress={onClose}
          style={[styles.mapCloseBtn, { top: insets.top + 10 }]}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={20} color="#111827" />
        </Pressable>

        {/* Live ETA Pill */}
        <Animated.View
          entering={FadeIn.delay(200).duration(320)}
          style={[styles.etaBubble, { top: insets.top + 10 }]}
        >
          {loadingRoute ? (
            <ActivityIndicator size="small" color={ORANGE} />
          ) : routeInfo ? (
            <>
              <View style={styles.etaBubbleInner}>
                <Text style={styles.etaBubbleTime}>{routeInfo.durationText}</Text>
                <Text style={styles.etaBubbleDist}>{routeInfo.distanceText}</Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
            </>
          ) : (
            <Text style={styles.etaBubbleDist}>Enable GPS for live ETA</Text>
          )}
        </Animated.View>
      </View>

      {/* Draggable Bottom Sheet */}
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
          contentContainerStyle={[
            styles.sheetContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 16 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.summaryHeader}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryTitle} numberOfLines={1}>
                {propertyTitle}
              </Text>
              <View style={styles.summaryLocationRow}>
                <Feather name="map-pin" size={12} color={ORANGE} />
                <Text style={styles.summaryLocation} numberOfLines={1}>
                  {resolvedAddress}
                </Text>
              </View>
            </View>
            {routeInfo && (
              <View style={styles.summaryEtaPill}>
                <Feather name="clock" size={13} color={ORANGE} />
                <Text style={styles.summaryEtaText}>{routeInfo.durationText}</Text>
              </View>
            )}
          </View>

          {/* Metrics Row */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Feather name="navigation" size={16} color={ROUTE_BLUE} />
              <Text style={styles.metricValue}>
                {routeInfo ? routeInfo.distanceText : '—'}
              </Text>
              <Text style={styles.metricLabel}>Road Distance</Text>
            </View>
            <View style={styles.metricCard}>
              <Feather name="clock" size={16} color={ORANGE} />
              <Text style={styles.metricValue}>
                {routeInfo ? routeInfo.durationText : '—'}
              </Text>
              <Text style={styles.metricLabel}>Drive Time</Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons
                name={
                  destPrecision === 'exact'
                    ? 'location-outline'
                    : 'shield-checkmark-outline'
                }
                size={16}
                color="#10B981"
              />
              <Text style={styles.metricValue}>
                {destPrecision === 'exact'
                  ? 'Exact'
                  : destPrecision === 'approximate'
                    ? '~500m'
                    : 'Town'}
              </Text>
              <Text style={styles.metricLabel}>Pin Precision</Text>
            </View>
            <View style={styles.metricCard}>
              <Feather name="log-in" size={16} color="#10B981" />
              <Text style={styles.metricValue}>{formattedCheckIn}</Text>
              <Text style={styles.metricLabel}>Check-in</Text>
            </View>
          </View>

          {/* Primary Start Navigation Button */}
          {mode === 'overview' && !showNavChoice && (
            <Pressable
              onPress={() => setShowNavChoice(true)}
              style={({ pressed }) => [
                styles.startNavBtn,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons name="navigate" size={20} color="#FFFFFF" />
              <Text style={styles.startNavBtnText}>START NAVIGATION</Text>
            </Pressable>
          )}

          {/* Navigation App Chooser (In-App + Google Maps + Apple Maps + Waze) */}
          {showNavChoice && (
            <Animated.View entering={FadeIn.duration(180)} style={styles.navChoiceWrap}>
              <Text style={styles.navChoiceTitle}>Choose navigation mode</Text>
              <View style={styles.navChoiceRow}>
                <Pressable
                  onPress={handleNavigateInApp}
                  style={[styles.navChoiceBtn, styles.navChoiceBtnPrimary]}
                >
                  <MaterialCommunityIcons
                    name="compass-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.navChoiceBtnTextPrimary}>
                      Live Companion in ZuruSasa
                    </Text>
                    <Text style={styles.navChoiceBtnSub}>
                      Follow road route & live GPS puck in-app
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => handleOpenExternalApp('google')}
                  style={[styles.navChoiceBtn, styles.navChoiceBtnSecondary]}
                >
                  <Ionicons name="navigate-circle-outline" size={20} color="#111827" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.navChoiceBtnTextSecondary}>
                      Open in Google Maps
                    </Text>
                    <Text style={styles.navChoiceBtnSubDark}>
                      Voice turn-by-turn directions
                    </Text>
                  </View>
                </Pressable>

                {Platform.OS === 'ios' && (
                  <Pressable
                    onPress={() => handleOpenExternalApp('apple')}
                    style={[styles.navChoiceBtn, styles.navChoiceBtnSecondary]}
                  >
                    <Ionicons name="map-outline" size={20} color="#111827" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.navChoiceBtnTextSecondary}>
                        Open in Apple Maps
                      </Text>
                      <Text style={styles.navChoiceBtnSubDark}>
                        Native iOS turn-by-turn
                      </Text>
                    </View>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => handleOpenExternalApp('waze')}
                  style={[styles.navChoiceBtn, styles.navChoiceBtnSecondary]}
                >
                  <MaterialCommunityIcons name="car-connected" size={20} color="#111827" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.navChoiceBtnTextSecondary}>Open in Waze</Text>
                    <Text style={styles.navChoiceBtnSubDark}>
                      Community live traffic alerts
                    </Text>
                  </View>
                </Pressable>
              </View>
            </Animated.View>
          )}

          {/* Active Live GPS Tracking Banner */}
          {mode === 'navigating' && (
            <View style={styles.navActiveStrip}>
              <View style={styles.navActiveDot} />
              <Text style={styles.navActiveText}>
                LIVE GPS TRACKING
                {routeInfo ? ` · ${routeInfo.durationText} remaining` : ''}
              </Text>
              <Pressable onPress={() => setMode('overview')} hitSlop={8}>
                <Text style={styles.navActiveStop}>End</Text>
              </Pressable>
            </View>
          )}

          {/* Route & Host Arrival Notes */}
          <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <Feather name="navigation" size={15} color={ORANGE} />
              <Text style={styles.insightTitle}>Trip & Arrival Guidance</Text>
            </View>
            <Text style={styles.insightBody}>
              {routeInfo
                ? `• Driving distance: ${routeInfo.distanceText} (${routeInfo.durationText} estimated).`
                : '• Enable location services to calculate live driving distance and ETA from your current position.'}
              {'\n'}• Recommended departure: {recommendedDeparture} for {formattedCheckIn} check-in.
              {directionsNote ? `\n• Host arrival note: ${directionsNote}` : ''}
            </Text>
          </View>

          {/* Host Contact Card */}
          <View style={styles.hostCard}>
            <View style={styles.hostLeft}>
              <View style={styles.hostAvatar}>
                <Text style={styles.hostAvatarText}>
                  {hostName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.hostLabel}>Your Host</Text>
                <Text style={styles.hostName}>{hostName}</Text>
              </View>
            </View>
            <View style={styles.hostActions}>
              <Pressable onPress={onMessageHost} style={styles.hostActionBtn}>
                <Feather name="message-square" size={16} color={ORANGE} />
              </Pressable>
              <Pressable onPress={handleShareETA} style={styles.hostActionBtn}>
                <Feather name="share-2" size={16} color="#10B981" />
              </Pressable>
            </View>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
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
    shadowOpacity: 0.14,
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
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    zIndex: 10,
  },
  etaBubbleInner: {
    alignItems: 'flex-end',
  },
  etaBubbleTime: {
    fontSize: 14.5,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  etaBubbleDist: {
    fontSize: 11.5,
    fontFamily: 'DMSans_500Medium',
    color: '#6B7280',
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  sheetBg: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
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
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLeft: {
    flex: 1,
    gap: 3,
  },
  summaryTitle: {
    fontSize: 18.5,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  summaryLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  summaryLocation: {
    flex: 1,
    fontSize: 12.5,
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
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },
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
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },
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
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  startNavBtnText: {
    fontSize: 15.5,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  navChoiceWrap: {
    gap: 10,
  },
  navChoiceTitle: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    color: '#374151',
  },
  navChoiceRow: {
    gap: 8,
  },
  navChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 15,
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
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  navChoiceBtnSub: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.84)',
  },
  navChoiceBtnTextSecondary: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  navChoiceBtnSubDark: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },
  navActiveStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111827',
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
  },
  navActiveStop: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#EF4444',
  },
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
    fontSize: 17,
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
    color: '#111827',
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
});
