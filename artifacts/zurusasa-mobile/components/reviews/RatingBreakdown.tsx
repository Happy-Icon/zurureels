import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import type { ReviewSummaryData } from '@/services/reviewService';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

interface RatingBreakdownProps {
  summary: ReviewSummaryData;
}

export function RatingBreakdown({ summary }: RatingBreakdownProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const { averageRating, totalCount, ratingBreakdown, categoryAverages } = summary;

  const categories = [
    { label: 'Cleanliness', icon: 'sparkles', score: categoryAverages.cleanliness },
    { label: 'Accuracy', icon: 'check-circle', score: categoryAverages.accuracy },
    { label: 'Communication', icon: 'message-square', score: categoryAverages.communication },
    { label: 'Location', icon: 'map-pin', score: categoryAverages.location },
    { label: 'Check-in', icon: 'key', score: categoryAverages.checkIn },
    { label: 'Value', icon: 'tag', score: categoryAverages.value },
  ];

  return (
    <View style={styles.container}>
      {/* 1. Rating Summary Banner */}
      <View
        style={[
          styles.heroBanner,
          {
            backgroundColor: isDark ? '#27272A' : '#FFFBF8',
            borderColor: isDark ? '#3F3F46' : '#FCE3D6',
          },
        ]}
      >
        <View style={styles.heroLeft}>
          <Text style={[styles.heroRatingNumber, { color: colors.text }]}>
            {averageRating ? averageRating.toFixed(2) : '5.0'}
          </Text>
          <View style={styles.heroStarsRow}>
            <Ionicons name="star" size={16} color="#F26522" />
            <Text style={[styles.heroReviewCountText, { color: colors.mutedForeground }]}>
              Based on {totalCount} {totalCount === 1 ? 'review' : 'reviews'}
            </Text>
          </View>
        </View>

        {/* Rating Progress Bars (5★ to 1★) */}
        <View style={styles.progressStack}>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = ratingBreakdown[star as 1 | 2 | 3 | 4 | 5] || 0;
            const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;

            return (
              <View key={star} style={styles.barRow}>
                <Text style={[styles.starLabel, { color: colors.mutedForeground }]}>{star}★</Text>
                <View style={[styles.track, { backgroundColor: isDark ? '#3F3F46' : '#EBEBEB' }]}>
                  <View style={[styles.fillBar, { width: `${pct}%` }]} />
                </View>
                <Text style={[styles.countText, { color: colors.mutedForeground }]}>{count}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* 2. Category Averages Grid */}
      <View style={styles.categoriesGrid}>
        {categories.map((cat, idx) => (
          <View
            key={idx}
            style={[
              styles.categoryCell,
              {
                backgroundColor: isDark ? '#1E1E1E' : '#F9F9F9',
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.catHeader}>
              <Feather name={cat.icon as any} size={15} color={colors.mutedForeground} />
              <Text style={[styles.catLabel, { color: colors.mutedForeground }]}>{cat.label}</Text>
            </View>
            <Text style={[styles.catScore, { color: colors.text }]}>{cat.score.toFixed(1)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  heroBanner: {
    backgroundColor: '#FFFBF8',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FCE3D6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroLeft: {
    alignItems: 'center',
    gap: 6,
  },
  heroRatingNumber: {
    fontSize: 40,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    letterSpacing: -1,
  },
  heroStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroReviewCountText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  progressStack: {
    flex: 1,
    gap: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#717171',
    width: 20,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EBEBEB',
    overflow: 'hidden',
  },
  fillBar: {
    height: '100%',
    backgroundColor: '#F26522',
    borderRadius: 3,
  },
  countText: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    width: 16,
    textAlign: 'right',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCell: {
    width: '48%',
    backgroundColor: '#F9F9F9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  catScore: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
});
