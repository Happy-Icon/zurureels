import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { useMyBookings } from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';
import { useColors } from '@/hooks/useColors';
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
    d.getFullYear() === new Date().getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year}`;
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

export default function ReservationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');
  const { data: bookings, isLoading } = useMyBookings(user?.id);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 110 : 100;

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

  if (!loading && !user) {
    return (
      <View
        style={[
          styles.fill,
          styles.centered,
          { backgroundColor: colors.background, paddingTop: topPad },
        ]}
      >
        <View style={[styles.heroIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="calendar" size={30} color={colors.primary} />
        </View>
        <Text style={[styles.heroTitle, { color: colors.foreground }]}>
          Your trips live here
        </Text>
        <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
          Sign in to see upcoming reservations and booking history.
        </Text>
        <Pressable
          testID="reservations-signin"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/auth');
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.primaryButtonText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  const statusStyle = (status: string | null) => {
    if (status === 'confirmed' || status === 'paid') {
      return { bg: '#2e7d3220', fg: '#2e7d32' };
    }
    if (status === 'cancelled') {
      return { bg: `${colors.destructive}20`, fg: colors.destructive };
    }
    return { bg: colors.secondary, fg: colors.secondaryForeground };
  };

  const renderBooking = ({ item }: { item: BookingRow }) => {
    const st = statusStyle(item.status);
    const range = dateRange(item);
    const chip = tab === 'upcoming' ? daysUntil(item.check_in) : null;
    return (
      <View
        testID={`booking-${item.id}`}
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        {item.experience?.image_url ? (
          <Image
            source={{ uri: item.experience.image_url }}
            style={[styles.cardImage, { backgroundColor: colors.muted }]}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[styles.cardImage, styles.cardImageFallback, { backgroundColor: colors.secondary }]}
          >
            <Feather name="map" size={20} color={colors.primary} />
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text
            style={[styles.cardTitle, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {item.experience?.title ?? 'Experience'}
          </Text>
          {item.experience?.location ? (
            <View style={styles.locRow}>
              <Feather name="map-pin" size={11} color={colors.mutedForeground} />
              <Text
                style={[styles.cardLoc, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {item.experience.location}
              </Text>
            </View>
          ) : null}
          {range ? (
            <Text style={[styles.cardDates, { color: colors.mutedForeground }]}>
              {range}
              {item.guests ? `  ·  ${item.guests} guest${item.guests === 1 ? '' : 's'}` : ''}
            </Text>
          ) : item.guests ? (
            <Text style={[styles.cardDates, { color: colors.mutedForeground }]}>
              {item.guests} guest{item.guests === 1 ? '' : 's'}
            </Text>
          ) : null}
          {item.amount != null ? (
            <Text style={[styles.cardAmount, { color: colors.primary }]}>
              KES {Number(item.amount).toLocaleString()}
            </Text>
          ) : null}
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.fg }]}>
              {item.status ?? 'pending'}
            </Text>
          </View>
          {chip ? (
            <Text style={[styles.daysChip, { color: colors.primary }]}>
              {chip}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  const data = tab === 'upcoming' ? upcoming : history;

  return (
    <View
      testID="reservations-screen"
      style={[styles.fill, { backgroundColor: colors.background }]}
    >
      <FlatList
        data={data}
        keyExtractor={(b) => b.id}
        renderItem={renderBooking}
        contentContainerStyle={{
          paddingTop: topPad + 8,
          paddingBottom: bottomPad,
          paddingHorizontal: 16,
          gap: 10,
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Reservations
            </Text>
            <View style={[styles.pillRow, { backgroundColor: colors.muted }]}>
              {(['upcoming', 'history'] as const).map((key) => (
                <Pressable
                  key={key}
                  testID={`reservations-tab-${key}`}
                  onPress={() => setTab(key)}
                  style={[
                    styles.pill,
                    tab === key && { backgroundColor: colors.background },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      {
                        color:
                          tab === key
                            ? colors.foreground
                            : colors.mutedForeground,
                      },
                    ]}
                  >
                    {key === 'upcoming' ? 'Upcoming' : 'History'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 10 }}>
              <Skeleton style={styles.skeletonCard} />
              <Skeleton style={styles.skeletonCard} />
              <Skeleton style={styles.skeletonCard} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Feather
                name="calendar"
                size={40}
                color={colors.mutedForeground}
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {tab === 'upcoming' ? 'No upcoming trips' : 'No past trips'}
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                {tab === 'upcoming'
                  ? 'When you book an experience, it will show up here.'
                  : 'Completed and cancelled trips will show up here.'}
              </Text>
              <Pressable
                onPress={() => router.push('/discover')}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={styles.primaryButtonText}>Start Exploring</Text>
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 26,
    fontFamily: 'InstrumentSerif_400Regular',
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
  primaryButton: {
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  header: { marginBottom: 14, gap: 10 },
  title: {
    fontSize: 30,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  pillRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: 10,
    padding: 3,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 8,
  },
  pillText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 12,
  },
  cardImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  cardImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, gap: 3 },
  cardTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardLoc: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    flexShrink: 1,
  },
  cardDates: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
  },
  cardAmount: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'DMSans_500Medium',
    textTransform: 'capitalize',
  },
  daysChip: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
  },
  skeletonCard: {
    height: 88,
    borderRadius: 12,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
});
