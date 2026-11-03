import React from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { PremiumLoader } from '@/components/PremiumLoader';
import type { BookingCheckoutState } from '@/hooks/useBookingCheckout';
import { BRAND_ORANGE, addDays, formatPhoneForPrompt } from './bookingHelpers';
import { bookingStyles as styles } from './bookingStyles';

interface BookingBottomActionBarProps {
  bottomInset: number;
  checkout: BookingCheckoutState;
}

export function BookingBottomActionBar({ bottomInset, checkout }: BookingBottomActionBarProps) {
  const {
    user,
    exp,
    step,
    setStep,
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

  return (
    <View style={[styles.bottomStickyBar, { paddingBottom: bottomInset + 12 }]}>
      {step === 'details' ? (
        /* Step 0: Listing Details Bottom Bar */
        <View style={styles.detailsBottomRow}>
          <View style={styles.detailsBottomPriceCol}>
            {exp?.current_price != null ? (
              <Text style={styles.detailsBottomPriceVal}>
                KES {Number(exp.current_price).toLocaleString()}
                <Text style={styles.detailsBottomPriceUnit}> / {exp.price_unit ?? 'night'}</Text>
              </Text>
            ) : (
              <Text style={styles.detailsBottomPriceVal}>Add dates for prices</Text>
            )}
            <View style={styles.bottomRatingRow}>
              {reviewCount > 0 ? (
                <>
                  <MaterialCommunityIcons name="star" size={12} color="#111111" />
                  <Text style={styles.bottomRatingText}>{ratingVal.toFixed(1)} ({reviewCount})</Text>
                </>
              ) : (
                <Text style={styles.bottomRatingText}>★ New listing</Text>
              )}
            </View>
          </View>

          <Pressable onPress={() => setStep('dates')} style={styles.checkAvailabilityBtn}>
            <Text style={styles.checkAvailabilityBtnText}>Check availability</Text>
          </Pressable>
        </View>
      ) : step === 'dates' ? (
        /* Step 1: Dates Bottom Bar */
        <View style={styles.datesStickyRow}>
          <View style={styles.datesPriceCol}>
            <Text style={styles.datesPriceMain}>
              KES {Number(price).toLocaleString()}
              <Text style={styles.datesPriceUnit}> / {priceUnit}</Text>
            </Text>
            <Text style={styles.datesTotalSub}>
              {from && to ? `KES ${totalAmount.toLocaleString()} total` : 'Add dates for total'}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              if (!from) {
                Alert.alert('Select Dates', 'Please pick your check-in and checkout dates.');
                return;
              }
              if (!to) {
                setTo(addDays(from, 1));
              }
              setStep('review');
            }}
            style={styles.orangeDatesReserveBtn}
          >
            <Text style={styles.orangeDatesReserveBtnText}>Reserve</Text>
          </Pressable>
        </View>
      ) : step === 'review' ? (
        /* Step 2: Progress Indicator + Orange Next Button */
        <>
          <View style={styles.stepProgressBar}>
            <View style={[styles.stepSegment, styles.stepSegmentActive]} />
            <View style={[styles.stepSegment, styles.stepSegmentActive]} />
            <View style={styles.stepSegment} />
          </View>
          <Pressable onPress={() => setStep('payment_method')} style={styles.orangePrimaryBtn}>
            <Text style={styles.orangePrimaryBtnText}>Next</Text>
          </Pressable>
        </>
      ) : step === 'payment_method' ? (
        /* Step 3: Add Payment Method Bottom Bar (Progress Indicator + Orange Next Button) */
        <>
          <View style={styles.stepProgressBar}>
            <View style={[styles.stepSegment, styles.stepSegmentActive]} />
            <View style={[styles.stepSegment, styles.stepSegmentActive]} />
            <View style={[styles.stepSegment, styles.stepSegmentActive]} />
          </View>
          <Pressable
            onPress={() => {
              setStep('confirm_pay');
            }}
            style={styles.orangePrimaryBtn}
          >
            <Text style={styles.orangePrimaryBtnText}>Next</Text>
          </Pressable>
        </>
      ) : (
        /* Step 4: Confirm and Pay Button */
        <>
          {phase === 'pin' || phase === 'settling' ? (
            <View style={styles.paymentProcessingBanner}>
              <PremiumLoader color={BRAND_ORANGE} size={6} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.paymentProcessingHeader}>
                  {phase === 'pin' ? 'Check your phone' : 'Confirming your payment…'}
                </Text>
                <Text style={styles.paymentProcessingText}>
                  {phase === 'pin'
                    ? `Enter your M-Pesa PIN for ${formatPhoneForPrompt(mpesaPhone || (user?.user_metadata?.phone as string) || user?.phone)} to complete your payment.`
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

          <Text style={styles.agreeTermsFooterText}>
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
  onViewItinerary: () => void;
  onClose: () => void;
}

export function BookingSuccessModal({
  visible,
  title,
  bottomInset,
  onViewItinerary,
  onClose,
}: BookingSuccessModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.successModalBackdrop}>
        <Pressable style={styles.successModalDismissArea} onPress={onClose} />

        <View style={[styles.successModalCard, { paddingBottom: Math.max(bottomInset, 20) + 16 }]}>
          {/* Green Circular Success Indicator */}
          <View style={styles.successBadgeWrap}>
            <View style={styles.successHalo}>
              <View style={styles.successCircle}>
                <Feather name="check" size={32} color="#FFFFFF" />
              </View>
            </View>
          </View>

          {/* Title & Description */}
          <Text style={styles.successModalTitle}>Booking Confirmed!</Text>
          <Text style={styles.successModalSub}>
            Your stay at <Text style={styles.successModalListingName}>{title}</Text> is secured. Your payment is held safely in escrow.
          </Text>

          {/* Action Buttons */}
          <View style={styles.successActionsCol}>
            {/* Primary CTA: View Itinerary */}
            <Pressable
              onPress={onViewItinerary}
              style={({ pressed }) => [
                styles.successPrimaryBtn,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
              hitSlop={8}
            >
              <Text style={styles.successPrimaryBtnText}>View Itinerary</Text>
            </Pressable>

            {/* Secondary Action: Done */}
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.successSecondaryBtn,
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={8}
            >
              <Text style={styles.successSecondaryBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
