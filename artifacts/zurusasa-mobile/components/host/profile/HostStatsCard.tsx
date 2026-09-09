import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors, useTheme } from '@/hooks/useColors';
import type { HostProfileData } from '@/lib/supabase';

interface HostStatsCardProps {
  host: HostProfileData;
}

export function HostStatsCard({ host }: HostStatsCardProps) {
  const colors = useColors();
  const { isDark } = useTheme();

  const hasReviews = Boolean(host.reviews_count && host.reviews_count > 0);
  const ratingText = hasReviews && host.average_rating ? host.average_rating.toFixed(1) : 'New';
  const reviewsLabel = hasReviews
    ? `${host.reviews_count} ${host.reviews_count === 1 ? 'Review' : 'Reviews'}`
    : 'No reviews yet';

  const yearsHostingText =
    host.years_hosting && host.years_hosting > 0
      ? `${host.years_hosting} ${host.years_hosting === 1 ? 'yr' : 'yrs'}`
      : '< 1 yr';

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.grid}>
        {/* Rating & Reviews */}
        <View style={styles.statCell}>
          <View style={styles.statHeaderRow}>
            <Ionicons
              name={hasReviews ? 'star' : 'star-outline'}
              size={15}
              color={hasReviews ? '#F26522' : colors.mutedForeground}
            />
            <Text style={[styles.statValue, { color: colors.text }]}>{ratingText}</Text>
          </View>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
            {reviewsLabel}
          </Text>
        </View>

        <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />

        {/* Trips Hosted */}
        <View style={styles.statCell}>
          <Text style={[styles.statValue, { color: colors.text }]}>{host.trips_hosted ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Trips Hosted</Text>
        </View>

        <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />

        {/* Years Hosting */}
        <View style={styles.statCell}>
          <Text style={[styles.statValue, { color: colors.text }]}>{yearsHostingText}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Hosting</Text>
        </View>
      </View>

      <View style={[styles.dividerHorizontal, { backgroundColor: colors.border }]} />

      <View style={styles.grid}>
        {/* Properties / Listings */}
        <View style={styles.statCell}>
          <Text style={[styles.statValue, { color: colors.text }]}>{host.properties_count ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            {host.properties_count === 1 ? 'Property' : 'Properties'}
          </Text>
        </View>

        <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />

        {/* Repeat Guests */}
        <View style={styles.statCell}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {host.repeat_guest_rate ?? '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Repeat Guests</Text>
        </View>

        <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />

        {/* Response Rate */}
        <View style={styles.statCell}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {host.response_rate ?? '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Response Rate</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    paddingVertical: 16,
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 3,
  },
  statHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
    textAlign: 'center',
  },
  dividerVertical: {
    width: 1,
    height: 32,
    backgroundColor: '#EBEBEB',
  },
  dividerHorizontal: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginVertical: 10,
  },
});
