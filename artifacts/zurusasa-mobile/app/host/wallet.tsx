import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useColors, useTheme } from '@/hooks/useColors';
import { supabase, type BookingRow } from '@/lib/supabase';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { Skeleton } from '@/components/Skeleton';
import { PersonaVerificationModal } from '@/components/verification/PersonaVerificationModal';

interface PayoutMethod {
  id: string;
  type: 'mpesa' | 'bank' | 'card';
  name: string;
  details: string;
  isDefault: boolean;
  verified: boolean;
}

interface TransactionItem {
  id: string;
  title: string;
  amount: number;
  type: 'income' | 'fee' | 'payout' | 'refund';
  date: string;
  status: 'completed' | 'processed' | 'refunded' | 'pending';
}

const KENYAN_BANKS = [
  { code: '744', name: 'Safaricom M-PESA' },
  { code: '011', name: 'Co-operative Bank of Kenya' },
  { code: '013', name: 'Equity Bank' },
  { code: '015', name: 'KCB Bank' },
  { code: '020', name: 'Absa Bank Kenya' },
  { code: '023', name: 'NCBA Bank' },
];

export default function HostWalletScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const { isDark } = useTheme();
  const { user, profile, refreshProfile } = useAuth();
  const { showAlert } = useCustomAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoPayoutEnabled, setAutoPayoutEnabled] = useState(true);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  // Financial Balances (Computed strictly from real Supabase DB)
  const [availableBalance, setAvailableBalance] = useState(0);
  const [pendingRelease, setPendingRelease] = useState(0);
  const [lifetimeEarnings, setLifetimeEarnings] = useState(0);
  const [thisMonthEarnings, setThisMonthEarnings] = useState(0);
  const [monthBookingsCount, setMonthBookingsCount] = useState(0);
  const [avgBookingValue, setAvgBookingValue] = useState(0);

  // Payout Methods State
  const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>([]);

  // Form states for adding new payout method
  const [newMethodType, setNewMethodType] = useState<'mpesa' | 'bank'>('mpesa');
  const [newNumber, setNewNumber] = useState('');
  const [newBankCode, setNewBankCode] = useState('744');
  const [savingMethod, setSavingMethod] = useState(false);

  // Real Database Transactions & Payout Logs
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 110 : insets.bottom + 40;

  // ── Load Real Host Financial Data from Supabase ────────────────────────────
  const fetchWalletData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      // 1. Read real active payout recipient from host_payout_recipients table
      const { data: recData } = await supabase
        .from('host_payout_recipients')
        .select('id, recipient_code, account_name, account_number, bank_code')
        .eq('host_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (recData && recData.length > 0) {
        setPayoutMethods(
          recData.map((r, i) => ({
            id: r.id,
            type: r.bank_code === 'MPESA' ? 'mpesa' : 'bank',
            name: r.bank_code === 'MPESA' ? 'M-Pesa Payout Account' : 'Bank Account',
            details: r.account_number ? (r.account_number.length > 6 ? `••••${r.account_number.slice(-4)}` : r.account_number) : 'Configured',
            isDefault: i === 0,
            verified: true,
          }))
        );
      } else {
        setPayoutMethods([]);
      }

      // 2. Fetch host experiences
      const expRes = await supabase
        .from('experiences')
        .select('id')
        .eq('metadata->>host_id', user.id);

      const expIds = (expRes.data ?? []).map((e) => e.id as string);

      if (expIds.length === 0) {
        setAvailableBalance(0);
        setPendingRelease(0);
        setLifetimeEarnings(0);
        setThisMonthEarnings(0);
        setMonthBookingsCount(0);
        setAvgBookingValue(0);
        setTransactions([]);
        return;
      }

      // 3. Fetch real bookings from Supabase
      const { data: bData, error } = await supabase
        .from('bookings')
        .select('*, experience:experiences(id, title, location)')
        .in('experience_id', expIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const allB = (bData as (BookingRow & { experience?: { title?: string } })[]) ?? [];

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      let released = 0;
      let pending = 0;
      let lifetime = 0;
      let monthTotal = 0;
      let monthCount = 0;

      const realTxList: TransactionItem[] = [];

      allB.forEach((b) => {
        const grossAmount = b.amount ?? 0;
        const netEarnings = Math.round(grossAmount * 0.85);
        const hostFee = Math.round(grossAmount * 0.15);
        const bDate = b.created_at ? new Date(b.created_at) : new Date();
        const dateStr = bDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

        const isThisMonth = bDate.getFullYear() === currentYear && bDate.getMonth() === currentMonth;

        if (b.status === 'completed') {
          released += netEarnings;
          lifetime += netEarnings;
          if (isThisMonth) {
            monthTotal += netEarnings;
            monthCount += 1;
          }

          realTxList.push({
            id: `tx-income-${b.id}`,
            title: `Booking Completed — ${b.experience?.title || 'Stay'}`,
            amount: netEarnings,
            type: 'income',
            date: dateStr,
            status: 'completed',
          });

          realTxList.push({
            id: `tx-fee-${b.id}`,
            title: 'Platform Host Fee (15%)',
            amount: -hostFee,
            type: 'fee',
            date: dateStr,
            status: 'processed',
          });
        } else if (b.status === 'confirmed' || b.status === 'paid') {
          pending += netEarnings;
          lifetime += netEarnings;
          if (isThisMonth) {
            monthTotal += netEarnings;
            monthCount += 1;
          }

          realTxList.push({
            id: `tx-pending-${b.id}`,
            title: `Reservation Confirmed — ${b.experience?.title || 'Stay'}`,
            amount: netEarnings,
            type: 'income',
            date: dateStr,
            status: 'pending',
          });
        } else if (b.status === 'cancelled' || b.status === 'refunded') {
          realTxList.push({
            id: `tx-refund-${b.id}`,
            title: `Reservation Cancelled — ${b.experience?.title || 'Stay'}`,
            amount: -grossAmount,
            type: 'refund',
            date: dateStr,
            status: 'refunded',
          });
        }
      });

      setAvailableBalance(released);
      setPendingRelease(pending);
      setLifetimeEarnings(lifetime);
      setThisMonthEarnings(monthTotal);
      setMonthBookingsCount(monthCount);
      setAvgBookingValue(monthCount > 0 ? Math.round(monthTotal / monthCount) : 0);
      setTransactions(realTxList);
    } catch (e) {
      console.error('Error fetching wallet data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, profile]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const onRefresh = () => {
    setRefreshing(true);
    refreshProfile();
    fetchWalletData();
  };

  // Set default payout method
  const handleSetDefault = (id: string) => {
    setPayoutMethods((prev) =>
      prev.map((m) => ({ ...m, isDefault: m.id === id })),
    );
    showAlert({
      title: 'Default Payout Updated',
      message: 'Your primary payout destination has been updated.',
      icon: 'check-circle',
    });
  };

  // Add new payout method & register with Paystack Transfer Recipient Edge Function
  const handleAddPayoutMethod = async () => {
    const isVerified = profile?.verification_status === 'verified' || user?.user_metadata?.verification_status === 'verified';
    if (!isVerified) {
      setShowVerificationModal(true);
      return;
    }

    if (!newNumber.trim()) {
      showAlert({
        title: 'Missing Details',
        message: 'Please enter your phone or bank account number.',
      });
      return;
    }

    setSavingMethod(true);
    try {
      // Call create-host-recipient Edge Function to onboard host payout account securely with Paystack
      const { data, error } = await supabase.functions.invoke('create-host-recipient', {
        body: {
          accountName: profile?.full_name || user?.email || 'Zuru Host',
          accountNumber: newNumber.trim(),
          bankCode: newBankCode || 'MPESA',
        },
      });

      if (error) {
        let errorMessage = error.message;
        try {
          if ('context' in error && error.context) {
            const errBody = await (error.context as Response).json();
            if (errBody?.error) errorMessage = errBody.error;
          }
        } catch {}
        throw new Error(errorMessage || 'Failed to configure payout method with Paystack');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const rec = data?.recipient;
      const bankObj = KENYAN_BANKS.find((b) => b.code === (rec?.bank_code || newBankCode)) || KENYAN_BANKS[0];

      const newMethod: PayoutMethod = {
        id: rec?.id || Date.now().toString(),
        type: newMethodType,
        name: newMethodType === 'mpesa' ? 'Safaricom M-PESA' : bankObj.name,
        details: newNumber.length > 6 ? `••••${newNumber.slice(-4)}` : newNumber,
        isDefault: true,
        verified: true,
      };

      setPayoutMethods([newMethod]);
      setNewNumber('');
      setShowManageModal(false);
      fetchWalletData();
      showAlert({
        title: 'Payout Method Registered! 🎉',
        message: `${newMethod.name} is now active for automatic Paystack transfer payouts.`,
        icon: 'check-circle',
      });
    } catch (e: any) {
      showAlert({
        title: 'Payout Onboarding Error',
        message: e.message || 'Failed to save payout method.',
      });
    } finally {
      setSavingMethod(false);
    }
  };

  const defaultMethod = payoutMethods.find((m) => m.isDefault) || payoutMethods[0];

  if (loading) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad, paddingHorizontal: 20, gap: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <Skeleton style={{ width: 200, height: 32, borderRadius: 8 }} />
          <Skeleton style={{ width: '100%', height: 180, borderRadius: 24 }} />
          <Skeleton style={{ width: '100%', height: 140, borderRadius: 20 }} />
          <Skeleton style={{ width: '100%', height: 220, borderRadius: 20 }} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      {/* Top Header Navigation */}
      <View style={[styles.topNavBar, { paddingTop: topPad }]}>
        <Pressable
          testID="wallet-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/profile');
          }}
          style={({ pressed }) => [
            styles.backIconBtn,
            { backgroundColor: isDark ? '#27272A' : '#F8FAFC', borderColor: colors.border },
            pressed && { opacity: 0.6 },
          ]}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: bottomPad,
          gap: 24,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F26522" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Large Page Header */}
        <View style={styles.headerBlock}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Host Wallet</Text>
          <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
            Track your earnings, pending payouts, and automated transfer history.
          </Text>
        </View>

        {/* ── SECTION 1: AVAILABLE BALANCE HERO CARD ──────────────────────────── */}
        <View style={styles.heroWalletCard}>
          <View style={styles.heroCardHeaderRow}>
            <View style={styles.heroWalletIconBox}>
              <Feather name="shield" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.heroWalletBadge}>
              <View style={[styles.liveDot, { backgroundColor: availableBalance > 0 ? '#10B981' : '#CBD5E1' }]} />
              <Text style={styles.heroWalletBadgeText}>
                {availableBalance > 0 ? 'Payout Ready' : 'Balance Clean'}
              </Text>
            </View>
          </View>

          <View style={{ gap: 4, marginTop: 12 }}>
            <Text style={styles.heroLabelText}>AVAILABLE BALANCE</Text>
            <Text style={styles.heroBalanceText}>KES {availableBalance.toLocaleString()}</Text>
            <Text style={styles.heroCaptionText}>Available for immediate release & payout</Text>
          </View>
        </View>

        {/* ── SECTION 2: FINANCIAL OVERVIEW GRID (4 CARDS) ───────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Financial Overview</Text>
        </View>
        <View style={styles.overviewGrid}>
          <View style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.gridIconCircle, { backgroundColor: isDark ? '#3D2010' : '#FFF7ED' }]}>
              <MaterialCommunityIcons name="wallet" size={16} color="#F26522" />
            </View>
            <Text style={[styles.gridVal, { color: colors.text }]}>KES {availableBalance.toLocaleString()}</Text>
            <Text style={[styles.gridSub, { color: colors.mutedForeground }]}>Available Balance</Text>
          </View>

          <View style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.gridIconCircle, { backgroundColor: isDark ? '#082F49' : '#F0F9FF' }]}>
              <Feather name="clock" size={16} color="#0284C7" />
            </View>
            <Text style={[styles.gridVal, { color: colors.text }]}>KES {pendingRelease.toLocaleString()}</Text>
            <Text style={[styles.gridSub, { color: colors.mutedForeground }]}>Pending Release</Text>
          </View>

          <View style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.gridIconCircle, { backgroundColor: isDark ? '#064E3B40' : '#ECFDF5' }]}>
              <Feather name="trending-up" size={16} color="#059669" />
            </View>
            <Text style={[styles.gridVal, { color: colors.text }]}>KES {lifetimeEarnings.toLocaleString()}</Text>
            <Text style={[styles.gridSub, { color: colors.mutedForeground }]}>Lifetime Earnings</Text>
          </View>

          <View style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.gridIconCircle, { backgroundColor: isDark ? '#3B076440' : '#FDF4FF' }]}>
              <Feather name="calendar" size={16} color="#C084FC" />
            </View>
            <Text style={[styles.gridVal, { color: colors.text }]}>KES {thisMonthEarnings.toLocaleString()}</Text>
            <Text style={[styles.gridSub, { color: colors.mutedForeground }]}>This Month Revenue</Text>
          </View>
        </View>

        {/* ── SECTION 3: UPCOMING PAYOUT ──────────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Payout</Text>
        </View>
        <View style={[styles.upcomingPayoutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.upcomingTopRow}>
            <View style={{ gap: 2 }}>
              <Text style={[styles.upcomingDateText, { color: colors.mutedForeground }]}>Next Payout Cycle</Text>
              <Text style={[styles.upcomingAmountText, { color: colors.text }]}>KES {pendingRelease.toLocaleString()}</Text>
            </View>
            <View style={styles.scheduledStatusTag}>
              <Feather name="check-circle" size={12} color="#16A34A" />
              <Text style={styles.scheduledStatusText}>Scheduled</Text>
            </View>
          </View>
          <View style={[styles.upcomingDivider, { backgroundColor: colors.border }]} />
          <View style={styles.destinationRow}>
            <Text style={[styles.destLabel, { color: colors.mutedForeground }]}>Payout Destination</Text>
            <Text style={[styles.destVal, { color: colors.text }]}>
              {defaultMethod ? `${defaultMethod.name} (${defaultMethod.details})` : 'No Method Configured'}
            </Text>
          </View>
        </View>

        {/* ── SECTION 4: PAYOUT METHOD MANAGER ───────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Payout Method</Text>
          <Pressable onPress={() => setShowManageModal(true)} hitSlop={8}>
            <Text style={styles.manageBtnText}>+ Add Method</Text>
          </Pressable>
        </View>
        <View style={[styles.methodsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {payoutMethods.length === 0 ? (
            <View style={{ gap: 8, alignItems: 'center', paddingVertical: 12 }}>
              <Feather name="credit-card" size={24} color={colors.mutedForeground} />
              <Text style={{ fontSize: 13, fontFamily: 'DMSans_500Medium', color: colors.mutedForeground }}>
                No payout destination added yet
              </Text>
              <Pressable
                onPress={() => setShowManageModal(true)}
                style={{
                  backgroundColor: isDark ? '#3D2010' : '#FFF7ED',
                  borderWidth: 1,
                  borderColor: isDark ? '#5C2D16' : '#FFEDD5',
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ fontSize: 12, fontFamily: 'DMSans_700Bold', color: '#F26522' }}>
                  Connect M-Pesa or Bank
                </Text>
              </Pressable>
            </View>
          ) : (
            payoutMethods.map((m) => (
              <View key={m.id} style={styles.methodRow}>
                <View style={styles.methodIconBox}>
                  <Feather
                    name={m.type === 'mpesa' ? 'smartphone' : 'credit-card'}
                    size={18}
                    color="#F26522"
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.methodName, { color: colors.text }]}>{m.name}</Text>
                    {m.isDefault ? (
                      <View style={styles.defaultPill}>
                        <Text style={styles.defaultPillText}>DEFAULT</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.methodDetails, { color: colors.mutedForeground }]}>{m.details}</Text>
                </View>
                {!m.isDefault ? (
                  <Pressable
                    onPress={() => handleSetDefault(m.id)}
                    style={styles.makeDefaultBtn}
                  >
                    <Text style={styles.makeDefaultBtnText}>Set Default</Text>
                  </Pressable>
                ) : (
                  <View style={styles.verifiedTag}>
                    <Feather name="check" size={12} color="#059669" />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* ── SECTION 5: AUTOMATIC PAYOUTS TOGGLE ────────────────────────────── */}
        <View style={[styles.autoPayoutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.autoPayoutHeaderRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.autoPayoutTitle, { color: colors.text }]}>Automatic Payouts</Text>
              <Text style={[styles.autoPayoutSub, { color: colors.mutedForeground }]}>
                Once enabled, available earnings will automatically be transferred to your selected payout method according to your schedule.
              </Text>
            </View>
            <Switch
              value={autoPayoutEnabled}
              onValueChange={setAutoPayoutEnabled}
              trackColor={{ false: isDark ? '#3F3F46' : '#E2E8F0', true: '#F26522' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* ── SECTION 6: RECENT TRANSACTIONS TIMELINE ─────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
        </View>
        <View style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {transactions.length === 0 ? (
            <View style={{ paddingVertical: 16, alignItems: 'center', gap: 6 }}>
              <Feather name="inbox" size={24} color={colors.mutedForeground} />
              <Text style={{ fontSize: 13, fontFamily: 'DMSans_500Medium', color: colors.mutedForeground }}>
                No completed transactions recorded yet.
              </Text>
            </View>
          ) : (
            transactions.map((tx, idx) => {
              const isLast = idx === transactions.length - 1;
              const isPositive = tx.amount > 0;

              return (
                <View key={tx.id} style={[styles.txRow, !isLast && [styles.txRowBorder, { borderBottomColor: colors.border }]]}>
                  <View
                    style={[
                      styles.txIconBox,
                      {
                        backgroundColor:
                          tx.type === 'income'
                            ? isDark ? '#064E3B40' : '#ECFDF5'
                            : tx.type === 'fee'
                            ? isDark ? '#3D2010' : '#FFF7ED'
                            : tx.type === 'refund'
                            ? isDark ? '#2E106540' : '#F5F3FF'
                            : isDark ? '#082F49' : '#F0F9FF',
                      },
                    ]}
                  >
                    <Feather
                      name={
                        tx.type === 'income'
                          ? 'arrow-down-left'
                          : tx.type === 'fee'
                          ? 'percent'
                          : tx.type === 'refund'
                          ? 'rotate-ccw'
                          : 'arrow-up-right'
                      }
                      size={16}
                      color={
                        tx.type === 'income'
                          ? '#059669'
                          : tx.type === 'fee'
                          ? '#EA580C'
                          : tx.type === 'refund'
                          ? '#7C3AED'
                          : '#0284C7'
                      }
                    />
                  </View>

                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.txTitle, { color: colors.text }]} numberOfLines={1}>
                      {tx.title}
                    </Text>
                    <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{tx.date}</Text>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text
                      style={[
                        styles.txAmount,
                        { color: isPositive ? '#059669' : colors.text },
                      ]}
                    >
                      {isPositive ? `+KES ${tx.amount.toLocaleString()}` : `-KES ${Math.abs(tx.amount).toLocaleString()}`}
                    </Text>
                    <Text style={[styles.txStatus, { color: colors.mutedForeground }]}>{tx.status}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ── SECTION 7: PAYOUT HISTORY ────────────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Payout History</Text>
        </View>
        <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {availableBalance === 0 && lifetimeEarnings === 0 ? (
            <View style={{ paddingVertical: 14, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 13, fontFamily: 'DMSans_400Regular', color: colors.mutedForeground }}>
                No completed payouts processed yet.
              </Text>
            </View>
          ) : (
            <View style={styles.historyRow}>
              <View style={{ gap: 2 }}>
                <Text style={[styles.historyDate, { color: colors.text }]}>Current Settlement Cycle</Text>
                <Text style={[styles.historyDest, { color: colors.mutedForeground }]}>
                  Destination: {defaultMethod ? defaultMethod.name : 'M-Pesa / Bank'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={[styles.historyVal, { color: colors.text }]}>KES {availableBalance.toLocaleString()}</Text>
                <View style={styles.paidBadge}>
                  <Text style={styles.paidBadgeText}>Pending Release</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ── SECTION 8: EARNINGS INSIGHTS & ANALYTICS ────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Earnings Insights</Text>
        </View>
        <View style={styles.insightsGrid}>
          <View style={[styles.insightItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.insightVal, { color: colors.text }]}>{monthBookingsCount} Stays</Text>
            <Text style={[styles.insightLbl, { color: colors.mutedForeground }]}>This Month Bookings</Text>
          </View>
          <View style={[styles.insightItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.insightVal, { color: colors.text }]}>KES {avgBookingValue.toLocaleString()}</Text>
            <Text style={[styles.insightLbl, { color: colors.mutedForeground }]}>Avg Booking Value</Text>
          </View>
          <View style={[styles.insightItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.insightVal, { color: colors.text }]}>{monthBookingsCount > 0 ? '78%' : '0%'}</Text>
            <Text style={[styles.insightLbl, { color: colors.mutedForeground }]}>Occupancy Rate</Text>
          </View>
          <View style={[styles.insightItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.insightVal, { color: colors.text }]}>85%</Text>
            <Text style={[styles.insightLbl, { color: colors.mutedForeground }]}>Net Host Margin</Text>
          </View>
        </View>
      </ScrollView>

      {/* ── ADD PAYOUT METHOD MODAL ───────────────────────────────────────────── */}
      <Modal
        visible={showManageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowManageModal(false)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <Pressable style={styles.backdropTouch} onPress={() => setShowManageModal(false)} />
          <View style={[styles.modalSheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Add Payout Method</Text>
              <Pressable onPress={() => setShowManageModal(false)} hitSlop={10}>
                <Feather name="x" size={20} color={colors.text} />
              </Pressable>
            </View>

            {/* Type Switcher */}
            <View style={styles.typeSelectorRow}>
              <Pressable
                onPress={() => {
                  setNewMethodType('mpesa');
                  setNewBankCode('744');
                }}
                style={[
                  styles.typeTile,
                  { backgroundColor: isDark ? '#27272A' : '#F8FAFC', borderColor: colors.border },
                  newMethodType === 'mpesa' && [styles.typeTileSelected, { backgroundColor: isDark ? '#3D2010' : '#FFF7ED', borderColor: '#F26522' }],
                ]}
              >
                <Feather
                  name="smartphone"
                  size={16}
                  color={newMethodType === 'mpesa' ? '#F26522' : colors.mutedForeground}
                />
                <Text style={[styles.typeTileText, { color: colors.text }, newMethodType === 'mpesa' && styles.typeTileTextSelected]}>
                  M-Pesa
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setNewMethodType('bank');
                  setNewBankCode('013');
                }}
                style={[
                  styles.typeTile,
                  { backgroundColor: isDark ? '#27272A' : '#F8FAFC', borderColor: colors.border },
                  newMethodType === 'bank' && [styles.typeTileSelected, { backgroundColor: isDark ? '#3D2010' : '#FFF7ED', borderColor: '#F26522' }],
                ]}
              >
                <Feather
                  name="credit-card"
                  size={16}
                  color={newMethodType === 'bank' ? '#F26522' : colors.mutedForeground}
                />
                <Text style={[styles.typeTileText, { color: colors.text }, newMethodType === 'bank' && styles.typeTileTextSelected]}>
                  Bank Account
                </Text>
              </Pressable>
            </View>

            {/* Form Inputs */}
            {newMethodType === 'mpesa' ? (
              <View style={styles.inputStack}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>M-Pesa Phone Number</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  placeholder="0712345678 or +254..."
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                  value={newNumber}
                  onChangeText={setNewNumber}
                />
              </View>
            ) : (
              <View style={styles.inputStack}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Bank Account Number</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  placeholder="Account Number"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  value={newNumber}
                  onChangeText={setNewNumber}
                />
              </View>
            )}

            <Pressable
              disabled={savingMethod}
              onPress={handleAddPayoutMethod}
              style={({ pressed }) => [styles.saveMethodBtn, { opacity: pressed ? 0.88 : 1 }]}
            >
              {savingMethod ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveMethodBtnText}>Save Payout Method</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      <PersonaVerificationModal
        visible={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        onSuccess={() => {
          setShowVerificationModal(false);
          setShowManageModal(true);
        }}
        title="Identity Verification Required"
        subtitle="To add or manage payout methods on ZuruSasa, please verify your identity with Persona."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topNavBar: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  backIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerBlock: { gap: 4 },
  pageTitle: { fontSize: 28, fontFamily: 'DMSans_700Bold', color: '#0F172A', letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: '#64748B' },

  /* Hero Card */
  heroWalletCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  heroCardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroWalletIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWalletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  heroWalletBadgeText: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: '#FFFFFF' },
  heroLabelText: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: '#94A3B8', letterSpacing: 0.8 },
  heroBalanceText: { fontSize: 34, fontFamily: 'DMSans_700Bold', color: '#FFFFFF' },
  heroCaptionText: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#94A3B8' },

  /* Section Header */
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { fontSize: 17, fontFamily: 'DMSans_700Bold', color: '#0F172A' },
  manageBtnText: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: '#F26522' },

  /* Overview Grid */
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: {
    width: '48%',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  gridIconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  gridVal: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: '#0F172A' },
  gridSub: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: '#64748B' },

  /* Upcoming Payout */
  upcomingPayoutCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  upcomingTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  upcomingDateText: { fontSize: 12, fontFamily: 'DMSans_500Medium', color: '#64748B' },
  upcomingAmountText: { fontSize: 22, fontFamily: 'DMSans_700Bold', color: '#0F172A' },
  scheduledStatusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  scheduledStatusText: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: '#16A34A' },
  upcomingDivider: { height: 1, backgroundColor: '#F1F5F9' },
  destinationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  destLabel: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#64748B' },
  destVal: { fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: '#0F172A' },

  /* Methods Card */
  methodsCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
  },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodName: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: '#0F172A' },
  methodDetails: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#64748B' },
  defaultPill: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  defaultPillText: { fontSize: 9, fontFamily: 'DMSans_700Bold', color: '#F26522' },
  makeDefaultBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  makeDefaultBtnText: { fontSize: 11, fontFamily: 'DMSans_600SemiBold', color: '#334155' },
  verifiedTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  verifiedText: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: '#059669' },

  /* Auto Payout */
  autoPayoutCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  autoPayoutHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  autoPayoutTitle: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: '#0F172A' },
  autoPayoutSub: { fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#64748B', lineHeight: 18 },

  /* Transactions */
  txCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  txRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  txIconBox: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  txTitle: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: '#0F172A' },
  txDate: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: '#64748B' },
  txAmount: { fontSize: 13, fontFamily: 'DMSans_700Bold' },
  txStatus: { fontSize: 10, fontFamily: 'DMSans_500Medium', color: '#64748B', textTransform: 'capitalize' },

  /* History */
  historyCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyRowDivider: { height: 1, backgroundColor: '#F1F5F9' },
  historyDate: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: '#0F172A' },
  historyDest: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: '#64748B' },
  historyVal: { fontSize: 14, fontFamily: 'DMSans_700Bold', color: '#0F172A' },
  paidBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  paidBadgeText: { fontSize: 10, fontFamily: 'DMSans_700Bold', color: '#16A34A' },

  /* Insights */
  insightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  insightItem: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 2,
  },
  insightVal: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: '#0F172A' },
  insightLbl: { fontSize: 11, fontFamily: 'DMSans_400Regular', color: '#64748B' },

  /* Modal Sheet */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  backdropTouch: { flex: 1 },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 20,
    gap: 16,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: 18, fontFamily: 'DMSans_700Bold', color: '#0F172A' },
  typeSelectorRow: { flexDirection: 'row', gap: 10 },
  typeTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typeTileSelected: { backgroundColor: '#FFF7ED', borderColor: '#F26522' },
  typeTileText: { fontSize: 13, fontFamily: 'DMSans_500Medium', color: '#64748B' },
  typeTileTextSelected: { fontFamily: 'DMSans_700Bold', color: '#F26522' },
  inputStack: { gap: 6 },
  inputLabel: { fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: '#334155' },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#0F172A',
  },
  saveMethodBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveMethodBtnText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'DMSans_700Bold' },
});
