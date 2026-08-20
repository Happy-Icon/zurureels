import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { FullReviewRow } from '@/lib/supabase';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { RatingStars } from '@/components/reviews/RatingStars';
import { ReviewPhotoViewer } from '@/components/reviews/ReviewPhotoViewer';

interface ReviewCardProps {
  review: FullReviewRow;
  onHelpful?: (reviewId: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Recently';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function ReviewCard({ review, onHelpful }: ReviewCardProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const reviewerName = review.reviewer?.full_name || 'Verified Traveler';
  const reviewerAvatar = review.reviewer?.avatar_url;
  const initials = reviewerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        {reviewerAvatar ? (
          <Image source={{ uri: reviewerAvatar }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: isDark ? '#27272A' : '#E5E7EB' }]}>
            <Text style={[styles.initialsText, { color: colors.text }]}>{initials}</Text>
          </View>
        )}

        <View style={styles.reviewerInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.nameText, { color: colors.text }]}>{reviewerName}</Text>
            {review.reviewer?.verification_status === 'verified' ? (
              <View style={styles.verifiedBadge}>
                <Feather name="check" size={10} color="#FFFFFF" />
              </View>
            ) : null}
          </View>

          <Text style={[styles.dateText, { color: colors.mutedForeground }]}>{formatDate(review.created_at)}</Text>
        </View>

        <RatingStars rating={review.rating} size={14} />
      </View>

      {/* Comment */}
      <Text style={[styles.commentText, { color: colors.text }]}>{review.comment}</Text>

      {/* Review Photos Gallery */}
      {review.photos && review.photos.length > 0 ? (
        <View style={styles.photosRow}>
          {review.photos.map((photo, idx) => (
            <Pressable key={idx} onPress={() => setSelectedPhoto(photo)}>
              <Image source={{ uri: photo }} style={styles.photoThumb} contentFit="cover" />
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Helpful Action Bar */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={() => onHelpful?.(review.id)}
          style={({ pressed }) => [
            styles.helpfulBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="thumbs-up" size={13} color="#717171" />
          <Text style={styles.helpfulText}>
            Helpful ({review.helpful_count || 0})
          </Text>
        </Pressable>
      </View>

      {/* Photo Full-screen Viewer */}
      <ReviewPhotoViewer
        visible={Boolean(selectedPhoto)}
        photoUrl={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F7F7F7',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  reviewerInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  commentText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#333333',
    lineHeight: 20,
  },
  photosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#F7F7F7',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  helpfulBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
  },
  helpfulText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
});
