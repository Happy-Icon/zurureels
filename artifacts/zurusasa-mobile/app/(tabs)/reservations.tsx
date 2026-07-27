import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useMyBookings } from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';
import type { BookingRow } from '@/lib/supabase';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

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

function daysUntil(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return 'Today';
  return `In ${days} day${days === 1 ? '' : 's'}`;
}

type TripTab = 'upcoming' | 'history';

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TripTab>('upcoming');
  const { data: bookings, isLoading } = useMyBookings(user?.id);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 110 : insets.bottom + 90;

  const { upcoming, history } = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const up: BookingRow[] = [];
    const past: BookingRow[] = [];
    for (const b of bookings ?? []) {
      const ref = b.check_out ?? b.check_in;
      const isPastDate = ref
        ? new Date(ref).getTime() < todayStart.getTime()
        : false;
      const closed = b.status === 'cancelled' || b.status === 'completed';
      if (closed || isPastDate) past.push(b);
      else up.push(b);
    }
    return { upcoming: up, history: past };
  }, [bookings]);

  // Unauthenticated signed-out state
  if (!loading && !user) {
    return (
      <View style={[styles.fill, { backgroundColor: '#FFFFFF', paddingTop: topPad }]}>
        <View style={styles.topNavBar}>
          <Pressable
            testID="trips-back-btn"
            onPress={() => {
              router.push('/profile');
            }}
            style={({ pressed }) => [styles.backIconBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={10}
          >
            <Feather name="arrow-left" size={22} color="#222222" />
          </Pressable>
        </View>

        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons name="bag-suitcase-outline" size={30} color="#F26522" />
          </View>

          <Text style={styles.emptyHeadline}>Log in to view trips</Text>
          <Text style={styles.emptyBody}>
            You can check your upcoming reservations, booking details, and past trips once you're logged in.
          </Text>

          <Pressable
            testID="trips-signin"
            onPress={() => {
              router.push('/auth');
            }}
            style={({ pressed }) => [
              styles.primaryCtaBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.primaryCtaBtnText}>Log in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Header with title & Airbnb line tab switcher
  const renderHeader = () => (
    <View style={styles.headerWrap}>
      <View style={styles.topNavBar}>
        <Pressable
          testID="trips-back-btn"
          onPress={() => {
            router.push('/profile');
          }}
          style={({ pressed }) => [styles.backIconBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color="#222222" />
        </Pressable>
      </View>

      <Text style={styles.pageTitle}>Trips</Text>

      {/* Airbnb Line Tab Switcher */}
      <View style={styles.tabLineContainer}>
        {(
          [
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'history', label: 'Past / Cancelled' },
          ] as const
        ).map((t) => {
          const isActive = activeTab === t.id;
          return (
            <Pressable
              key={t.id}
              testID={`reservations-tab-${t.id}`}
              onPress={() => {
                setActiveTab(t.id);
              }}
              style={styles.tabLineItem}
            >
              <Text
                style={[
                  styles.tabLineText,
                  isActive ? styles.tabLineTextActive : styles.tabLineTextInactive,
                ]}
              >
                {t.label}
              </Text>
              {isActive ? <View style={styles.tabActiveIndicator} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  // Render populated trip card (Single-column vertical card list)
  const renderTripCard = ({ item }: { item: BookingRow }) => {
    const range = dateRange(item);
    const chip = activeTab === 'upcoming' ? daysUntil(item.check_in) : null;
    const isPaid = item.status === 'confirmed' || item.status === 'paid';
    const isCancelled = item.status === 'cancelled';

    return (
      <View testID={`booking-${item.id}`} style={styles.tripCard}>
        {/* Cover Photo */}
        <View style={styles.tripImageWrap}>
          {item.experience?.image_url ? (
            <Image
              source={{ uri: item.experience.image_url }}
              style={styles.tripImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.tripImageFallback}>
              <Feather name="map-pin" size={28} color="#717171" />
            </View>
          )}

          {/* Days until badge on image */}
          {chip ? (
            <View style={styles.daysUntilBadge}>
              <Text style={styles.daysUntilBadgeText}>{chip}</Text>
            </View>
          ) : null}
        </View>

        {/* Content Stack */}
        <View style={styles.tripCardContent}>
          <View style={styles.tripCardTopRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.tripLocationTitle} numberOfLines={1}>
                {item.experience?.location || 'Kenya Coast'}
              </Text>
              <Text style={styles.tripStayTitle} numberOfLines={1}>
                {item.experience?.title ?? 'Coastal Stay'}
              </Text>
            </View>

            {/* Status Badge */}
            <View
              style={[
                styles.statusBadge,
                isPaid
                  ? styles.statusBadgePaid
                  : isCancelled
                  ? styles.statusBadgeCancelled
                  : styles.statusBadgeNeutral,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  isPaid
                    ? { color: '#16A34A' }
                    : isCancelled
                    ? { color: '#EF4444' }
                    : { color: '#6B7280' },
                ]}
              >
                {item.status === 'paid' ? 'Confirmed' : item.status ?? 'Pending'}
              </Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          {/* Reservation details */}
          <View style={styles.tripCardBottomRow}>
            <View style={{ gap: 2 }}>
              <Text style={styles.tripDatesText}>
                {range || 'Dates to be confirmed'}
              </Text>
              <Text style={styles.tripGuestsText}>
                {item.guests ? `${item.guests} guest${item.guests === 1 ? '' : 's'}` : '1 guest'}
              </Text>
            </View>

            {item.amount != null ? (
              <Text style={styles.tripAmountText}>
                KES {Number(item.amount).toLocaleString()}
              </Text>
            ) : null}
          </View>

          {/* Write Review CTA for confirmed/paid trips */}
          {isPaid ? (
            <View style={{ marginTop: 10, alignItems: 'flex-end' }}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/reviews',
                    params: {
                      bookingId: item.id,
                      listingId: item.experience_id,
                      title: item.experience?.title || 'Stay',
                    },
                  } as any)
                }
                style={({ pressed }) => [
                  styles.writeReviewBtn,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Feather name="star" size={13} color="#F26522" />
                <Text style={styles.writeReviewBtnText}>Write Review</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const currentData = activeTab === 'upcoming' ? upcoming : history;

  return (
    <View testID="reservations-screen" style={[styles.fill, { backgroundColor: '#FFFFFF' }]}>
      <FlatList
        data={currentData}
        keyExtractor={(b) => b.id}
        renderItem={renderTripCard}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: bottomPad,
          gap: 16,
        }}
        ListHeaderComponent={renderHeader()}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 16 }}>
              <Skeleton style={styles.skeletonTripCard} />
              <Skeleton style={styles.skeletonTripCard} />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <MaterialCommunityIcons name="bag-suitcase-outline" size={30} color="#F26522" />
              </View>

              <Text style={styles.emptyHeadline}>
                {activeTab === 'upcoming' ? 'No trips booked... yet!' : 'No past trips'}
              </Text>
              <Text style={styles.emptyBody}>
                {activeTab === 'upcoming'
                  ? 'Time to dust off your bags and start planning your next coastal adventure.'
                  : 'Your past, completed, and cancelled bookings will be listed here.'}
              </Text>

              <Pressable
                onPress={() => {
                  router.push('/discover');
                }}
                style={({ pressed }) => [
                  styles.primaryCtaBtn,
                  { opacity: pressed ? 0.88 : 1 },
                ]}
              >
                <Text style={styles.primaryCtaBtnText}>Start searching</Text>
              </Pressable>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topNavBar: {
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerWrap: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    letterSpacing: -0.4,
    marginTop: 6,
    marginBottom: 16,
  },
  tabLineContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    gap: 24,
  },
  tabLineItem: {
    paddingBottom: 10,
    position: 'relative',
  },
  tabLineText: {
    fontSize: 15,
  },
  tabLineTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  tabLineTextInactive: {
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  tabActiveIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#F26522',
    borderRadius: 1,
  },
  tripCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tripImageWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#F7F7F7',
    position: 'relative',
  },
  tripImage: {
    width: '100%',
    height: '100%',
  },
  tripImageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysUntilBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(34, 34, 34, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  daysUntilBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  tripCardContent: {
    padding: 16,
    gap: 12,
  },
  tripCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  tripLocationTitle: {
    fontSize: 17,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  tripStayTitle: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgePaid: {
    backgroundColor: '#F0FDF4',
  },
  statusBadgeCancelled: {
    backgroundColor: '#FEF2F2',
  },
  statusBadgeNeutral: {
    backgroundColor: '#F7F7F7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    textTransform: 'capitalize',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  tripCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tripDatesText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  tripGuestsText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  tripAmountText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  writeReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBF8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCE3D6',
  },
  writeReviewBtnText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(242, 101, 34, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyHeadline: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 290,
    marginBottom: 10,
  },
  primaryCtaBtn: {
    height: 48,
    paddingHorizontal: 32,
    borderRadius: 24,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F26522',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  primaryCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  skeletonTripCard: {
    width: '100%',
    height: 220,
    borderRadius: 16,
  },
});
