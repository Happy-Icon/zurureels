import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
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
}

function formatDate(d?: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PaymentsAndPayoutsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 12;
  const bottomPad = Platform.OS === 'web' ? 110 : insets.bottom + 40;

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('id, trip_title, amount, status, created_at, payment_reference')
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
      <View style={[styles.container, { paddingTop: topPad, paddingHorizontal: 24, gap: 16 }]}>
        <Skeleton style={{ height: 40, width: 40, borderRadius: 20 }} />
        <Skeleton style={{ height: 32, width: 220, borderRadius: 8 }} />
        <Skeleton style={{ height: 120, borderRadius: 16 }} />
        <Skeleton style={{ height: 120, borderRadius: 16 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          testID="payments-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/profile');
          }}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnActive]}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={20} color="#000000" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Payments & payouts</Text>
        </View>

        {/* ── PAYMENT METHODS ──────────────────────────────────────────────── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Payment methods</Text>

          <View style={styles.menuRow}>
            <Feather name="smartphone" size={22} color="#000000" style={styles.menuIcon} />
            <View style={styles.menuTextStack}>
              <Text style={styles.menuRowTitle}>M-Pesa Express</Text>
              <Text style={styles.menuRowSub}>{userPhone} · Default</Text>
            </View>
            <Feather name="check" size={18} color="#059669" />
          </View>

          <View style={styles.divider} />

          <Pressable
            onPress={() => {}}
            style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
          >
            <Feather name="credit-card" size={22} color="#000000" style={styles.menuIcon} />
            <View style={styles.menuTextStack}>
              <Text style={styles.menuRowTitle}>Add credit or debit card</Text>
              <Text style={styles.menuRowSub}>Visa, Mastercard, Amex</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </Pressable>
        </View>

        {/* ── TRANSACTION HISTORY ─────────────────────────────────────────── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Transaction history</Text>

          {transactions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="file-text" size={32} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptySub}>When you book a stay or receive a payout, your receipts will appear here.</Text>
            </View>
          ) : (
            transactions.map((tx, idx) => (
              <React.Fragment key={tx.id}>
                <View style={styles.menuRow}>
                  <Feather name="file-text" size={22} color="#000000" style={styles.menuIcon} />
                  <View style={styles.menuTextStack}>
                    <Text style={styles.menuRowTitle}>{tx.trip_title || 'Reservation'}</Text>
                    <Text style={styles.menuRowSub}>{formatDate(tx.created_at)} · {tx.status ?? 'completed'}</Text>
                  </View>
                  <Text style={styles.amountText}>
                    KES {((tx.amount ?? 0) / 100).toLocaleString()}
                  </Text>
                </View>
                {idx < transactions.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnActive: {
    backgroundColor: '#E5E7EB',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  titleSection: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.8,
  },
  sectionBlock: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  menuRowPressed: {
    opacity: 0.6,
  },
  menuIcon: {
    marginRight: 16,
  },
  menuTextStack: {
    flex: 1,
    paddingRight: 8,
  },
  menuRowTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  menuRowSub: {
    fontSize: 13,
    color: '#717171',
    marginTop: 2,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 2,
  },
  emptyBox: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  emptySub: {
    fontSize: 13,
    color: '#717171',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
});
