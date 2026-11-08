import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import { AI_COLORS, AI_FONTS, AI_RADIUS, AI_SHADOW, type AICard } from './tokens';

// ── AI Listing Card ─────────────────────────────────────────────────────────
interface AIListingCardProps {
  card: AICard;
  onSave?: (id: string, card: AICard) => void;
  onOpen?: (id: string, card: AICard) => void;
  onBook?: (id: string, card: AICard) => void;
  isSaved?: boolean;
}

export function AIListingCard({
  card,
  onSave,
  onOpen,
  onBook,
  isSaved = false,
}: AIListingCardProps) {
  const imageUri = card.thumbnailUrl || card.imageUrl;

  // Extract verified amenities strictly from actual data
  const rawAmenities =
    Array.isArray(card.experience?.amenities) && card.experience.amenities.length > 0
      ? card.experience.amenities
      : Array.isArray(card.tags) && card.tags.length > 0
      ? card.tags
      : [];

  const verifiedAmenities = rawAmenities.slice(0, 3);

  // Format pricing strictly according to real data rules
  const hasPrice = card.price != null && Number(card.price) > 0;
  const priceDisplay = hasPrice
    ? `KES ${Number(card.price).toLocaleString()}`
    : 'Price on request';
  const unitDisplay = hasPrice && card.priceUnit ? ` / ${card.priceUnit}` : '';

  // Rating rules: Never fabricate ratings or reviews. Omit if not present.
  const hasRating = card.rating != null && Number(card.rating) > 0;

  return (
    <View style={styles.card}>
      {/* ── Hero Image / Reel Thumbnail ── */}
      <Pressable
        onPress={() => onOpen?.(card.id, card)}
        style={styles.imageWrap}
        accessibilityRole="button"
        accessibilityLabel={`View ${card.title}`}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <View style={styles.fallbackIconCircle}>
              <Feather name="home" size={24} color="#9CA3AF" />
            </View>
            <Text style={styles.fallbackText}>ZuruSasa Stay</Text>
          </View>
        )}

        {/* Video Reel indicator badge */}
        {card.videoUrl ? (
          <View style={styles.reelBadge}>
            <Ionicons name="play" size={10} color="#FFFFFF" />
            <Text style={styles.reelBadgeText}>Reel</Text>
          </View>
        ) : null}

        {/* Top-right Heart Save button */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onSave?.(card.id, card);
          }}
          style={styles.saveBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isSaved ? 'Remove from saved' : 'Save to wishlist'}
        >
          <Ionicons
            name={isSaved ? 'heart' : 'heart-outline'}
            size={18}
            color={isSaved ? AI_COLORS.orange : '#FFFFFF'}
          />
        </Pressable>

        {/* Top-left Category badge */}
        {card.category ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {card.category.replace(/_/g, ' ')}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {/* ── Card Content ── */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title} numberOfLines={1}>
          {card.title}
        </Text>

        {/* Location */}
        {card.location ? (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={12} color={AI_COLORS.textTertiary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {card.location}
            </Text>
          </View>
        ) : null}

        {/* Verified Amenities (ONLY real data) */}
        {verifiedAmenities.length > 0 ? (
          <View style={styles.amenitiesRow}>
            {verifiedAmenities.map((amenity: string, idx: number) => (
              <View key={idx} style={styles.amenityChip}>
                <Text style={styles.amenityText} numberOfLines={1}>
                  {amenity}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Rating & Pricing Row */}
        <View style={styles.ratingPriceRow}>
          {hasRating ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={13} color={AI_COLORS.star} />
              <Text style={styles.ratingText}>{Number(card.rating).toFixed(1)}</Text>
              {card.reviewCount != null && Number(card.reviewCount) > 0 ? (
                <Text style={styles.reviewText}>({card.reviewCount})</Text>
              ) : null}
            </View>
          ) : (
            <View />
          )}

          <Text style={styles.priceContainer}>
            <Text style={hasPrice ? styles.priceAmount : styles.priceOnRequest}>
              {priceDisplay}
            </Text>
            {unitDisplay ? <Text style={styles.priceUnit}>{unitDisplay}</Text> : null}
          </Text>
        </View>

        {/* ── Action Buttons ── */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => onOpen?.(card.id, card)}
            style={({ pressed }) => [styles.viewBtn, pressed && styles.btnPressed]}
            accessibilityRole="button"
            accessibilityLabel={`View details for ${card.title}`}
          >
            <Text style={styles.viewBtnText}>View</Text>
          </Pressable>

          <Pressable
            onPress={() => onBook?.(card.id, card)}
            style={({ pressed }) => [styles.bookBtn, pressed && styles.btnPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Book ${card.title}`}
          >
            <Text style={styles.bookBtnText}>Book</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ── Card row (horizontal scroll) ────────────────────────────────────────────
export function AICardRow({
  cards,
  onSave,
  onOpen,
  onBook,
}: {
  cards: AICard[];
  onSave?: (id: string, card: AICard) => void;
  onOpen?: (id: string, card: AICard) => void;
  onBook?: (id: string, card: AICard) => void;
}) {
  if (!cards || cards.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.cardRow}
      nestedScrollEnabled
    >
      {cards.map((card) => (
        <AIListingCard
          key={card.id || card.experienceId || card.reelId}
          card={card}
          onSave={onSave}
          onOpen={onOpen}
          onBook={onBook}
        />
      ))}
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  cardRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 14,
  },
  card: {
    width: 270,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    overflow: 'hidden',
    ...AI_SHADOW.card,
  },
  imageWrap: {
    width: '100%',
    height: 155,
    position: 'relative',
    backgroundColor: '#F3F4F6',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fallbackIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDEFF2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontFamily: AI_FONTS.medium,
    fontSize: 12,
    color: '#9CA3AF',
  },
  saveBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(17,17,17,0.72)',
    borderRadius: AI_RADIUS.full,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: AI_FONTS.semibold,
    textTransform: 'capitalize',
    letterSpacing: 0.2,
  },
  reelBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  reelBadgeText: {
    fontSize: 10,
    fontFamily: AI_FONTS.bold,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  content: {
    padding: 12,
    gap: 6,
  },
  title: {
    fontSize: 14.5,
    fontFamily: AI_FONTS.semibold,
    color: AI_COLORS.textPrimary,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textSecondary,
    flex: 1,
  },
  amenitiesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 2,
  },
  amenityChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  amenityText: {
    fontSize: 11,
    fontFamily: AI_FONTS.medium,
    color: '#4B5563',
  },
  ratingPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 12.5,
    fontFamily: AI_FONTS.semibold,
    color: AI_COLORS.textPrimary,
  },
  reviewText: {
    fontSize: 11,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textTertiary,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontSize: 13.5,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.orange,
  },
  priceOnRequest: {
    fontSize: 12,
    fontFamily: AI_FONTS.medium,
    color: AI_COLORS.textSecondary,
  },
  priceUnit: {
    fontSize: 11,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textTertiary,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  viewBtn: {
    flex: 1,
    height: 35,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewBtnText: {
    fontSize: 12.5,
    fontFamily: AI_FONTS.semibold,
    color: AI_COLORS.textPrimary,
  },
  bookBtn: {
    flex: 1,
    height: 35,
    borderRadius: 8,
    backgroundColor: AI_COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookBtnText: {
    fontSize: 12.5,
    fontFamily: AI_FONTS.bold,
    color: '#FFFFFF',
  },
  btnPressed: {
    opacity: 0.85,
  },
});
