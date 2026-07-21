import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/profile/ScreenHeader';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/hooks/useColors';

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
      return { bg: '#d1fae5', fg: '#047857' };
    case 'cancelled':
    case 'refunded':
      return { bg: '#fee2e2', fg: '#b91c1c' };
    default:
      return { bg: '#fef3c7', fg: '#b45309' };
  }
}

export default function TransactionsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);

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

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScreenHeader label="Transactions & Receipts" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Ionicons name="receipt-outline" size={20} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>Transaction Ledger</Text>
        </View>
        <Text style={[styles.caption, { color: colors.mutedForeground }]}>
          View receipts and refund records for all your bookings on ZuruSasa.
        </Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : transactions.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={36}
              color={colors.mutedForeground}
            />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No transaction records found.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {transactions.map((tx) => {
              const sc = statusColors(tx.status);
              return (
                <View
                  key={tx.id}
                  style={[
                    styles.txCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.txTop}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.txTitle, { color: colors.foreground }]}
                        numberOfLines={1}
                      >
                        {tx.trip_title ?? 'Booking'}
                      </Text>
                      <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
                        {formatDate(tx.created_at)}
                      </Text>
                    </View>
                    <Text style={[styles.txAmount, { color: colors.foreground }]}>
                      KSh {Number(tx.amount ?? 0).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.txBottom}>
                    {tx.payment_reference ? (
                      <Text
                        style={[styles.txRef, { color: colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        Ref: {tx.payment_reference}
                      </Text>
                    ) : (
                      <View />
                    )}
                    <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusText, { color: sc.fg }]}>
                        {tx.status ?? 'pending'}
                      </Text>
                    </View>
                  </View>
                  {tx.refund_amount ? (
                    <Text style={[styles.refundText, { color: colors.primary }]}>
                      Refunded: KSh {Number(tx.refund_amount).toLocaleString()}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 20, fontFamily: 'InstrumentSerif_400Regular' },
  caption: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    marginTop: 4,
    marginBottom: 20,
  },
  loadingBox: { paddingVertical: 48, alignItems: 'center' },
  emptyBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyText: { fontSize: 13, fontFamily: 'DMSans_400Regular' },
  list: { gap: 12 },
  txCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  txTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  txTitle: { fontSize: 15, fontFamily: 'DMSans_600SemiBold' },
  txDate: { fontSize: 12, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  txAmount: { fontSize: 15, fontFamily: 'DMSans_700Bold' },
  txBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  txRef: { fontSize: 11, fontFamily: 'DMSans_400Regular', flex: 1 },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    textTransform: 'capitalize',
  },
  refundText: { fontSize: 12, fontFamily: 'DMSans_500Medium' },
});
