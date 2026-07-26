import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { useReelInteractions, useToggleSave } from '@/lib/queries';
import type { ReelRow } from '@/lib/supabase';

interface ReelGridCardProps {
  reel: ReelRow;
  width: number;
  onOpen: () => void;
}

export function ReelGridCard({ reel, width, onOpen }: ReelGridCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const toggleSave = useToggleSave();

  const exp = reel.experience;
  const meta = (exp?.metadata ?? {}) as Record<string, unknown>;
  const rating = Number((meta.rating as number | string | undefined) ?? 5.0);
  const category = (reel.category ?? 'Reel').toUpperCase().replace(/_/g, ' ');

  const hostId = reel.user_id ?? null;
  const { data: inter } = useReelInteractions(reel.id, hostId, user?.id, true);
  const saved = inter?.saved ?? false;

  const onSave = () => {
    if (!user) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push('/auth');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleSave.mutate({ reelId: reel.id, userId: user.id, saved });
  };

  const imageHeight = width * 1.25; // 4:5 aspect ratio

  return (
    <Pressable
      testID={`grid-card-${reel.id}`}
      onPress={onOpen}
      style={[styles.cardContainer, { width }]}
    >
      {/* High-res 4:5 Rounded Image Container */}
      <View style={[styles.imageWrap, { width, height: imageHeight }]}>
        {reel.thumbnail_url ? (
          <Image
            source={{ uri: reel.thumbnail_url }}
            style={styles.image}
            contentFit="cover"
          />
        ) : (
          <View style={styles.imageFallback}>
            <Feather name="film" size={24} color="#717171" />
          </View>
        )}

        {/* Top Left: Category Badge in Blurred Glass */}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{category}</Text>
        </View>

        {/* Top Right: Floating Wishlist Heart Icon */}
        <Pressable
          testID={`grid-save-${reel.id}`}
          onPress={onSave}
          hitSlop={8}
          style={styles.heartCircleBtn}
        >
          <Ionicons
            name={saved ? 'heart' : 'heart-outline'}
            size={18}
            color={saved ? '#EE7D30' : '#222222'}
          />
        </Pressable>
      </View>

      {/* Text Information Below Image Container */}
      <View style={styles.textMetaStack}>
        <View style={styles.titleRatingRow}>
          <Text style={styles.titleText} numberOfLines={1}>
            {exp?.title ?? 'Coastal Stay'}
          </Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color="#222222" />
            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
          </View>
        </View>

        <Text style={styles.locationText} numberOfLines={1}>
          {exp?.location ?? 'Kenyan Coast'}
        </Text>

        <Text style={styles.priceText}>
          KES {Number(exp?.current_price ?? 0).toLocaleString()}
          <Text style={styles.priceUnitText}> / {exp?.price_unit ?? 'person'}</Text>
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    gap: 8,
  },
  imageWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F7F7F7',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.4,
  },
  heartCircleBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  textMetaStack: {
    gap: 2,
  },
  titleRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  titleText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  locationText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  priceText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    marginTop: 2,
  },
  priceUnitText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
});
