import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { PremiumLoader } from '@/components/PremiumLoader';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { useColors, useTheme } from '@/hooks/useColors';
import type { BookingCheckoutState } from '@/hooks/useBookingCheckout';
import type { CategoryFlowConfig } from './categoryFlowConfig';
import { BRAND_ORANGE, addDays, fmtShort, formatPhoneForPrompt } from './bookingHelpers';
import { bookingStyles as styles } from './bookingStyles';

interface BookingBottomActionBarProps {
  bottomInset: number;
  checkout: BookingCheckoutState;
}

export function BookingBottomActionBar({ bottomInset, checkout }: BookingBottomActionBarProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const { showAlert } = useCustomAlert();

  const {
    user,
    exp,
    step,
    setStep,
    flowConfig,
    eventLifecycle,
    eventSalesClosed,
    offerExpired,
    isFreeBooking,
    continueFromReview,
    continueFromPaymentMethod,
    savingPaymentMethod,
    reviewCount,
    ratingVal,
    price,
    priceUnit,
    from,
    to,
    setTo,
    totalAmount,
    phase,
    busy,
    mpesaPhone,
    startPaymentFlow,
  } = checkout;

  const surfaceBg = isDark ? '#18181B' : '#FFFFFF';
  const inactiveSegColor = isDark ? '#27272A' : '#EBEBEB';

  const nextSelectionStep =
    flowConfig.kind === 'event'
      ? 'event_tickets'
      : flowConfig.kind === 'offer'
      ? 'offer_claim'
      : 'dates';

  const isSelectionStep =
    step === 'dates' || step === 'event_tickets' || step === 'offer_claim';

  const promoActionClosed = eventSalesClosed || offerExpired;
  const promoClosedLabel = offerExpired
    ? 'Offer Expired'
    : eventLifecycle?.isLive
    ? 'Event Live · Closed'
    : 'Event Ended';

  return (
    <View
      style={[
        styles.bottomStickyBar,
        {
          paddingBottom: bottomInset + 12,
          backgroundColor: surfaceBg,
          borderTopColor: colors.border,
        },
      ]}
    >
      {step === 'details' ? (
        /* Step 0: Listing Details Bottom Bar */
        <View style={styles.detailsBottomRow}>
          <View style={styles.detailsBottomPriceCol}>
            {isFreeBooking ? (
              <Text style={[styles.detailsBottomPriceVal, { color: colors.text }]}>
                {flowConfig.kind === 'event'
                  ? 'Free Entry'
                  : flowConfig.kind === 'offer'
                  ? 'Free Deal Pass'
                  : 'Free Table Booking'}
              </Text>
            ) : exp?.current_price != null ? (
              <Text style={[styles.detailsBottomPriceVal, { color: colors.text }]}>
                KES {Number(exp.current_price).toLocaleString()}
                <Text style={[styles.detailsBottomPriceUnit, { color: colors.mutedForeground }]}>
                  {' '}
                  / {exp.price_unit ?? 'night'}
                </Text>
              </Text>
            ) : (
              <Text style={[styles.detailsBottomPriceVal, { color: colors.text }]}>
                Add dates for prices
              </Text>
            )}
            <View style={styles.bottomRatingRow}>
              {reviewCount > 0 ? (
                <>
                  <MaterialCommunityIcons name="star" size={12} color={colors.text} />
                  <Text style={[styles.bottomRatingText, { color: colors.text }]}>
                    {ratingVal.toFixed(1)} ({reviewCount})
                  </Text>
                </>
              ) : (
                <Text style={[styles.bottomRatingText, { color: colors.text }]}>
                  ★ New listing
                </Text>
              )}
            </View>
          </View>

          <Pressable
            disabled={promoActionClosed}
            onPress={() => setStep(nextSelectionStep)}
            style={[
              styles.checkAvailabilityBtn,
              promoActionClosed
                ? {
                    backgroundColor: isDark ? '#3F3F46' : '#D1D5DB',
                    opacity: 0.55,
                  }
                : null,
            ]}
          >
            <Text
              style={[
                styles.checkAvailabilityBtnText,
                promoActionClosed ? { color: colors.mutedForeground } : null,
              ]}
            >
              {promoActionClosed ? promoClosedLabel : flowConfig.detailsCtaLabel}
            </Text>
          </Pressable>
        </View>
      ) : isSelectionStep ? (
        /* Step 1: Category Selection Bottom Bar (Dates / Event Tickets / Offer Claim) */
        <View style={styles.datesStickyRow}>
          <View style={styles.datesPriceCol}>
            <Text style={[styles.datesPriceMain, { color: colors.text }]}>
              {isFreeBooking ? (
                'Free'
              ) : (
                <>
                  KES {Number(price).toLocaleString()}
                  <Text style={[styles.datesPriceUnit, { color: colors.mutedForeground }]}>
                    {' '}
                    / {flowConfig.kind === 'event' ? 'ticket' : priceUnit}
                  </Text>
                </>
              )}
            </Text>
            <Text style={[styles.datesTotalSub, { color: colors.mutedForeground }]}>
              {isFreeBooking
                ? flowConfig.kind === 'dining'
                  ? 'No cover fee required'
                  : 'Instant confirmation'
                : flowConfig.isFixedDate || (from && (!flowConfig.isRangePicker || to))
                ? `KES ${totalAmount.toLocaleString()} total`
                : 'Pick date for total'}
            </Text>
          </View>
          <Pressable
            disabled={promoActionClosed}
            onPress={() => {
              if (promoActionClosed) return;
              if (!flowConfig.isFixedDate && !from) {
                showAlert({
                  title: flowConfig.isRangePicker ? 'Select Dates' : 'Select Date',
                  message: flowConfig.isRangePicker
                    ? 'Please pick your check-in and checkout dates.'
                    : 'Please pick a date to continue.',
                  icon: 'calendar',
                  variant: 'warning',
                });
                return;
              }
              if (from && (!to || !flowConfig.isRangePicker)) {
                setTo(addDays(from, 1));
              }
              setStep('review');
            }}
            style={[
              styles.orangeDatesReserveBtn,
              promoActionClosed
                ? {
                    backgroundColor: isDark ? '#3F3F46' : '#D1D5DB',
                    opacity: 0.55,
                  }
                : null,
            ]}
          >
            <Text
              style={[
                styles.orangeDatesReserveBtnText,
                promoActionClosed ? { color: colors.mutedForeground } : null,
              ]}
            >
              {offerExpired
                ? 'Offer Expired'
                : eventSalesClosed
                ? eventLifecycle?.isLive
                  ? 'Tickets Closed'
                  : 'Event Ended'
                : flowConfig.datesCtaLabel}
            </Text>
          </Pressable>
        </View>
      ) : step === 'review' ? (
        /* Step 2: Progress Indicator + Next (or Instant Confirm Free Booking) */
        <>
          <View style={styles.stepProgressBar}>
            <View style={[styles.stepSegment, styles.stepSegmentActive]} />
            <View style={[styles.stepSegment, styles.stepSegmentActive]} />
            {!isFreeBooking ? (
              <View style={[styles.stepSegment, { backgroundColor: inactiveSegColor }]} />
            ) : null}
          </View>
          {isFreeBooking ? (
            <Pressable
              onPress={startPaymentFlow}
              disabled={busy || promoActionClosed}
              style={({ pressed }) => [
                styles.orangePrimaryBtn,
                promoActionClosed
                  ? { backgroundColor: isDark ? '#3F3F46' : '#D1D5DB', opacity: 0.55 }
                  : { opacity: pressed || busy ? 0.88 : 1 },
              ]}
            >
              {busy ? (
                <PremiumLoader color="#FFFFFF" size={8} />
              ) : (
                <Text
                  style={[
                    styles.orangePrimaryBtnText,
                    promoActionClosed ? { color: colors.mutedForeground } : null,
                  ]}
                >
                  {promoActionClosed
                    ? promoClosedLabel
                    : flowConfig.kind === 'event'
                    ? 'Confirm Free RSVP'
                    : flowConfig.kind === 'offer'
                    ? 'Claim Free Voucher'
                    : 'Confirm Free Table'}
                </Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              disabled={promoActionClosed}
              onPress={continueFromReview}
              style={[
                styles.orangePrimaryBtn,
                promoActionClosed
                  ? { backgroundColor: isDark ? '#3F3F46' : '#D1D5DB', opacity: 0.55 }
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.orangePrimaryBtnText,
                  promoActionClosed ? { color: colors.mutedForeground } : null,
                ]}
              >
                {promoActionClosed ? promoClosedLabel : 'Next'}
              </Text>
            </Pressable>
          )}
        </>
      ) : step === 'payment_method' ? (
        /* Step 3: Add / Choose Payment Method Bottom Bar */
        <>
          <View style={styles.stepProgressBar}>
            <View style={[styles.stepSegment, styles.stepSegmentActive]} />
            <View style={[styles.stepSegment, styles.stepSegmentActive]} />
            <View style={[styles.stepSegment, styles.stepSegmentActive]} />
          </View>
          <Pressable
            disabled={savingPaymentMethod}
            onPress={() => {
              continueFromPaymentMethod();
            }}
            style={[styles.orangePrimaryBtn, savingPaymentMethod ? { opacity: 0.65 } : null]}
          >
            {savingPaymentMethod ? (
              <PremiumLoader color="#FFFFFF" size={8} />
            ) : (
              <Text style={styles.orangePrimaryBtnText}>Next</Text>
            )}
          </Pressable>
        </>
      ) : (
        /* Step 4: Confirm and Pay Button */
        <>
          {phase === 'pin' || phase === 'settling' ? (
            <View
              style={[
                styles.paymentProcessingBanner,
                {
                  backgroundColor: isDark ? 'rgba(242, 101, 34, 0.14)' : '#FFF7ED',
                  borderColor: isDark ? 'rgba(242, 101, 34, 0.35)' : '#FED7AA',
                },
              ]}
            >
              <PremiumLoader color={BRAND_ORANGE} size={6} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.paymentProcessingTopRow}>
                  <Text
                    style={[
                      styles.paymentProcessingHeader,
                      { color: isDark ? '#FDBA74' : '#9A3412' },
                    ]}
                  >
                    {phase === 'pin' ? 'Check your phone' : 'Confirming your payment…'}
                  </Text>
                  <View
                    style={[
                      styles.paymentProcessingPhasePill,
                      {
                        backgroundColor: isDark
                          ? 'rgba(242, 101, 34, 0.22)'
                          : 'rgba(242, 101, 34, 0.12)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.paymentProcessingPhaseText,
                        { color: isDark ? '#FB923C' : '#C2410C' },
                      ]}
                    >
                      {phase === 'pin' ? 'STK PROMPT' : 'VERIFYING'}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.paymentProcessingText,
                    { color: isDark ? '#FED7AA' : '#C2410C' },
                  ]}
                >
                  {phase === 'pin'
                    ? `Enter your M-Pesa PIN for ${formatPhoneForPrompt(
                        mpesaPhone || (user?.user_metadata?.phone as string) || user?.phone,
                      )} to complete your payment.`
                    : 'Connecting to payment provider to verify settlement…'}
                </Text>
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={startPaymentFlow}
            disabled={busy}
            style={({ pressed }) => [
              styles.orangePrimaryBtn,
              { opacity: pressed || busy ? 0.88 : 1 },
            ]}
          >
            {busy ? (
              <PremiumLoader color="#FFFFFF" size={8} />
            ) : (
              <Text style={styles.orangePrimaryBtnText}>Confirm and pay</Text>
            )}
          </Pressable>

          <Text style={[styles.agreeTermsFooterText, { color: colors.mutedForeground }]}>
            By selecting the button, I agree to the <Text style={styles.termsUnderline}>booking terms</Text>.
          </Text>
        </>
      )}
    </View>
  );
}

interface BookingSuccessModalProps {
  visible: boolean;
  title: string;
  bottomInset: number;
  checkIn?: Date;
  checkOut?: Date;
  guestSummary?: string;
  totalAmount?: number;
  paymentMethod?: 'mpesa' | 'card';
  bookingMode?: 'instant' | 'approval_required' | null;
  flowConfig?: CategoryFlowConfig;
  timeSlot?: string;
  onViewItinerary: () => void;
  onClose: () => void;
}

const DISMISS_OFFSET = 520;

export function BookingSuccessModal({
  visible,
  title,
  bottomInset,
  checkIn,
  checkOut,
  guestSummary,
  totalAmount,
  paymentMethod,
  bookingMode,
  flowConfig,
  timeSlot,
  onViewItinerary,
  onClose,
}: BookingSuccessModalProps) {
  const colors = useColors();
  const { isDark } = useTheme();

  const [isRendered, setIsRendered] = useState(visible);
  const translateY = useRef(new Animated.Value(DISMISS_OFFSET)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0.55)).current;
  const isClosing = useRef(false);

  const openSheet = useCallback(() => {
    isClosing.current = false;
    setIsRendered(true);
    translateY.setValue(DISMISS_OFFSET);
    backdropOpacity.setValue(0);
    badgeScale.setValue(0.55);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 210,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 22,
        stiffness: 220,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.spring(badgeScale, {
        toValue: 1,
        damping: 12,
        stiffness: 220,
        mass: 0.7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, badgeScale, translateY]);

  const dismissSheet = useCallback(
    (afterDismiss?: () => void) => {
      if (isClosing.current) return;
      isClosing.current = true;

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: DISMISS_OFFSET,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsRendered(false);
        isClosing.current = false;
        afterDismiss?.();
      });
    },
    [backdropOpacity, translateY],
  );

  const snapBack = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 22,
        stiffness: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, translateY]);

  useEffect(() => {
    if (visible) {
      openSheet();
    } else if (isRendered && !isClosing.current) {
      dismissSheet();
    }
  }, [visible, isRendered, openSheet, dismissSheet]);

  const handleDragMove = useCallback(
    (dy: number) => {
      const clamped = Math.max(-18, dy);
      translateY.setValue(clamped > 0 ? clamped : clamped * 0.25);
      const progress = Math.max(0, Math.min(1, 1 - clamped / 340));
      backdropOpacity.setValue(progress);
    },
    [backdropOpacity, translateY],
  );

  const handleDragRelease = useCallback(
    (dy: number, vy: number) => {
      if (dy > 65 || (dy > 18 && vy > 0.35)) {
        dismissSheet(onClose);
      } else {
        snapBack();
      }
    },
    [dismissSheet, onClose, snapBack],
  );

  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => handleDragMove(g.dy),
        onPanResponderRelease: (_, g) => handleDragRelease(g.dy, g.vy),
        onPanResponderTerminate: () => {
          if (!isClosing.current) snapBack();
        },
      }),
    [handleDragMove, handleDragRelease, snapBack],
  );

  const cardPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          g.dy > 6 && g.dy > Math.abs(g.dx) * 1.15,
        onMoveShouldSetPanResponderCapture: (_, g) =>
          g.dy > 6 && g.dy > Math.abs(g.dx) * 1.15,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => handleDragMove(g.dy),
        onPanResponderRelease: (_, g) => handleDragRelease(g.dy, g.vy),
        onPanResponderTerminate: () => {
          if (!isClosing.current) snapBack();
        },
      }),
    [handleDragMove, handleDragRelease, snapBack],
  );

  if (!isRendered) return null;

  const isRange = flowConfig ? flowConfig.isRangePicker : true;
  const datesLabel = checkIn
    ? isRange && checkOut
      ? `${fmtShort(checkIn)} – ${fmtShort(checkOut)}`
      : `${fmtShort(checkIn)}${timeSlot ? ` · ${timeSlot}` : ''}`
    : null;
  const hasSummary = Boolean(datesLabel || guestSummary || totalAmount != null);
  const isFree = totalAmount === 0;

  return (
    <Modal
      visible={isRendered}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => dismissSheet(onClose)}
    >
      <View style={styles.successModalBackdrop}>
        <Animated.View
          style={[
            styles.successModalBackdropFill,
            {
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.56)',
              opacity: backdropOpacity,
            },
          ]}
        >
          <Pressable
            style={StyleSheetFill}
            onPress={() => dismissSheet(onClose)}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.successModalCard,
            {
              backgroundColor: colors.card,
              borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              paddingBottom: Math.max(bottomInset, 20) + 16,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Interactive Drag Handle Pill */}
          <View
            style={styles.successDragHandleArea}
            {...handlePanResponder.panHandlers}
            collapsable={false}
          >
            <View
              style={[
                styles.successDragHandle,
                { backgroundColor: isDark ? '#3F3F46' : '#D1D5DB' },
              ]}
            />
          </View>

          <View
            style={{ width: '100%', alignItems: 'center' }}
            {...cardPanResponder.panHandlers}
            collapsable={false}
          >
            {/* Concentric Emerald Success Indicator */}
            <Animated.View
              style={[
                styles.successBadgeWrap,
                { transform: [{ scale: badgeScale }] },
              ]}
            >
              <View
                style={[
                  styles.successHalo,
                  {
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5',
                    borderColor: isDark ? 'rgba(16, 185, 129, 0.32)' : '#A7F3D0',
                  },
                ]}
              >
                <View style={styles.successCircle}>
                  <Feather name="check" size={30} color="#FFFFFF" />
                </View>
              </View>
            </Animated.View>

            {/* Status Pill */}
            <View
              style={[
                styles.successStatusPill,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5',
                },
              ]}
            >
              <Text
                style={[
                  styles.successStatusPillText,
                  { color: isDark ? '#34D399' : '#047857' },
                ]}
              >
                {bookingMode === 'approval_required'
                  ? 'PAYMENT RECEIVED · AWAITING HOST'
                  : (flowConfig?.successStatusPill ?? 'RESERVATION SECURED')}
              </Text>
            </View>

            {/* Title & Description */}
            <Text style={[styles.successModalTitle, { color: colors.foreground }]}>
              {bookingMode === 'approval_required'
                ? 'Request Sent & Paid!'
                : (flowConfig?.successHeadline ?? 'Booking Confirmed!')}
            </Text>
            <Text style={[styles.successModalSub, { color: colors.mutedForeground }]}>
              {flowConfig?.successVerbPhrase ?? 'Your stay at'}{' '}
              <Text style={[styles.successModalListingName, { color: colors.foreground }]}>
                {title}
              </Text>{' '}
              {bookingMode === 'approval_required'
                ? 'has been paid and sent to the host for confirmation.'
                : 'is confirmed and locked in.'}
            </Text>

            {/* Structured Reservation Summary Card */}
            {hasSummary ? (
              <View
                style={[
                  styles.successSummaryCard,
                  {
                    backgroundColor: isDark ? '#1F2024' : '#F9FAFB',
                    borderColor: colors.border,
                  },
                ]}
              >
                {(datesLabel || guestSummary) ? (
                  <View style={styles.successSummaryRow}>
                    {datesLabel ? (
                      <View style={styles.successSummaryCol}>
                        <Text
                          style={[
                            styles.successSummaryLabel,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {(flowConfig?.scheduleSectionLabel ?? 'DATES').toUpperCase()}
                        </Text>
                        <Text
                          style={[styles.successSummaryValue, { color: colors.foreground }]}
                          numberOfLines={1}
                        >
                          {datesLabel}
                        </Text>
                      </View>
                    ) : null}
                    {guestSummary ? (
                      <View
                        style={[
                          styles.successSummaryCol,
                          datesLabel ? { alignItems: 'flex-end' } : undefined,
                        ]}
                      >
                        <Text
                          style={[
                            styles.successSummaryLabel,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {(flowConfig?.participantSectionLabel ?? 'GUESTS').toUpperCase()}
                        </Text>
                        <Text
                          style={[styles.successSummaryValue, { color: colors.foreground }]}
                          numberOfLines={1}
                        >
                          {guestSummary}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {totalAmount != null ? (
                  <>
                    {(datesLabel || guestSummary) ? (
                      <View
                        style={[
                          styles.successSummaryDivider,
                          { backgroundColor: colors.border },
                        ]}
                      />
                    ) : null}
                    <View style={styles.successSummaryRow}>
                      <View style={styles.successSummaryCol}>
                        <Text
                          style={[
                            styles.successSummaryLabel,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {isFree ? 'TOTAL DUE' : 'TOTAL PAID'}
                        </Text>
                        <Text
                          style={[styles.successSummaryValue, { color: BRAND_ORANGE }]}
                        >
                          {isFree ? 'FREE' : `KES ${Number(totalAmount).toLocaleString()}`}
                        </Text>
                      </View>
                      {paymentMethod ? (
                        <View style={[styles.successSummaryCol, { alignItems: 'flex-end' }]}>
                          <Text
                            style={[
                              styles.successSummaryLabel,
                              { color: colors.mutedForeground },
                            ]}
                          >
                            PAYMENT
                          </Text>
                          <Text
                            style={[styles.successSummaryValue, { color: colors.foreground }]}
                          >
                            {isFree ? 'Free Pass' : paymentMethod === 'card' ? 'Card' : 'M-Pesa'}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </>
                ) : null}

                <View
                  style={[
                    styles.successSummaryDivider,
                    { backgroundColor: colors.border },
                  ]}
                />

                <View style={styles.successEscrowRow}>
                  <Feather name="shield" size={14} color="#10B981" />
                  <Text
                    style={[
                      styles.successEscrowText,
                      { color: isDark ? '#6EE7B7' : '#065F46' },
                    ]}
                  >
                    {isFree
                      ? 'Instant digital reservation pass added to Trips'
                      : flowConfig?.escrowText ?? 'Protected in ZuruSasa Escrow until check-in'}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Action Buttons */}
            <View style={styles.successActionsCol}>
              <Pressable
                onPress={() => dismissSheet(onViewItinerary)}
                style={({ pressed }) => [
                  styles.successPrimaryBtn,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
                ]}
                hitSlop={8}
              >
                <Text style={styles.successPrimaryBtnText}>View Itinerary</Text>
              </Pressable>

              <Pressable
                onPress={() => dismissSheet(onClose)}
                style={({ pressed }) => [
                  styles.successSecondaryBtn,
                  {
                    backgroundColor: isDark ? '#27272A' : '#F3F4F6',
                    borderColor: colors.border,
                  },
                  pressed && { opacity: 0.78 },
                ]}
                hitSlop={8}
              >
                <Text style={[styles.successSecondaryBtnText, { color: colors.foreground }]}>
                  Done
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const StyleSheetFill = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};
