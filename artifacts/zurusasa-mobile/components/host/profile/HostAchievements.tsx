import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors, useTheme } from '@/hooks/useColors';

interface HostAchievementsProps {
  badges?: string[];
}

export function HostAchievements({ badges }: HostAchievementsProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const badgeList = badges && badges.length > 0 ? badges : [
    'Super Host',
    'Top Rated',
    '100+ Trips',
    'Fast Response',
    'Community Favorite',
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeading, { color: colors.text }]}>Host Achievements</Text>
      <View style={styles.badgeList}>
        {badgeList.map((badge, idx) => (
          <View
            key={idx}
            style={[
              styles.badgeRow,
              { backgroundColor: isDark ? '#2A1810' : '#FFFBF8', borderColor: isDark ? '#5C2D16' : '#FCE3D6' },
            ]}
          >
            <View style={styles.badgeIconWrap}>
              <Ionicons name="ribbon" size={16} color="#F26522" />
            </View>
            <Text style={[styles.badgeTitle, { color: colors.text }]}>{badge}</Text>
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
  badgeList: {
    gap: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBF8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCE3D6',
  },
  badgeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(242, 101, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
});
