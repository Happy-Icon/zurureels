import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import type { BookingRow } from '@/lib/supabase';
import { dateRange, ORANGE } from './reservationHelpers';
import { StatusPill } from './StatusPill';
import { reservationsStyles as styles } from './reservationsStyles';

export interface TripCardProps {
  booking: BookingRow;
  type: 'upcoming' | 'past' | 'cancelled';
  onViewBooking: () => void;
  onMessageHost?: () => void;
  onDirections?: () => void;
  onWriteReview?: () => void;
  onBookAgain?: () => void;
  onBookSimilar?: () => void;
}

export function TripCard({
  booking,
  type,
  onViewBooking,
  onMessageHost,
  onDirections,
  onWriteReview,
  onBookAgain,
  onBookSimilar,
}: TripCardProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const exp = booking.experience;
  const range = dateRange(booking);

  return (
    <Pressable
      onPress={onViewBooking}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        type === 'cancelled' && styles.cardCancelled,
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Trip to ${exp?.title ?? 'Coastal Stay'}, ${range || 'Dates set'}`}
    >
      {/* Cover Image */}
      <View style={[styles.cardImageWrap, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
        {exp?.image_url ? (
          <Image source={{ uri: exp.image_url }} style={styles.cardImage} contentFit="cover" />
        ) : (
          <View style={[styles.cardImage, styles.imageFallback, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
            <Feather name="image" size={24} color={colors.mutedForeground} />
          </View>
        )}

        <View style={styles.cardStatusPosition}>
          <StatusPill status={booking.status} />
        </View>
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {exp?.title ?? 'Coastal Stay'}
          </Text>
        </View>

        {exp?.location ? (
          <View style={styles.cardLocationRow}>
            <Feather name="map-pin" size={11} color={colors.mutedForeground} />
            <Text style={[styles.cardLocationText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {exp.location}
            </Text>
          </View>
        ) : null}

        <View style={styles.cardMetaRow}>
          <View style={styles.cardMetaItem}>
            <Feather name="calendar" size={11} color={colors.mutedForeground} />
            <Text style={[styles.cardMetaText, { color: colors.mutedForeground }]}>{range || 'Dates set'}</Text>
          </View>
          {booking.amount != null ? (
            <Text style={[styles.cardPriceText, { color: colors.text }]}>
              KES {Number(booking.amount).toLocaleString()}
            </Text>
          ) : null}
        </View>

        {/* Card Action Dock */}
        <View style={styles.cardActionsRow}>
          {type === 'upcoming' ? (
            <>
              {onMessageHost ? (
                <Pressable
                  onPress={(e) => { e.stopPropagation(); onMessageHost(); }}
                  style={[styles.cardSecondaryBtn, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}
                  accessibilityRole="button"
                  accessibilityLabel="Message host"
                >
                  <Feather name="message-square" size={13} color={colors.text} />
                  <Text style={[styles.cardSecondaryBtnText, { color: colors.text }]}>Host</Text>
                </Pressable>
              ) : null}
              {onDirections ? (
                <Pressable
                  onPress={(e) => { e.stopPropagation(); onDirections(); }}
                  style={[styles.cardSecondaryBtn, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}
                  accessibilityRole="button"
                  accessibilityLabel="Get directions"
                >
                  <Feather name="navigation" size={13} color={colors.text} />
                  <Text style={[styles.cardSecondaryBtnText, { color: colors.text }]}>Directions</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={onViewBooking}
                style={[styles.cardPrimaryBtn, { backgroundColor: colors.text }]}
                accessibilityRole="button"
                accessibilityLabel="View details"
              >
                <Text style={[styles.cardPrimaryBtnText, { color: colors.background }]}>Details</Text>
              </Pressable>
            </>
          ) : type === 'past' ? (
            <>
              {onWriteReview ? (
                <Pressable
                  onPress={(e) => { e.stopPropagation(); onWriteReview(); }}
                  style={styles.cardReviewBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Write review"
                >
                  <Feather name="star" size={13} color={ORANGE} />
                  <Text style={styles.cardReviewBtnText}>Write Review</Text>
                </Pressable>
              ) : null}
              {onBookAgain ? (
                <Pressable
                  onPress={(e) => { e.stopPropagation(); onBookAgain(); }}
                  style={[styles.cardPrimaryBtn, { backgroundColor: colors.text }]}
                  accessibilityRole="button"
                  accessibilityLabel="Book again"
                >
                  <Text style={[styles.cardPrimaryBtnText, { color: colors.background }]}>Book Again</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              <Pressable
                onPress={onViewBooking}
                style={[styles.cardSecondaryBtn, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}
                accessibilityRole="button"
                accessibilityLabel="Check refund status"
              >
                <Text style={[styles.cardSecondaryBtnText, { color: colors.text }]}>Refund Status</Text>
              </Pressable>
              {onBookSimilar ? (
                <Pressable
                  onPress={(e) => { e.stopPropagation(); onBookSimilar(); }}
                  style={[styles.cardPrimaryBtn, { backgroundColor: colors.text }]}
                  accessibilityRole="button"
                  accessibilityLabel="Book similar experience"
                >
                  <Text style={[styles.cardPrimaryBtnText, { color: colors.background }]}>Book Similar</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}
