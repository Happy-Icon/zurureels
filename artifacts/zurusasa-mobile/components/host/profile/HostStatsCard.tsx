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

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.grid}>
        {/* Rating & Reviews */}
        <View style={styles.statCell}>
          <View style={styles.statHeaderRow}>
            <Ionicons name="star" size={16} color="#F26522" />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {host.average_rating ? host.average_rating.toFixed(2) : '4.95'}
            </Text>
          </View>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            {host.reviews_count ?? 112} {host.reviews_count === 1 ? 'Review' : 'Reviews'}
          </Text>
        </View>

        <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />

        {/* Trips Hosted */}
        <View style={styles.statCell}>
          <Text style={[styles.statValue, { color: colors.text }]}>{host.trips_hosted ?? 148}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Trips Hosted</Text>
        </View>

        <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />

        {/* Years Hosting */}
        <View style={styles.statCell}>
          <Text style={[styles.statValue, { color: colors.text }]}>{host.years_hosting ?? 3}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Years Hosting</Text>
        </View>
      </View>

      <View style={[styles.dividerHorizontal, { backgroundColor: colors.border }]} />

      <View style={styles.grid}>
        {/* Properties / Listings */}
        <View style={styles.statCell}>
          <Text style={[styles.statValue, { color: colors.text }]}>{host.properties_count ?? 4}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Properties</Text>
        </View>

        <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />

        {/* Repeat Guests */}
        <View style={styles.statCell}>
          <Text style={[styles.statValue, { color: colors.text }]}>{host.repeat_guest_rate ?? '42%'}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Repeat Guests</Text>
        </View>

        <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />

        {/* Response Rate */}
        <View style={styles.statCell}>
          <Text style={[styles.statValue, { color: colors.text }]}>{host.response_rate ?? '98%'}</Text>
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
    gap: 2,
  },
  statHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  dividerVertical: {
    width: 1,
    height: 36,
    backgroundColor: '#EBEBEB',
  },
  dividerHorizontal: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginVertical: 12,
  },
});
