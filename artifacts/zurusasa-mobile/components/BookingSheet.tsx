import React from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';

import { CardPaymentModal } from '@/components/CardPaymentModal';
import { useBookingCheckout } from '@/hooks/useBookingCheckout';
import {
  BookingDatesStep,
  BookingEventTicketsStep,
  BookingOfferClaimStep,
} from '@/components/booking/BookingDatesStep';
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
    flowConfig,
    visitedPaymentStep,
    selectedTimeSlot,
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

  const handleBack = () => {
    if (step === 'confirm_pay') {
      setStep(visitedPaymentStep ? 'payment_method' : 'review');
    } else if (step === 'payment_method') {
      setStep('review');
    } else if (step === 'review') {
      setStep(
        flowConfig.kind === 'event'
          ? 'event_tickets'
          : flowConfig.kind === 'offer'
          ? 'offer_claim'
          : 'dates',
      );
    } else if (step === initialStep && initialStep !== 'details') {
      handleClose();
    } else {
      setStep('details');
    }
  };

  const headerTitle =
    step === 'dates'
      ? flowConfig.datesStepHeader
      : step === 'event_tickets'
      ? 'Select tickets'
      : step === 'offer_claim'
      ? 'Claim offer'
      : step === 'review'
      ? 'Review and continue'
      : 'Confirm and pay';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={[styles.root, { backgroundColor: isDark ? '#18181B' : '#FFFFFF' }]}>
        {/* ── TOP HEADER NAV ── */}
        {step !== 'details' ? (
          <View style={[styles.headerNav, { paddingTop: Platform.OS === 'ios' ? insets.top + 6 : 16 }]}>
            <Pressable onPress={handleBack} style={styles.headerBackBtn} hitSlop={12}>
              <Feather name="arrow-left" size={22} color="#111111" />
            </Pressable>

            {step === 'payment_method' ? (
              <View style={{ flex: 1 }} />
            ) : (
              <Text style={styles.headerTitle}>{headerTitle}</Text>
            )}

            {step === 'dates' || step === 'offer_claim' ? (
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
          {step === 'event_tickets' ? <BookingEventTicketsStep checkout={checkout} /> : null}
          {step === 'offer_claim' ? <BookingOfferClaimStep checkout={checkout} /> : null}
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
        checkIn={checkout.from}
        checkOut={checkout.to}
        guestSummary={checkout.guestSummary}
        totalAmount={checkout.totalAmount}
        paymentMethod={checkout.paymentMethod}
        flowConfig={flowConfig}
        timeSlot={selectedTimeSlot}
        onViewItinerary={handleViewItinerary}
        onClose={handleSuccessClose}
      />
    </Modal>
  );
}
