import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
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
import { useAuth } from '@/context/AuthContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { useEnquire, useGuestCancelBooking, useMyBookings } from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';
import { JourneyCompanionSheet } from '@/components/journey/JourneyCompanionSheet';
import { HostReservationsView } from '@/components/host/HostReservationsView';
import type { BookingRow } from '@/lib/supabase';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const ORANGE = '#F26522';

// ── Date Formatting Helpers ──────────────────────────────────────────────────

function formatDay(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const year =
    d.getFullYear() === new Date().getFullYear() ? '' : `, ${d.getFullYear()}`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${year}`;
}

function dateRange(b: BookingRow) {
  const ci = formatDay(b.check_in);
  const co = formatDay(b.check_out);
  if (ci && co) return `${ci} – ${co}`;
  return ci || co || '';
}

function daysUntilNumber(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function daysUntilLabel(iso: string | null): string | null {
  const num = daysUntilNumber(iso);
  if (num === null) return null;
  if (num < 0) return null;
  if (num === 0) return 'Check in Today';
  if (num === 1) return 'Check in Tomorrow';
  return `Check in in ${num} days`;
}

type FilterChip = 'all' | 'upcoming' | 'completed' | 'cancelled' | 'refunded';

const FILTER_CHIPS: { id: FilterChip; label: string }[] = [
  { id: 'all', label: 'All Trips' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'refunded', label: 'Refunded' },
];

// ── Status Badge Component ───────────────────────────────────────────────────

function StatusPill({ status }: { status: string | null }) {
  const s = (status ?? 'pending').toLowerCase();
  let bg = '#FFF7ED';
  let color = '#D97706';
  let iconName: keyof typeof Feather.glyphMap = 'clock';
  let label = 'Pending';

  if (s === 'paid') {
    bg = '#EFF6FF';
    color = '#2563EB';
    iconName = 'clock';
    label = 'Awaiting Host';
  } else if (s === 'confirmed') {
    bg = '#ECFDF5';
    color = '#059669';
    iconName = 'check-circle';
    label = 'Confirmed';
  } else if (s === 'completed') {
    bg = '#EFF6FF';
    color = '#2563EB';
    iconName = 'check-square';
    label = 'Completed';
  } else if (s === 'refund_pending') {
    bg = '#FFFBEB';
    color = '#D97706';
    iconName = 'refresh-cw';
    label = 'Refund Pending';
  } else if (s === 'cancelled' || s === 'refunded') {
    bg = '#FEF2F2';
    color = '#DC2626';
    iconName = 'x-circle';
    label = s === 'refunded' ? 'Refunded' : 'Cancelled';
  }

  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <Feather name={iconName} size={11} color={color} />
      <Text style={[styles.statusPillText, { color }]}>{label}</Text>
    </View>
  );
}

// ── Trip Progress Bar ────────────────────────────────────────────────────────

function TripProgressTimeline({ status, checkIn }: { status: string | null; checkIn: string | null }) {
  const days = daysUntilNumber(checkIn);
  const s = (status ?? 'pending').toLowerCase();
  const isPaid = s === 'paid' || s === 'confirmed';

  let activeStep = 1; // 0: Booked, 1: Confirmed, 2: Check In, 3: Stay, 4: Checkout
  if (isPaid) {
    if (days !== null && days <= 0 && days >= -1) activeStep = 2; // Check In
    else if (days !== null && days < -1) activeStep = 3; // Stay
    else activeStep = 1; // Confirmed
  }

  const steps = ['Booked', 'Confirmed', 'Check In', 'Stay'];

  return (
    <View style={styles.timelineWrap}>
      <View style={styles.timelineTrack}>
        <View
          style={[
            styles.timelineFill,
            { width: `${(activeStep / (steps.length - 1)) * 100}%` },
          ]}
        />
      </View>

      <View style={styles.timelineSteps}>
        {steps.map((label, idx) => {
          const isDone = idx <= activeStep;
          const isCurrent = idx === activeStep;
          return (
            <View key={label} style={styles.timelineStep}>
              <View
                style={[
                  styles.timelineDot,
                  isDone && styles.timelineDotDone,
                  isCurrent && styles.timelineDotCurrent,
                ]}
              >
                {isDone ? (
                  <Feather name="check" size={8} color="#FFFFFF" />
                ) : null}
              </View>
              <Text
                style={[
                  styles.timelineLabel,
                  isDone && styles.timelineLabelDone,
                  isCurrent && styles.timelineLabelCurrent,
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Root Screen Component ───────────────────────────────────────────────────

export default function ReservationsScreen() {
  const { viewMode } = useAuth();
  if (viewMode === 'host') {
    return <HostReservationsView />;
  }
  return <GuestTripsView />;
}

// ── Guest Trips Screen ───────────────────────────────────────────────────────

function GuestTripsView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, loading } = useAuth();
  const enquire = useEnquire();

  const [selectedFilter, setSelectedFilter] = useState<FilterChip>('all');
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const [journeyBooking, setJourneyBooking] = useState<BookingRow | null>(null);

  const { data: bookings, isLoading, isRefetching, refetch } = useMyBookings(user?.id);

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
  const handleMessageHost = async (hostId?: string | null) => {
    if (!user) {
      router.push('/auth');
      return;
    }
    if (!hostId) {
      Alert.alert('Host Unavailable', 'This booking has no direct host contact details.');
      return;
    }
    try {
      const convId = await enquire.mutateAsync({ userId: user.id, hostId });
      router.push({
        pathname: `/chat/${convId}` as any,
        params: { id: convId, otherId: hostId },
      });
    } catch (err) {
      Alert.alert('Chat Error', err instanceof Error ? err.message : 'Could not open chat');
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
  const { showAlert } = useCustomAlert();

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
      <View style={[styles.fill, { backgroundColor: '#FAFAFA', paddingTop: topPad }]}>
        <View style={[styles.topNavBar, { paddingHorizontal: 20 }]}>
          <Pressable
            testID="reservations-back-btn"
            onPress={handleBack}
            style={({ pressed }) => [styles.backIconBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={10}
          >
            <Feather name="arrow-left" size={20} color="#111111" />
          </Pressable>
          <Text style={styles.pageTitle}>Trips</Text>
          <View style={{ width: 38 }} />
        </View>

        <View style={styles.loggedOutContainer}>
          <View style={styles.loggedOutIconCircle}>
            <MaterialCommunityIcons name="bag-suitcase-outline" size={36} color={ORANGE} />
          </View>

          <Text style={styles.loggedOutTitle}>Log in to view trips</Text>
          <Text style={styles.loggedOutSub}>
            Check your active reservations, check-in instructions, and past memories once logged in.
          </Text>

          <Pressable
            testID="trips-signin"
            onPress={() => router.push('/auth')}
            style={({ pressed }) => [styles.primaryCtaBtn, pressed && { opacity: 0.88 }]}
          >
            <Text style={styles.primaryCtaBtnText}>Log in or Sign up</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const hasAnyBookings = (bookings ?? []).length > 0;

  return (
    <View testID="reservations-screen" style={[styles.fill, { backgroundColor: '#FAFAFA' }]}>
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
              style={({ pressed }) => [styles.backIconBtn, { opacity: pressed ? 0.6 : 1 }]}
              hitSlop={10}
            >
              <Feather name="arrow-left" size={20} color="#111111" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>Trips & Itineraries</Text>
              <Text style={styles.pageSubtitle}>
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
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
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
                  onMessageHost={() => handleMessageHost(filteredData.featured?.experience?.entity_name)}
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
                      onMessageHost={() => handleMessageHost(b.experience?.entity_name)}
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
                      onWriteReview={() =>
                        router.push({
                          pathname: '/reviews',
                          params: {
                            bookingId: b.id,
                            listingId: b.experience_id,
                            title: b.experience?.title || 'Stay',
                          },
                        } as any)
                      }
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
            const hostId = selectedBooking.experience?.entity_name;
            setSelectedBooking(null);
            handleMessageHost(hostId);
          }}
          onDirections={() => {
            const current = selectedBooking;
            setSelectedBooking(null);
            setJourneyBooking(current);
          }}
          onCancelBooking={() => handleCancelBooking(selectedBooking)}
          isCancelling={cancelBookingMutation.isPending}
        />
      ) : null}

      {/* ── Journey Companion Sheet ──────────────────────────────── */}
      {journeyBooking ? (
        <JourneyCompanionSheet
          visible={Boolean(journeyBooking)}
          booking={journeyBooking}
          onClose={() => setJourneyBooking(null)}
          onMessageHost={() => {
            const hostId = journeyBooking.experience?.entity_name;
            setJourneyBooking(null);
            handleMessageHost(hostId);
          }}
        />
      ) : null}
    </View>
  );
}

// ── FEATURED NEXT TRIP HERO CARD ─────────────────────────────────────────────

interface FeaturedNextTripCardProps {
  booking: BookingRow;
  onViewBooking: () => void;
  onMessageHost: () => void;
  onDirections: () => void;
}

function FeaturedNextTripCard({
  booking,
  onViewBooking,
  onMessageHost,
  onDirections,
}: FeaturedNextTripCardProps) {
  const exp = booking.experience;
  const countdown = daysUntilLabel(booking.check_in);
  const range = dateRange(booking);

  return (
    <Pressable
      onPress={onViewBooking}
      style={({ pressed }) => [
        styles.heroCard,
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
    >
      {/* High-res Image with Gradient Scrim */}
      <View style={styles.heroImageWrap}>
        {exp?.image_url ? (
          <Image
            source={{ uri: exp.image_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.imageFallback]}>
            <Feather name="map-pin" size={32} color="#D1D5DB" />
          </View>
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)']}
          style={StyleSheet.absoluteFill}
        />

        {/* Countdown Banner */}
        {countdown ? (
          <View style={styles.heroCountdownBadge}>
            <Feather name="zap" size={12} color="#FFFFFF" />
            <Text style={styles.heroCountdownText}>{countdown}</Text>
          </View>
        ) : null}

        {/* Top Right Status */}
        <View style={styles.heroStatusWrap}>
          <StatusPill status={booking.status} />
        </View>

        {/* Hero Bottom Information Stack */}
        <View style={styles.heroInfoStack}>
          {exp?.location ? (
            <View style={styles.heroLocationRow}>
              <Feather name="map-pin" size={11} color="rgba(255,255,255,0.85)" />
              <Text style={styles.heroLocationText}>{exp.location}</Text>
            </View>
          ) : null}

          <Text style={styles.heroTitleText} numberOfLines={2}>
            {exp?.title ?? 'Coastal Trip'}
          </Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaItem}>
              <Feather name="calendar" size={12} color="rgba(255,255,255,0.85)" />
              <Text style={styles.heroMetaText}>{range || 'Dates set'}</Text>
            </View>
            <Text style={styles.heroMetaDot}>·</Text>
            <View style={styles.heroMetaItem}>
              <Feather name="users" size={12} color="rgba(255,255,255,0.85)" />
              <Text style={styles.heroMetaText}>
                {booking.guests ? `${booking.guests} Guest${booking.guests > 1 ? 's' : ''}` : '1 Guest'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Content Body: Timeline & Actions */}
      <View style={styles.heroBody}>
        {/* Timeline */}
        <TripProgressTimeline status={booking.status} checkIn={booking.check_in} />

        {/* Price & Action Dock */}
        <View style={styles.heroDockRow}>
          {booking.amount != null ? (
            <View style={styles.heroPriceBlock}>
              <Text style={styles.heroPriceLabel}>TOTAL PRICE</Text>
              <Text style={styles.heroPriceAmount}>
                KES {Number(booking.amount).toLocaleString()}
              </Text>
            </View>
          ) : null}

          <View style={styles.heroActionsRow}>
            <Pressable
              onPress={onMessageHost}
              style={({ pressed }) => [styles.heroIconBtn, pressed && { opacity: 0.8 }]}
              hitSlop={6}
            >
              <Feather name="message-square" size={16} color="#374151" />
            </Pressable>
            <Pressable
              onPress={onDirections}
              style={({ pressed }) => [styles.heroIconBtn, pressed && { opacity: 0.8 }]}
              hitSlop={6}
            >
              <Feather name="navigation" size={16} color="#374151" />
            </Pressable>
            <Pressable
              onPress={onViewBooking}
              style={({ pressed }) => [styles.heroPrimaryBtn, pressed && { opacity: 0.88 }]}
            >
              <Text style={styles.heroPrimaryBtnText}>View Itinerary</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ── REGULAR TRIP CARD ─────────────────────────────────────────────────────────

interface TripCardProps {
  booking: BookingRow;
  type: 'upcoming' | 'past' | 'cancelled';
  onViewBooking: () => void;
  onMessageHost?: () => void;
  onDirections?: () => void;
  onWriteReview?: () => void;
  onBookAgain?: () => void;
  onBookSimilar?: () => void;
}

function TripCard({
  booking,
  type,
  onViewBooking,
  onMessageHost,
  onDirections,
  onWriteReview,
  onBookAgain,
  onBookSimilar,
}: TripCardProps) {
  const exp = booking.experience;
  const range = dateRange(booking);

  return (
    <Pressable
      onPress={onViewBooking}
      style={({ pressed }) => [
        styles.card,
        type === 'cancelled' && styles.cardCancelled,
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
    >
      {/* Cover Image */}
      <View style={styles.cardImageWrap}>
        {exp?.image_url ? (
          <Image source={{ uri: exp.image_url }} style={styles.cardImage} contentFit="cover" />
        ) : (
          <View style={[styles.cardImage, styles.imageFallback]}>
            <Feather name="image" size={24} color="#D1D5DB" />
          </View>
        )}

        <View style={styles.cardStatusPosition}>
          <StatusPill status={booking.status} />
        </View>
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {exp?.title ?? 'Coastal Stay'}
          </Text>
        </View>

        {exp?.location ? (
          <View style={styles.cardLocationRow}>
            <Feather name="map-pin" size={11} color="#9CA3AF" />
            <Text style={styles.cardLocationText} numberOfLines={1}>
              {exp.location}
            </Text>
          </View>
        ) : null}

        <View style={styles.cardMetaRow}>
          <View style={styles.cardMetaItem}>
            <Feather name="calendar" size={11} color="#717171" />
            <Text style={styles.cardMetaText}>{range || 'Dates set'}</Text>
          </View>
          {booking.amount != null ? (
            <Text style={styles.cardPriceText}>
              KES {Number(booking.amount).toLocaleString()}
            </Text>
          ) : null}
        </View>

        {/* Card Action Dock */}
        <View style={styles.cardActionsRow}>
          {type === 'upcoming' ? (
            <>
              {onMessageHost ? (
                <Pressable
                  onPress={(e) => { e.stopPropagation(); onMessageHost(); }}
                  style={styles.cardSecondaryBtn}
                >
                  <Feather name="message-square" size={13} color="#374151" />
                  <Text style={styles.cardSecondaryBtnText}>Host</Text>
                </Pressable>
              ) : null}
              {onDirections ? (
                <Pressable
                  onPress={(e) => { e.stopPropagation(); onDirections(); }}
                  style={styles.cardSecondaryBtn}
                >
                  <Feather name="navigation" size={13} color="#374151" />
                  <Text style={styles.cardSecondaryBtnText}>Directions</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={onViewBooking} style={styles.cardPrimaryBtn}>
                <Text style={styles.cardPrimaryBtnText}>Details</Text>
              </Pressable>
            </>
          ) : type === 'past' ? (
            <>
              {onWriteReview ? (
                <Pressable
                  onPress={(e) => { e.stopPropagation(); onWriteReview(); }}
                  style={styles.cardReviewBtn}
                >
                  <Feather name="star" size={13} color={ORANGE} />
                  <Text style={styles.cardReviewBtnText}>Write Review</Text>
                </Pressable>
              ) : null}
              {onBookAgain ? (
                <Pressable
                  onPress={(e) => { e.stopPropagation(); onBookAgain(); }}
                  style={styles.cardPrimaryBtn}
                >
                  <Text style={styles.cardPrimaryBtnText}>Book Again</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              <Pressable onPress={onViewBooking} style={styles.cardSecondaryBtn}>
                <Text style={styles.cardSecondaryBtnText}>Refund Status</Text>
              </Pressable>
              {onBookSimilar ? (
                <Pressable
                  onPress={(e) => { e.stopPropagation(); onBookSimilar(); }}
                  style={styles.cardPrimaryBtn}
                >
                  <Text style={styles.cardPrimaryBtnText}>Book Similar</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ── BOOKING DETAIL MODAL ──────────────────────────────────────────────────────

interface BookingDetailModalProps {
  booking: BookingRow;
  onClose: () => void;
  onMessageHost: () => void;
  onDirections: () => void;
  onCancelBooking?: () => void;
  isCancelling?: boolean;
}

function BookingDetailModal({
  booking,
  onClose,
  onMessageHost,
  onDirections,
  onCancelBooking,
  isCancelling,
}: BookingDetailModalProps) {
  const exp = booking.experience;
  const range = dateRange(booking);
  const status = (booking.status ?? '').toLowerCase();
  const canCancel = status === 'pending' || status === 'confirmed' || status === 'paid';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />

        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Pressable style={styles.modalCloseBtn} onPress={onClose} hitSlop={8}>
            <Feather name="x" size={18} color="#374151" />
          </Pressable>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View style={styles.modalHeader}>
              <StatusPill status={booking.status} />
              <Text style={styles.modalRefText}>
                REF: #{booking.id.slice(0, 8).toUpperCase()}
              </Text>
            </View>

            <Text style={styles.modalTitle}>{exp?.title ?? 'Coastal Experience'}</Text>
            {exp?.location ? (
              <View style={styles.cardLocationRow}>
                <Feather name="map-pin" size={12} color="#9CA3AF" />
                <Text style={styles.modalLocationText}>{exp.location}</Text>
              </View>
            ) : null}

            {/* Travel dates block */}
            <View style={styles.modalDatesBlock}>
              <View style={styles.modalDateCol}>
                <Text style={styles.modalDateLabel}>CHECK-IN</Text>
                <Text style={styles.modalDateVal}>{formatDay(booking.check_in) || 'Set date'}</Text>
              </View>
              <Feather name="arrow-right" size={16} color="#9CA3AF" />
              <View style={styles.modalDateCol}>
                <Text style={styles.modalDateLabel}>CHECK-OUT</Text>
                <Text style={styles.modalDateVal}>{formatDay(booking.check_out) || 'Set date'}</Text>
              </View>
            </View>

            {/* Guest & Price info */}
            <View style={styles.modalInfoRow}>
              <View style={styles.modalInfoBox}>
                <Feather name="users" size={14} color={ORANGE} />
                <Text style={styles.modalInfoBoxLabel}>Guests</Text>
                <Text style={styles.modalInfoBoxVal}>{booking.guests ?? 1} Guests</Text>
              </View>
              <View style={styles.modalInfoBox}>
                <Feather name="credit-card" size={14} color={ORANGE} />
                <Text style={styles.modalInfoBoxLabel}>Total Amount</Text>
                <Text style={styles.modalInfoBoxVal}>
                  KES {Number(booking.amount ?? 0).toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <Pressable onPress={onMessageHost} style={styles.modalPrimaryBtn}>
                <Feather name="message-square" size={16} color="#FFFFFF" />
                <Text style={styles.modalPrimaryBtnText}>Message Host</Text>
              </Pressable>
              <Pressable onPress={onDirections} style={styles.modalSecondaryBtn}>
                <Feather name="navigation" size={16} color="#374151" />
                <Text style={styles.modalSecondaryBtnText}>Get Directions</Text>
              </Pressable>
              {canCancel && onCancelBooking ? (
                <Pressable
                  onPress={onCancelBooking}
                  disabled={isCancelling}
                  style={({ pressed }) => [
                    styles.modalCancelBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Feather name="x-circle" size={16} color="#DC2626" />
                  <Text style={styles.modalCancelBtnText}>
                    {isCancelling ? 'Cancelling...' : 'Cancel Reservation'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#FAFAFA' },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  pageTitle: {
    fontSize: 26,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontSize: 13.5,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  headerArea: {
    gap: 12,
  },

  // Filter chips
  filterRow: {
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#6B7280',
  },
  filterChipTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },

  // Status pills
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
  },

  // Section blocks
  sectionBlock: {
    gap: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  nextTripPill: {
    backgroundColor: '#FFF5EF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#FDDFCB',
  },
  nextTripPillText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },
  cardList: {
    gap: 12,
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  heroImageWrap: {
    height: 210,
    position: 'relative',
    justifyContent: 'flex-end',
    padding: 16,
  },
  imageFallback: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCountdownBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
  },
  heroCountdownText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  heroStatusWrap: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  heroInfoStack: {
    gap: 4,
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroLocationText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: 'rgba(255,255,255,0.85)',
  },
  heroTitleText: {
    fontSize: 22,
    lineHeight: 26,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroMetaText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: 'rgba(255,255,255,0.85)',
  },
  heroMetaDot: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },

  // Hero Body
  heroBody: {
    padding: 16,
    gap: 16,
  },

  // Timeline
  timelineWrap: {
    gap: 8,
  },
  timelineTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    position: 'relative',
    marginHorizontal: 10,
  },
  timelineFill: {
    height: '100%',
    backgroundColor: ORANGE,
    borderRadius: 2,
  },
  timelineSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineStep: {
    alignItems: 'center',
    gap: 4,
    width: 60,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotDone: {
    backgroundColor: ORANGE,
  },
  timelineDotCurrent: {
    borderWidth: 2,
    borderColor: ORANGE,
    backgroundColor: '#FFFFFF',
  },
  timelineLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },
  timelineLabelDone: {
    color: '#374151',
  },
  timelineLabelCurrent: {
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },

  // Hero Dock
  heroDockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  heroPriceBlock: {
    gap: 1,
  },
  heroPriceLabel: {
    fontSize: 9.5,
    fontFamily: 'DMSans_700Bold',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  heroPriceAmount: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPrimaryBtn: {
    height: 38,
    borderRadius: 12,
    backgroundColor: '#111111',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontFamily: 'DMSans_700Bold',
  },

  // Regular Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardCancelled: {
    opacity: 0.75,
    backgroundColor: '#FAFAFA',
  },
  cardImageWrap: {
    height: 125,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardStatusPosition: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  cardContent: {
    padding: 14,
    gap: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cardLocationText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  cardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#374151',
  },
  cardPriceText: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cardSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  cardSecondaryBtnText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_600SemiBold',
    color: '#374151',
  },
  cardPrimaryBtn: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPrimaryBtnText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  cardReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFF5EF',
    borderWidth: 1,
    borderColor: '#FDDFCB',
  },
  cardReviewBtnText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },

  // Logged Out
  loggedOutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
    gap: 12,
  },
  loggedOutIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF5EF',
    borderWidth: 1,
    borderColor: '#FDDFCB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  loggedOutTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
    textAlign: 'center',
  },
  loggedOutSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyIllustration: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyOuterCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyInnerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5EF',
    borderWidth: 1.5,
    borderColor: '#FDDFCB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },
  exploreCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 50,
    paddingHorizontal: 28,
    borderRadius: 25,
    backgroundColor: ORANGE,
    marginTop: 6,
    shadowColor: ORANGE,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  exploreCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },

  primaryCtaBtn: {
    height: 48,
    paddingHorizontal: 32,
    borderRadius: 24,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },

  // Skeletons
  skeletonHero: {
    width: '100%',
    height: 280,
    borderRadius: 24,
  },
  skeletonCard: {
    width: '100%',
    height: 180,
    borderRadius: 20,
  },

  // Modal
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginTop: 10,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 50,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  modalRefText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#9CA3AF',
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  modalLocationText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },
  modalDatesBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    padding: 14,
    marginVertical: 4,
  },
  modalDateCol: {
    alignItems: 'center',
    gap: 2,
  },
  modalDateLabel: {
    fontSize: 9.5,
    fontFamily: 'DMSans_700Bold',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  modalDateVal: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  modalInfoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalInfoBox: {
    flex: 1,
    backgroundColor: '#FFF5EF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDDFCB',
    padding: 12,
    gap: 2,
  },
  modalInfoBoxLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  modalInfoBoxVal: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  modalActions: {
    gap: 10,
    marginTop: 6,
  },
  modalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 16,
    backgroundColor: ORANGE,
  },
  modalPrimaryBtnText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  modalSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  modalSecondaryBtnText: {
    fontSize: 14.5,
    fontFamily: 'DMSans_600SemiBold',
    color: '#374151',
  },
  modalCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    marginTop: 4,
  },
  modalCancelBtnText: {
    fontSize: 14.5,
    fontFamily: 'DMSans_700Bold',
    color: '#DC2626',
  },
});
