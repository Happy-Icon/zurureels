import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/Skeleton';

interface TransactionRow {
  id: string;
  trip_title: string | null;
  amount: number | null;
  status: string | null;
  created_at: string | null;
  payment_reference: string | null;
  refund_amount: number | null;
}

function formatDate(d?: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusColors(status: string | null): { bg: string; fg: string } {
  switch (status) {
    case 'confirmed':
    case 'completed':
    case 'paid':
      return { bg: '#10B98118', fg: '#047857' };
    case 'cancelled':
    case 'refunded':
      return { bg: '#EF444418', fg: '#B91C1C' };
    default:
      return { bg: '#F3F4F6', fg: '#4B5563' };
  }
}

type TabKey = 'payments' | 'history';

export default function PaymentsAndPayoutsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('payments');
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [selectedTx, setSelectedTx] = useState<TransactionRow | null>(null);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 40;

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('id, trip_title, amount, status, created_at, payment_reference, refund_amount')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setTransactions((data as TransactionRow[]) ?? []);
      } catch (e) {
        console.error('Error fetching transactions:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [user]);

  const userPhone = profile?.phone || user?.user_metadata?.phone || '+254 712 *** ***';

  if (loading) {
    return (
      <View style={[styles.fill, { backgroundColor: '#FFFFFF', paddingTop: topPad, paddingHorizontal: 20, gap: 16 }]}>
        <Skeleton style={{ height: 28, width: 200, borderRadius: 6 }} />
        <Skeleton style={{ height: 44, borderRadius: 12 }} />
        <Skeleton style={{ height: 72, borderRadius: 16 }} />
        <Skeleton style={{ height: 72, borderRadius: 16 }} />
        <Skeleton style={{ height: 56, borderRadius: 12 }} />
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: '#FFFFFF' }]}>
      {/* 1. Top Navigation & Modern Header */}
      <View style={[styles.topNavBar, { paddingTop: topPad }]}>
        <Pressable
          testID="payments-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/profile');
          }}
          style={({ pressed }) => [styles.backIconBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color="#222222" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Payments & payouts</Text>
        </View>

        {/* 2. Segmented Navigation Tab Switcher */}
        <View style={styles.tabLineContainer}>
          {(
            [
              { id: 'payments', label: 'Payments' },
              { id: 'history', label: 'History' },
            ] as const
          ).map((t) => {
            const isActive = activeTab === t.id;
            return (
              <Pressable
                key={t.id}
                testID={`payments-tab-${t.id}`}
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

        {activeTab === 'payments' ? (
          /* TAB 1: PAYMENTS & SAVED METHODS */
          <View style={styles.tabSectionWrap}>
            <Text style={styles.sectionHeading}>Your payment methods</Text>
            <Text style={styles.sectionSub}>
              Manage saved M-Pesa accounts and payment methods for booking stays and experiences.
            </Text>

            {/* M-Pesa Saved Method Row */}
            <View style={styles.paymentMethodRow}>
              <View style={styles.paymentMethodLeft}>
                <View style={styles.mpesaBadgeIcon}>
                  <Feather name="smartphone" size={18} color="#008A05" />
                </View>
                <View style={styles.methodTextWrap}>
                  <Text style={styles.methodPrimaryText}>M-Pesa Mobile Money</Text>
                  <Text style={styles.methodSecondaryText}>{userPhone} · STK Express</Text>
                </View>
              </View>
              <View style={styles.defaultPill}>
                <Text style={styles.defaultPillText}>Default</Text>
              </View>
            </View>

            {/* Zuru Escrow Protection Row */}
            <View style={styles.paymentMethodRow}>
              <View style={styles.paymentMethodLeft}>
                <View style={styles.shieldBadgeIcon}>
                  <MaterialCommunityIcons name="shield-check" size={18} color="#EE7D30" />
                </View>
                <View style={styles.methodTextWrap}>
                  <Text style={styles.methodPrimaryText}>Zuru Secure Escrow</Text>
                  <Text style={styles.methodSecondaryText}>Payment held until check-in confirmation</Text>
                </View>
              </View>
              <Feather name="check" size={16} color="#008A05" />
            </View>

            <View style={styles.divider} />

            {/* Coupons & Credits */}
            <Text style={styles.sectionHeading}>Coupons & Credits</Text>
            <View style={styles.paymentMethodRow}>
              <View style={styles.paymentMethodLeft}>
                <View style={styles.tagBadgeIcon}>
                  <Feather name="tag" size={18} color="#717171" />
                </View>
                <View style={styles.methodTextWrap}>
                  <Text style={styles.methodPrimaryText}>Add a coupon</Text>
                  <Text style={styles.methodSecondaryText}>Enter promo code for discount</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color="#717171" />
            </View>
          </View>
        ) : (
          /* TAB 2: TRANSACTION HISTORY & RECEIPTS */
          <View style={styles.tabSectionWrap}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#EE7D30" />
              </View>
            ) : transactions.length === 0 ? (
              /* 3. Redesigned Empty State UI */
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="receipt-outline" size={30} color="#717171" />
                </View>
                <Text style={styles.emptyHeadline}>No transaction records</Text>
                <Text style={styles.emptyBody}>
                  When you complete a booking or receive a payout, your detailed receipts will appear here.
                </Text>
              </View>
            ) : (
              /* 5. Populated Transaction History Row Architecture */
              <View style={styles.historyListWrap}>
                <Text style={styles.sectionHeading}>Completed Receipts</Text>
                {transactions.map((tx) => {
                  const sc = statusColors(tx.status);
                  return (
                    <Pressable
                      key={tx.id}
                      onPress={() => {
                        setSelectedTx(tx);
                      }}
                      style={({ pressed }) => [
                        styles.historyRow,
                        { opacity: pressed ? 0.75 : 1 },
                      ]}
                    >
                      <View style={styles.historyRowLeft}>
                        <Text style={styles.historyTitleText} numberOfLines={1}>
                          {tx.trip_title ?? 'Booking Transaction'}
                        </Text>
                        <View style={styles.historyMetaRow}>
                          <Text style={styles.historyDateText}>{formatDate(tx.created_at)}</Text>
                          {tx.payment_reference ? (
                            <Text style={styles.historyRefText}>
                              · Ref: {tx.payment_reference.slice(-8)}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.historyRowRight}>
                        <Text style={styles.historyAmountText}>
                          KES {Number(tx.amount ?? 0).toLocaleString()}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                          <Text style={[styles.statusBadgeText, { color: sc.fg }]}>
                            {tx.status ?? 'Pending'}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Itemized Modal Receipt Detail View */}
      <Modal
        visible={selectedTx !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTx(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Receipt Detail</Text>
              <Pressable
                onPress={() => setSelectedTx(null)}
                style={styles.modalCloseBtn}
                hitSlop={8}
              >
                <Feather name="x" size={20} color="#222222" />
              </Pressable>
            </View>

            {selectedTx ? (
              <View style={styles.modalBody}>
                <View style={styles.modalReceiptHeader}>
                  <Text style={styles.modalReceiptTitle}>{selectedTx.trip_title || 'Coastal Experience'}</Text>
                  <Text style={styles.modalReceiptDate}>{formatDate(selectedTx.created_at)}</Text>
                </View>

                <View style={styles.modalDivider} />

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Status</Text>
                  <Text style={styles.modalDetailVal}>{selectedTx.status || 'Paid'}</Text>
                </View>

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Payment Reference</Text>
                  <Text style={styles.modalDetailVal}>{selectedTx.payment_reference || 'STK-ESCROW-254'}</Text>
                </View>

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Payment Method</Text>
                  <Text style={styles.modalDetailVal}>M-Pesa Mobile Money</Text>
                </View>

                {selectedTx.refund_amount ? (
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Refund Amount</Text>
                    <Text style={[styles.modalDetailVal, { color: '#008A05' }]}>
                      KES {Number(selectedTx.refund_amount).toLocaleString()}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.modalDivider} />

                <View style={styles.modalTotalRow}>
                  <Text style={styles.modalTotalLabel}>Total Paid</Text>
                  <Text style={styles.modalTotalVal}>
                    KES {Number(selectedTx.amount ?? 0).toLocaleString()}
                  </Text>
                </View>

                <Pressable
                  onPress={() => setSelectedTx(null)}
                  style={styles.modalDoneBtn}
                >
                  <Text style={styles.modalDoneBtnText}>Done</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
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
  titleSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    letterSpacing: -0.4,
  },
  tabLineContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    gap: 24,
    marginBottom: 24,
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
  tabSectionWrap: {
    gap: 16,
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    lineHeight: 18,
    marginTop: -8,
    marginBottom: 8,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  paymentMethodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  mpesaBadgeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#008A0512',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldBadgeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EE7D3012',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagBadgeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTextWrap: {
    flex: 1,
    gap: 2,
  },
  methodPrimaryText: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  methodSecondaryText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  defaultPill: {
    backgroundColor: '#F7F7F7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  defaultPillText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  divider: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginVertical: 12,
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
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
    maxWidth: 280,
  },
  historyListWrap: {
    gap: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  historyRowLeft: {
    flex: 1,
    gap: 4,
    paddingRight: 10,
  },
  historyTitleText: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  historyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyDateText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  historyRefText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },
  historyRowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  historyAmountText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
    textTransform: 'capitalize',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    gap: 12,
  },
  modalReceiptHeader: {
    gap: 4,
  },
  modalReceiptTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  modalReceiptDate: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginVertical: 4,
  },
  modalDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalDetailLabel: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  modalDetailVal: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  modalTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  modalTotalLabel: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  modalTotalVal: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#EE7D30',
  },
  modalDoneBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  modalDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
