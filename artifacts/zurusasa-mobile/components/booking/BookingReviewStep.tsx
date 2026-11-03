import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import type { BookingCheckoutState } from '@/hooks/useBookingCheckout';
import { fmtRange } from './bookingHelpers';
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
    from,
    to,
    checkInTime,
    checkOutTime,
    guestSummary,
    units,
    priceUnit,
    price,
    totalAmount,
    cancellationPolicy,
    setStep,
  } = checkout;

  return (
    <View style={{ gap: 16 }}>
      {/* ── CARD 1: LISTING & TRIP DETAILS SUMMARY ── */}
      <View style={styles.mainCard}>
        {/* Top Listing Snippet */}
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

        {/* Dates Row */}
        <View style={styles.cardSectionRow}>
          <View style={styles.cardSectionLeft}>
            <Text style={styles.sectionLabel}>Dates</Text>
            <Text style={styles.sectionVal}>{from ? fmtRange(from, to) : 'Select dates'}</Text>
            <Text style={styles.sectionSub}>
              {checkInTime} check-in · {checkOutTime} check-out
            </Text>
          </View>
          <Pressable onPress={() => setStep('dates')} style={styles.changeBtn}>
            <Text style={styles.changeBtnText}>Change</Text>
          </Pressable>
        </View>

        <View style={styles.cardDivider} />

        {/* Guests Row */}
        <View style={styles.cardSectionRow}>
          <View style={styles.cardSectionLeft}>
            <Text style={styles.sectionLabel}>Guests</Text>
            <Text style={styles.sectionVal}>{guestSummary}</Text>
          </View>
          <Pressable onPress={() => setStep('dates')} style={styles.changeBtn}>
            <Text style={styles.changeBtnText}>Change</Text>
          </Pressable>
        </View>
      </View>

      {/* Price Details Card */}
      <View style={styles.cardContainer}>
        <Text style={styles.cardHeaderTitle}>Price details</Text>
        <View style={styles.cardItemRow}>
          <Text style={styles.cardItemLabel}>
            {units} {priceUnit}{units !== 1 ? 's' : ''} x KSh {price.toLocaleString()}.00
          </Text>
          <Text style={styles.cardItemVal}>KSh {totalAmount.toLocaleString()}.00</Text>
        </View>
        <View style={styles.cardItemRow}>
          <Text style={styles.cardItemLabel}>Service fee</Text>
          <Text style={styles.cardItemVal}>KSh 0.00</Text>
        </View>
        <View style={styles.cardDivider} />
        <View style={styles.cardTotalRow}>
          <Text style={styles.cardTotalLabel}>Total (KES)</Text>
          <Text style={styles.cardTotalVal}>KSh {totalAmount.toLocaleString()}.00</Text>
        </View>
      </View>

      {/* Cancellation Policy Card */}
      <View style={styles.cardContainer}>
        <Text style={styles.cardHeaderTitle}>Cancellation policy</Text>
        <Text style={styles.cardBodyText}>
          {cancellationPolicy === 'strict'
            ? 'Full refund if cancelled at least 7 days before check-in.'
            : cancellationPolicy === 'moderate'
            ? 'Full refund if cancelled at least 5 days before check-in.'
            : 'Free cancellation up to 24 hours before check-in.'}
        </Text>
      </View>
    </View>
  );
}
