import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import type { BookingCheckoutState } from '@/hooks/useBookingCheckout';
import { formatEventScheduleBadge } from '@/constants/taxonomy';
import { fmtRange, fmtShort } from './bookingHelpers';
import { bookingStyles as styles } from './bookingStyles';

interface BookingReviewStepProps {
  checkout: BookingCheckoutState;
}

export function BookingReviewStep({ checkout }: BookingReviewStepProps) {
  const {
    thumbnail,
    title,
    reviewCount,
    ratingVal,
    flowConfig,
    eventDetails,
    offerDetails,
    selectedTimeSlot,
    selectedTier,
    specialRequests,
    from,
    to,
    checkInTime,
    checkOutTime,
    guestSummary,
    units,
    priceUnit,
    price,
    originalOfferPrice,
    totalAmount,
    isFreeBooking,
    cancellationPolicy,
    setStep,
  } = checkout;

  const editStep =
    flowConfig.kind === 'event'
      ? 'event_tickets'
      : flowConfig.kind === 'offer'
      ? 'offer_claim'
      : 'dates';

  const scheduleMainText =
    flowConfig.kind === 'event'
      ? formatEventScheduleBadge(
          (eventDetails?.event_date as string | undefined) || from?.toISOString(),
          eventDetails?.start_time as string | undefined,
        )
      : flowConfig.isRangePicker
      ? from
        ? fmtRange(from, to)
        : 'Select dates'
      : from
      ? fmtShort(from)
      : 'Select date';

  const scheduleSubText =
    flowConfig.kind === 'event'
      ? [eventDetails?.start_time, eventDetails?.location].filter(Boolean).join(' · ') ||
        'Fixed event schedule'
      : flowConfig.isRangePicker
      ? `${checkInTime} check-in · ${checkOutTime} check-out`
      : selectedTimeSlot || (offerDetails?.applicable_schedule as string | undefined) || null;

  const totalSavings =
    originalOfferPrice && originalOfferPrice > price
      ? (originalOfferPrice - price) * units
      : null;

  return (
    <View style={{ gap: 16 }}>
      {/* ── CARD 1: LISTING & BOOKING SUMMARY ── */}
      <View style={styles.mainCard}>
        <View style={styles.listingSnippetRow}>
          <Image source={{ uri: thumbnail }} style={styles.listingThumb} contentFit="cover" />
          <View style={styles.listingSnippetMeta}>
            <Text style={styles.snippetTitle} numberOfLines={2}>
              {title}
            </Text>
            <View style={styles.snippetRatingRow}>
              {reviewCount > 0 ? (
                <>
                  <MaterialCommunityIcons name="star" size={13} color="#111111" />
                  <Text style={styles.snippetRatingText}>
                    {ratingVal.toFixed(1)} ({reviewCount})
                    {reviewCount >= 3 && ratingVal >= 4.7 ? (
                      <> · <MaterialCommunityIcons name="leaf" size={13} color="#111111" /> Guest favorite</>
                    ) : null}
                  </Text>
                </>
              ) : (
                <Text style={styles.snippetRatingText}>★ New listing</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.cardDivider} />

        {/* Schedule Row */}
        <View style={styles.cardSectionRow}>
          <View style={styles.cardSectionLeft}>
            <Text style={styles.sectionLabel}>{flowConfig.scheduleSectionLabel}</Text>
            <Text style={styles.sectionVal}>{scheduleMainText}</Text>
            {scheduleSubText ? (
              <Text style={styles.sectionSub}>{scheduleSubText}</Text>
            ) : null}
          </View>
          {flowConfig.kind !== 'event' ? (
            <Pressable onPress={() => setStep(editStep)} style={styles.changeBtn}>
              <Text style={styles.changeBtnText}>Change</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.cardDivider} />

        {/* Participants / Tickets / Party Row */}
        <View style={styles.cardSectionRow}>
          <View style={styles.cardSectionLeft}>
            <Text style={styles.sectionLabel}>{flowConfig.participantSectionLabel}</Text>
            <Text style={styles.sectionVal}>{guestSummary}</Text>
            {specialRequests.trim() ? (
              <Text style={styles.sectionSub} numberOfLines={2}>
                Note: {specialRequests.trim()}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={() => setStep(editStep)} style={styles.changeBtn}>
            <Text style={styles.changeBtnText}>Change</Text>
          </Pressable>
        </View>
      </View>

      {/* Price Details Card */}
      <View style={styles.cardContainer}>
        <Text style={styles.cardHeaderTitle}>Price details</Text>
        {isFreeBooking ? (
          <View style={styles.cardItemRow}>
            <Text style={styles.cardItemLabel}>
              {flowConfig.kind === 'event'
                ? 'Complimentary RSVP entry'
                : flowConfig.kind === 'offer'
                ? 'Free promotional voucher'
                : 'Complimentary table reservation'}
            </Text>
            <Text style={styles.cardItemVal}>KSh 0.00</Text>
          </View>
        ) : (
          <>
            {totalSavings && originalOfferPrice ? (
              <>
                <View style={styles.cardItemRow}>
                  <Text style={styles.cardItemLabel}>
                    Standard rate ({units} x KSh {originalOfferPrice.toLocaleString()})
                  </Text>
                  <Text style={[styles.cardItemVal, { textDecorationLine: 'line-through', color: '#9CA3AF' }]}>
                    KSh {(originalOfferPrice * units).toLocaleString()}.00
                  </Text>
                </View>
                <View style={styles.cardItemRow}>
                  <Text style={[styles.cardItemLabel, { color: '#059669' }]}>
                    Special offer savings
                  </Text>
                  <Text style={[styles.cardItemVal, { color: '#059669' }]}>
                    −KSh {totalSavings.toLocaleString()}.00
                  </Text>
                </View>
              </>
            ) : null}
            <View style={styles.cardItemRow}>
              <Text style={styles.cardItemLabel}>
                {selectedTier && flowConfig.kind === 'event'
                  ? `${units} x ${selectedTier.label} (KSh ${price.toLocaleString()})`
                  : `${units} ${priceUnit}${units !== 1 ? 's' : ''} x KSh ${price.toLocaleString()}.00`}
              </Text>
              <Text style={styles.cardItemVal}>KSh {totalAmount.toLocaleString()}.00</Text>
            </View>
            <View style={styles.cardItemRow}>
              <Text style={styles.cardItemLabel}>Guest service fee</Text>
              <Text style={styles.cardItemVal}>KSh 0.00</Text>
            </View>
          </>
        )}

        <View style={styles.cardDivider} />
        <View style={styles.cardTotalRow}>
          <Text style={styles.cardTotalLabel}>Total (KES)</Text>
          <Text style={styles.cardTotalVal}>
            {isFreeBooking ? 'FREE' : `KSh ${totalAmount.toLocaleString()}.00`}
          </Text>
        </View>
      </View>

      {/* Cancellation Policy Card */}
      <View style={styles.cardContainer}>
        <Text style={styles.cardHeaderTitle}>Cancellation policy</Text>
        <Text style={styles.cardBodyText}>
          {isFreeBooking
            ? 'Free to reserve or cancel anytime before arrival.'
            : cancellationPolicy === 'strict'
            ? `Full refund if cancelled at least 7 days before ${flowConfig.cancellationNoun}.`
            : cancellationPolicy === 'moderate'
            ? `Full refund if cancelled at least 5 days before ${flowConfig.cancellationNoun}.`
            : `Free cancellation up to 24 hours before ${flowConfig.cancellationNoun}.`}
        </Text>
      </View>
    </View>
  );
}
