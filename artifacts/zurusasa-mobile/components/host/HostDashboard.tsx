import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { supabase, type BookingRow } from '@/lib/supabase';
import { Skeleton } from '@/components/Skeleton';
import { useHostConfirmBooking, useHostDeclineBooking } from '@/lib/queries';

interface HostKPIs {
  views: number;
  likes: number;
  saves: number;
  bookings: number;
  followers: number;
  earnings: number;
}

interface ActivityItem {
  id: string;
  time: string;
  text: string;
  type: 'booking' | 'accept' | 'decline' | 'payment' | 'sms';
}

const DECLINE_REASONS = [
  'Property unavailable',
  'Maintenance & repairs',
  'Double booking conflict',
  'Other reasons',
];

export function HostDashboard() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height: winHeight } = useWindowDimensions();
  const { user, profile, refreshProfile } = useAuth();
  const { showAlert } = useCustomAlert();

  const confirmBookingMutation = useHostConfirmBooking();
  const declineBookingMutation = useHostDeclineBooking();

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
  const [showEarnings, setShowEarnings] = useState(true);

  // Expansion & Workflow Modal States
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [acceptModalBooking, setAcceptModalBooking] = useState<BookingRow | null>(null);
  const [declineModalBooking, setDeclineModalBooking] = useState<BookingRow | null>(null);
  const [selectedDeclineReason, setSelectedDeclineReason] = useState<string>(DECLINE_REASONS[0]);
  const [processingAction, setProcessingAction] = useState(false);

  // Live Activity Timeline Feed
  const [activities, setActivities] = useState<ActivityItem[]>([
    { id: '1', time: '09:45 AM', text: 'Guest inquiry for Diani Villa Stay', type: 'booking' },
    { id: '2', time: '09:46 AM', text: 'KES 15,000 Payment secured in escrow', type: 'payment' },
    { id: '3', time: '09:47 AM', text: 'Reservation accepted & SMS dispatched', type: 'sms' },
  ]);

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

      // 1. Fetch host experience IDs (both user_id and metadata->host_id)
      const expRes = await supabase
        .from('experiences')
        .select('id')
        .or(`user_id.eq.${user.id},metadata->>host_id.eq.${user.id}`);

      const expIds = (expRes.data ?? []).map((e) => e.id as string);

      // 2. Fetch quotes assigned to this host
      const quotesRes = await supabase
        .from('booking_quotes')
        .select('id, experience_id')
        .eq('host_id', user.id);

      const quoteIds = (quotesRes.data ?? []).map((q) => q.id as string);
      const quoteExpIds = (quotesRes.data ?? []).map((q) => q.experience_id as string).filter(Boolean);
      const allExpIds = Array.from(new Set([...expIds, ...quoteExpIds]));

      let hostBookings: BookingRow[] = [];
      let totalEarnings = 0;

      if (allExpIds.length > 0 || quoteIds.length > 0) {
        let query = supabase
          .from('bookings')
          .select('*, experience:experiences(id, title, location, current_price, price_unit, image_url)')
          .order('created_at', { ascending: false });

        if (allExpIds.length > 0 && quoteIds.length > 0) {
          query = query.or(`experience_id.in.(${allExpIds.join(',')}),quote_id.in.(${quoteIds.join(',')})`);
        } else if (allExpIds.length > 0) {
          query = query.in('experience_id', allExpIds);
        } else if (quoteIds.length > 0) {
          query = query.in('quote_id', quoteIds);
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

  // ── Accept Reservation Workflow Execution ──────────────────────────────────
  const executeAccept = async () => {
    if (!acceptModalBooking) return;
    const b = acceptModalBooking;
    setProcessingAction(true);

    try {
      // 1. Confirm booking via standardized hook (handles RPC + notification dispatch)
      await confirmBookingMutation.mutateAsync(b.id);

      const titleStr = b.experience?.title || b.trip_title || 'Stay';
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // 2. Update Live Activity Timeline
      const newItems: ActivityItem[] = [
        { id: Date.now() + '-1', time: nowStr, text: `Accepted reservation for ${titleStr}`, type: 'accept' },
      ];
      setActivities((prev) => [...newItems, ...prev].slice(0, 8));

      setAcceptModalBooking(null);
      showAlert({
        title: 'Reservation Confirmed! 🎉',
        message: 'Booking has been moved to Upcoming. Multi-channel confirmation sent.',
        icon: 'check-circle',
      });
      loadData();
    } catch (err: any) {
      console.error('Accept reservation error:', err);
      showAlert({
        title: 'Action Failed',
        message: err?.message || 'Failed to accept reservation.',
        icon: 'alert-circle',
      });
    } finally {
      setProcessingAction(false);
    }
  };

  // ── Decline Reservation Workflow Execution ─────────────────────────────────
  const executeDecline = async () => {
    if (!declineModalBooking) return;
    const b = declineModalBooking;
    setProcessingAction(true);

    try {
      // 1. Decline booking via standardized hook (handles RPC + notification dispatch)
      await declineBookingMutation.mutateAsync({
        bookingId: b.id,
        reason: selectedDeclineReason,
      });

      const titleStr = b.experience?.title || b.trip_title || 'Stay';
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const declineItems: ActivityItem[] = [
        { id: Date.now() + '-1', time: nowStr, text: `Declined booking for ${titleStr} (${selectedDeclineReason})`, type: 'decline' },
      ];
      setActivities((prev) => [...declineItems, ...prev].slice(0, 8));

      setDeclineModalBooking(null);
      showAlert({
        title: 'Reservation Declined',
        message: 'Booking has been moved to Cancelled History. Guest notified.',
        icon: 'info',
      });
      loadData();
    } catch (err: any) {
      console.error('Decline reservation error:', err);
      showAlert({
        title: 'Action Failed',
        message: err?.message || 'Failed to decline reservation.',
        icon: 'alert-circle',
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const hasPayout = Boolean(
    (profile?.metadata as { paystack_subaccount_code?: string } | null)?.paystack_subaccount_code,
  );

  const filteredBookings = bookings.filter((b) => {
    if (activeTab === 'requests') return b.status === 'paid' || b.status === 'pending';
    if (activeTab === 'upcoming') return b.status === 'confirmed';
    return b.status === 'completed' || b.status === 'cancelled' || b.status === 'refund_pending' || b.status === 'refunded';
  });

  const getStatusStyle = (status?: string | null) => {
    const st = (status || 'pending').toLowerCase();
    switch (st) {
      case 'confirmed':
        return { bg: '#F0FDF4', border: '#DCFCE7', text: '#16A34A', label: 'Confirmed' };
      case 'paid':
        return { bg: '#EFF6FF', border: '#BFDBFE', text: '#2563EB', label: 'Paid — Awaiting Confirmation' };
      case 'completed':
        return { bg: '#F0F9FF', border: '#BAE6FD', text: '#0284C7', label: 'Completed' };
      case 'refund_pending':
        return { bg: '#FFFBEB', border: '#FDE68A', text: '#D97706', label: 'Refund Pending' };
      case 'refunded':
        return { bg: '#F5F3FF', border: '#DDD6FE', text: '#7C3AED', label: 'Refunded' };
      case 'cancelled':
        return { bg: '#FEF2F2', border: '#FEE2E2', text: '#EF4444', label: 'Cancelled' };
      case 'pending':
      default:
        return { bg: '#FFF7ED', border: '#FFEDD5', text: '#EA580C', label: 'Pending Request' };
    }
  };

  if (loading) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad + 32, paddingHorizontal: 20, gap: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topHeader}>
            <View style={{ gap: 8 }}>
              <Skeleton style={{ width: 180, height: 28, borderRadius: 8 }} />
              <Skeleton style={{ width: 220, height: 14, borderRadius: 6 }} />
            </View>
          </View>
          <Skeleton style={{ width: '100%', height: 110, borderRadius: 16 }} />
          <Skeleton style={{ width: '100%', height: 160, borderRadius: 20 }} />
          <Skeleton style={{ width: '100%', height: 40, borderRadius: 12 }} />
          <Skeleton style={{ width: '100%', height: 180, borderRadius: 16 }} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad + 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F26522" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header Title */}
        <View style={styles.topHeader}>
          <View style={styles.headerTextStack}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Host Dashboard</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Hospitality overview & reservation manager.</Text>
          </View>
        </View>

        {/* 3. Payout Setup Banner */}
        {!hasPayout ? (
          <View style={[styles.payoutCardAmber, { backgroundColor: isDark ? '#2A1810' : '#FFF8F5', borderColor: isDark ? '#5C2D16' : '#FFEDD5' }]}>
            <View style={styles.payoutHeaderRow}>
              <View style={styles.payoutBadgeAmber}>
                <Feather name="credit-card" size={18} color="#F26522" />
              </View>
              <View style={styles.payoutTextWrap}>
                <Text style={[styles.payoutTitleAmber, { color: colors.text }]}>Set Up Payout Method</Text>
                <Text style={[styles.payoutSubAmber, { color: colors.mutedForeground }]}>
                  Connect your M-Pesa business line or bank account to receive guest earnings.
                </Text>
              </View>
            </View>
            <Pressable
              testID="connect-payout-button"
              onPress={() => router.push('/host/payouts')}
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

        {/* 4. Refined Earnings & Metric Summary Card */}
        {/* 4. Refined Host Wallet Fintech Card */}
        <Pressable
          onPress={() => router.push('/host/wallet')}
          style={({ pressed }) => [styles.fintechWalletCard, { opacity: pressed ? 0.95 : 1 }]}
        >
          {/* Card Top Header */}
          <View style={styles.walletHeaderRow}>
            <View style={styles.walletTitleGroup}>
              <View style={styles.walletIconCircle}>
                <MaterialCommunityIcons name="wallet" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.walletCardTitle}>Host Wallet</Text>
            </View>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                setShowEarnings((prev) => !prev);
              }}
              style={({ pressed }) => [styles.eyeToggleBtn, { opacity: pressed ? 0.6 : 1 }]}
              hitSlop={8}
            >
              <Feather name={showEarnings ? 'eye' : 'eye-off'} size={16} color="#94A3B8" />
            </Pressable>
          </View>

          {/* Available Balance Hero */}
          <View style={styles.availableSection}>
            <Text style={styles.availableLabel}>AVAILABLE BALANCE</Text>
            <Text style={styles.availableAmount}>
              {showEarnings ? `KES ${Math.round(kpis.earnings * 0.85).toLocaleString()}` : 'KES ••••••••'}
            </Text>
            <Text style={styles.availableSub}>Ready for payout</Text>
          </View>

          {/* Summary Chips Row */}
          <View style={styles.chipsRow}>
            <View style={styles.summaryPill}>
              <Text style={styles.pillLabel}>Pending Release</Text>
              <Text style={styles.pillValue}>
                {showEarnings ? `KES ${Math.round(kpis.earnings * 0.15).toLocaleString()}` : 'KES •••••'}
              </Text>
            </View>
            <View style={styles.summaryPill}>
              <Text style={styles.pillLabel}>Lifetime Earnings</Text>
              <Text style={styles.pillValue}>
                {showEarnings ? `KES ${kpis.earnings.toLocaleString()}` : 'KES •••••'}
              </Text>
            </View>
          </View>

          {/* Bottom Upcoming Payout Link Row */}
          <View style={styles.upcomingRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="clock" size={13} color="#CBD5E1" />
              <Text style={styles.upcomingText}>Upcoming Payout</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.upcomingTime}>Tomorrow</Text>
              <Feather name="chevron-right" size={16} color="#94A3B8" />
            </View>
          </View>
        </Pressable>

        {/* 5. Reservation Requests Summary Widget */}
        <View style={styles.sectionHeaderWrap}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Reservations & Requests</Text>
        </View>

        <Pressable
          testID="dashboard-requests-card"
          onPress={() => router.push('/(tabs)/reservations')}
          style={({ pressed }) => [
            styles.requestsSummaryCard,
            { backgroundColor: colors.card, borderColor: colors.border },
            bookings.filter((b) => b.status === 'paid' || b.status === 'pending').length > 0
              ? [styles.requestsSummaryCardAlert, isDark && { backgroundColor: '#2A1810', borderColor: '#5C2D16' }]
              : styles.requestsSummaryCardClean,
            { opacity: pressed ? 0.95 : 1 },
          ]}
        >
          <View style={styles.requestsSummaryTopRow}>
            <View
              style={[
                styles.requestsIconCircle,
                {
                  backgroundColor:
                    bookings.filter((b) => b.status === 'paid' || b.status === 'pending').length > 0
                      ? isDark ? '#3D2010' : '#FFF7ED'
                      : isDark ? '#064E3B30' : '#F0FDF4',
                },
              ]}
            >
              <Feather
                name={
                  bookings.filter((b) => b.status === 'paid' || b.status === 'pending').length > 0
                    ? 'bell'
                    : 'check-circle'
                }
                size={22}
                color={
                  bookings.filter((b) => b.status === 'paid' || b.status === 'pending').length > 0
                    ? '#F26522'
                    : '#16A34A'
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.requestsSummaryTitle, { color: colors.text }]}>
                {bookings.filter((b) => b.status === 'paid' || b.status === 'pending').length > 0
                  ? `You have ${
                      bookings.filter((b) => b.status === 'paid' || b.status === 'pending').length
                    } pending reservation request${
                      bookings.filter((b) => b.status === 'paid' || b.status === 'pending').length > 1
                        ? 's'
                        : ''
                    }`
                  : 'All reservations up to date'}
              </Text>
              <Text style={[styles.requestsSummarySub, { color: colors.mutedForeground }]}>
                {bookings.filter((b) => b.status === 'paid' || b.status === 'pending').length > 0
                  ? 'Awaiting your acceptance to lock dates and confirm.'
                  : 'No pending guest requests. All bookings confirmed.'}
              </Text>
            </View>
            <View style={[styles.viewRequestsPill, isDark && { backgroundColor: '#3D2010' }]}>
              <Text style={styles.viewRequestsPillText}>View</Text>
              <Feather name="arrow-right" size={14} color="#F26522" />
            </View>
          </View>

          {/* Quick Metrics Breakdown Row */}
          <View style={[styles.requestsMetricsRow, { borderTopColor: colors.border }]}>
            <View style={styles.requestsMetricItem}>
              <Text style={[styles.requestsMetricVal, { color: colors.text }]}>
                {bookings.filter((b) => b.status === 'paid' || b.status === 'pending').length}
              </Text>
              <Text style={[styles.requestsMetricLbl, { color: colors.mutedForeground }]}>Pending</Text>
            </View>
            <View style={[styles.requestsMetricDivider, { backgroundColor: colors.border }]} />
            <View style={styles.requestsMetricItem}>
              <Text style={[styles.requestsMetricVal, { color: colors.text }]}>
                {bookings.filter((b) => b.status === 'confirmed').length}
              </Text>
              <Text style={[styles.requestsMetricLbl, { color: colors.mutedForeground }]}>Upcoming</Text>
            </View>
            <View style={[styles.requestsMetricDivider, { backgroundColor: colors.border }]} />
            <View style={styles.requestsMetricItem}>
              <Text style={[styles.requestsMetricVal, { color: colors.text }]}>
                {
                  bookings.filter(
                    (b) =>
                      b.status === 'completed' ||
                      b.status === 'cancelled' ||
                      b.status === 'refunded' ||
                      b.status === 'refund_pending'
                  ).length
                }
              </Text>
              <Text style={[styles.requestsMetricLbl, { color: colors.mutedForeground }]}>History</Text>
            </View>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerTextStack: { flex: 1, paddingRight: 12 },
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
  createBtnText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'DMSans_600SemiBold' },

  /* Live Activity Timeline */
  timelineCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#F3E8FF',
    gap: 10,
  },
  timelineHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timelineBadgeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(242, 101, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineTitle: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: '#222222' },
  timelineList: { gap: 6 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timelineTime: { fontSize: 11, fontFamily: 'DMSans_500Medium', color: '#717171', width: 62 },
  timelineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F26522' },
  timelineText: { flex: 1, fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#222222' },

  /* Payout Setup */
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
  payoutHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  payoutBadgeAmber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(242, 101, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutTextWrap: { flex: 1, gap: 2 },
  payoutTitleAmber: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: '#222222' },
  payoutSubAmber: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: '#666666', lineHeight: 18 },
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
  connectPayoutBtnText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'DMSans_600SemiBold' },

  /* Host Wallet Fintech Card */
  fintechWalletCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 22,
    borderRadius: 24,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  walletHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  walletTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  walletIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletCardTitle: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: '#FFFFFF' },
  eyeToggleBtn: { padding: 4 },
  availableSection: { gap: 2 },
  availableLabel: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: '#94A3B8', letterSpacing: 0.8 },
  availableAmount: { fontSize: 32, fontFamily: 'DMSans_700Bold', color: '#FFFFFF' },
  availableSub: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#94A3B8' },
  chipsRow: { flexDirection: 'row', gap: 10 },
  summaryPill: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 2,
  },
  pillLabel: { fontSize: 10, fontFamily: 'DMSans_500Medium', color: '#94A3B8' },
  pillValue: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: '#FFFFFF' },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  upcomingText: { fontSize: 12, fontFamily: 'DMSans_500Medium', color: '#CBD5E1' },
  upcomingTime: { fontSize: 12, fontFamily: 'DMSans_700Bold', color: '#F26522' },

  /* Operational Section */
  sectionHeaderWrap: { paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontFamily: 'DMSans_700Bold', color: '#222222' },
  segmentedControlTrack: {
    flexDirection: 'row',
    marginHorizontal: 20,
    padding: 3,
    borderRadius: 12,
    backgroundColor: '#F7F7F7',
    marginBottom: 16,
  },
  segmentedTile: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9 },
  segmentedTileActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentedTileText: { fontSize: 13, fontFamily: 'DMSans_500Medium', color: '#717171' },
  segmentedTileTextActive: { fontFamily: 'DMSans_700Bold', color: '#222222' },

  /* Empty State */
  compactEmptyCard: {
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    alignItems: 'center',
    gap: 10,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: '#222222' },
  emptySub: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: '#6B7280', textAlign: 'center', lineHeight: 18 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F26522',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 4,
  },
  emptyBtnText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'DMSans_700Bold' },

  /* Bookings Cards */
  bookingsList: { paddingHorizontal: 20, gap: 14 },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    gap: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardMainTouch: { gap: 12 },
  bookingCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  guestInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 },
  guestAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestName: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: '#222222' },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  verifiedTagText: { fontSize: 10, fontFamily: 'DMSans_700Bold', color: '#059669' },
  bookingDate: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#717171', marginTop: 1 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontFamily: 'DMSans_700Bold' },

  /* Booking Details Grid */
  bookingDetailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 8,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailTitle: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: '#0F172A', flex: 1 },
  detailSub: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#64748B' },
  detailMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  detailMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailMetaText: { fontSize: 12, fontFamily: 'DMSans_500Medium', color: '#334155' },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  priceLabel: { fontSize: 12, fontFamily: 'DMSans_500Medium', color: '#64748B' },
  priceValue: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: '#0F172A' },

  /* Expanded Drawer */
  expandedDrawer: {
    gap: 12,
    paddingTop: 4,
  },
  drawerDivider: { height: 1, backgroundColor: '#F1F5F9' },
  drawerHeader: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: '#0F172A' },
  drawerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  drawerItem: { width: '47%', gap: 2 },
  drawerLabel: { fontSize: 11, fontFamily: 'DMSans_500Medium', color: '#64748B' },
  drawerVal: { fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: '#0F172A' },
  drawerActionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  drawerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 8,
  },
  drawerBtnText: { fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: '#0F172A' },

  /* Action Row Buttons */
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  msgBtnText: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#0F172A' },
  declineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  declineText: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#EF4444' },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F26522',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  acceptText: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: '#FFFFFF' },

  /* Modals & Sheets */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  backdropTouch: { flex: 1 },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 20,
    gap: 16,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetHeaderBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { fontSize: 18, fontFamily: 'DMSans_700Bold', color: '#0F172A' },
  sheetSub: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#64748B', marginTop: 2 },
  sheetBreakdownCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLabel: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: '#64748B' },
  breakdownVal: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: '#0F172A' },
  breakdownValBold: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: '#0F172A' },
  sheetDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  payoutHighlightLabel: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: '#16A34A' },
  payoutHighlightVal: { fontSize: 18, fontFamily: 'DMSans_700Bold', color: '#16A34A' },
  sheetActionRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  sheetCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelBtnText: { fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: '#334155' },
  sheetConfirmAcceptBtn: {
    flex: 1.6,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetConfirmDeclineBtn: {
    flex: 1.6,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetConfirmAcceptBtnText: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: '#FFFFFF' },

  /* Decline Reasons List */
  reasonsList: { gap: 10 },
  reasonTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reasonTileSelected: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: { borderColor: '#EF4444' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
  reasonTileText: { fontSize: 14, fontFamily: 'DMSans_500Medium', color: '#334155' },
  reasonTileTextSelected: { fontFamily: 'DMSans_700Bold', color: '#991B1B' },

  /* Reservation Requests Summary Widget */
  requestsSummaryCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    gap: 16,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  requestsSummaryCardAlert: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FED7AA',
  },
  requestsSummaryCardClean: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  requestsSummaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  requestsIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestsSummaryTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#0F172A',
  },
  requestsSummarySub: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#64748B',
    marginTop: 2,
  },
  viewRequestsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  viewRequestsPillText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  requestsMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  requestsMetricItem: {
    alignItems: 'center',
    flex: 1,
  },
  requestsMetricVal: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#0F172A',
  },
  requestsMetricLbl: {
    fontSize: 11,
    fontFamily: 'DMSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  requestsMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
});
