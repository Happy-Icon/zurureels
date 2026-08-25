import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
import { Feather } from '@expo/vector-icons';

export interface CardDetails {
  cardNumber: string;
  expiry: string;
  cvv: string;
  streetAddress?: string;
  aptSuite?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  cardholderName?: string;
}

export interface CardPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  amount?: number;
  experienceTitle?: string;
  onConfirmPay: (cardDetails: {
    cardNumber: string;
    expiry: string;
    cvv: string;
    cardholderName: string;
    streetAddress?: string;
    aptSuite?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  }) => Promise<void> | void;
}

export function CardPaymentModal({
  visible,
  onClose,
  amount,
  experienceTitle,
  onConfirmPay,
}: CardPaymentModalProps) {
  const insets = useSafeAreaInsets();

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  const [streetAddress, setStreetAddress] = useState('');
  const [aptSuite, setAptSuite] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('Kenya');

  // Format Card Number (groups of 4 digits)
  const handleCardNumberChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 16);
    const parts = cleaned.match(/.{1,4}/g) || [];
    setCardNumber(parts.join(' '));
  };

  // Format Expiration MM/YY
  const handleExpiryChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
    if (cleaned.length >= 3) {
      setExpiry(`${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`);
    } else {
      setExpiry(cleaned);
    }
  };

  // Format CVV
  const handleCvvChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
    setCvv(cleaned);
  };

  const handleNext = () => {
    const rawNum = cardNumber.replace(/\s+/g, '');
    if (rawNum.length < 15) {
      Alert.alert('Card number required', 'Please enter a valid 16-digit credit or debit card number.');
      return;
    }
    if (expiry.length < 5) {
      Alert.alert('Expiration date required', 'Please enter your card expiration date (MM/YY).');
      return;
    }
    const [month] = expiry.split('/').map((s) => parseInt(s, 10));
    if (isNaN(month) || month < 1 || month > 12) {
      Alert.alert('Invalid expiration month', 'Expiration month must be between 01 and 12.');
      return;
    }
    if (cvv.length < 3) {
      Alert.alert('CVV required', 'Please enter the 3 or 4-digit security code (CVV) on the back of your card.');
      return;
    }

    onConfirmPay({
      cardNumber: rawNum,
      expiry,
      cvv,
      cardholderName: streetAddress ? `Resident (${city || 'Kenya'})` : 'Cardholder',
      streetAddress,
      aptSuite,
      city,
      state,
      zipCode,
      country,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: '#FFFFFF' }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── TOP HEADER NAV ── */}
        <View style={[styles.headerNav, { paddingTop: Platform.OS === 'ios' ? insets.top + 6 : 16 }]}>
          <View style={styles.headerLeftSpacer} />
          <Text style={styles.headerTitle}>Add card details</Text>
          <Pressable onPress={onClose} style={styles.headerCloseBtn} hitSlop={12}>
            <Feather name="x" size={22} color="#111111" />
          </Pressable>
        </View>

        {/* ── SCROLLABLE FORM (Matching Screenshot 2 exactly) ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 90 },
          ]}
        >
          {/* 1. CARD NUMBER & EXPIRY / CVV GROUP */}
          <View style={styles.groupedCardBox}>
            {/* Row 1: Card Number */}
            <View style={styles.inputRow}>
              <TextInput
                value={cardNumber}
                onChangeText={handleCardNumberChange}
                placeholder="Card number"
                placeholderTextColor="#717171"
                keyboardType="numeric"
                style={styles.fieldInput}
                autoFocus={true}
              />
            </View>

            <View style={styles.groupDivider} />

            {/* Row 2: Expiration | CVV */}
            <View style={styles.splitRow}>
              <View style={styles.splitColLeft}>
                <TextInput
                  value={expiry}
                  onChangeText={handleExpiryChange}
                  placeholder="Expiration"
                  placeholderTextColor="#717171"
                  keyboardType="numeric"
                  maxLength={5}
                  style={styles.fieldInput}
                />
              </View>

              <View style={styles.verticalDivider} />

              <View style={styles.splitColRight}>
                <TextInput
                  value={cvv}
                  onChangeText={handleCvvChange}
                  placeholder="CVV"
                  placeholderTextColor="#717171"
                  keyboardType="numeric"
                  secureTextEntry={true}
                  maxLength={4}
                  style={styles.fieldInput}
                />
              </View>
            </View>
          </View>

          {/* 2. BILLING ADDRESS SECTION TITLE */}
          <Text style={styles.sectionHeading}>Billing address</Text>

          {/* 3. BILLING ADDRESS GROUPED BOX */}
          <View style={styles.groupedCardBox}>
            {/* Row 1: Street address */}
            <View style={styles.inputRow}>
              <TextInput
                value={streetAddress}
                onChangeText={setStreetAddress}
                placeholder="Street address"
                placeholderTextColor="#717171"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.groupDivider} />

            {/* Row 2: Apt or suite number */}
            <View style={styles.inputRow}>
              <TextInput
                value={aptSuite}
                onChangeText={setAptSuite}
                placeholder="Apt or suite number"
                placeholderTextColor="#717171"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.groupDivider} />

            {/* Row 3: City */}
            <View style={styles.inputRow}>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="City"
                placeholderTextColor="#717171"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.groupDivider} />

            {/* Row 4: State | ZIP code */}
            <View style={styles.splitRow}>
              <View style={styles.splitColLeft}>
                <TextInput
                  value={state}
                  onChangeText={setState}
                  placeholder="State"
                  placeholderTextColor="#717171"
                  style={styles.fieldInput}
                />
              </View>

              <View style={styles.verticalDivider} />

              <View style={styles.splitColRight}>
                <TextInput
                  value={zipCode}
                  onChangeText={setZipCode}
                  placeholder="ZIP code"
                  placeholderTextColor="#717171"
                  keyboardType="numeric"
                  style={styles.fieldInput}
                />
              </View>
            </View>
          </View>

          {/* 4. COUNTRY / REGION DROPDOWN BOX */}
          <View style={styles.countryDropdownContainer}>
            <View style={styles.countryTextCol}>
              <Text style={styles.countryLabel}>Country/region</Text>
              <Text style={styles.countryValue}>{country}</Text>
            </View>
            <Feather name="chevron-down" size={20} color="#222222" />
          </View>
        </ScrollView>

        {/* ── STICKY BOTTOM ACTION BAR (Cancel on left, Next on right) ── */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={onClose} style={styles.cancelBtn} hitSlop={12}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>

          <Pressable onPress={handleNext} style={styles.nextBtn}>
            <Text style={styles.nextBtnText}>Next</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  headerLeftSpacer: {
    width: 32,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  headerCloseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 16,
  },
  groupedCardBox: {
    borderWidth: 1,
    borderColor: '#B0B0B0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  inputRow: {
    paddingHorizontal: 14,
    height: 52,
    justifyContent: 'center',
  },
  fieldInput: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: '#222222',
    height: '100%',
  },
  groupDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  splitRow: {
    flexDirection: 'row',
    height: 52,
    alignItems: 'center',
  },
  splitColLeft: {
    flex: 1,
    paddingHorizontal: 14,
    height: '100%',
    justifyContent: 'center',
  },
  verticalDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#E0E0E0',
  },
  splitColRight: {
    flex: 1,
    paddingHorizontal: 14,
    height: '100%',
    justifyContent: 'center',
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    marginTop: 8,
  },
  countryDropdownContainer: {
    borderWidth: 1,
    borderColor: '#B0B0B0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countryTextCol: {
    gap: 2,
  },
  countryLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  countryValue: {
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    paddingHorizontal: 20,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    textDecorationLine: 'underline',
  },
  nextBtn: {
    backgroundColor: '#222222',
    paddingVertical: 13,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
