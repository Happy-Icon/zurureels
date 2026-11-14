import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { useEnquire, useGuestCancelBooking, useMyBookings } from '@/lib/queries';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { Skeleton } from '@/components/Skeleton';
import { OfflineState } from '@/components/OfflineState';
import { useNetworkStatus } from '@/lib/networkManager';
import { JourneyCompanionSheet } from '@/components/journey/JourneyCompanionSheet';
import { LeaveReviewModal } from '@/components/reviews/LeaveReviewModal';
import { supabase, type BookingRow } from '@/lib/supabase';
import { FILTER_CHIPS, type FilterChip, ORANGE } from './reservationHelpers';
import { FeaturedNextTripCard } from './FeaturedNextTripCard';
import { TripCard } from './TripCard';
import { BookingDetailModal } from './BookingDetailModal';
import { reservationsStyles as styles } from './reservationsStyles';

export function GuestTripsView() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { showAlert } = useCustomAlert();
  const { isOnline } = useNetworkStatus();
  const enquire = useEnquire();

  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const [selectedFilter, setSelectedFilter] = useState<FilterChip>('all');
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const [journeyBooking, setJourneyBooking] = useState<BookingRow | null>(null);
  const [reviewModalBooking, setReviewModalBooking] = useState<BookingRow | null>(null);

  const { data: bookings, isLoading, isRefetching, refetch } = useMyBookings(user?.id);

  // Automatically select the requested booking when navigated with bookingId param
  useEffect(() => {
    if (bookingId && bookings && bookings.length > 0) {
      const match = bookings.find((b) => b.id === bookingId);
      if (match) {
        setSelectedBooking(match);
      }
    }
  }, [bookingId, bookings]);

  // Automatically refresh trips whenever this screen/tab gains focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        refetch();
      }
    }, [user?.id, refetch])
  );

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 10;
  const bottomPad = Platform.OS === 'web' ? 110 : insets.bottom + 90;

  // Grouping & Filtering Logic
  const { featuredUpcoming, upcomingList, pastList, cancelledList } = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const upcoming: BookingRow[] = [];
    const past: BookingRow[] = [];
    const cancelled: BookingRow[] = [];

    for (const b of bookings ?? []) {
      const s = (b.status ?? '').toLowerCase();
      const ref = b.check_out ?? b.check_in;
      const isPastDate = ref ? new Date(ref).getTime() < todayStart.getTime() : false;

      if (s === 'cancelled' || s === 'refunded') {
        cancelled.push(b);
      } else if (s === 'completed' || isPastDate) {
        past.push(b);
      } else {
        upcoming.push(b);
      }
    }

    // Sort upcoming by nearest check_in date first
    upcoming.sort((a, b) => {
      const tA = a.check_in ? new Date(a.check_in).getTime() : 0;
      const tB = b.check_in ? new Date(b.check_in).getTime() : 0;
      return tA - tB;
    });

    const featured = upcoming.length > 0 ? upcoming[0] : null;
    const remainingUpcoming = upcoming.length > 1 ? upcoming.slice(1) : [];

    return {
      featuredUpcoming: featured,
      upcomingList: remainingUpcoming,
      pastList: past,
      cancelledList: cancelled,
    };
  }, [bookings]);

  // Apply selected Filter Chip
  const filteredData = useMemo(() => {
    if (selectedFilter === 'upcoming') {
      return {
        featured: featuredUpcoming,
        upcoming: upcomingList,
        past: [],
        cancelled: [],
      };
    }
    if (selectedFilter === 'completed') {
      return { featured: null, upcoming: [], past: pastList, cancelled: [] };
    }
    if (selectedFilter === 'cancelled' || selectedFilter === 'refunded') {
      return { featured: null, upcoming: [], past: [], cancelled: cancelledList };
    }
    return {
      featured: featuredUpcoming,
      upcoming: upcomingList,
      past: pastList,
      cancelled: cancelledList,
    };
  }, [selectedFilter, featuredUpcoming, upcomingList, pastList, cancelledList]);

  // Handlers
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const handleMessageHost = async (
    hostId?: string | null,
    experienceId?: string | null,
    hostName?: string | null,
    hostAvatar?: string | null,
  ) => {
    if (!user) {
      router.push('/auth');
      return;
    }

    let targetHostId = hostId;
    let targetHostName = hostName;
    let targetHostAvatar = hostAvatar;

    if ((!targetHostId || !UUID_REGEX.test(targetHostId)) && experienceId) {
      try {
        const { data: exp } = await supabase
          .from('experiences')
          .select('user_id, entity_name, image_url')
          .eq('id', experienceId)
          .maybeSingle();
        if (exp?.user_id && UUID_REGEX.test(exp.user_id)) {
          targetHostId = exp.user_id;
          if (!targetHostName && exp.entity_name) targetHostName = exp.entity_name;
          if (!targetHostAvatar && exp.image_url) targetHostAvatar = exp.image_url;
        }
      } catch (e) {
        console.warn('Fallback hostId resolution failed:', e);
      }
    }

    if (!targetHostId || !UUID_REGEX.test(targetHostId)) {
      showAlert({
        title: 'Host Unavailable',
        message: 'This booking has no direct host contact details.',
        variant: 'info',
      });
      return;
    }

    try {
      const convId = await enquire.mutateAsync({ userId: user.id, hostId: targetHostId });
      router.push({
        pathname: '/chat/[id]',
        params: {
          id: convId,
          otherId: targetHostId,
          name: targetHostName || 'Host',
          avatar: targetHostAvatar || '',
        },
      });
    } catch (err) {
      showAlert({
        title: 'Chat Error',
        message: err instanceof Error ? err.message : 'Could not open chat',
        variant: 'error',
      });
    }
  };

  const handleDirections = (location?: string | null) => {
    const loc = location || 'Kenyan Coast';
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(loc)}`,
      android: `geo:0,0?q=${encodeURIComponent(loc)}`,
      web: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`,
    });
    if (url) Linking.openURL(url);
  };

  const cancelBookingMutation = useGuestCancelBooking();

  const handleCancelBooking = (b: BookingRow) => {
    showAlert({
      title: 'Cancel Reservation?',
      message: 'Are you sure you want to cancel this reservation? The host will be notified and your cancellation will be processed.',
      icon: 'alert-triangle',
      buttons: [
        { text: 'Keep Reservation', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelBookingMutation.mutateAsync({
                bookingId: b.id,
                reason: 'Cancelled by guest from Trips screen',
              });
              setSelectedBooking(null);
              showAlert({
                title: 'Reservation Cancelled',
                message: 'Your booking has been cancelled.',
                icon: 'check-circle',
              });
            } catch (err: any) {
              showAlert({
                title: 'Cancellation Failed',
                message: err?.message || 'Could not cancel reservation.',
                icon: 'alert-circle',
              });
            }
          },
        },
      ],
    });
  };

  const handleBack = () => {
    router.push('/profile');
  };

  // ── Unauthenticated State ──────────────────────────────────────────────────
  if (!loading && !user) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={[styles.topNavBar, { paddingHorizontal: 20 }]}>
          <Pressable
            testID="reservations-back-btn"
            onPress={handleBack}
            style={({ pressed }) => [
              styles.backIconBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
              { opacity: pressed ? 0.6 : 1 },
            ]}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back to Profile"
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Trips</Text>
          <View style={{ width: 38 }} />
        </View>

        <View style={styles.loggedOutContainer}>
          <View style={[styles.loggedOutIconCircle, { backgroundColor: isDark ? '#27272A' : '#FFF7ED' }]}>
            <MaterialCommunityIcons name="bag-suitcase-outline" size={36} color={ORANGE} />
          </View>

          <Text style={[styles.loggedOutTitle, { color: colors.text }]}>Log in to view trips</Text>
          <Text style={[styles.loggedOutSub, { color: colors.mutedForeground }]}>
            Check your active reservations, check-in instructions, and past memories once logged in.
          </Text>

          <Pressable
            testID="trips-signin"
            onPress={() => router.push('/auth')}
            style={({ pressed }) => [styles.primaryCtaBtn, pressed && { opacity: 0.88 }]}
            accessibilityRole="button"
            accessibilityLabel="Log in or Sign up"
          >
            <Text style={styles.primaryCtaBtnText}>Log in or Sign up</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const hasAnyBookings = (bookings ?? []).length > 0;

  return (
    <View testID="reservations-screen" style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#F26522"
            colors={['#F26522']}
          />
        }
        contentContainerStyle={{
          paddingTop: topPad,
          paddingBottom: bottomPad,
          paddingHorizontal: 20,
          gap: 20,
        }}
      >
        {/* ── Page Header ────────────────────────────────────────────── */}
        <View style={styles.headerArea}>
          <View style={styles.topHeaderRow}>
            <Pressable
              testID="reservations-back-btn"
              onPress={handleBack}
              style={({ pressed }) => [
                styles.backIconBtn,
                { backgroundColor: colors.card, borderColor: colors.border },
                { opacity: pressed ? 0.6 : 1 },
              ]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back to Profile"
            >
              <Feather name="arrow-left" size={20} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pageTitle, { color: colors.text }]}>Trips & Itineraries</Text>
              <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
                Your upcoming coastal adventures & travel memories
              </Text>
            </View>
          </View>

          {/* Filter Chips Row */}
          {hasAnyBookings ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {FILTER_CHIPS.map((chip) => {
                const isActive = selectedFilter === chip.id;
                return (
                  <Pressable
                    key={chip.id}
                    onPress={() => setSelectedFilter(chip.id)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isActive
                          ? colors.text
                          : isDark
                          ? '#27272A'
                          : '#F3F4F6',
                        borderColor: colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={`Filter by ${chip.label}`}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        {
                          color: isActive
                            ? colors.background
                            : colors.mutedForeground,
                          fontFamily: isActive ? 'DMSans_700Bold' : 'DMSans_500Medium',
                        },
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>

        {/* ── Loading Skeleton ───────────────────────────────────────── */}
        {isLoading ? (
          <View style={{ gap: 16 }}>
            <Skeleton style={styles.skeletonHero} />
            <Skeleton style={styles.skeletonCard} />
            <Skeleton style={styles.skeletonCard} />
          </View>
        ) : !hasAnyBookings && !isOnline ? (
          <OfflineState
            fullScreen={false}
            onRetry={refetch}
            message="Check your internet connection to view your booked trips."
          />
        ) : !hasAnyBookings ? (
          /* ── Premium Empty State ───────────────────────────────────── */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIllustration}>
              <View style={styles.emptyOuterCircle}>
                <View style={styles.emptyInnerCircle}>
                  <Feather name="compass" size={38} color={ORANGE} />
                </View>
              </View>
            </View>

            <Text style={styles.emptyTitle}>No adventures yet</Text>
            <Text style={styles.emptySub}>
              Your next unforgettable stay starts here. Discover luxury villas, boat tours, and coastal stays across Kenya.
            </Text>

            <Pressable
              onPress={() => router.push('/discover')}
              style={({ pressed }) => [styles.exploreCtaBtn, pressed && { opacity: 0.88 }]}
              accessibilityRole="button"
              accessibilityLabel="Explore Experiences"
            >
              <Feather name="search" size={16} color="#FFFFFF" />
              <Text style={styles.exploreCtaBtnText}>Explore Experiences</Text>
            </Pressable>
          </View>
        ) : (
          /* ── Content Sections ─────────────────────────────────────── */
          <>
            {/* 1. FEATURED NEXT TRIP HERO CARD */}
            {filteredData.featured ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>Next Trip</Text>
                  <View style={styles.nextTripPill}>
                    <Text style={styles.nextTripPillText}>Featured</Text>
                  </View>
                </View>

                <FeaturedNextTripCard
                  booking={filteredData.featured}
                  onViewBooking={() => setSelectedBooking(filteredData.featured)}
                  onMessageHost={() =>
                    handleMessageHost(
                      filteredData.featured?.experience?.user_id,
                      filteredData.featured?.experience_id,
                      filteredData.featured?.experience?.entity_name || filteredData.featured?.experience?.title,
                      filteredData.featured?.experience?.image_url,
                    )
                  }
                  onDirections={() => setJourneyBooking(filteredData.featured)}
                />
              </View>
            ) : null}

            {/* 2. REMAINING UPCOMING TRIPS */}
            {filteredData.upcoming.length > 0 ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>
                  Upcoming Trips ({filteredData.upcoming.length})
                </Text>

                <View style={styles.cardList}>
                  {filteredData.upcoming.map((b) => (
                    <TripCard
                      key={b.id}
                      booking={b}
                      type="upcoming"
                      onViewBooking={() => setSelectedBooking(b)}
                      onMessageHost={() =>
                        handleMessageHost(
                          b.experience?.user_id,
                          b.experience_id,
                          b.experience?.entity_name || b.experience?.title,
                          b.experience?.image_url,
                        )
                      }
                      onDirections={() => setJourneyBooking(b)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {/* 3. PAST TRIPS */}
            {filteredData.past.length > 0 ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>
                  Past Trips ({filteredData.past.length})
                </Text>

                <View style={styles.cardList}>
                  {filteredData.past.map((b) => (
                    <TripCard
                      key={b.id}
                      booking={b}
                      type="past"
                      onViewBooking={() => setSelectedBooking(b)}
                      onWriteReview={() => setReviewModalBooking(b)}
                      onBookAgain={() => router.push('/discover')}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {/* 4. CANCELLED / REFUNDED */}
            {filteredData.cancelled.length > 0 ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>
                  Cancelled ({filteredData.cancelled.length})
                </Text>

                <View style={styles.cardList}>
                  {filteredData.cancelled.map((b) => (
                    <TripCard
                      key={b.id}
                      booking={b}
                      type="cancelled"
                      onViewBooking={() => setSelectedBooking(b)}
                      onBookSimilar={() => router.push('/discover')}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* ── Booking Detail Sheet Modal ───────────────────────────── */}
      {selectedBooking ? (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onMessageHost={() => {
            const hostId = selectedBooking.experience?.user_id;
            const expId = selectedBooking.experience_id;
            const hostName = selectedBooking.experience?.entity_name || selectedBooking.experience?.title;
            const hostAvatar = selectedBooking.experience?.image_url;
            setSelectedBooking(null);
            handleMessageHost(hostId, expId, hostName, hostAvatar);
          }}
          onDirections={() => {
            const current = selectedBooking;
            setSelectedBooking(null);
            setJourneyBooking(current);
          }}
          onWriteReview={() => {
            const current = selectedBooking;
            setSelectedBooking(null);
            setReviewModalBooking(current);
          }}
          onCancelBooking={() => handleCancelBooking(selectedBooking)}
          isCancelling={cancelBookingMutation.isPending}
        />
      ) : null}

      {/* ── Leave Review Modal ───────────────────────────────────── */}
      {reviewModalBooking ? (
        <LeaveReviewModal
          visible={Boolean(reviewModalBooking)}
          bookingId={reviewModalBooking.id}
          hostId={reviewModalBooking.experience?.user_id || ''}
          listingId={reviewModalBooking.experience_id}
          listingTitle={reviewModalBooking.experience?.title || 'Coastal Stay'}
          onClose={() => setReviewModalBooking(null)}
          onSuccess={() => {
            setReviewModalBooking(null);
            refetch();
            showAlert({
              title: 'Review Submitted! ⭐',
              message: 'Thank you for sharing your experience. Your review is now live on ZuruSasa.',
              icon: 'check-circle',
            });
          }}
        />
      ) : null}

      {/* ── Journey Companion Sheet ──────────────────────────────── */}
      {journeyBooking ? (
        <JourneyCompanionSheet
          visible={Boolean(journeyBooking)}
          booking={journeyBooking}
          onClose={() => setJourneyBooking(null)}
          onMessageHost={() => {
            const hostId = journeyBooking.experience?.user_id;
            const expId = journeyBooking.experience_id;
            setJourneyBooking(null);
            handleMessageHost(hostId, expId);
          }}
        />
      ) : null}
    </View>
  );
}
