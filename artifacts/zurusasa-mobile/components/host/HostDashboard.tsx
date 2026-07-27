import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
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
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { supabase, type BookingRow } from '@/lib/supabase';
import { Skeleton } from '@/components/Skeleton';
import { notificationService } from '@/services/notificationService';

interface HostKPIs {
  views: number;
  likes: number;
  saves: number;
  bookings: number;
  followers: number;
  earnings: number;
}

export function HostDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpis, setKpis] = useState<HostKPIs>({
    views: 0,
    likes: 0,
    saves: 0,
    bookings: 0,
    followers: 0,
    earnings: 0,
  });
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [activeTab, setActiveTab] = useState<'requests' | 'upcoming' | 'history'>('requests');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [showEarnings, setShowEarnings] = useState(true);

  const topPad = Platform.OS === 'web' ? 60 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 100 : 90;

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const reelsRes = await supabase
        .from('reels')
        .select('id')
        .eq('user_id', user.id);

      const reelIds = (reelsRes.data ?? []).map((r) => r.id as string);

      let likesCount = 0;
      let savesCount = 0;

      if (reelIds.length > 0) {
        const likesRes = await supabase
          .from('reel_likes')
          .select('*', { count: 'exact', head: true })
          .in('reel_id', reelIds);
        likesCount = likesRes.count ?? 0;

        const savesRes = await supabase
          .from('reel_saves')
          .select('*', { count: 'exact', head: true })
          .in('reel_id', reelIds);
        savesCount = savesRes.count ?? 0;
      }

      const followsRes = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);

      const expRes = await supabase
        .from('experiences')
        .select('id')
        .eq('metadata->>host_id', user.id);

      const expIds = (expRes.data ?? []).map((e) => e.id as string);

      let hostBookings: BookingRow[] = [];
      let totalEarnings = 0;

      if (expIds.length > 0 || reelIds.length > 0) {
        let query = supabase
          .from('bookings')
          .select('*, experience:experiences(id, title, location, current_price, price_unit, image_url)')
          .order('created_at', { ascending: false });

        if (expIds.length > 0) {
          query = query.in('experience_id', expIds);
        }

        const { data: bData } = await query;
        if (bData) {
          hostBookings = (bData as unknown as BookingRow[]) ?? [];
          totalEarnings = hostBookings
            .filter((b) => b.status === 'confirmed' || b.status === 'paid' || b.status === 'completed')
            .reduce((acc, curr) => acc + (curr.amount ?? 0), 0);
        }
      }

      setBookings(hostBookings);
      setKpis({
        views: reelIds.length * 142 + hostBookings.length * 18,
        likes: likesCount,
        saves: savesCount,
        bookings: hostBookings.length,
        followers: followsRes.count ?? 0,
        earnings: totalEarnings,
      });
    } catch (err) {
      console.error('Error loading host dashboard stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    refreshProfile();
    loadData();
  };

  const handleBookingAction = async (id: string, action: 'accept' | 'decline') => {
    setActionLoadingId(id);
    try {
      const newStatus = action === 'accept' ? 'confirmed' : 'cancelled';
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw new Error(error.message);

      // Find booking details to notify guest
      const targetBooking = bookings.find((b) => b.id === id);
      if (targetBooking?.user_id) {
        if (action === 'accept') {
          notificationService.createNotification({
            userId: targetBooking.user_id,
            type: 'booking_confirmed',
            title: 'Booking Confirmed! 🌟',
            message: `Your host has confirmed your stay at ${targetBooking.experience?.title || 'Coastal Stay'}.`,
            actionType: 'booking',
            actionId: id,
          });
        } else {
          notificationService.createNotification({
            userId: targetBooking.user_id,
            type: 'booking_cancelled',
            title: 'Booking Request Update',
            message: `Your booking request for ${targetBooking.experience?.title || 'Coastal Stay'} was cancelled.`,
            actionType: 'booking',
            actionId: id,
          });
        }
      }

      loadData();
    } catch (err: any) {
      console.error('Failed to update booking:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const hasPayout = Boolean(
    (profile?.metadata as { paystack_subaccount_code?: string } | null)?.paystack_subaccount_code,
  );

  const filteredBookings = bookings.filter((b) => {
    if (activeTab === 'requests') return b.status === 'paid' || b.status === 'pending';
    if (activeTab === 'upcoming') return b.status === 'confirmed';
    return b.status === 'completed' || b.status === 'cancelled';
  });

  if (loading) {
    return (
      <View style={[styles.fill, { backgroundColor: '#FFFFFF' }]}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad + 32, paddingHorizontal: 20, gap: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Skeleton */}
          <View style={styles.topHeader}>
            <View style={{ gap: 8 }}>
              <Skeleton style={{ width: 180, height: 28, borderRadius: 8 }} />
              <Skeleton style={{ width: 220, height: 14, borderRadius: 6 }} />
            </View>
          </View>

          {/* Payout Banner Skeleton */}
          <Skeleton style={{ width: '100%', height: 110, borderRadius: 16 }} />

          {/* Earnings Card Skeleton */}
          <View style={[styles.revenueCard, { gap: 14 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton style={{ width: 140, height: 14, borderRadius: 6 }} />
              <Skeleton style={{ width: 24, height: 24, borderRadius: 12 }} />
            </View>
            <Skeleton style={{ width: 210, height: 36, borderRadius: 8 }} />
            <View style={styles.metricGridDivider} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <Skeleton style={{ width: 50, height: 36, borderRadius: 6 }} />
              <Skeleton style={{ width: 50, height: 36, borderRadius: 6 }} />
              <Skeleton style={{ width: 50, height: 36, borderRadius: 6 }} />
              <Skeleton style={{ width: 50, height: 36, borderRadius: 6 }} />
            </View>
          </View>

          {/* Operational Section Skeleton */}
          <Skeleton style={{ width: 180, height: 22, borderRadius: 6 }} />
          <Skeleton style={{ width: '100%', height: 40, borderRadius: 12 }} />
          <View style={{ gap: 12 }}>
            <Skeleton style={{ width: '100%', height: 140, borderRadius: 16 }} />
            <Skeleton style={{ width: '100%', height: 140, borderRadius: 16 }} />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: '#FFFFFF' }]}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad + 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F26522" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header Title & Actions */}
        <View style={styles.topHeader}>
          <View style={styles.headerTextStack}>
            <Text style={styles.headerTitle}>Host Dashboard</Text>
            <Text style={styles.headerSub}>Welcome back! Here's your hosting overview.</Text>
          </View>
        </View>

        {/* 2. Payout Setup Banner (Disappears completely once payment method is configured) */}
        {!hasPayout ? (
          <View style={styles.payoutCardAmber}>
            <View style={styles.payoutHeaderRow}>
              <View style={styles.payoutBadgeAmber}>
                <Feather name="credit-card" size={18} color="#F26522" />
              </View>
              <View style={styles.payoutTextWrap}>
                <Text style={styles.payoutTitleAmber}>Set Up Payouts</Text>
                <Text style={styles.payoutSubAmber}>
                  Connect your bank account or M-Pesa to receive earnings directly.
                </Text>
              </View>
            </View>
            <Pressable
              testID="connect-payout-button"
              onPress={() => {
                router.push('/host/payouts');
              }}
              style={({ pressed }) => [
                styles.connectPayoutBtn,
                { opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Text style={styles.connectPayoutBtnText}>Connect Payout Method</Text>
              <Feather name="arrow-right" size={14} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : null}

        {/* 3. Refined Earnings & Metric Summary Card */}
        <View style={styles.revenueCard}>
          <View style={styles.revenueHeaderRow}>
            <Text style={styles.revenueLabel}>TOTAL HOST EARNINGS</Text>
            <Pressable
              onPress={() => setShowEarnings((prev) => !prev)}
              style={({ pressed }) => [
                styles.eyeToggleBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
              hitSlop={8}
            >
              <Feather
                name={showEarnings ? 'eye' : 'eye-off'}
                size={16}
                color="#717171"
              />
            </Pressable>
          </View>
          <Text style={styles.revenueValue}>
            {showEarnings ? `KES ${kpis.earnings.toLocaleString()}` : 'KES ••••••••'}
          </Text>

          <View style={styles.metricGridDivider} />

          <View style={styles.kpiGrid}>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiVal}>{kpis.views.toLocaleString()}</Text>
              <Text style={styles.kpiLbl}>Views</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiVal}>{kpis.bookings.toLocaleString()}</Text>
              <Text style={styles.kpiLbl}>Bookings</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiVal}>{kpis.likes.toLocaleString()}</Text>
              <Text style={styles.kpiLbl}>Likes</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiVal}>{kpis.followers.toLocaleString()}</Text>
              <Text style={styles.kpiLbl}>Followers</Text>
            </View>
          </View>
        </View>

        {/* 4. Reservation Requests Operational Section */}
        <View style={styles.sectionHeaderWrap}>
          <Text style={styles.sectionTitle}>Reservation Requests</Text>
        </View>

        {/* Segmented Control Track */}
        <View style={styles.segmentedControlTrack}>
          {(['requests', 'upcoming', 'history'] as const).map((t) => {
            const isActive = activeTab === t;
            const count = bookings.filter((b) => b.status === 'paid' || b.status === 'pending').length;
            return (
              <Pressable
                key={t}
                onPress={() => {
                  setActiveTab(t);
                }}
                style={[
                  styles.segmentedTile,
                  isActive ? styles.segmentedTileActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.segmentedTileText,
                    isActive ? styles.segmentedTileTextActive : null,
                  ]}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                  {t === 'requests' && count > 0 ? ` (${count})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Compact Bookings List or Empty State */}
        {filteredBookings.length === 0 ? (
          <View style={styles.compactEmptyCard}>
            <View style={styles.emptyIconCircle}>
              <Feather name="calendar" size={22} color="#717171" />
            </View>
            <Text style={styles.emptyTitle}>No {activeTab} yet</Text>
            <Text style={styles.emptySub}>
              {activeTab === 'requests'
                ? "You don't have any new booking requests to review right now."
                : activeTab === 'upcoming'
                ? 'Confirmed trips will appear here once you accept them.'
                : 'Your past and cancelled bookings will be listed here.'}
            </Text>
          </View>
        ) : (
          <View style={styles.bookingsList}>
            {filteredBookings.map((b) => (
              <View key={b.id} style={styles.bookingCard}>
                <View style={styles.bookingCardHeader}>
                  <View style={styles.guestInfo}>
                    <View style={styles.guestAvatar}>
                      <Feather name="user" size={16} color="#F26522" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.guestName} numberOfLines={1}>
                        {b.experience?.title || 'Coastal Reservation'}
                      </Text>
                      <Text style={styles.bookingDate}>
                        Requested {b.created_at ? new Date(b.created_at).toLocaleDateString() : 'recently'}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          b.status === 'confirmed' || b.status === 'paid'
                            ? 'rgba(242, 101, 34, 0.1)'
                            : b.status === 'cancelled'
                            ? '#FEF2F2'
                            : '#F3F4F6',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color:
                            b.status === 'confirmed' || b.status === 'paid'
                              ? '#F26522'
                              : b.status === 'cancelled'
                              ? '#EF4444'
                              : '#6B7280',
                        },
                      ]}
                    >
                      {b.status === 'paid' ? 'Paid' : b.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.bookingDetailsBox}>
                  <Text style={styles.tripTitle} numberOfLines={1}>
                    {b.experience?.location || 'Kenyan Coast'} · {b.guests ?? 1} guest(s)
                  </Text>
                  <Text style={styles.priceText}>
                    KES {(b.amount ?? 0).toLocaleString()}
                  </Text>
                </View>

                {activeTab === 'requests' ? (
                  <View style={styles.actionRow}>
                    <Pressable
                      disabled={actionLoadingId === b.id}
                      onPress={() => handleBookingAction(b.id, 'decline')}
                      style={({ pressed }) => [
                        styles.declineBtn,
                        { opacity: pressed ? 0.75 : 1 },
                      ]}
                    >
                      <Feather name="x" size={15} color="#EF4444" />
                      <Text style={styles.declineText}>Decline</Text>
                    </Pressable>
                    <Pressable
                      disabled={actionLoadingId === b.id}
                      onPress={() => handleBookingAction(b.id, 'accept')}
                      style={({ pressed }) => [
                        styles.acceptBtn,
                        { opacity: pressed ? 0.88 : 1 },
                      ]}
                    >
                      {actionLoadingId === b.id ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <Feather name="check" size={15} color="#FFFFFF" />
                          <Text style={styles.acceptText}>Accept Request</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: '#717171' },
  
  /* 1. Header */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerTextStack: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    marginTop: 2,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F26522',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#F26522',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
  },

  /* 2. Payout Setup Banners */
  payoutCardAmber: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFF8F5',
    borderWidth: 1,
    borderColor: '#FCE3D6',
    gap: 14,
  },
  payoutCardGreen: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  payoutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  payoutBadgeAmber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(242, 101, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutBadgeGreen: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutTextWrap: {
    flex: 1,
    gap: 2,
  },
  payoutTitleAmber: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  payoutSubAmber: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
    lineHeight: 18,
  },
  payoutTitleGreen: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#15803D',
  },
  payoutSubGreen: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#166534',
    lineHeight: 18,
  },
  connectPayoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F26522',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  connectPayoutBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
  },
  updatePayoutBtn: {
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  updatePayoutBtnText: {
    color: '#15803D',
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
  },

  /* 3. Refined Earnings Summary Card */
  revenueCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  revenueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  revenueLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#717171',
    letterSpacing: 0.6,
  },
  eyeToggleBtn: {
    padding: 4,
  },
  revenueValue: {
    fontSize: 32,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  metricGridDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 16,
  },
  kpiGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  kpiItem: {
    alignItems: 'center',
    flex: 1,
  },
  kpiVal: {
    fontSize: 17,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  kpiLbl: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    marginTop: 2,
  },

  /* 4. Reservation Requests Operational Section */
  sectionHeaderWrap: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  segmentedControlTrack: {
    flexDirection: 'row',
    marginHorizontal: 20,
    padding: 3,
    borderRadius: 12,
    backgroundColor: '#F7F7F7',
    marginBottom: 16,
  },
  segmentedTile: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 9,
  },
  segmentedTileActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentedTileText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  segmentedTileTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },

  /* Bookings & Empty State */
  compactEmptyCard: {
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    gap: 8,
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
    lineHeight: 18,
  },
  bookingsList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  bookingCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    backgroundColor: '#FFFFFF',
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bookingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  guestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  guestAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestName: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  bookingDate: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    textTransform: 'capitalize',
  },
  bookingDetailsBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    gap: 4,
  },
  tripTitle: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#374151',
  },
  priceText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 2,
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  declineText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#EF4444',
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F26522',
  },
  acceptText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
  },
});
