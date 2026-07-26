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
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { supabase, type BookingRow } from '@/lib/supabase';

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

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 10;
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadData();
    } catch (err: any) {
      console.error('Failed to update booking:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
      <View style={[styles.fill, styles.centered, { backgroundColor: '#FAFAFA' }]}>
        <ActivityIndicator size="large" color="#EE7D30" />
        <Text style={styles.loadingText}>
          Loading Host Dashboard…
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: '#FAFAFA' }]}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad + 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#EE7D30" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header Title & Actions */}
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.headerTitle}>Host Dashboard</Text>
            <Text style={styles.headerSub}>
              Welcome back! Here's your hosting overview.
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <Pressable
              testID="create-listing-button"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/host/create-reel');
              }}
              style={({ pressed }) => [
                styles.createBtn,
                { opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Feather name="plus" size={16} color="#ffffff" />
              <Text style={styles.createBtnText}>New Reel</Text>
            </Pressable>
          </View>
        </View>

        {/* Payout Banner */}
        {!hasPayout ? (
          <View style={styles.payoutAmberBanner}>
            <View style={styles.payoutBannerLeft}>
              <Text style={styles.payoutAmberTitle}>Set Up Payouts</Text>
              <Text style={styles.payoutAmberSub}>
                Connect your bank account or M-Pesa to receive earnings directly.
              </Text>
            </View>
            <Pressable
              testID="connect-payout-button"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/host/payouts');
              }}
              style={styles.connectPayoutBtn}
            >
              <Text style={styles.connectPayoutBtnText}>Connect Payout Method</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.payoutGreenBanner}>
            <View style={styles.payoutBannerLeft}>
              <Text style={styles.payoutGreenTitle}>✓ Payouts Active</Text>
              <Text style={styles.payoutGreenSub}>
                Settlement account connected. Earnings automatically split via Zuru Escrow.
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/host/payouts')}
              style={styles.updatePayoutBtn}
            >
              <Text style={styles.updatePayoutBtnText}>Settings</Text>
            </Pressable>
          </View>
        )}

        {/* Hero Revenue Card */}
        <LinearGradient
          colors={['#EE7D3016', '#EE7D3008']}
          style={styles.revenueCard}
        >
          <Text style={styles.revenueLabel}>
            Total Host Earnings
          </Text>
          <Text style={styles.revenueValue}>
            KES {kpis.earnings.toLocaleString()}
          </Text>

          <View style={styles.kpiGrid}>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiVal}>{kpis.views}</Text>
              <Text style={styles.kpiLbl}>Views</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiVal}>{kpis.bookings}</Text>
              <Text style={styles.kpiLbl}>Bookings</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiVal}>{kpis.likes}</Text>
              <Text style={styles.kpiLbl}>Likes</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiVal}>{kpis.followers}</Text>
              <Text style={styles.kpiLbl}>Followers</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Reservations & Requests Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Reservation Requests
          </Text>
        </View>

        {/* Tab Filter Pills */}
        <View style={styles.tabsRow}>
          {(['requests', 'upcoming', 'history'] as const).map((t) => {
            const isActive = activeTab === t;
            const count = bookings.filter((b) => b.status === 'paid' || b.status === 'pending').length;
            return (
              <Pressable
                key={t}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveTab(t);
                }}
                style={[
                  styles.tabPill,
                  { backgroundColor: isActive ? '#FFFFFF' : 'transparent' },
                ]}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    { color: isActive ? '#111827' : '#6B7280' },
                  ]}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                  {t === 'requests' && count > 0 ? ` (${count})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="calendar" size={32} color="#9CA3AF" />
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
                      <Feather name="user" size={18} color="#EE7D30" />
                    </View>
                    <View>
                      <Text style={styles.guestName}>
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
                            ? '#EE7D3018'
                            : b.status === 'cancelled'
                            ? '#EF444418'
                            : '#6B728018',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color:
                            b.status === 'confirmed' || b.status === 'paid'
                              ? '#EE7D30'
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

                <View style={styles.bookingDetails}>
                  <Text style={styles.tripTitle} numberOfLines={1}>
                    {b.experience?.location || 'Coastal Experience'} · {b.guests ?? 1} guest(s)
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
                        { opacity: pressed ? 0.8 : 1 },
                      ]}
                    >
                      <Feather name="x" size={16} color="#EF4444" />
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
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <>
                          <Feather name="check" size={16} color="#ffffff" />
                          <Text style={styles.acceptText}>Accept</Text>
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
  loadingText: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: '#6B7280' },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  headerSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  headerButtons: { flexDirection: 'row', gap: 8 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EE7D30',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  createBtnText: { color: '#ffffff', fontSize: 13, fontFamily: 'DMSans_600SemiBold' },
  payoutAmberBanner: {
    marginHorizontal: 20,
    marginBottom: 18,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  payoutGreenBanner: {
    marginHorizontal: 20,
    marginBottom: 18,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  payoutBannerLeft: { flex: 1, marginBottom: 10 },
  payoutAmberTitle: { color: '#C2410C', fontSize: 15, fontFamily: 'DMSans_700Bold' },
  payoutAmberSub: { color: '#7C2D12', fontSize: 13, fontFamily: 'DMSans_400Regular', marginTop: 4, lineHeight: 18 },
  payoutGreenTitle: { color: '#15803D', fontSize: 15, fontFamily: 'DMSans_700Bold' },
  payoutGreenSub: { color: '#166534', fontSize: 13, fontFamily: 'DMSans_400Regular', marginTop: 4, lineHeight: 18 },
  connectPayoutBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  connectPayoutBtnText: { color: '#ffffff', fontSize: 13, fontFamily: 'DMSans_600SemiBold' },
  updatePayoutBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  updatePayoutBtnText: { color: '#ffffff', fontSize: 12, fontFamily: 'DMSans_600SemiBold' },
  revenueCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 22,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EE7D3025',
  },
  revenueLabel: { fontSize: 13, fontFamily: 'DMSans_500Medium', color: '#6B7280' },
  revenueValue: { fontSize: 32, fontFamily: 'DMSans_700Bold', color: '#111827', marginTop: 4 },
  kpiGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  kpiItem: { alignItems: 'center' },
  kpiVal: { fontSize: 18, fontFamily: 'DMSans_700Bold', color: '#111827' },
  kpiLbl: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: '#6B7280', marginTop: 2 },
  sectionHeader: { paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontFamily: 'DMSans_700Bold', color: '#111827' },
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabPillText: { fontSize: 13, fontFamily: 'DMSans_600SemiBold' },
  emptyCard: {
    marginHorizontal: 20,
    padding: 32,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontFamily: 'DMSans_600SemiBold', color: '#111827' },
  emptySub: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: '#6B7280', textAlign: 'center' },
  bookingsList: { paddingHorizontal: 20, gap: 14 },
  bookingCard: { padding: 18, borderRadius: 22, borderWidth: 1, borderColor: '#F3F4F6', backgroundColor: '#FFFFFF', gap: 14, shadowColor: '#000000', shadowOpacity: 0.03, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  bookingCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  guestInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  guestAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  guestName: { fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: '#111827' },
  bookingDate: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#6B7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: 'DMSans_700Bold', textTransform: 'capitalize' },
  bookingDetails: { padding: 14, borderRadius: 14, backgroundColor: '#F9FAFB', gap: 4 },
  tripTitle: { fontSize: 13, fontFamily: 'DMSans_500Medium', color: '#374151' },
  priceText: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: '#EE7D30' },
  actionRow: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  declineText: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#EF4444' },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EE7D30',
  },
  acceptText: { color: '#ffffff', fontSize: 13, fontFamily: 'DMSans_600SemiBold' },
});
