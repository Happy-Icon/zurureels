import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { zuruPlanService } from '@/services/zuruPlanService';
import { Skeleton } from '@/components/Skeleton';
import { ItineraryDayCard } from '@/components/plan/ItineraryDayCard';
import { AgentItinerarySheet } from '@/components/plan/AgentItinerarySheet';
import { BookingSheet } from '@/components/BookingSheet';
import { supabase, type ReelRow } from '@/lib/supabase';
import type { ItineraryItem, TripPlan } from '@/types/zuruPlan';

const { width } = Dimensions.get('window');

export default function TripItineraryWorkspaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [trip, setTrip] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'all'>('all');
  const [isRegeneratingDay, setIsRegeneratingDay] = useState<number | null>(null);
  const [isUpgradingAi, setIsUpgradingAi] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Agent Sheet State
  const [agentSheetVisible, setAgentSheetVisible] = useState(false);

  // Booking Sheet Integration
  const [bookingSheetVisible, setBookingSheetVisible] = useState(false);
  const [bookingReel, setBookingReel] = useState<ReelRow | null>(null);

  // Cleanup in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const isBusy = isRegeneratingDay !== null || isUpgradingAi;

  const loadTrip = useCallback(async () => {
    if (!id) return;
    try {
      const allTrips = await zuruPlanService.getSavedTrips(user?.id);
      const match = allTrips.find((t) => t.id === id);
      setTrip(match || null);
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  const handleShareTrip = async () => {
    if (!trip) return;
    Haptics.selectionAsync().catch(() => {});
    try {
      await Share.share({
        title: trip.title,
        message: `Take a look at our coastal Kenya trip itinerary: "${trip.title}" (${trip.durationDays} days in ${trip.destination}) on ZuruSasa!`,
      });
    } catch {
      // dismissed
    }
  };

  const handleBookExperience = async (experienceId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      // Fetch matching reel or experience from Supabase
      const { data: reel } = await supabase
        .from('reels')
        .select('*, experience:experiences(*)')
        .eq('experience_id', experienceId)
        .maybeSingle();

      if (reel) {
        setBookingReel(reel as ReelRow);
        setBookingSheetVisible(true);
      } else {
        // Fetch direct experience
        const { data: exp } = await supabase
          .from('experiences')
          .select('*')
          .eq('id', experienceId)
          .maybeSingle();

        if (exp) {
          const mockReel: ReelRow = {
            id: `reel_${exp.id}`,
            video_url: '',
            caption: exp.title,
            tags: [],
            category: exp.category,
            experience_id: exp.id,
            experience: exp,
            created_at: new Date().toISOString(),
          } as any;
          setBookingReel(mockReel);
          setBookingSheetVisible(true);
        } else {
          Alert.alert('Unavailable', 'This listing is temporarily unavailable for direct booking.');
        }
      }
    } catch (err) {
      console.warn('Failed to load booking experience:', err);
    }
  };

  // Single-Day Regeneration with Mutex & Error Handling (REM-08)
  const handleRegenerateDay = async (dayNumber: number) => {
    if (isBusy || !trip) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsRegeneratingDay(dayNumber);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const updatedTrip = await zuruPlanService.regenerateDay(trip, dayNumber, {
        signal: controller.signal,
      });
      await zuruPlanService.saveTrip(user?.id, updatedTrip);
      setTrip(updatedTrip);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      if (controller.signal.aborted) return;
      console.warn('Day regeneration failed:', err);
      Alert.alert(
        'Regeneration Notice',
        err?.message || 'Could not find alternative activities for this day without repeating previous experiences.'
      );
    } finally {
      setIsRegeneratingDay(null);
      abortControllerRef.current = null;
    }
  };

  // Reorder Item with Mutex Guard and userModified Flagging
  const handleReorderItem = async (dayNumber: number, fromIndex: number, toIndex: number) => {
    if (isBusy || !trip) return;
    const dayIndex = trip.days.findIndex((d) => d.dayNumber === dayNumber);
    if (dayIndex < 0) return;

    Haptics.selectionAsync().catch(() => {});
    const targetDay = trip.days[dayIndex];
    const items = [...targetDay.items];
    const [moved] = items.splice(fromIndex, 1);
    const markedMoved = { ...moved, userModified: true };
    items.splice(toIndex, 0, markedMoved);

    const updatedDays = [...trip.days];
    updatedDays[dayIndex] = {
      ...targetDay,
      items,
      revision: (targetDay.revision ?? 1) + 1,
      updatedAt: new Date().toISOString(),
    };

    const nextRevision = (trip.revision ?? 1) + 1;
    const updatedTrip: TripPlan = {
      ...trip,
      revision: nextRevision,
      days: updatedDays,
      updatedAt: new Date().toISOString(),
    };

    setTrip(updatedTrip);
    await zuruPlanService.saveTrip(user?.id, updatedTrip);
  };

  // Apply Agent Item with Mutex Guard and userModified Flagging
  const handleApplyAgentItem = async (dayNumber: number, newItem: ItineraryItem) => {
    if (isBusy || !trip) return;
    const dayIndex = trip.days.findIndex((d) => d.dayNumber === dayNumber);
    if (dayIndex < 0) return;

    const targetDay = trip.days[dayIndex];
    const itemWithFlag: ItineraryItem = {
      ...newItem,
      userModified: true, // Guarantees item survives day regeneration
    };

    const updatedDays = [...trip.days];
    updatedDays[dayIndex] = {
      ...targetDay,
      items: [...targetDay.items, itemWithFlag],
      revision: (targetDay.revision ?? 1) + 1,
      updatedAt: new Date().toISOString(),
    };

    // Recalculate totals
    let newActivitiesTotal = 0;
    for (const d of updatedDays) {
      for (const item of d.items) {
        if (item.type === 'activity' && item.estimatedPriceKes) {
          newActivitiesTotal += item.estimatedPriceKes;
        }
      }
    }

    const nextRevision = (trip.revision ?? 1) + 1;
    const updatedTrip: TripPlan = {
      ...trip,
      revision: nextRevision,
      days: updatedDays,
      budgetBreakdown: {
        ...trip.budgetBreakdown,
        activitiesTotal: newActivitiesTotal,
        totalEstimatedKes:
          trip.budgetBreakdown.accommodationTotal +
          newActivitiesTotal +
          trip.budgetBreakdown.diningEstimate,
      },
      updatedAt: new Date().toISOString(),
    };

    setTrip(updatedTrip);
    await zuruPlanService.saveTrip(user?.id, updatedTrip);
  };

  // Upgrade Plan with AI (REM-10)
  const handleRetryFullAIRegeneration = async () => {
    if (isBusy || !trip) return;
    setIsUpgradingAi(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      const regenerated = await zuruPlanService.generateItineraryFromPreferences({
        destinationId: trip.destinationId || (trip.destination?.toLowerCase().includes('lamu') ? 'lamu' : 'diani'),
        destinationName: trip.destination,
        durationDays: trip.durationDays,
        adultsCount: trip.guestCount,
        childrenCount: 0,
        budgetTier: trip.budgetTier,
        accommodationType: trip.preferences?.accommodationType || 'resort',
        interests: trip.preferences?.interests || ['beaches', 'dhow_cruises', 'seafood_dining'],
        dietaryRestrictions: trip.preferences?.dietaryRestrictions,
        pace: trip.preferences?.pace,
        exclusions: trip.preferences?.exclusions,
      });

      const finalTrip: TripPlan = {
        ...regenerated,
        id: trip.id,
        title: trip.title,
        revision: (trip.revision ?? 1) + 1,
      };

      await zuruPlanService.saveTrip(user?.id, finalTrip);
      setTrip(finalTrip);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('AI Plan Updated! ✨', 'Your itinerary has been refreshed with live intelligence from Claude.');
    } catch (err: any) {
      console.warn('AI upgrade failed:', err);
      Alert.alert('Notice', err?.message || 'Unable to connect to AI gateway at this time.');
    } finally {
      setIsUpgradingAi(false);
    }
  };

  const topInset = Platform.OS === 'web' ? 20 : insets.top + 10;
  const bottomInset = Platform.OS === 'web' ? 30 : insets.bottom + 20;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topInset + 20, paddingHorizontal: 20, gap: 16 }]}>
        <Skeleton style={{ height: 200, borderRadius: 20 }} />
        <Skeleton style={{ height: 60, borderRadius: 14 }} />
        <Skeleton style={{ height: 160, borderRadius: 16 }} />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color="#F26522" />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Trip Not Found</Text>
        <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
          This itinerary may have been removed or created on another account.
        </Text>
        <Pressable
          onPress={() => router.replace('/plan/builder' as any)}
          style={styles.rebuildBtn}
        >
          <Text style={styles.rebuildBtnText}>Create New Itinerary</Text>
        </Pressable>
      </View>
    );
  }

  const filteredDays =
    selectedDayFilter === 'all'
      ? trip.days
      : trip.days.filter((d) => d.dayNumber === selectedDayFilter);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Floating Top Nav Bar */}
      <View style={[styles.floatingNav, { paddingTop: topInset }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.navCircleBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>

        <View style={styles.navActionsRow}>
          <Pressable
            onPress={handleShareTrip}
            style={styles.navCircleBtn}
            accessibilityRole="button"
            accessibilityLabel="Share itinerary"
          >
            <Feather name="share-2" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 80 }}
      >
        {/* Cover Hero */}
        <View style={styles.heroWrap}>
          <Image source={{ uri: trip.coverImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.92)']}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.heroInfo, { paddingBottom: 20 }]}>
            <View style={styles.destBadgeRow}>
              <View style={styles.heroDestPill}>
                <Feather name="map-pin" size={11} color="#FFFFFF" />
                <Text style={styles.heroDestText}>{trip.destination}</Text>
              </View>
              <View style={styles.heroBudgetPill}>
                <Text style={styles.heroBudgetText}>{trip.budgetTier.toUpperCase()}</Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>{trip.title}</Text>

            <View style={styles.heroMetaRow}>
              <View style={styles.metaItem}>
                <Feather name="calendar" size={13} color="rgba(255,255,255,0.85)" />
                <Text style={styles.metaText}>{trip.durationDays} Days</Text>
              </View>
              <Text style={styles.metaDot}>·</Text>
              <View style={styles.metaItem}>
                <Feather name="users" size={13} color="rgba(255,255,255,0.85)" />
                <Text style={styles.metaText}>{trip.guestCount} Guests</Text>
              </View>
              <Text style={styles.metaDot}>·</Text>
              <View style={styles.metaItem}>
                <Feather name="check-circle" size={13} color="#10B981" />
                <Text style={styles.metaText}>Curated Itinerary</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Content Body */}
        <View style={[styles.mainBody, { backgroundColor: colors.background }]}>
          {/* REM-10: Degraded Mode Notice Banner */}
          {(trip.degraded || trip.metadata?.degraded) && (
            <View
              style={[
                styles.degradedBanner,
                {
                  backgroundColor: isDark ? '#3D2005' : '#FEF3C7',
                  borderColor: isDark ? '#B45309' : '#F59E0B',
                },
              ]}
            >
              <View style={styles.degradedBannerHeader}>
                <Feather name="alert-triangle" size={16} color="#D97706" />
                <Text style={[styles.degradedBannerTitle, { color: isDark ? '#FDE68A' : '#92400E' }]}>
                  Operating in Offline Mode
                </Text>
              </View>
              <Text style={[styles.degradedBannerText, { color: isDark ? '#FDE68A' : '#78350F' }]}>
                {trip.fallbackReason && !trip.fallbackReason.includes('{"type":')
                  ? trip.fallbackReason
                  : 'This itinerary was assembled using verified local listings while the AI reasoning engine was momentarily unreachable. Tap below to retry AI synthesis.'}
              </Text>
              <Pressable
                disabled={isBusy}
                onPress={handleRetryFullAIRegeneration}
                style={[styles.retryAiBtn, isBusy && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Upgrade Plan with AI"
              >
                {isUpgradingAi ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={13} color="#FFFFFF" />
                    <Text style={styles.retryAiBtnText}>Upgrade Plan with AI</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* Cost Breakdown Card */}
          <View style={[styles.budgetCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.budgetHeaderRow}>
              <Text style={[styles.budgetTitle, { color: colors.text }]}>Total Estimated Trip Cost</Text>
              <Text style={styles.budgetTotalAmount}>
                KSh {Number(trip.budgetBreakdown.totalEstimatedKes).toLocaleString()}
              </Text>
            </View>

            <View style={[styles.budgetDivider, { backgroundColor: colors.border }]} />

            <View style={styles.budgetDetailsRow}>
              <View style={styles.budgetCol}>
                <Text style={[styles.budgetColLabel, { color: colors.mutedForeground }]}>ACCOMMODATION</Text>
                <Text style={[styles.budgetColVal, { color: colors.text }]}>
                  KSh {Number(trip.budgetBreakdown.accommodationTotal).toLocaleString()}
                </Text>
              </View>
              <View style={styles.budgetCol}>
                <Text style={[styles.budgetColLabel, { color: colors.mutedForeground }]}>ACTIVITIES</Text>
                <Text style={[styles.budgetColVal, { color: colors.text }]}>
                  KSh {Number(trip.budgetBreakdown.activitiesTotal).toLocaleString()}
                </Text>
              </View>
              <View style={styles.budgetCol}>
                <Text style={[styles.budgetColLabel, { color: colors.mutedForeground }]}>DINING (EST.)</Text>
                <Text style={[styles.budgetColVal, { color: colors.text }]}>
                  KSh {Number(trip.budgetBreakdown.diningEstimate).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          {/* Horizontal Day Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayTabsRow}
          >
            <Pressable
              onPress={() => setSelectedDayFilter('all')}
              style={[
                styles.dayFilterPill,
                {
                  backgroundColor: selectedDayFilter === 'all' ? '#F26522' : isDark ? '#27272A' : '#F3F4F6',
                },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedDayFilter === 'all' }}
            >
              <Text style={[styles.dayFilterText, { color: selectedDayFilter === 'all' ? '#FFFFFF' : colors.text }]}>
                All Days ({trip.days.length})
              </Text>
            </Pressable>

            {trip.days.map((d) => {
              const isSelected = selectedDayFilter === d.dayNumber;
              return (
                <Pressable
                  key={d.dayNumber}
                  onPress={() => setSelectedDayFilter(d.dayNumber)}
                  style={[
                    styles.dayFilterPill,
                    {
                      backgroundColor: isSelected ? '#F26522' : isDark ? '#27272A' : '#F3F4F6',
                    },
                  ]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.dayFilterText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                    Day {d.dayNumber}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Day-by-Day Cards List */}
          <View style={styles.daysList}>
            {filteredDays.map((day) => (
              <ItineraryDayCard
                key={day.dayNumber}
                day={day}
                onBookExperience={handleBookExperience}
                onRegenerateDay={handleRegenerateDay}
                onReorderItem={handleReorderItem}
                isRegenerating={isRegeneratingDay === day.dayNumber}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Floating Zuru Agent Pill Button */}
      <Pressable
        testID="open-itinerary-agent-btn"
        disabled={isBusy}
        onPress={() => {
          if (isBusy) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setAgentSheetVisible(true);
        }}
        style={[styles.floatingAgentBtn, { bottom: bottomInset }, isBusy && { opacity: 0.5 }]}
        accessibilityRole="button"
        accessibilityLabel="Ask Zuru Agent to edit this itinerary"
      >
        <MaterialCommunityIcons name="robot" size={20} color="#FFFFFF" />
        <Text style={styles.floatingAgentText}>Ask Zuru Agent</Text>
      </Pressable>

      {/* Expandable Zuru Agent Bottom Sheet */}
      <AgentItinerarySheet
        visible={agentSheetVisible}
        onClose={() => setAgentSheetVisible(false)}
        trip={trip}
        onApplyItem={handleApplyAgentItem}
      />

      {/* Integrated Real Listing Booking Sheet */}
      {bookingReel && (
        <BookingSheet
          reel={bookingReel}
          visible={bookingSheetVisible}
          onClose={() => {
            setBookingSheetVisible(false);
            setBookingReel(null);
          }}
          onSuccess={() => {
            setBookingSheetVisible(false);
            setBookingReel(null);
            Alert.alert('Booking Confirmed! 🎉', 'Your stay or activity has been scheduled. Check Trips for details.');
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  rebuildBtn: {
    backgroundColor: '#F26522',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  rebuildBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },

  /* Floating Nav */
  floatingNav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  navCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  /* Hero */
  heroWrap: {
    height: 310,
    justifyContent: 'flex-end',
  },
  heroInfo: {
    paddingHorizontal: 20,
    gap: 8,
  },
  destBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroDestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  heroDestText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontFamily: 'DMSans_700Bold',
  },
  heroBudgetPill: {
    backgroundColor: 'rgba(242,101,34,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  heroBudgetText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.3,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12.5,
    fontFamily: 'DMSans_500Medium',
  },
  metaDot: {
    color: 'rgba(255,255,255,0.6)',
  },

  /* Body */
  mainBody: {
    paddingTop: 16,
    paddingHorizontal: 20,
    gap: 18,
  },

  /* Budget Card */
  budgetCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  budgetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  budgetTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  budgetTotalAmount: {
    fontSize: 17,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  budgetDivider: {
    height: 1,
  },
  budgetDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  budgetCol: {
    gap: 2,
  },
  budgetColLabel: {
    fontSize: 9.5,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.4,
  },
  budgetColVal: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
  },

  /* Day Tabs */
  dayTabsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  dayFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  dayFilterText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
  },

  /* Days List */
  daysList: {
    marginTop: 4,
  },

  /* Degraded Mode Banner (REM-10) */
  degradedBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    marginBottom: 4,
  },
  degradedBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  degradedBannerTitle: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
  },
  degradedBannerText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 17,
  },
  retryAiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#D97706',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  retryAiBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },

  /* Floating Agent Button */
  floatingAgentBtn: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E40AF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingAgentText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
});
