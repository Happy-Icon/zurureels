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
  onSave?: (id: string) => void;
  onOpen?: (id: string) => void;
  onBook?: (id: string) => void;
}

export function AIListingCard({ card, onSave, onOpen, onBook }: AIListingCardProps) {
  return (
    <Pressable
      onPress={() => onOpen?.(card.id)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}
    >
      {/* Hero image */}
      <View style={styles.imageWrap}>
        {card.imageUrl ? (
          <Image
            source={{ uri: card.imageUrl }}
            style={styles.image}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Feather name="image" size={24} color="#D1D5DB" />
          </View>
        )}

        {/* Save button */}
        <Pressable
          onPress={(e) => { e.stopPropagation(); onSave?.(card.id); }}
          style={styles.saveBtn}
          hitSlop={6}
        >
          <Ionicons name="heart-outline" size={16} color="#FFFFFF" />
        </Pressable>

        {/* Category badge */}
        {card.category ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {card.category.replace(/_/g, ' ')}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{card.title}</Text>
        {card.location ? (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={10} color={AI_COLORS.textTertiary} />
            <Text style={styles.metaText} numberOfLines={1}>{card.location}</Text>
          </View>
        ) : null}

        <View style={styles.ratingPriceRow}>
          {card.rating != null ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={11} color={AI_COLORS.star} />
              <Text style={styles.ratingText}>{card.rating.toFixed(1)}</Text>
              {card.reviewCount != null ? (
                <Text style={styles.reviewText}>({card.reviewCount})</Text>
              ) : null}
            </View>
          ) : null}
          {card.price != null ? (
            <Text style={styles.price}>
              KES {card.price.toLocaleString()}
              {card.priceUnit ? `/${card.priceUnit}` : ''}
            </Text>
          ) : null}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => onOpen?.(card.id)}
            style={styles.openBtn}
          >
            <Text style={styles.openBtnText}>View</Text>
          </Pressable>
          <Pressable
            onPress={() => onBook?.(card.id)}
            style={styles.bookBtn}
          >
            <Text style={styles.bookBtnText}>Book</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

// ── AI Recommendation Card ──────────────────────────────────────────────────
interface AIRecommendationCardProps {
  card: AICard;
  onPress?: (id: string) => void;
}

export function AIRecommendationCard({ card, onPress }: AIRecommendationCardProps) {
  return (
    <Pressable
      onPress={() => onPress?.(card.id)}
      style={({ pressed }) => [styles.recCard, pressed && { opacity: 0.92 }]}
    >
      {/* Left image */}
      <View style={styles.recImageWrap}>
        {card.imageUrl ? (
          <Image source={{ uri: card.imageUrl }} style={styles.recImage} contentFit="cover" />
        ) : (
          <View style={[styles.recImage, styles.recImageFallback]}>
            <Text style={styles.recFallbackEmoji}>
              {card.category === 'food' ? '🍽' :
               card.category === 'events' ? '🎉' :
               card.category === 'beach' ? '🏖' :
               card.category === 'tours' ? '🗺' : '✨'}
            </Text>
          </View>
        )}
      </View>

      {/* Right content */}
      <View style={styles.recContent}>
        <Text style={styles.recTitle} numberOfLines={2}>{card.title}</Text>
        {card.subtitle ? (
          <Text style={styles.recSubtitle} numberOfLines={1}>{card.subtitle}</Text>
        ) : null}
        <View style={styles.recMeta}>
          {card.location ? (
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={9} color={AI_COLORS.textTertiary} />
              <Text style={styles.recMetaText}>{card.location}</Text>
            </View>
          ) : null}
          {card.rating != null ? (
            <View style={styles.metaRow}>
              <Ionicons name="star" size={9} color={AI_COLORS.star} />
              <Text style={styles.recMetaText}>{card.rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
        {card.price != null ? (
          <Text style={styles.recPrice}>
            KES {card.price.toLocaleString()}
          </Text>
        ) : null}
      </View>

      <Feather name="chevron-right" size={16} color={AI_COLORS.textTertiary} />
    </Pressable>
  );
}

// ── Card row (horizontal scroll) ────────────────────────────────────────────
export function AICardRow({ cards, type = 'listing' }: {
  cards: AICard[];
  type?: 'listing' | 'recommendation';
}) {
  if (type === 'recommendation') {
    return (
      <View style={styles.recList}>
        {cards.map((card) => (
          <AIRecommendationCard key={card.id} card={card} />
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.cardRow}
    >
      {cards.map((card) => (
        <AIListingCard key={card.id} card={card} />
      ))}
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Listing card
  card: {
    width: 190,
    backgroundColor: AI_COLORS.bgCard,
    borderRadius: AI_RADIUS.lg,
    borderWidth: 1,
    borderColor: AI_COLORS.border,
    overflow: 'hidden',
    ...AI_SHADOW.card,
  },
  imageWrap: {
    height: 130,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: AI_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: AI_FONTS.bold,
    textTransform: 'capitalize',
  },
  content: {
    padding: 10,
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontFamily: AI_FONTS.semibold,
    color: AI_COLORS.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textTertiary,
    flex: 1,
  },
  ratingPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 11.5,
    fontFamily: AI_FONTS.semibold,
    color: AI_COLORS.textPrimary,
  },
  reviewText: {
    fontSize: 10,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textTertiary,
  },
  price: {
    fontSize: 11.5,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.orange,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  openBtn: {
    flex: 1,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AI_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openBtnText: {
    fontSize: 11,
    fontFamily: AI_FONTS.semibold,
    color: AI_COLORS.textPrimary,
  },
  bookBtn: {
    flex: 1,
    height: 30,
    borderRadius: 8,
    backgroundColor: AI_COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookBtnText: {
    fontSize: 11,
    fontFamily: AI_FONTS.bold,
    color: '#FFFFFF',
  },

  // Recommendation card
  recCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AI_COLORS.bgCard,
    borderRadius: AI_RADIUS.md,
    borderWidth: 1,
    borderColor: AI_COLORS.border,
    padding: 10,
    gap: 10,
    ...AI_SHADOW.subtle,
  },
  recImageWrap: {
    width: 66,
    height: 66,
    borderRadius: 12,
    overflow: 'hidden',
  },
  recImage: {
    width: '100%',
    height: '100%',
  },
  recImageFallback: {
    backgroundColor: AI_COLORS.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recFallbackEmoji: {
    fontSize: 24,
  },
  recContent: {
    flex: 1,
    gap: 2,
  },
  recTitle: {
    fontSize: 13.5,
    fontFamily: AI_FONTS.semibold,
    color: AI_COLORS.textPrimary,
    lineHeight: 18,
  },
  recSubtitle: {
    fontSize: 11.5,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textSecondary,
  },
  recMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  recMetaText: {
    fontSize: 11,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textTertiary,
  },
  recPrice: {
    fontSize: 12,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.orange,
    marginTop: 2,
  },
  cardRow: {
    paddingHorizontal: 4,
    gap: 10,
  },
  recList: {
    gap: 8,
  },
});
