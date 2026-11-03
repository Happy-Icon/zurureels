import React from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

import { CardPaymentModal } from '@/components/CardPaymentModal';
import { useBookingCheckout } from '@/hooks/useBookingCheckout';
import { BookingDatesStep } from '@/components/booking/BookingDatesStep';
import { BookingDetailsStep } from '@/components/booking/BookingDetailsStep';
import {
  BookingConfirmPayStep,
  BookingPaymentMethodStep,
} from '@/components/booking/BookingPaymentSteps';
import { BookingReviewStep } from '@/components/booking/BookingReviewStep';
import {
  BookingBottomActionBar,
  BookingSuccessModal,
} from '@/components/booking/BookingStatusModals';
import type { BookingSheetProps } from '@/components/booking/bookingHelpers';
import { bookingStyles as styles } from '@/components/booking/bookingStyles';

export type {
  BookingSheetProps,
  GuestCounts,
  PaymentMethod,
  Phase,
  Step,
} from '@/components/booking/bookingHelpers';

export function BookingSheet({
  reel,
  visible,
  onClose,
  initialStep = 'details',
  onSuccess,
}: BookingSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { isDark } = useTheme();
  const checkout = useBookingCheckout({
    reel,
    visible,
    onClose,
    initialStep,
    onSuccess,
  });

  const {
    step,
    setStep,
    setFrom,
    setTo,
    title,
    totalAmount,
    cardModalVisible,
    setCardModalVisible,
    successModalVisible,
    handleClose,
    handleCardConfirmed,
    handleViewItinerary,
    handleSuccessClose,
  } = checkout;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={[styles.root, { backgroundColor: isDark ? '#18181B' : '#FFFFFF' }]}>
        {/* ── TOP HEADER NAV (Visible on Steps: dates, review, payment_method, confirm_pay) ── */}
        {step !== 'details' ? (
          <View style={[styles.headerNav, { paddingTop: Platform.OS === 'ios' ? insets.top + 6 : 16 }]}>
            <Pressable
              onPress={() => {
                if (step === 'confirm_pay') setStep('payment_method');
                else if (step === 'payment_method') setStep('review');
                else if (step === 'review') setStep('dates');
                else if (step === 'dates') setStep('details');
              }}
              style={styles.headerBackBtn}
              hitSlop={12}
            >
              <Feather name="arrow-left" size={22} color="#111111" />
            </Pressable>

            {step === 'payment_method' ? (
              <View style={{ flex: 1 }} />
            ) : (
              <Text style={styles.headerTitle}>
                {step === 'dates'
                  ? 'Select dates & guests'
                  : step === 'review'
                  ? 'Review and continue'
                  : 'Confirm and pay'}
              </Text>
            )}

            {step === 'dates' ? (
              <Pressable
                onPress={() => {
                  setFrom(undefined);
                  setTo(undefined);
                }}
                hitSlop={12}
              >
                <Text style={styles.clearDatesText}>Clear</Text>
              </Pressable>
            ) : (
              <Pressable onPress={handleClose} style={styles.headerCloseBtn} hitSlop={12}>
                <Feather name="x" size={22} color="#111111" />
              </Pressable>
            )}
          </View>
        ) : null}

        {/* ── SCROLLABLE CONTENT ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            step === 'details' && { paddingHorizontal: 0, paddingTop: 0 },
            { paddingBottom: insets.bottom + 120 },
          ]}
        >
          {step === 'details' ? (
            <BookingDetailsStep reel={reel} topInset={insets.top} checkout={checkout} />
          ) : null}
          {step === 'dates' ? <BookingDatesStep checkout={checkout} /> : null}
          {step === 'review' ? <BookingReviewStep checkout={checkout} /> : null}
          {step === 'payment_method' ? <BookingPaymentMethodStep checkout={checkout} /> : null}
          {step === 'confirm_pay' ? <BookingConfirmPayStep checkout={checkout} /> : null}
        </ScrollView>

        {/* ── STICKY BOTTOM ACTION BAR ── */}
        <BookingBottomActionBar bottomInset={insets.bottom} checkout={checkout} />
      </View>

      {/* ── SECURE HOSTED CARD CHECKOUT MODAL ── */}
      <CardPaymentModal
        visible={cardModalVisible}
        onClose={() => setCardModalVisible(false)}
        amount={totalAmount}
        experienceTitle={title}
        onConfirmPay={handleCardConfirmed}
      />

      {/* ── SUCCESS CONFIRMATION MODAL / BOTTOM SHEET ── */}
      <BookingSuccessModal
        visible={successModalVisible}
        title={title}
        bottomInset={insets.bottom}
        onViewItinerary={handleViewItinerary}
        onClose={handleSuccessClose}
      />
    </Modal>
  );
}
