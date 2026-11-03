import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import type { BookingRow } from '@/lib/supabase';
import { dateRange, daysUntilLabel } from './reservationHelpers';
import { StatusPill } from './StatusPill';
import { TripProgressTimeline } from './TripProgressTimeline';
import { reservationsStyles as styles } from './reservationsStyles';

export interface FeaturedNextTripCardProps {
  booking: BookingRow;
  onViewBooking: () => void;
  onMessageHost: () => void;
  onDirections: () => void;
}

export function FeaturedNextTripCard({
  booking,
  onViewBooking,
  onMessageHost,
  onDirections,
}: FeaturedNextTripCardProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const exp = booking.experience;
  const countdown = daysUntilLabel(booking.check_in);
  const range = dateRange(booking);

  return (
    <Pressable
      onPress={onViewBooking}
      style={({ pressed }) => [
        styles.heroCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Featured trip to ${exp?.title ?? 'Coastal Trip'}, ${range || 'Dates set'}`}
    >
      {/* High-res Image with Gradient Scrim */}
      <View style={styles.heroImageWrap}>
        {exp?.image_url ? (
          <Image
            source={{ uri: exp.image_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.imageFallback, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
            <Feather name="map-pin" size={32} color={colors.mutedForeground} />
          </View>
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)']}
          style={StyleSheet.absoluteFill}
        />

        {/* Countdown Banner */}
        {countdown ? (
          <View style={styles.heroCountdownBadge}>
            <Feather name="zap" size={12} color="#FFFFFF" />
            <Text style={styles.heroCountdownText}>{countdown}</Text>
          </View>
        ) : null}

        {/* Top Right Status */}
        <View style={styles.heroStatusWrap}>
          <StatusPill status={booking.status} />
        </View>

        {/* Hero Bottom Information Stack */}
        <View style={styles.heroInfoStack}>
          {exp?.location ? (
            <View style={styles.heroLocationRow}>
              <Feather name="map-pin" size={11} color="rgba(255,255,255,0.85)" />
              <Text style={styles.heroLocationText}>{exp.location}</Text>
            </View>
          ) : null}

          <Text style={styles.heroTitleText} numberOfLines={2}>
            {exp?.title ?? 'Coastal Trip'}
          </Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaItem}>
              <Feather name="calendar" size={12} color="rgba(255,255,255,0.85)" />
              <Text style={styles.heroMetaText}>{range || 'Dates set'}</Text>
            </View>
            <Text style={styles.heroMetaDot}>·</Text>
            <View style={styles.heroMetaItem}>
              <Feather name="users" size={12} color="rgba(255,255,255,0.85)" />
              <Text style={styles.heroMetaText}>
                {booking.guests ? `${booking.guests} Guest${booking.guests > 1 ? 's' : ''}` : '1 Guest'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Content Body: Timeline & Actions */}
      <View style={styles.heroBody}>
        {/* Timeline */}
        <TripProgressTimeline status={booking.status} checkIn={booking.check_in} />

        {/* Price & Action Dock */}
        <View style={[styles.heroDockRow, { borderTopColor: colors.border }]}>
          {booking.amount != null ? (
            <View style={styles.heroPriceBlock}>
              <Text style={[styles.heroPriceLabel, { color: colors.mutedForeground }]}>TOTAL PRICE</Text>
              <Text style={styles.heroPriceAmount}>
                KES {Number(booking.amount).toLocaleString()}
              </Text>
            </View>
          ) : null}

          <View style={styles.heroActionsRow}>
            <Pressable
              onPress={onMessageHost}
              style={({ pressed }) => [
                styles.heroIconBtn,
                { backgroundColor: isDark ? '#27272A' : '#F9FAFB', borderColor: colors.border },
                pressed && { opacity: 0.8 },
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Message Host"
            >
              <Feather name="message-square" size={16} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={onDirections}
              style={({ pressed }) => [
                styles.heroIconBtn,
                { backgroundColor: isDark ? '#27272A' : '#F9FAFB', borderColor: colors.border },
                pressed && { opacity: 0.8 },
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Get directions"
            >
              <Feather name="navigation" size={16} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={onViewBooking}
              style={({ pressed }) => [
                styles.heroPrimaryBtn,
                { backgroundColor: colors.text },
                pressed && { opacity: 0.88 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="View Itinerary"
            >
              <Text style={[styles.heroPrimaryBtnText, { color: colors.background }]}>View Itinerary</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
