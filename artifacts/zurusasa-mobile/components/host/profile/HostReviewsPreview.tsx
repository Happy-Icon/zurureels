import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useColors, useTheme } from '@/hooks/useColors';
import type { HostReviewRow } from '@/lib/supabase';

interface HostReviewsPreviewProps {
  averageRating?: number;
  reviewsCount?: number;
  reviews: HostReviewRow[];
}

export function HostReviewsPreview({
  averageRating,
  reviewsCount = 0,
  reviews,
}: HostReviewsPreviewProps) {
  const colors = useColors();
  const { isDark } = useTheme();

  const hasReviews = reviewsCount > 0 && reviews.length > 0;

  if (!hasReviews) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Reviews</Text>
        </View>

        <View
          style={[
            styles.emptyCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.emptyIconCircle,
              { backgroundColor: isDark ? '#2A1810' : '#FFF3EB' },
            ]}
          >
            <Feather name="message-square" size={22} color="#F26522" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No reviews yet</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Reviews from guests who complete a booking with this host will appear here.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.ratingGroup}>
          <Ionicons name="star" size={20} color="#F26522" />
          <Text style={[styles.ratingNumber, { color: colors.text }]}>
            {averageRating ? averageRating.toFixed(1) : '—'}
          </Text>
          <Text style={[styles.dotSeparator, { color: colors.mutedForeground }]}>·</Text>
          <Text style={[styles.reviewCountText, { color: colors.text }]}>
            {reviewsCount} {reviewsCount === 1 ? 'Review' : 'Reviews'}
          </Text>
        </View>
      </View>

      {/* Real Review Cards */}
      <View style={styles.reviewsList}>
        {reviews.map((rev) => {
          const initials = rev.reviewer_name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase() || 'G';

          const reviewDate = rev.created_at
            ? new Date(rev.created_at).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })
            : null;

          return (
            <View
              key={rev.id}
              style={[
                styles.reviewCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.reviewerHeader}>
                {rev.reviewer_avatar ? (
                  <Image
                    source={{ uri: rev.reviewer_avatar }}
                    style={styles.reviewerAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.reviewerFallback}>
                    <Text style={styles.initialsText}>{initials}</Text>
                  </View>
                )}

                <View style={styles.reviewerMeta}>
                  <Text style={[styles.reviewerName, { color: colors.text }]}>
                    {rev.reviewer_name}
                  </Text>
                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name="star"
                        size={12}
                        color={s <= rev.rating ? '#F26522' : isDark ? '#333' : '#EBEBEB'}
                      />
                    ))}
                    {reviewDate ? (
                      <Text style={[styles.reviewDate, { color: colors.mutedForeground }]}>
                        · {reviewDate}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>

              <Text style={[styles.commentText, { color: colors.text }]}>{rev.comment}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  ratingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingNumber: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  dotSeparator: {
    fontSize: 18,
    color: '#717171',
  },
  reviewCountText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  reviewsList: {
    gap: 12,
  },
  reviewCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    gap: 10,
  },
  reviewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBEBEB',
  },
  reviewerFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  reviewerMeta: {
    gap: 2,
  },
  reviewerName: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewDate: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    marginLeft: 4,
  },
  commentText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 20,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    alignItems: 'center',
    gap: 8,
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    marginTop: 2,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
});
