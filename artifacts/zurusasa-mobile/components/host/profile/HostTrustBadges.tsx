import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { HostProfileData } from '@/lib/supabase';

interface HostTrustBadgesProps {
  host?: HostProfileData;
}

export function HostTrustBadges({ host }: HostTrustBadgesProps) {
  const isVerified = Boolean(host?.is_verified || host?.verification_status === 'verified');
  const hasPhone = Boolean(host?.phone);
  const hasEmail = Boolean(host?.email);

  const trustItems = [
    ...(isVerified
      ? [
          { icon: 'shield', label: 'Verified Identity' },
          { icon: 'file-text', label: 'Government ID Verified' },
        ]
      : []),
    ...(hasPhone ? [{ icon: 'phone', label: 'Phone Confirmed' }] : []),
    ...(hasEmail ? [{ icon: 'mail', label: 'Email Confirmed' }] : []),
    ...(host?.is_super_host ? [{ icon: 'award', label: 'Super Host' }] : []),
    { icon: 'zap', label: 'Fast Responder' },
  ];

  if (trustItems.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeading}>Verified Information</Text>
      <View style={styles.badgeGrid}>
        {trustItems.map((item, idx) => (
          <View key={idx} style={styles.badgeChip}>
            <View style={styles.iconCircle}>
              <Feather name={item.icon as any} size={14} color="#F26522" />
            </View>
            <Text style={styles.badgeLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9F9F9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(242, 101, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
});
