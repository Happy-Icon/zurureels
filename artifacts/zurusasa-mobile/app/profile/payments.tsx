import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type PaymentScreenView =
  | 'hub'
  | 'payment_methods'
  | 'your_payments'
  | 'credits_coupons'
  | 'earnings';

interface PaymentMethodItem {
  id: string;
  type: 'mpesa' | 'card';
  title: string;
  subtitle: string;
  isDefault?: boolean;
}

interface CurrencyItem {
  code: string;
  name: string;
  symbol: string;
}

const CURRENCIES_LIST: CurrencyItem[] = [
  { code: 'KES', name: 'Kenyan shilling', symbol: 'KSh' },
  { code: 'AUD', name: 'Australian dollar', symbol: '$' },
  { code: 'BRL', name: 'Brazilian real', symbol: 'R$' },
  { code: 'BGN', name: 'Bulgarian lev', symbol: 'лв.' },
  { code: 'CAD', name: 'Canadian dollar', symbol: '$' },
  { code: 'CLP', name: 'Chilean peso', symbol: '$' },
  { code: 'CNY', name: 'Chinese yuan', symbol: '¥' },
  { code: 'COP', name: 'Colombian peso', symbol: '$' },
  { code: 'CRC', name: 'Costa Rican colon', symbol: '₡' },
  { code: 'CZK', name: 'Czech koruna', symbol: 'Kč' },
  { code: 'DKK', name: 'Danish krone', symbol: 'kr' },
  { code: 'AED', name: 'Emirati dirham', symbol: 'د.إ' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British pound', symbol: '£' },
  { code: 'HKD', name: 'Hong Kong dollar', symbol: '$' },
  { code: 'HUF', name: 'Hungarian forint', symbol: 'Ft' },
  { code: 'INR', name: 'Indian rupee', symbol: '₹' },
  { code: 'IDR', name: 'Indonesian rupiah', symbol: 'Rp' },
  { code: 'ILS', name: 'Israeli new shekel', symbol: '₪' },
  { code: 'JPY', name: 'Japanese yen', symbol: '¥' },
  { code: 'MYR', name: 'Malaysian ringgit', symbol: 'RM' },
  { code: 'MXN', name: 'Mexican peso', symbol: '$' },
  { code: 'MAD', name: 'Moroccan dirham', symbol: 'د.م.' },
  { code: 'TWD', name: 'New Taiwan dollar', symbol: '$' },
  { code: 'NZD', name: 'New Zealand dollar', symbol: '$' },
  { code: 'NOK', name: 'Norwegian krone', symbol: 'kr' },
  { code: 'PEN', name: 'Peruvian sol', symbol: 'S/.' },
  { code: 'PHP', name: 'Philippine peso', symbol: '₱' },
  { code: 'PLN', name: 'Polish zloty', symbol: 'zł' },
  { code: 'QAR', name: 'Qatari riyal', symbol: 'ر.ق' },
  { code: 'RON', name: 'Romanian leu', symbol: 'lei' },
  { code: 'SAR', name: 'Saudi riyal', symbol: 'ر.س' },
  { code: 'SGD', name: 'Singapore dollar', symbol: '$' },
  { code: 'ZAR', name: 'South African rand', symbol: 'R' },
  { code: 'KRW', name: 'South Korean won', symbol: '₩' },
  { code: 'SEK', name: 'Swedish krona', symbol: 'kr' },
  { code: 'CHF', name: 'Swiss franc', symbol: 'CHF' },
  { code: 'TZS', name: 'Tanzanian shilling', symbol: 'TSh' },
  { code: 'THB', name: 'Thai baht', symbol: '฿' },
  { code: 'TRY', name: 'Turkish lira', symbol: '₺' },
  { code: 'UGX', name: 'Ugandan shilling', symbol: 'USh' },
  { code: 'USD', name: 'United States dollar', symbol: '$' },
];

export default function PaymentsAndPayoutsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();

  const [currentView, setCurrentView] = useState<PaymentScreenView>('hub');
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyItem>(CURRENCIES_LIST[0]);
  const [currencySearch, setCurrencySearch] = useState('');

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [paymentMethodSelectionModal, setPaymentMethodSelectionModal] = useState(false);
  const [chosenMethodType, setChosenMethodType] = useState<'card' | 'mpesa' | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  const [mpesaNumber, setMpesaNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Credits and coupons
  const [giftCardModal, setGiftCardModal] = useState(false);
  const [giftCardCode, setGiftCardCode] = useState('');
  const [couponModal, setCouponModal] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponsCount, setCouponsCount] = useState(0);

  // Currency modal
  const [currencyModal, setCurrencyModal] = useState(false);

  // Payout setup modal
  const [payoutModal, setPayoutModal] = useState(false);
  const [payoutPhone, setPayoutPhone] = useState('');
  const [payoutBankName, setPayoutBankName] = useState('');
  const [payoutAccountNumber, setPayoutAccountNumber] = useState('');
  const [payoutType, setPayoutType] = useState<'mpesa' | 'bank'>('mpesa');
  const [payoutsConfigured, setPayoutsConfigured] = useState(false);

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

  const filteredCurrencies = useMemo(() => {
    if (!currencySearch.trim()) return CURRENCIES_LIST;
    const query = currencySearch.toLowerCase();
    return CURRENCIES_LIST.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.code.toLowerCase().includes(query) ||
        c.symbol.toLowerCase().includes(query)
    );
  }, [currencySearch]);

  const handleDoneSelectingMethod = () => {
    if (!chosenMethodType) return;
    setPaymentMethodSelectionModal(false);
    setDetailsModalVisible(true);
  };

  const handleSavePaymentMethodDetails = () => {
    if (chosenMethodType === 'mpesa') {
      if (!mpesaNumber || mpesaNumber.length < 9) {
        Alert.alert('Invalid Number', 'Please enter a valid Safaricom phone number.');
        return;
      }
      const newMethod: PaymentMethodItem = {
        id: `mpesa_${Date.now()}`,
        type: 'mpesa',
        title: 'M-Pesa',
        subtitle: mpesaNumber.startsWith('+') ? mpesaNumber : `+254 ${mpesaNumber}`,
      };
      setPaymentMethods((prev) => [...prev, newMethod]);
      setDetailsModalVisible(false);
      setMpesaNumber('');
      setChosenMethodType(null);
      Alert.alert('Payment Method Added', 'M-Pesa account linked successfully.');
    } else {
      if (!cardNumber || cardNumber.length < 15) {
        Alert.alert('Invalid Card', 'Please enter a valid card number.');
        return;
      }
      const last4 = cardNumber.slice(-4);
      const newMethod: PaymentMethodItem = {
        id: `card_${Date.now()}`,
        type: 'card',
        title: 'Credit or debit card',
        subtitle: `•••• ${last4}`,
      };
      setPaymentMethods((prev) => [...prev, newMethod]);
      setDetailsModalVisible(false);
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      setChosenMethodType(null);
      Alert.alert('Payment Method Added', 'Card linked successfully.');
    }
  };

  const handleApplyGiftCard = () => {
    if (!giftCardCode.trim()) {
      Alert.alert('Invalid Code', 'Please enter a valid gift card code.');
      return;
    }
    Alert.alert('Gift Card Claimed', `Gift card code ${giftCardCode.toUpperCase()} applied to your balance.`);
    setGiftCardCode('');
    setGiftCardModal(false);
  };

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) {
      Alert.alert('Invalid Code', 'Please enter a valid coupon code.');
      return;
    }
    setCouponsCount((prev) => prev + 1);
    Alert.alert('Coupon Added', `Coupon ${couponCode.toUpperCase()} added to your wallet.`);
    setCouponCode('');
    setCouponModal(false);
  };

  const handleSavePayoutSetup = () => {
    if (payoutType === 'mpesa') {
      if (!payoutPhone) {
        Alert.alert('Missing Phone', 'Please enter your M-Pesa phone number.');
        return;
      }
    } else {
      if (!payoutAccountNumber || !payoutBankName) {
        Alert.alert('Missing Bank Details', 'Please fill in bank name and account number.');
        return;
      }
    }
    setPayoutsConfigured(true);
    setPayoutModal(false);
    Alert.alert('Payout Method Saved', 'Your host earnings will be dispatched automatically.');
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     RENDER SCREEN 1: HUB VIEW (SCREENSHOT 1)
     ───────────────────────────────────────────────────────────────────────────── */
  if (currentView === 'hub') {
    return (
      <View style={styles.container}>
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
          >
            <Feather name="arrow-left" size={22} color="#111111" />
          </Pressable>

          <Pressable
            testID="open-currency-modal-btn"
            onPress={() => setCurrencyModal(true)}
            hitSlop={8}
          >
            <Text style={styles.currencyTopLink}>{`${selectedCurrency.code}-${selectedCurrency.symbol}`}</Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        >
          {/* Main Title */}
          <Text style={styles.pageTitle}>Payments & payouts</Text>

          {loading ? (
            <ActivityIndicator size="small" color="#111111" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.menuBlock}>
              {/* ── SECTION 1: TRAVELLING ─────────────────────────────────────── */}
              <Text style={styles.sectionHeader}>Travelling</Text>

              {/* Payment methods */}
              <Pressable
                testID="menu-payment-methods"
                onPress={() => setCurrentView('payment_methods')}
                style={styles.navRow}
              >
                <View style={styles.navRowLeft}>
                  <MaterialCommunityIcons name="credit-card-outline" size={24} color="#1E1E1E" style={styles.rowIcon} />
                  <Text style={styles.navRowTitle}>Payment methods</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#717171" />
              </Pressable>

              {/* Your payments */}
              <Pressable
                testID="menu-your-payments"
                onPress={() => setCurrentView('your_payments')}
                style={styles.navRow}
              >
                <View style={styles.navRowLeft}>
                  <Feather name="list" size={22} color="#1E1E1E" style={styles.rowIcon} />
                  <Text style={styles.navRowTitle}>Your payments</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#717171" />
              </Pressable>

              {/* Credits & coupons */}
              <Pressable
                testID="menu-credits-coupons"
                onPress={() => setCurrentView('credits_coupons')}
                style={styles.navRow}
              >
                <View style={styles.navRowLeft}>
                  <MaterialCommunityIcons name="ticket-percent-outline" size={24} color="#1E1E1E" style={styles.rowIcon} />
                  <Text style={styles.navRowTitle}>Credits & coupons</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#717171" />
              </Pressable>

              <View style={styles.dividerLine} />

              {/* ── SECTION 2: HOSTING ────────────────────────────────────────── */}
              <Text style={styles.sectionHeader}>Hosting</Text>

              {/* Payout methods */}
              <Pressable
                testID="menu-payout-methods"
                onPress={() => setCurrentView('earnings')}
                style={styles.navRow}
              >
                <View style={styles.navRowLeft}>
                  <MaterialCommunityIcons name="hand-coin-outline" size={24} color="#1E1E1E" style={styles.rowIcon} />
                  <Text style={styles.navRowTitle}>Payout methods</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#717171" />
              </Pressable>

              {/* Transaction history */}
              <Pressable
                testID="menu-transaction-history"
                onPress={() => setCurrentView('earnings')}
                style={styles.navRow}
              >
                <View style={styles.navRowLeft}>
                  <MaterialCommunityIcons name="receipt-text-outline" size={24} color="#1E1E1E" style={styles.rowIcon} />
                  <Text style={styles.navRowTitle}>Transaction history</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#717171" />
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* ── CHOOSE A CURRENCY MODAL (SCREENSHOT 2) ───────────────────────── */}
        <Modal
          visible={currencyModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setCurrencyModal(false)}
        >
          <View style={[styles.currencyModalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
            {/* Header */}
            <View style={styles.currencyModalHeader}>
              <Pressable
                onPress={() => {
                  setCurrencyModal(false);
                  setCurrencySearch('');
                }}
                style={styles.circleBtn}
                hitSlop={10}
              >
                <Feather name="x" size={22} color="#111111" />
              </Pressable>
              <Text style={styles.currencyHeaderTitle}>Choose a currency</Text>
              <View style={{ width: 36 }} />
            </View>

            {/* Search input */}
            <View style={styles.searchContainer}>
              <View style={styles.searchBarWrapper}>
                <Feather name="search" size={18} color="#717171" style={{ marginRight: 8 }} />
                <TextInput
                  value={currencySearch}
                  onChangeText={setCurrencySearch}
                  placeholder="Search currencies"
                  placeholderTextColor="#717171"
                  style={styles.searchInput}
                />
                {currencySearch.length > 0 && (
                  <Pressable onPress={() => setCurrencySearch('')} hitSlop={8}>
                    <Feather name="x-circle" size={16} color="#717171" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Currency list */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[styles.currencyListContent, { paddingBottom: insets.bottom + 32 }]}
              showsVerticalScrollIndicator={false}
            >
              {filteredCurrencies.map((item) => {
                const isSelected = selectedCurrency.code === item.code;
                return (
                  <Pressable
                    key={item.code}
                    onPress={() => {
                      setSelectedCurrency(item);
                      setCurrencyModal(false);
                      setCurrencySearch('');
                    }}
                    style={styles.currencyItemRow}
                  >
                    <Text style={[styles.currencyItemLabel, isSelected && styles.currencyItemLabelActive]}>
                      {item.name} - {item.symbol}
                    </Text>
                    {isSelected && <Feather name="check" size={20} color="#111111" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Modal>
      </View>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     RENDER SCREEN 2: PAYMENT METHODS (SCREENSHOT 2 & 3)
     ───────────────────────────────────────────────────────────────────────────── */
  if (currentView === 'payment_methods') {
    return (
      <View style={styles.container}>
        <View style={[styles.headerRow, { paddingTop: topPad }]}>
          <Pressable onPress={() => setCurrentView('hub')} style={styles.circleBtn} hitSlop={12}>
            <Feather name="arrow-left" size={22} color="#111111" />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        >
          <Text style={styles.pageTitle}>Payment methods</Text>
          <Text style={styles.pageSubtitle}>
            Add a payment method using our secure payment system, then start planning your next trip.
          </Text>

          {/* List of Linked Methods if any */}
          {paymentMethods.map((method) => (
            <View key={method.id} style={styles.linkedMethodRow}>
              <View style={styles.methodIconBadge}>
                {method.type === 'mpesa' ? (
                  <Text style={styles.mpesaBadgeText}>M</Text>
                ) : (
                  <Feather name="credit-card" size={18} color="#111111" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodRowTitle}>{method.title}</Text>
                <Text style={styles.methodRowSubtitle}>{method.subtitle}</Text>
              </View>
              {method.isDefault && (
                <View style={styles.defaultPill}>
                  <Text style={styles.defaultPillText}>DEFAULT</Text>
                </View>
              )}
            </View>
          ))}

          {/* Add payment method button */}
          <Pressable
            testID="add-payment-method-btn"
            onPress={() => setPaymentMethodSelectionModal(true)}
            style={styles.blackActionBtn}
          >
            <Text style={styles.blackActionBtnText}>Add payment method</Text>
          </Pressable>

          {/* Make all payments through ZuruSasa Protection Card */}
          <View style={styles.protectionCard}>
            <View style={styles.protectionIconWrapper}>
              <MaterialCommunityIcons name="credit-card-chip-outline" size={24} color="#E11D48" />
            </View>
            <Text style={styles.protectionCardTitle}>Make all payments through ZuruSasa</Text>
            <Text style={styles.protectionCardBody}>
              Always pay and communicate through ZuruSasa to ensure you're protected under our{' '}
              <Text style={styles.underlineLink}>Terms of Service</Text>,{' '}
              <Text style={styles.underlineLink}>Payments Terms of Service</Text>, cancellation and other safeguards.
            </Text>
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Payment Protection',
                  'ZuruSasa guarantees secure coastal transactions. Paying off-platform voids reservation dispute rights and insurance coverage.'
                )
              }
              style={{ marginTop: 12 }}
            >
              <Text style={styles.learnMoreBold}>Learn more</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* ── PAYMENT METHOD SELECTION BOTTOM SHEET (SCREENSHOT 3) ──────────── */}
        <Modal
          visible={paymentMethodSelectionModal}
          transparent
          animationType="fade"
          onRequestClose={() => setPaymentMethodSelectionModal(false)}
        >
          <View style={styles.bottomSheetOverlay}>
            <Pressable
              style={{ flex: 1 }}
              onPress={() => setPaymentMethodSelectionModal(false)}
            />

            <View style={[styles.bottomSheetContainer, { paddingBottom: insets.bottom + 20 }]}>
              {/* Header */}
              <View style={styles.bottomSheetHeader}>
                <Text style={styles.bottomSheetTitle}>Payment method</Text>
                <Pressable
                  onPress={() => setPaymentMethodSelectionModal(false)}
                  style={styles.sheetCloseBtn}
                  hitSlop={10}
                >
                  <Feather name="x" size={20} color="#111111" />
                </Pressable>
              </View>

              {/* Option 1: Credit or debit card */}
              <Pressable
                onPress={() => setChosenMethodType('card')}
                style={[
                  styles.methodCardOption,
                  chosenMethodType === 'card' && styles.methodCardOptionSelected,
                ]}
              >
                <View style={styles.methodCardLeft}>
                  <MaterialCommunityIcons name="credit-card-outline" size={22} color="#111111" style={{ marginRight: 12 }} />
                  <View>
                    <Text style={styles.methodCardName}>Credit or debit card</Text>
                    <View style={styles.cardBadgesRow}>
                      <Text style={styles.visaBadge}>VISA</Text>
                      <View style={styles.mastercardCircleWrapper}>
                        <View style={[styles.mcCircle, { backgroundColor: '#EB001B' }]} />
                        <View style={[styles.mcCircle, { backgroundColor: '#F79E1B', marginLeft: -6 }]} />
                      </View>
                    </View>
                  </View>
                </View>

                {/* Radio button */}
                <View style={[styles.radioCircle, chosenMethodType === 'card' && styles.radioCircleActive]}>
                  {chosenMethodType === 'card' && <View style={styles.radioInnerDot} />}
                </View>
              </Pressable>

              {/* Option 2: M-Pesa */}
              <Pressable
                onPress={() => setChosenMethodType('mpesa')}
                style={[
                  styles.methodCardOption,
                  chosenMethodType === 'mpesa' && styles.methodCardOptionSelected,
                  { marginTop: 12 },
                ]}
              >
                <View style={styles.methodCardLeft}>
                  <View style={styles.mpesaSmallBadge}>
                    <Text style={styles.mpesaSmallBadgeText}>M</Text>
                  </View>
                  <View>
                    <Text style={styles.methodCardName}>M-Pesa</Text>
                    <Text style={styles.mpesaCardSubtitle}>Safaricom M-Pesa Express</Text>
                  </View>
                </View>

                {/* Radio button */}
                <View style={[styles.radioCircle, chosenMethodType === 'mpesa' && styles.radioCircleActive]}>
                  {chosenMethodType === 'mpesa' && <View style={styles.radioInnerDot} />}
                </View>
              </Pressable>

              {/* Footer Buttons: Cancel on left, Done on right */}
              <View style={styles.sheetFooterRow}>
                <Pressable
                  onPress={() => {
                    setChosenMethodType(null);
                    setPaymentMethodSelectionModal(false);
                  }}
                  style={styles.sheetCancelBtn}
                  hitSlop={8}
                >
                  <Text style={styles.sheetCancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  disabled={!chosenMethodType}
                  onPress={handleDoneSelectingMethod}
                  style={[
                    styles.sheetDoneBtn,
                    chosenMethodType ? styles.sheetDoneBtnActive : styles.sheetDoneBtnDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.sheetDoneText,
                      chosenMethodType ? styles.sheetDoneTextActive : styles.sheetDoneTextDisabled,
                    ]}
                  >
                    Done
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── CARD / MPESA DETAILS INPUT MODAL ──────────────────────────────── */}
        <Modal
          visible={detailsModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setDetailsModalVisible(false)}
        >
          <View style={[styles.currencyModalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
            <View style={styles.currencyModalHeader}>
              <Pressable onPress={() => setDetailsModalVisible(false)} style={styles.circleBtn}>
                <Feather name="x" size={22} color="#111111" />
              </Pressable>
              <Text style={styles.currencyHeaderTitle}>
                {chosenMethodType === 'mpesa' ? 'Enter M-Pesa Number' : 'Enter Card Details'}
              </Text>
              <View style={{ width: 36 }} />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalBody}>
              {chosenMethodType === 'mpesa' ? (
                <View>
                  <Text style={styles.inputLabel}>Safaricom Phone Number</Text>
                  <TextInput
                    value={mpesaNumber}
                    onChangeText={setMpesaNumber}
                    placeholder="0712 345 678"
                    placeholderTextColor="#9E9E9E"
                    keyboardType="phone-pad"
                    style={styles.sheetInput}
                  />
                  <Text style={styles.inputHint}>
                    An M-Pesa STK PIN prompt will be sent directly to your phone whenever you confirm a reservation.
                  </Text>
                </View>
              ) : (
                <View>
                  <Text style={styles.inputLabel}>Card Number</Text>
                  <TextInput
                    value={cardNumber}
                    onChangeText={setCardNumber}
                    placeholder="4111 2222 3333 4444"
                    placeholderTextColor="#9E9E9E"
                    keyboardType="numeric"
                    style={styles.sheetInput}
                  />

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Expiry (MM/YY)</Text>
                      <TextInput
                        value={cardExpiry}
                        onChangeText={setCardExpiry}
                        placeholder="12/28"
                        placeholderTextColor="#9E9E9E"
                        style={styles.sheetInput}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>CVV</Text>
                      <TextInput
                        value={cardCvv}
                        onChangeText={setCardCvv}
                        placeholder="123"
                        placeholderTextColor="#9E9E9E"
                        keyboardType="numeric"
                        secureTextEntry
                        style={styles.sheetInput}
                      />
                    </View>
                  </View>
                </View>
              )}

              <Pressable onPress={handleSavePaymentMethodDetails} style={styles.modalPrimaryBtn}>
                <Text style={styles.modalPrimaryBtnText}>Save payment method</Text>
              </Pressable>
            </ScrollView>
          </View>
        </Modal>
      </View>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     RENDER SCREEN 3: YOUR PAYMENTS (SCREENSHOT 3)
     ───────────────────────────────────────────────────────────────────────────── */
  if (currentView === 'your_payments') {
    return (
      <View style={styles.container}>
        <View style={[styles.headerRow, { paddingTop: topPad }]}>
          <Pressable onPress={() => setCurrentView('hub')} style={styles.circleBtn} hitSlop={12}>
            <Feather name="arrow-left" size={22} color="#111111" />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { flexGrow: 1, justifyContent: 'space-between', paddingBottom: bottomPad }]}
        >
          <View>
            <Text style={styles.pageTitle}>Your payments</Text>
            <Text style={styles.pageSubtitle}>
              Once you have a reservation, this is where you can come to track your payments and refunds.
            </Text>

            {userBookings.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text style={styles.sectionHeader}>Recent Bookings</Text>
                {userBookings.map((b) => (
                  <View key={b.id} style={styles.bookingPaymentRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bookingRowTitle}>{b.trip_title || 'Coastal Getaway'}</Text>
                      <Text style={styles.bookingRowSub}>
                        Ref: {b.payment_reference || b.id.slice(0, 8)} · {b.status?.toUpperCase() || 'PAID'}
                      </Text>
                    </View>
                    <Text style={styles.bookingRowAmount}>KES {b.amount?.toLocaleString() || '0'}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.helpFooter}>
            <Text style={styles.helpFooterText}>
              To find another payment, try our{' '}
              <Text onPress={() => router.push('/profile/support')} style={styles.underlineLinkBold}>
                Help Centre
              </Text>
              .
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     RENDER SCREEN 4: CREDITS AND COUPONS (SCREENSHOT 4)
     ───────────────────────────────────────────────────────────────────────────── */
  if (currentView === 'credits_coupons') {
    return (
      <View style={styles.container}>
        <View style={[styles.headerRow, { paddingTop: topPad }]}>
          <Pressable onPress={() => setCurrentView('hub')} style={styles.circleBtn} hitSlop={12}>
            <Feather name="arrow-left" size={22} color="#111111" />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        >
          <Text style={styles.pageTitle}>Credits and coupons</Text>

          {/* Section: Gift credit */}
          <View style={{ marginTop: 20 }}>
            <Text style={styles.sectionHeader}>Gift credit</Text>
            <Pressable
              testID="add-gift-card-btn"
              onPress={() => setGiftCardModal(true)}
              style={[styles.blackActionBtn, { marginTop: 16 }]}
            >
              <Text style={styles.blackActionBtnText}>Add gift card</Text>
            </Pressable>
          </View>

          <View style={[styles.dividerLine, { marginVertical: 32 }]} />

          {/* Section: Coupons */}
          <View>
            <Text style={styles.sectionHeader}>Coupons</Text>
            <View style={styles.couponCountRow}>
              <Text style={styles.couponCountLabel}>Your coupons</Text>
              <Text style={styles.couponCountValue}>{couponsCount}</Text>
            </View>

            <Pressable
              testID="add-coupon-btn"
              onPress={() => setCouponModal(true)}
              style={[styles.blackActionBtn, { marginTop: 16 }]}
            >
              <Text style={styles.blackActionBtnText}>Add coupon</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* Gift Card Modal */}
        <Modal
          visible={giftCardModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setGiftCardModal(false)}
        >
          <View style={[styles.currencyModalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
            <View style={styles.currencyModalHeader}>
              <Pressable onPress={() => setGiftCardModal(false)} style={styles.circleBtn}>
                <Feather name="x" size={22} color="#111111" />
              </Pressable>
              <Text style={styles.currencyHeaderTitle}>Add gift card</Text>
              <View style={{ width: 36 }} />
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Gift Card PIN / Code</Text>
              <TextInput
                value={giftCardCode}
                onChangeText={setGiftCardCode}
                placeholder="XXXX-XXXX-XXXX"
                placeholderTextColor="#9E9E9E"
                autoCapitalize="characters"
                style={styles.sheetInput}
              />
              <Pressable onPress={handleApplyGiftCard} style={styles.modalPrimaryBtn}>
                <Text style={styles.modalPrimaryBtnText}>Apply to balance</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Coupon Modal */}
        <Modal
          visible={couponModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setCouponModal(false)}
        >
          <View style={[styles.currencyModalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
            <View style={styles.currencyModalHeader}>
              <Pressable onPress={() => setCouponModal(false)} style={styles.circleBtn}>
                <Feather name="x" size={22} color="#111111" />
              </Pressable>
              <Text style={styles.currencyHeaderTitle}>Add coupon</Text>
              <View style={{ width: 36 }} />
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Coupon Code</Text>
              <TextInput
                value={couponCode}
                onChangeText={setCouponCode}
                placeholder="COASTAL20"
                placeholderTextColor="#9E9E9E"
                autoCapitalize="characters"
                style={styles.sheetInput}
              />
              <Pressable onPress={handleApplyCoupon} style={styles.modalPrimaryBtn}>
                <Text style={styles.modalPrimaryBtnText}>Add to account</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     RENDER SCREEN 5 & 6: EARNINGS / HOST PAYOUTS (SCREENSHOTS 5 & 6)
     ───────────────────────────────────────────────────────────────────────────── */
  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.headerRow, { paddingTop: topPad }]}>
        <Pressable onPress={() => setCurrentView('hub')} style={styles.circleBtn} hitSlop={12}>
          <Feather name="arrow-left" size={22} color="#111111" />
        </Pressable>

        <Pressable onPress={() => setPayoutModal(true)} style={styles.circleBtn} hitSlop={12}>
          <Feather name="settings" size={20} color="#111111" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      >
        <Text style={styles.pageTitle}>Earnings</Text>

        {/* Warning Banner: Payouts are paused */}
        {!payoutsConfigured && (
          <View style={styles.warningBanner}>
            <View style={styles.warningHeaderRow}>
              <Ionicons name="alert-circle" size={22} color="#DC2626" style={{ marginRight: 8 }} />
              <Text style={styles.warningTitle}>Your payouts are paused</Text>
            </View>
            <Text style={styles.warningSubtitle}>
              Add a payout method so we can send you the money you're owed.
            </Text>

            <Pressable
              testID="setup-payouts-btn"
              onPress={() => setPayoutModal(true)}
              style={styles.setupPayoutsPillBtn}
            >
              <Text style={styles.setupPayoutsBtnText}>Set up payouts</Text>
            </Pressable>
          </View>
        )}

        {/* Performance Card */}
        <View style={styles.performanceCard}>
          <Text style={styles.performanceHeader}>Performance</Text>
          <Text style={styles.performanceAmount}>$0.00</Text>
          <Text style={styles.performanceSub}>Total for August (USD)</Text>

          {/* Bar placeholder */}
          <View style={styles.barGraphRow}>
            <View style={[styles.barPillar, { height: 70 }]} />
            <View style={[styles.barPillar, { height: 50 }]} />
          </View>

          <Text style={styles.performanceFooterText}>
            Your overview will show up here once you get your first booking.
          </Text>
        </View>

        {/* Section: Upcoming */}
        <Text style={[styles.sectionHeader, { marginTop: 32 }]}>Upcoming</Text>
        <View style={styles.illustrationCard}>
          <View style={styles.illustrationBadge}>
            <Text style={{ fontSize: 32 }}>📅</Text>
          </View>
          <Text style={styles.illustrationTitle}>No scheduled payouts</Text>
          <Text style={styles.illustrationSub}>
            Upcoming payouts will be shown here after your first booking.
          </Text>
        </View>

        {/* Section: Paid */}
        <Text style={[styles.sectionHeader, { marginTop: 32 }]}>Paid</Text>
        <View style={styles.illustrationCard}>
          <View style={styles.illustrationBadge}>
            <Text style={{ fontSize: 32 }}>🪙</Text>
          </View>
          <Text style={styles.illustrationTitle}>No sent payouts</Text>
          <Pressable
            onPress={() =>
              Alert.alert(
                'How Payouts Work',
                'ZuruSasa automatically releases host earnings to your M-Pesa or Bank account 24 hours after guest check-in.'
              )
            }
          >
            <Text style={styles.underlineLinkBold}>Learn how payouts work</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Set Up Payouts Modal */}
      <Modal
        visible={payoutModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPayoutModal(false)}
      >
        <View style={[styles.currencyModalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          <View style={styles.currencyModalHeader}>
            <Pressable onPress={() => setPayoutModal(false)} style={styles.circleBtn}>
              <Feather name="x" size={22} color="#111111" />
            </Pressable>
            <Text style={styles.currencyHeaderTitle}>Set up payout method</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalBody}>
            <View style={styles.methodTypeSwitcher}>
              <Pressable
                onPress={() => setPayoutType('mpesa')}
                style={[styles.typeBtn, payoutType === 'mpesa' && styles.typeBtnActive]}
              >
                <Text style={[styles.typeBtnText, payoutType === 'mpesa' && styles.typeBtnTextActive]}>
                  M-Pesa Payout
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPayoutType('bank')}
                style={[styles.typeBtn, payoutType === 'bank' && styles.typeBtnActive]}
              >
                <Text style={[styles.typeBtnText, payoutType === 'bank' && styles.typeBtnTextActive]}>
                  Bank Account (EFT)
                </Text>
              </Pressable>
            </View>

            {payoutType === 'mpesa' ? (
              <View>
                <Text style={styles.inputLabel}>M-Pesa Phone Number</Text>
                <TextInput
                  value={payoutPhone}
                  onChangeText={setPayoutPhone}
                  placeholder="0712 345 678"
                  placeholderTextColor="#9E9E9E"
                  keyboardType="phone-pad"
                  style={styles.sheetInput}
                />
              </View>
            ) : (
              <View>
                <Text style={styles.inputLabel}>Bank Name</Text>
                <TextInput
                  value={payoutBankName}
                  onChangeText={setPayoutBankName}
                  placeholder="e.g. KCB, Equity Bank, NCBA"
                  placeholderTextColor="#9E9E9E"
                  style={styles.sheetInput}
                />
                <Text style={styles.inputLabel}>Account Number</Text>
                <TextInput
                  value={payoutAccountNumber}
                  onChangeText={setPayoutAccountNumber}
                  placeholder="1234567890"
                  placeholderTextColor="#9E9E9E"
                  keyboardType="numeric"
                  style={styles.sheetInput}
                />
              </View>
            )}

            <Pressable onPress={handleSavePayoutSetup} style={styles.modalPrimaryBtn}>
              <Text style={styles.modalPrimaryBtnText}>Save payout method</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  currencyTopLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    textDecorationLine: 'underline',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.5,
    marginBottom: 24,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#717171',
    lineHeight: 22,
    marginBottom: 20,
  },
  menuBlock: {
    width: '100%',
  },
  sectionHeader: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 12,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  navRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIcon: {
    marginRight: 16,
  },
  navRowTitle: {
    fontSize: 16,
    color: '#1E1E1E',
    fontWeight: '400',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_500Medium',
      default: 'sans-serif',
    }),
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 16,
  },

  /* Payment Methods Styles */
  blackActionBtn: {
    backgroundColor: '#111111',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignSelf: 'flex-start',
    marginBottom: 28,
  },
  blackActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  linkedMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    marginBottom: 16,
  },
  methodIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  mpesaBadgeText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#16A34A',
  },
  methodRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  methodRowSubtitle: {
    fontSize: 13,
    color: '#717171',
    marginTop: 2,
  },
  defaultPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  defaultPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  protectionCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 20,
    marginTop: 8,
  },
  protectionIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  protectionCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  protectionCardBody: {
    fontSize: 14,
    color: '#484848',
    lineHeight: 20,
  },
  underlineLink: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  learnMoreBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    textDecorationLine: 'underline',
  },

  /* Bottom Sheet Selector Styles (Screenshot 3) */
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  sheetCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodCardOption: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  methodCardOptionSelected: {
    borderColor: '#111111',
  },
  methodCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  cardBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  visaBadge: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1A1F71',
    marginRight: 8,
    letterSpacing: 0.5,
  },
  mastercardCircleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mcCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  mpesaSmallBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  mpesaSmallBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  mpesaCardSubtitle: {
    fontSize: 12,
    color: '#717171',
    marginTop: 2,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#9E9E9E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#111111',
  },
  radioInnerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#111111',
  },
  sheetFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 32,
  },
  sheetCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  sheetCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  sheetDoneBtn: {
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  sheetDoneBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  sheetDoneBtnActive: {
    backgroundColor: '#111111',
  },
  sheetDoneText: {
    fontSize: 15,
    fontWeight: '700',
  },
  sheetDoneTextDisabled: {
    color: '#9CA3AF',
  },
  sheetDoneTextActive: {
    color: '#FFFFFF',
  },

  /* Choose Currency Modal Styles (Screenshot 2) */
  currencyModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  currencyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  currencyHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111111',
  },
  currencyListContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  currencyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  currencyItemLabel: {
    fontSize: 16,
    color: '#1E1E1E',
    fontWeight: '400',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_500Medium',
      default: 'sans-serif',
    }),
  },
  currencyItemLabelActive: {
    fontWeight: '700',
    color: '#111111',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },

  /* Your Payments Styles */
  bookingPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  bookingRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  bookingRowSub: {
    fontSize: 13,
    color: '#717171',
    marginTop: 2,
  },
  bookingRowAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  helpFooter: {
    paddingTop: 32,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  helpFooterText: {
    fontSize: 14,
    color: '#484848',
  },
  underlineLinkBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    textDecorationLine: 'underline',
  },

  /* Coupons Styles */
  couponCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  couponCountLabel: {
    fontSize: 15,
    color: '#1E1E1E',
  },
  couponCountValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },

  /* Earnings Styles */
  warningBanner: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  warningHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  warningSubtitle: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 20,
    marginBottom: 16,
  },
  setupPayoutsPillBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  setupPayoutsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
  performanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  performanceHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 12,
  },
  performanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 4,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  performanceSub: {
    fontSize: 13,
    color: '#717171',
    marginBottom: 20,
  },
  barGraphRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginVertical: 12,
  },
  barPillar: {
    width: 60,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
  },
  performanceFooterText: {
    fontSize: 13,
    color: '#717171',
    lineHeight: 18,
    marginTop: 16,
  },
  illustrationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  illustrationBadge: {
    marginBottom: 12,
  },
  illustrationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 6,
    textAlign: 'center',
  },
  illustrationSub: {
    fontSize: 13,
    color: '#717171',
    textAlign: 'center',
    lineHeight: 18,
  },

  /* Modals & Dialogs */
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  methodTypeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  typeBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  typeBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#717171',
  },
  typeBtnTextActive: {
    color: '#111111',
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 8,
    marginTop: 8,
  },
  sheetInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111111',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    color: '#717171',
    lineHeight: 16,
    marginBottom: 16,
  },
  modalPrimaryBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
