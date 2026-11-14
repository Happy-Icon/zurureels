import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useReelInteractions, useToggleSave } from '@/lib/queries';
import type { ReelRow } from '@/lib/supabase';
import {
  formatEventScheduleBadge,
  getCategoryDisplayMeta,
  resolveReelContentType,
} from '@/constants/taxonomy';

import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

interface ReelGridCardProps {
  reel: ReelRow;
  width: number;
  onOpen: () => void;
}

export function ReelGridCard({ reel, width, onOpen }: ReelGridCardProps) {
  const router = useRouter();
  const colors = useColors();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const toggleSave = useToggleSave();

  const exp = reel.experience;
  const meta = (exp?.metadata ?? {}) as Record<string, any>;
  const rating = Number((meta.rating as number | string | undefined) ?? 5.0);

  const contentType = resolveReelContentType(reel);
  const subcategory = reel.subcategory || (meta.subcategory as string | undefined) || null;
  const catMeta = getCategoryDisplayMeta(
    reel.category || exp?.category,
    contentType,
    subcategory,
  );
  const evDetails = (meta.event_details ?? {}) as Record<string, any>;
  const offDetails = (meta.offer_details ?? {}) as Record<string, any>;

  const badgeLabel =
    contentType === 'event'
      ? `EVENT · ${formatEventScheduleBadge(
          evDetails.event_date || reel.event?.event_date,
          evDetails.start_time || reel.event?.start_time,
        )}`
      : contentType === 'special_offer'
      ? `OFFER · ${String(
          reel.offer?.discount_label || offDetails.discount_label || 'DEAL',
        ).toUpperCase()}`
      : catMeta.shortLabel.toUpperCase();

  const offerOriginalPrice =
    contentType === 'special_offer'
      ? typeof reel.offer?.original_price === 'number'
        ? reel.offer.original_price
        : typeof offDetails.original_price === 'number'
        ? offDetails.original_price
        : null
      : null;

  const displayPrice = Number(exp?.current_price ?? 0);

  const hostId = reel.user_id ?? null;
  const { data: inter } = useReelInteractions(reel.id, hostId, user?.id, true);
  const saved = inter?.saved ?? false;

  const onSave = () => {
    if (!user) {
      router.push('/auth');
      return;
    }
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
      <View
        style={[
          styles.imageWrap,
          { width, height: imageHeight, backgroundColor: isDark ? '#27272A' : '#F7F7F7' },
        ]}
      >
        {reel.thumbnail_url ? (
          <Image
            source={{ uri: reel.thumbnail_url }}
            style={styles.image}
            contentFit="cover"
          />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name="videocam-outline" size={26} color={colors.mutedForeground} />
          </View>
        )}

        {/* Top Left: Format / Category Badge */}
        <View style={[styles.categoryBadge, { backgroundColor: catMeta.badgeBg }]}>
          <Ionicons name={catMeta.icon} size={11} color="#FFFFFF" />
          <Text style={styles.categoryBadgeText} numberOfLines={1}>
            {badgeLabel}
          </Text>
        </View>

        {/* Top Right: Floating Wishlist Heart Icon */}
        <Pressable
          testID={`grid-save-${reel.id}`}
          onPress={onSave}
          hitSlop={8}
          style={[
            styles.heartCircleBtn,
            { backgroundColor: isDark ? 'rgba(30, 30, 30, 0.85)' : 'rgba(255, 255, 255, 0.9)' },
          ]}
        >
          <Ionicons
            name={saved ? 'heart' : 'heart-outline'}
            size={18}
            color={saved ? '#F26522' : colors.text}
          />
        </Pressable>
      </View>

      {/* Text Information Below Image Container */}
      <View style={styles.textMetaStack}>
        <View style={styles.titleRatingRow}>
          <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>
            {exp?.title ?? 'Coastal Experience'}
          </Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={[styles.ratingText, { color: colors.text }]}>{rating.toFixed(1)}</Text>
          </View>
        </View>

        <Text style={[styles.locationText, { color: colors.mutedForeground }]} numberOfLines={1}>
          {exp?.location ?? 'Kenyan Coast'}
        </Text>

        {contentType === 'event' && displayPrice === 0 ? (
          <Text style={[styles.priceText, { color: colors.text }]}>Free Entry</Text>
        ) : contentType === 'special_offer' && offerOriginalPrice && offerOriginalPrice > 0 ? (
          <View style={styles.offerPriceWrap}>
            <Text style={[styles.strikePriceText, { color: colors.mutedForeground }]}>
              KES {offerOriginalPrice.toLocaleString()}
            </Text>
            <Text style={[styles.priceText, { color: colors.text, marginTop: 0 }]}>
              {displayPrice > 0
                ? `KES ${displayPrice.toLocaleString()}`
                : String(reel.offer?.discount_label || offDetails.discount_label || 'Offer')}
            </Text>
          </View>
        ) : (
          <Text style={[styles.priceText, { color: colors.text }]}>
            KES {displayPrice.toLocaleString()}
            <Text style={[styles.priceUnitText, { color: colors.mutedForeground }]}>
              {' '}
              / {exp?.price_unit ?? 'person'}
            </Text>
          </Text>
        )}
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
    right: 48,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.3,
    flexShrink: 1,
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
  offerPriceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  strikePriceText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    textDecorationLine: 'line-through',
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
