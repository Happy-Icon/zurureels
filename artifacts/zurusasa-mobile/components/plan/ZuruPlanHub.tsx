import React, { useCallback, useState } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useAuth } from '@/context/AuthContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { zuruPlanService } from '@/services/zuruPlanService';
import { Skeleton } from '@/components/Skeleton';
import type { TripPlan } from '@/types/zuruPlan';

const { width } = Dimensions.get('window');

export function ZuruPlanHub() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useCustomAlert();

  const [trips, setTrips] = useState<TripPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTrips = useCallback(async () => {
    try {
      const data = await zuruPlanService.getSavedTrips(user?.id);
      setTrips(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [loadTrips])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadTrips();
  };

  const handleBuildTrip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/plan/builder' as any);
  };

  const handlePlanWithAgent = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/plan/agent' as any);
  };

  const handleOpenTrip = (tripId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({ pathname: '/plan/[id]', params: { id: tripId } } as any);
  };

  const handleDeleteTrip = (tripId: string, title: string) => {
    showAlert({
      title: 'Delete Trip',
      message: `Are you sure you want to remove "${title}"?`,
      variant: 'destructive',
      icon: 'trash-2',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await zuruPlanService.deleteTrip(user?.id, tripId);
            loadTrips();
          },
        },
      ],
    });
  };

  const topInset = Platform.OS === 'web' ? 24 : insets.top + 54;
  const bottomInset = Platform.OS === 'web' ? 40 : insets.bottom + 84;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F26522"
            colors={['#F26522']}
          />
        }
        contentContainerStyle={{
          paddingTop: topInset,
          paddingBottom: bottomInset,
          paddingHorizontal: 20,
          gap: 22,
        }}
      >
        {/* Welcome Header */}
        <View style={styles.headerBlock}>
          <View style={styles.badgeRow}>
            <View style={styles.badgePill}>
              <Feather name="compass" size={13} color="#F26522" />
              <Text style={styles.badgeText}>ZuruPlan Workspace</Text>
            </View>
          </View>
          <Text style={[styles.heroHeading, { color: colors.text }]}>
            Plan your coastal escape
          </Text>
          <Text style={[styles.heroSubheading, { color: colors.mutedForeground }]}>
            Craft bespoke multi-day itineraries with real villas, ocean safaris, and authentic dining across coastal Kenya.
          </Text>
        </View>

        {/* Primary Action Launchers (2 Cards Grid) */}
        <View style={styles.actionsGrid}>
          {/* Action 1: Guided Builder */}
          <Pressable
            testID="zuruplan-build-trip-btn"
            onPress={handleBuildTrip}
            style={({ pressed }) => [
              styles.actionCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Build a trip using the guided builder"
          >
            <View style={[styles.actionIconBox, { backgroundColor: isDark ? '#27272A' : '#FFF7ED' }]}>
              <Feather name="map" size={24} color="#F26522" />
            </View>
            <View style={styles.actionCardContent}>
              <Text style={[styles.actionCardTitle, { color: colors.text }]}>Build a trip</Text>
              <Text style={[styles.actionCardDesc, { color: colors.mutedForeground }]}>
                Pick destination, duration, vibe, and let ZuruPlan construct a balanced day-by-day itinerary.
              </Text>
            </View>
            <View style={styles.actionArrowRow}>
              <Text style={styles.actionLinkText}>Start Guided Builder</Text>
              <Feather name="arrow-right" size={15} color="#F26522" />
            </View>
          </Pressable>

          {/* Action 2: Plan with Zuru Agent */}
          <Pressable
            testID="zuruplan-agent-btn"
            onPress={handlePlanWithAgent}
            style={({ pressed }) => [
              styles.actionCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Plan with Zuru Agent conversationally"
          >
            <View style={[styles.actionIconBox, { backgroundColor: isDark ? '#27272A' : '#EFF6FF' }]}>
              <MaterialCommunityIcons name="robot-outline" size={24} color="#2563EB" />
            </View>
            <View style={styles.actionCardContent}>
              <Text style={[styles.actionCardTitle, { color: colors.text }]}>Plan with Zuru Agent</Text>
              <Text style={[styles.actionCardDesc, { color: colors.mutedForeground }]}>
                Chat naturally with your AI coastal concierge to tailor a custom itinerary in real time.
              </Text>
            </View>
            <View style={styles.actionArrowRow}>
              <Text style={[styles.actionLinkText, { color: '#2563EB' }]}>Chat with Agent</Text>
              <Feather name="message-square" size={15} color="#2563EB" />
            </View>
          </Pressable>
        </View>

        {/* Saved & Planned Trips Section */}
        <View style={styles.savedSection}>
          <View style={styles.savedSectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Planned Trips</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
                {trips.length > 0 ? `${trips.length} itinerary saved` : 'Ready to begin your journey'}
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={{ gap: 14 }}>
              <Skeleton style={{ height: 160, borderRadius: 16 }} />
              <Skeleton style={{ height: 160, borderRadius: 16 }} />
            </View>
          ) : trips.length > 0 ? (
            <View style={styles.tripsList}>
              {trips.map((trip) => {
                const totalItems = trip.days.reduce((acc, d) => acc + d.items.length, 0);
                return (
                  <Pressable
                    key={trip.id}
                    onPress={() => handleOpenTrip(trip.id)}
                    style={({ pressed }) => [
                      styles.tripCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      pressed && { transform: [{ scale: 0.99 }] },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Open itinerary ${trip.title}`}
                  >
                    <Image
                      source={{ uri: trip.coverImage }}
                      style={styles.tripCover}
                      contentFit="cover"
                    />
                    <LinearGradient
                      colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.65)']}
                      style={StyleSheet.absoluteFill}
                    />

                    {/* Top Pill: Destination */}
                    <View style={styles.tripCardTopRow}>
                      <View style={styles.destinationBadge}>
                        <Feather name="map-pin" size={11} color="#FFFFFF" />
                        <Text style={styles.destinationBadgeText}>{trip.destination}</Text>
                      </View>
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteTrip(trip.id, trip.title);
                        }}
                        hitSlop={8}
                        style={styles.tripDeleteBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Delete trip"
                      >
                        <Feather name="trash-2" size={14} color="#FFFFFF" />
                      </Pressable>
                    </View>

                    {/* Bottom Info Stack */}
                    <View style={styles.tripCardBottom}>
                      <Text style={styles.tripTitleText} numberOfLines={1}>
                        {trip.title}
                      </Text>
                      <View style={styles.tripMetaRow}>
                        <Text style={styles.tripMetaText}>
                          {trip.durationDays} Days · {totalItems} Activities & Stays
                        </Text>
                        <Text style={styles.tripPriceText}>
                          KES {Number(trip.budgetBreakdown.totalEstimatedKes).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            /* Empty State */
            <View style={[styles.emptyBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? '#27272A' : '#FFF7ED' }]}>
                <Feather name="compass" size={32} color="#F26522" />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No itineraries planned yet</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                Tap "Build a trip" or chat with Zuru Agent to assemble your personalized coastal Kenyan getaway.
              </Text>
              <Pressable
                onPress={handleBuildTrip}
                style={styles.emptyCta}
                accessibilityRole="button"
                accessibilityLabel="Create your first trip"
              >
                <Text style={styles.emptyCtaText}>Create Your First Trip</Text>
                <Feather name="plus" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width,
  },
  headerBlock: {
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#EA580C',
    letterSpacing: 0.2,
  },
  heroHeading: {
    fontSize: 28,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  heroSubheading: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 21,
  },

  /* Action Cards */
  actionsGrid: {
    gap: 14,
  },
  actionCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  actionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCardContent: {
    gap: 4,
  },
  actionCardTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.2,
  },
  actionCardDesc: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 18,
  },
  actionArrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  actionLinkText: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },

  /* Saved Section */
  savedSection: {
    gap: 14,
    marginTop: 8,
  },
  savedSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    marginTop: 2,
  },

  /* Trips List */
  tripsList: {
    gap: 14,
  },
  tripCard: {
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    justifyContent: 'space-between',
    padding: 16,
  },
  tripCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tripCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  destinationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  destinationBadgeText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_600SemiBold',
    color: '#FFFFFF',
  },
  tripDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripCardBottom: {
    gap: 4,
  },
  tripTitleText: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  tripMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tripMetaText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_500Medium',
    color: 'rgba(255,255,255,0.85)',
  },
  tripPriceText: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },

  /* Empty State */
  emptyBox: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    borderStyle: 'dashed',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F26522',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
  },
});
