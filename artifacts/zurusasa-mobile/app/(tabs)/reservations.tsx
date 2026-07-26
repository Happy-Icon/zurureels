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
import * as Haptics from 'expo-haptics';
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
            testID="reservations-back-btn"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
            <Feather name="briefcase" size={30} color="#222222" />
          </View>

          <Text style={styles.emptyHeadline}>Log in to view trips</Text>
          <Text style={styles.emptyBody}>
            Once you log in, you'll find your active reservations, check-in guides, and past trips here.
          </Text>

          <Pressable
            testID="reservations-signin"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
          testID="reservations-back-btn"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                    ? { color: '#047857' }
                    : isCancelled
                    ? { color: '#EF4444' }
                    : { color: '#4B5563' },
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
          gap: 20,
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
                <MaterialCommunityIcons name="bag-suitcase-outline" size={30} color="#222222" />
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
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/discover');
                }}
                style={({ pressed }) => [
                  styles.primaryCtaBtn,
                  { opacity: pressed ? 0.85 : 1 },
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
    paddingTop: 12,
    paddingBottom: 8,
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
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 32,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    letterSpacing: -0.5,
    marginTop: 8,
    marginBottom: 16,
  },
  tabLineContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    gap: 24,
  },
  tabLineItem: {
    paddingBottom: 12,
    position: 'relative',
  },
  tabLineText: {
    fontSize: 16,
  },
  tabLineTextActive: {
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  tabLineTextInactive: {
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  tabActiveIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#222222',
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
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
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
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  tripStayTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgePaid: {
    backgroundColor: '#10B98118',
  },
  statusBadgeCancelled: {
    backgroundColor: '#EF444418',
  },
  statusBadgeNeutral: {
    backgroundColor: '#F3F4F6',
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    textTransform: 'capitalize',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
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
    color: '#EE7D30',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyHeadline: {
    fontSize: 22,
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
    maxWidth: 280,
    marginBottom: 8,
  },
  primaryCtaBtn: {
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
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
