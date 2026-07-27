import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { HostReviewRow } from '@/lib/supabase';

interface HostReviewsPreviewProps {
  averageRating: number;
  reviewsCount: number;
  reviews: HostReviewRow[];
}

export function HostReviewsPreview({
  averageRating,
  reviewsCount,
  reviews,
}: HostReviewsPreviewProps) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.ratingGroup}>
          <Ionicons name="star" size={20} color="#F26522" />
          <Text style={styles.ratingNumber}>
            {averageRating ? averageRating.toFixed(2) : '4.95'}
          </Text>
          <Text style={styles.dotSeparator}>·</Text>
          <Text style={styles.reviewCountText}>
            {reviewsCount} {reviewsCount === 1 ? 'Review' : 'Reviews'}
          </Text>
        </View>
      </View>

      {/* Review Cards */}
      <View style={styles.reviewsList}>
        {reviews.map((rev) => {
          const initials = rev.reviewer_name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

          return (
            <View key={rev.id} style={styles.reviewCard}>
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
                  <Text style={styles.reviewerName}>{rev.reviewer_name}</Text>
                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name="star"
                        size={12}
                        color={s <= rev.rating ? '#F26522' : '#EBEBEB'}
                      />
                    ))}
                  </View>
                </View>
              </View>

              <Text style={styles.commentText}>{rev.comment}</Text>
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
  commentText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#484848',
    lineHeight: 20,
  },
});
