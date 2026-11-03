import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/Skeleton';

import {
  CURRENCIES_LIST,
  type CurrencyItem,
  type PaymentMethodItem,
  type PaymentScreenView,
} from '@/components/payments/paymentTypes';
import { paymentsStyles as styles } from '@/components/payments/paymentsStyles';
import { CurrencyPickerModal } from '@/components/payments/CurrencyPickerModal';
import { PaymentMethodsView } from '@/components/payments/PaymentMethodsView';
import { YourPaymentsView } from '@/components/payments/YourPaymentsView';
import { CreditsCouponsView } from '@/components/payments/CreditsCouponsView';
import { HostEarningsView } from '@/components/payments/HostEarningsView';

export default function PaymentsAndPayoutsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();

  const [currentView, setCurrentView] = useState<PaymentScreenView>('hub');
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyItem>(CURRENCIES_LIST[0]);
  const [currencyModal, setCurrencyModal] = useState(false);

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);

  // Past Bookings/Payments
  const [userBookings, setUserBookings] = useState<any[]>([]);

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 32;

  useEffect(() => {
    const fetchPaymentData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id, trip_title, amount, status, created_at, payment_reference')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (bookings) {
          setUserBookings(bookings);
        }

        const phone = profile?.phone || user?.user_metadata?.phone || '';
        if (phone) {
          setPaymentMethods([
            {
              id: 'default_mpesa',
              type: 'mpesa',
              title: 'M-Pesa Express',
              subtitle: phone,
              isDefault: true,
            },
          ]);
        }
      } catch (e) {
        console.warn('Error loading payments:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchPaymentData();
  }, [user, profile]);

  if (currentView === 'payment_methods') {
    return (
      <PaymentMethodsView
        paymentMethods={paymentMethods}
        onAddMethod={(newMethod) => setPaymentMethods((prev) => [...prev, newMethod])}
        onBack={() => setCurrentView('hub')}
        topPad={topPad}
        bottomPad={bottomPad}
      />
    );
  }

  if (currentView === 'your_payments') {
    return (
      <YourPaymentsView
        userBookings={userBookings}
        onBack={() => setCurrentView('hub')}
        topPad={topPad}
        bottomPad={bottomPad}
      />
    );
  }

  if (currentView === 'credits_coupons') {
    return (
      <CreditsCouponsView
        onBack={() => setCurrentView('hub')}
        topPad={topPad}
        bottomPad={bottomPad}
      />
    );
  }

  if (currentView === 'earnings') {
    return (
      <HostEarningsView
        onBack={() => setCurrentView('hub')}
        topPad={topPad}
        bottomPad={bottomPad}
      />
    );
  }

  // HUB VIEW
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.headerRow, { paddingTop: topPad }]}>
        <Pressable
          testID="payments-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/profile/settings');
          }}
          style={styles.circleBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back to settings"
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>

        <Pressable
          testID="open-currency-modal-btn"
          onPress={() => setCurrencyModal(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Selected currency: ${selectedCurrency.code} ${selectedCurrency.symbol}. Tap to change currency.`}
        >
          <Text style={[styles.currencyTopLink, { color: colors.text }]}>
            {`${selectedCurrency.code}-${selectedCurrency.symbol}`}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      >
        {/* Main Title */}
        <Text style={[styles.pageTitle, { color: colors.text }]}>Payments & payouts</Text>

        {loading ? (
          <ActivityIndicator size="small" color={colors.text} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.menuBlock}>
            {/* ── SECTION 1: TRAVELLING ─────────────────────────────────────── */}
            <Text style={[styles.sectionHeader, { color: colors.text }]}>Travelling</Text>

            {/* Payment methods */}
            <Pressable
              testID="menu-payment-methods"
              onPress={() => setCurrentView('payment_methods')}
              style={styles.navRow}
              accessibilityRole="button"
              accessibilityLabel="Payment methods"
            >
              <View style={styles.navRowLeft}>
                <MaterialCommunityIcons name="credit-card-outline" size={24} color={colors.text} style={styles.rowIcon} />
                <Text style={[styles.navRowTitle, { color: colors.text }]}>Payment methods</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </Pressable>

            {/* Your payments */}
            <Pressable
              testID="menu-your-payments"
              onPress={() => setCurrentView('your_payments')}
              style={styles.navRow}
              accessibilityRole="button"
              accessibilityLabel="Your payments and refund history"
            >
              <View style={styles.navRowLeft}>
                <Feather name="list" size={22} color={colors.text} style={styles.rowIcon} />
                <Text style={[styles.navRowTitle, { color: colors.text }]}>Your payments</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </Pressable>

            {/* Credits & coupons */}
            <Pressable
              testID="menu-credits-coupons"
              onPress={() => setCurrentView('credits_coupons')}
              style={styles.navRow}
              accessibilityRole="button"
              accessibilityLabel="Credits and coupons"
            >
              <View style={styles.navRowLeft}>
                <MaterialCommunityIcons name="ticket-percent-outline" size={24} color={colors.text} style={styles.rowIcon} />
                <Text style={[styles.navRowTitle, { color: colors.text }]}>Credits & coupons</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </Pressable>

            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />

            {/* ── SECTION 2: HOSTING ────────────────────────────────────────── */}
            <Text style={[styles.sectionHeader, { color: colors.text }]}>Hosting</Text>

            {/* Payout methods */}
            <Pressable
              testID="menu-payout-methods"
              onPress={() => setCurrentView('earnings')}
              style={styles.navRow}
              accessibilityRole="button"
              accessibilityLabel="Payout methods"
            >
              <View style={styles.navRowLeft}>
                <MaterialCommunityIcons name="hand-coin-outline" size={24} color={colors.text} style={styles.rowIcon} />
                <Text style={[styles.navRowTitle, { color: colors.text }]}>Payout methods</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </Pressable>

            {/* Transaction history */}
            <Pressable
              testID="menu-transaction-history"
              onPress={() => setCurrentView('earnings')}
              style={styles.navRow}
              accessibilityRole="button"
              accessibilityLabel="Transaction history"
            >
              <View style={styles.navRowLeft}>
                <MaterialCommunityIcons name="receipt-text-outline" size={24} color={colors.text} style={styles.rowIcon} />
                <Text style={[styles.navRowTitle, { color: colors.text }]}>Transaction history</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Currency Modal */}
      <CurrencyPickerModal
        visible={currencyModal}
        onClose={() => setCurrencyModal(false)}
        selectedCurrency={selectedCurrency}
        onSelectCurrency={setSelectedCurrency}
      />
    </View>
  );
}
