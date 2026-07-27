import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import type { HostProfileData } from '@/lib/supabase';

interface HostStatsCardProps {
  host: HostProfileData;
}

export function HostStatsCard({ host }: HostStatsCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {/* Rating & Reviews */}
        <View style={styles.statCell}>
          <View style={styles.statHeaderRow}>
            <Ionicons name="star" size={16} color="#F26522" />
            <Text style={styles.statValue}>
              {host.average_rating ? host.average_rating.toFixed(2) : '4.95'}
            </Text>
          </View>
          <Text style={styles.statLabel}>
            {host.reviews_count ?? 112} {host.reviews_count === 1 ? 'Review' : 'Reviews'}
          </Text>
        </View>

        <View style={styles.dividerVertical} />

        {/* Trips Hosted */}
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{host.trips_hosted ?? 148}</Text>
          <Text style={styles.statLabel}>Trips Hosted</Text>
        </View>

        <View style={styles.dividerVertical} />

        {/* Years Hosting */}
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{host.years_hosting ?? 3}</Text>
          <Text style={styles.statLabel}>Years Hosting</Text>
        </View>
      </View>

      <View style={styles.dividerHorizontal} />

      <View style={styles.grid}>
        {/* Properties / Listings */}
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{host.properties_count ?? 4}</Text>
          <Text style={styles.statLabel}>Properties</Text>
        </View>

        <View style={styles.dividerVertical} />

        {/* Repeat Guests */}
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{host.repeat_guest_rate ?? '42%'}</Text>
          <Text style={styles.statLabel}>Repeat Guests</Text>
        </View>

        <View style={styles.dividerVertical} />

        {/* Response Rate */}
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{host.response_rate ?? '98%'}</Text>
          <Text style={styles.statLabel}>Response Rate</Text>
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
