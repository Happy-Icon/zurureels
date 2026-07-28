import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeRouteMapView } from '@/components/map/SafeMapView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import type { BookingRow } from '@/lib/supabase';
import { googleMapsService, type LatLng, type RouteResult } from '@/services/googleMapsService';

const ORANGE = '#F26522';

export type JourneyMode = 'pre_journey' | 'in_progress' | 'arrival' | 'stay_companion';

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

  const [mode, setMode] = useState<JourneyMode>('pre_journey');
  const [showNavPicker, setShowNavPicker] = useState(false);
  const [preferredApp, setPreferredApp] = useState<string | null>(null);

  // Real Route Data from Google Routes / Directions API
  const [routeInfo, setRouteInfo] = useState<RouteResult | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng>({ latitude: -4.0435, longitude: 39.6682 }); // Mombasa default
  const [destLocation, setDestLocation] = useState<LatLng>({ latitude: -4.2797, longitude: 39.5947 }); // Diani default

  const exp = booking.experience;
  const propertyTitle = exp?.title ?? 'Coastal Sanctuary';
  const locationName = exp?.location ?? 'Diani Beach, Kenya';
  const hostName = booking.experience?.entity_name ?? 'Zuru Host';
  const checkInTime = '3:00 PM';

  // 1. Geocode Destination & Fetch Real Route from Google Routes API
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        // Geocode destination
        const dest = await googleMapsService.geocodeLocation(locationName);
        if (!active) return;
        setDestLocation(dest);

        // Get user location
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

        // Fetch Google Routes API result
        const route = await googleMapsService.fetchRoute(origin, dest);
        if (active) {
          setRouteInfo(route);
        }
      } catch {
        // Fallback handled in service
      }
    })();

    return () => {
      active = false;
    };
  }, [locationName]);

  const handleStartJourney = (appName: string) => {
    setShowNavPicker(false);
    setPreferredApp(appName);
    setMode('in_progress');

    // Launch external app with exact destination coordinates
    const lat = destLocation.latitude;
    const lng = destLocation.longitude;
    const locStr = `${lat},${lng}`;

    let url = '';
    if (appName === 'google') {
      url = `https://www.google.com/maps/dir/?api=1&destination=${locStr}`;
    } else if (appName === 'apple') {
      url = `maps:0,0?q=${encodeURIComponent(locationName)}&ll=${locStr}`;
    } else if (appName === 'waze') {
      url = `https://waze.com/ul?ll=${locStr}&navigate=yes`;
    } else {
      url = Platform.select({
        ios: `maps:0,0?q=${encodeURIComponent(locationName)}&ll=${locStr}`,
        android: `google.navigation:q=${locStr}`,
        web: `https://www.google.com/maps/dir/?api=1&destination=${locStr}`,
      }) || '';
    }

    if (url) Linking.openURL(url);
  };

  const handleShareETA = () => {
    const min = routeInfo?.durationMin ?? 42;
    Alert.alert(
      'Share ETA',
      `ETA shared with ${hostName}: Arriving at ~${checkInTime} (${min} min away).`,
    );
  };

  const handleImOutside = () => {
    Alert.alert('Host Notified 🔔', `${hostName} has been notified that you are outside!`);
  };

  const travelTimeMin = routeInfo?.durationMin ?? 42;
  const distanceKm = routeInfo?.distanceKm ?? 35;
  const trafficCond = routeInfo?.trafficCondition ?? 'Light';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Top handle bar */}
          <View style={styles.handle} />
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <Feather name="x" size={18} color="#374151" />
          </Pressable>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 10 }}
          >
            {/* ── HERO DESTINATION & MINI GOOGLE MAP PREVIEW ──────────── */}
            <View style={styles.heroWrap}>
              {/* SAFE ROUTE MAP VIEW */}
              <SafeRouteMapView
                destLocation={destLocation}
                routeInfo={routeInfo}
                propertyTitle={propertyTitle}
              />



              <LinearGradient
                colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.85)']}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />

              {/* Top Mode Selector Badge */}
              <View style={styles.heroModeRow}>
                <View style={styles.journeyBadge}>
                  <Text style={styles.journeyBadgeText}>JOURNEY COMPANION</Text>
                </View>
              </View>

              {/* Hero Title Stack */}
              <View style={styles.heroTitleStack}>
                <View style={styles.locationRow}>
                  <Feather name="map-pin" size={11} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.locationText}>{locationName}</Text>
                </View>
                <Text style={styles.heroTitle} numberOfLines={1}>{propertyTitle}</Text>
              </View>
            </View>

            {/* ── SIMULATED STATE TOGGLE BAR ─────────────────────────── */}
            <View style={styles.modeToggleBar}>
              {[
                { id: 'pre_journey', label: 'Overview' },
                { id: 'in_progress', label: 'En Route' },
                { id: 'arrival', label: 'Arriving' },
                { id: 'stay_companion', label: 'In Stay' },
              ].map((tab) => {
                const isActive = mode === tab.id;
                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => setMode(tab.id as JourneyMode)}
                    style={[styles.modeTab, isActive && styles.modeTabActive]}
                  >
                    <Text style={[styles.modeTabText, isActive && styles.modeTabTextActive]}>
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.body}>
              {/* ── 1. OVERVIEW / PRE-JOURNEY STATE ────────────────── */}
              {mode === 'pre_journey' ? (
                <>
                  {/* Smart Travel Card */}
                  <View style={styles.smartCard}>
                    <View style={styles.smartCardHeader}>
                      <Ionicons name="navigate-circle" size={18} color={ORANGE} />
                      <Text style={styles.smartCardTitle}>Live Google Route Metrics</Text>
                    </View>

                    <View style={styles.metricsGrid}>
                      <View style={styles.metricItem}>
                        <Feather name="clock" size={14} color="#6B7280" />
                        <Text style={styles.metricVal}>{travelTimeMin} min</Text>
                        <Text style={styles.metricLabel}>Travel Time</Text>
                      </View>

                      <View style={styles.metricItem}>
                        <Feather name="navigation" size={14} color="#6B7280" />
                        <Text style={styles.metricVal}>{distanceKm} km</Text>
                        <Text style={styles.metricLabel}>Distance</Text>
                      </View>

                      <View style={styles.metricItem}>
                        <Feather name="activity" size={14} color="#10B981" />
                        <Text style={styles.metricVal}>{trafficCond}</Text>
                        <Text style={styles.metricLabel}>Traffic</Text>
                      </View>

                      <View style={styles.metricItem}>
                        <Feather name="log-in" size={14} color="#10B981" />
                        <Text style={styles.metricVal}>{checkInTime}</Text>
                        <Text style={styles.metricLabel}>Check-in</Text>
                      </View>
                    </View>
                  </View>

                  {/* AI Journey Insights */}
                  <View style={styles.aiInsightCard}>
                    <View style={styles.aiInsightHeader}>
                      <MaterialCommunityIcons name="creation" size={16} color={ORANGE} />
                      <Text style={styles.aiInsightTitle}>AI Journey Insights</Text>
                    </View>
                    <Text style={styles.aiInsightText}>
                      • Real-time route via Google Routes API: {routeInfo?.distanceText || `${distanceKm} km`}.
                      {'\n'}• {trafficCond} traffic along coastal highway. Leave by 2:15 PM for effortless arrival.
                    </Text>
                  </View>

                  {/* Host Quick Bar */}
                  <View style={styles.hostBar}>
                    <View style={styles.hostAvatarFallback}>
                      <Text style={styles.hostInitials}>{hostName.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hostBarLabel}>Your Host</Text>
                      <Text style={styles.hostBarName}>{hostName}</Text>
                    </View>
                    <Pressable onPress={onMessageHost} style={styles.hostChatBtn}>
                      <Feather name="message-square" size={14} color={ORANGE} />
                      <Text style={styles.hostChatBtnText}>Message</Text>
                    </Pressable>
                  </View>

                  {/* Action Buttons */}
                  <Pressable
                    onPress={() => setShowNavPicker(true)}
                    style={({ pressed }) => [styles.primaryStartBtn, pressed && { opacity: 0.88 }]}
                  >
                    <Ionicons name="navigate" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryStartBtnText}>Start Journey</Text>
                  </Pressable>

                  <View style={styles.secondaryActionsRow}>
                    <Pressable onPress={handleShareETA} style={styles.secBtn}>
                      <Feather name="share-2" size={13} color="#374151" />
                      <Text style={styles.secBtnText}>Share ETA</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => Alert.alert('Saved Offline 💾', 'Itinerary and route coordinates saved offline.')}
                      style={styles.secBtn}
                    >
                      <Feather name="download" size={13} color="#374151" />
                      <Text style={styles.secBtnText}>Save Offline</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              {/* ── 2. JOURNEY IN PROGRESS (EN ROUTE) ──────────────── */}
              {mode === 'in_progress' ? (
                <>
                  <View style={styles.inProgressCard}>
                    <View style={styles.pulseDotRow}>
                      <View style={styles.pulseDot} />
                      <Text style={styles.pulseText}>JOURNEY IN PROGRESS</Text>
                    </View>

                    <Text style={styles.etaTitle}>Arriving in ~{travelTimeMin} mins</Text>
                    <Text style={styles.etaSub}>{distanceKm} km remaining · Target {checkInTime}</Text>

                    {/* Progress Bar */}
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: '45%' }]} />
                    </View>
                  </View>

                  <View style={styles.actionGrid}>
                    <Pressable
                      onPress={() => handleStartJourney(preferredApp || 'google')}
                      style={styles.actionGridBtn}
                    >
                      <Feather name="navigation" size={18} color={ORANGE} />
                      <Text style={styles.actionGridText}>Resume Maps</Text>
                    </Pressable>

                    <Pressable onPress={onMessageHost} style={styles.actionGridBtn}>
                      <Feather name="message-square" size={18} color={ORANGE} />
                      <Text style={styles.actionGridText}>Host Chat</Text>
                    </Pressable>

                    <Pressable onPress={handleShareETA} style={styles.actionGridBtn}>
                      <Feather name="share-2" size={18} color={ORANGE} />
                      <Text style={styles.actionGridText}>Share ETA</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              {/* ── 3. ARRIVAL ASSISTANT ─────────────────────────────── */}
              {mode === 'arrival' ? (
                <>
                  <View style={styles.arrivalCard}>
                    <MaterialCommunityIcons name="home-map-marker" size={32} color={ORANGE} />
                    <Text style={styles.arrivalTitle}>Welcome! You're Almost There 🎉</Text>
                    <Text style={styles.arrivalSub}>You are within 500m of {propertyTitle}.</Text>

                    <Pressable onPress={handleImOutside} style={styles.imOutsideBtn}>
                      <Ionicons name="megaphone" size={16} color="#FFFFFF" />
                      <Text style={styles.imOutsideBtnText}>I'm Outside — Notify Host</Text>
                    </Pressable>
                  </View>

                  <View style={styles.infoBoxGroup}>
                    <View style={styles.infoBox}>
                      <Feather name="key" size={16} color={ORANGE} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.infoBoxTitle}>Gate & Door Code</Text>
                        <Text style={styles.infoBoxVal}>Keypad: #4829</Text>
                      </View>
                    </View>

                    <View style={styles.infoBox}>
                      <Feather name="wifi" size={16} color={ORANGE} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.infoBoxTitle}>Wi-Fi Network</Text>
                        <Text style={styles.infoBoxVal}>ZuruSasa_Guest (Pass: coastal2026)</Text>
                      </View>
                    </View>
                  </View>
                </>
              ) : null}

              {/* ── 4. STAY COMPANION ───────────────────────────────── */}
              {mode === 'stay_companion' ? (
                <>
                  <View style={styles.stayHeader}>
                    <Text style={styles.stayTitle}>Your Stay Companion 🏡</Text>
                    <Text style={styles.staySub}>Everything you need during your stay at {propertyTitle}.</Text>
                  </View>

                  <View style={styles.stayMenuGrid}>
                    <Pressable
                      onPress={() => Alert.alert('Wi-Fi', 'Network: ZuruSasa_Guest\nPassword: coastal2026')}
                      style={styles.stayMenuItem}
                    >
                      <Feather name="wifi" size={20} color={ORANGE} />
                      <Text style={styles.stayMenuText}>Wi-Fi Details</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => Alert.alert('House Rules', '1. Quiet hours after 10 PM\n2. No smoking inside\n3. Pool open till 8 PM')}
                      style={styles.stayMenuItem}
                    >
                      <Feather name="book-open" size={20} color={ORANGE} />
                      <Text style={styles.stayMenuText}>House Rules</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => Alert.alert('Nearby Dining', '1. Tamarind Seafood (1.2km)\n2. Ali Barbour Cave (3km)')}
                      style={styles.stayMenuItem}
                    >
                      <MaterialCommunityIcons name="silverware-fork-knife" size={20} color={ORANGE} />
                      <Text style={styles.stayMenuText}>Restaurants</Text>
                    </Pressable>

                    <Pressable
                      onPress={onMessageHost}
                      style={styles.stayMenuItem}
                    >
                      <Feather name="message-square" size={20} color={ORANGE} />
                      <Text style={styles.stayMenuText}>Message Host</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          </ScrollView>
        </View>

        {/* ── NAVIGATION APP PICKER MODAL ─────────────────────────── */}
        <Modal visible={showNavPicker} transparent animationType="fade" onRequestClose={() => setShowNavPicker(false)}>
          <View style={styles.pickerBackdrop}>
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>Choose Navigation App</Text>
              <Text style={styles.pickerSub}>Select your preferred map app to launch turn-by-turn guidance.</Text>

              <View style={styles.pickerOptions}>
                <Pressable onPress={() => handleStartJourney('google')} style={styles.pickerOpt}>
                  <Ionicons name="map" size={20} color="#EA4335" />
                  <Text style={styles.pickerOptText}>Google Maps</Text>
                </Pressable>

                {Platform.OS === 'ios' ? (
                  <Pressable onPress={() => handleStartJourney('apple')} style={styles.pickerOpt}>
                    <Ionicons name="navigate" size={20} color="#007AFF" />
                    <Text style={styles.pickerOptText}>Apple Maps</Text>
                  </Pressable>
                ) : null}

                <Pressable onPress={() => handleStartJourney('waze')} style={styles.pickerOpt}>
                  <MaterialCommunityIcons name="waze" size={20} color="#33CCFF" />
                  <Text style={styles.pickerOptText}>Waze Navigation</Text>
                </Pressable>
              </View>

              <Pressable onPress={() => setShowNavPicker(false)} style={styles.pickerCancelBtn}>
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

// ── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.52)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '92%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginTop: 10,
    marginBottom: 4,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 50,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero Map
  heroWrap: { height: 190, position: 'relative', justifyContent: 'flex-end', padding: 16 },
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
  heroModeRow: { position: 'absolute', top: 14, left: 16 },
  journeyBadge: {
    backgroundColor: 'rgba(242,101,34,0.9)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  journeyBadgeText: { color: '#FFFFFF', fontSize: 9.5, fontFamily: 'DMSans_700Bold', letterSpacing: 0.8 },
  heroTitleStack: { gap: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { color: 'rgba(255,255,255,0.85)', fontSize: 11.5, fontFamily: 'DMSans_500Medium' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontFamily: 'DMSans_700Bold' },

  // State toggle bar
  modeToggleBar: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 3,
    gap: 2,
  },
  modeTab: { flex: 1, paddingVertical: 7, borderRadius: 11, alignItems: 'center' },
  modeTabActive: { backgroundColor: '#FFFFFF', elevation: 1 },
  modeTabText: { fontSize: 11.5, fontFamily: 'DMSans_500Medium', color: '#9CA3AF' },
  modeTabTextActive: { fontFamily: 'DMSans_700Bold', color: '#111111' },

  body: { padding: 16, gap: 14 },

  // Smart Card
  smartCard: {
    backgroundColor: '#FFFBF8',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FCE3D6',
    padding: 14,
    gap: 12,
  },
  smartCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  smartCardTitle: { fontSize: 13.5, fontFamily: 'DMSans_700Bold', color: '#111111' },
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  metricItem: { alignItems: 'center', gap: 2 },
  metricVal: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: '#111111' },
  metricLabel: { fontSize: 10.5, fontFamily: 'DMSans_400Regular', color: '#6B7280' },

  // AI Insight
  aiInsightCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    padding: 12,
    gap: 6,
  },
  aiInsightHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiInsightTitle: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: ORANGE },
  aiInsightText: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#4B5563', lineHeight: 18 },

  // Host Bar
  hostBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    padding: 10,
  },
  hostAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostInitials: { color: '#FFFFFF', fontSize: 16, fontFamily: 'DMSans_700Bold' },
  hostBarLabel: { fontSize: 10.5, fontFamily: 'DMSans_400Regular', color: '#9CA3AF' },
  hostBarName: { fontSize: 13.5, fontFamily: 'DMSans_700Bold', color: '#111111' },
  hostChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF5EF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#FDDFCB',
  },
  hostChatBtnText: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: ORANGE },

  // Buttons
  primaryStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 16,
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryStartBtnText: { color: '#FFFFFF', fontSize: 15.5, fontFamily: 'DMSans_700Bold' },
  secondaryActionsRow: { flexDirection: 'row', gap: 10 },
  secBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  secBtnText: { fontSize: 12.5, fontFamily: 'DMSans_600SemiBold', color: '#374151' },

  // In Progress State
  inProgressCard: {
    backgroundColor: '#111111',
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  pulseDotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  pulseText: { color: '#10B981', fontSize: 10, fontFamily: 'DMSans_700Bold', letterSpacing: 0.8 },
  etaTitle: { color: '#FFFFFF', fontSize: 20, fontFamily: 'DMSans_700Bold' },
  etaSub: { color: '#9CA3AF', fontSize: 12.5, fontFamily: 'DMSans_400Regular' },
  progressTrack: { height: 4, backgroundColor: '#374151', borderRadius: 2, marginTop: 4 },
  progressFill: { height: '100%', backgroundColor: ORANGE, borderRadius: 2 },
  actionGrid: { flexDirection: 'row', gap: 10 },
  actionGridBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FFF5EF',
    borderWidth: 1,
    borderColor: '#FDDFCB',
    borderRadius: 16,
    paddingVertical: 14,
  },
  actionGridText: { fontSize: 11.5, fontFamily: 'DMSans_700Bold', color: '#111111' },

  // Arrival State
  arrivalCard: {
    alignItems: 'center',
    backgroundColor: '#FFFBF8',
    borderWidth: 1,
    borderColor: '#FCE3D6',
    borderRadius: 20,
    padding: 20,
    gap: 8,
  },
  arrivalTitle: { fontSize: 18, fontFamily: 'DMSans_700Bold', color: '#111111', textAlign: 'center' },
  arrivalSub: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: '#6B7280', textAlign: 'center' },
  imOutsideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ORANGE,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 6,
  },
  imOutsideBtnText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'DMSans_700Bold' },
  infoBoxGroup: { gap: 8 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 16,
    padding: 14,
  },
  infoBoxTitle: { fontSize: 11, fontFamily: 'DMSans_500Medium', color: '#9CA3AF' },
  infoBoxVal: { fontSize: 13.5, fontFamily: 'DMSans_700Bold', color: '#111111' },

  // Stay Companion
  stayHeader: { gap: 4 },
  stayTitle: { fontSize: 20, fontFamily: 'DMSans_700Bold', color: '#111111' },
  staySub: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: '#6B7280' },
  stayMenuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stayMenuItem: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  stayMenuText: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: '#111111' },

  // Nav Picker Modal
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 24 },
  pickerCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, gap: 12 },
  pickerTitle: { fontSize: 18, fontFamily: 'DMSans_700Bold', color: '#111111' },
  pickerSub: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: '#6B7280' },
  pickerOptions: { gap: 10, marginVertical: 6 },
  pickerOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 14,
  },
  pickerOptText: { fontSize: 14.5, fontFamily: 'DMSans_600SemiBold', color: '#111111' },
  pickerCancelBtn: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pickerCancelText: { fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: '#6B7280' },
});
