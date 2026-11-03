import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import type { ItineraryItem } from '@/types/zuruPlan';

export interface ItineraryItemRowProps {
  item: ItineraryItem;
  onBookExperience: (experienceId: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function ItineraryItemRow({
  item,
  onBookExperience,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: ItineraryItemRowProps) {
  const colors = useColors();
  const { isDark } = useTheme();

  let timeSlotIcon: keyof typeof Feather.glyphMap = 'sun';
  let timeSlotBadgeBg = '#FFF7ED';
  let timeSlotColor = '#D97706';

  if (item.timeSlot === 'morning') {
    timeSlotIcon = 'sunrise';
    timeSlotBadgeBg = '#FEF3C7';
    timeSlotColor = '#B45309';
  } else if (item.timeSlot === 'afternoon') {
    timeSlotIcon = 'sun';
    timeSlotBadgeBg = '#E0F2FE';
    timeSlotColor = '#0369A1';
  } else if (item.timeSlot === 'evening') {
    timeSlotIcon = 'sunset';
    timeSlotBadgeBg = '#F3E8FF';
    timeSlotColor = '#7E22CE';
  } else if (item.timeSlot === 'night') {
    timeSlotIcon = 'moon';
    timeSlotBadgeBg = '#EDE9FE';
    timeSlotColor = '#6D28D9';
  }

  const isStay = item.type === 'stay';

  return (
    <View
      style={[
        styles.cardContainer,
        { backgroundColor: colors.card, borderColor: colors.border },
        isStay && { borderColor: '#F26522', borderWidth: 1.5 },
      ]}
    >
      {/* Top Header: Time Slot & Controls */}
      <View style={styles.cardHeaderRow}>
        <View style={[styles.timeBadge, { backgroundColor: isDark ? '#27272A' : timeSlotBadgeBg }]}>
          <Feather name={timeSlotIcon} size={11} color={timeSlotColor} />
          <Text style={[styles.timeBadgeText, { color: timeSlotColor }]}>
            {item.timeLabel || item.timeSlot.toUpperCase()}
          </Text>
        </View>

        {/* Up / Down Reorder Arrows */}
        <View style={styles.reorderArrows}>
          {canMoveUp && onMoveUp && (
            <Pressable
              onPress={onMoveUp}
              hitSlop={6}
              style={styles.arrowBtn}
              accessibilityRole="button"
              accessibilityLabel="Move item up"
            >
              <Feather name="chevron-up" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
          {canMoveDown && onMoveDown && (
            <Pressable
              onPress={onMoveDown}
              hitSlop={6}
              style={styles.arrowBtn}
              accessibilityRole="button"
              accessibilityLabel="Move item down"
            >
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Main Body */}
      <View style={styles.cardBody}>
        {item.experienceImageUrl ? (
          <Image source={{ uri: item.experienceImageUrl }} style={styles.itemImage} contentFit="cover" />
        ) : null}

        <View style={styles.itemDetails}>
          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>

          {item.location ? (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={11} color={colors.mutedForeground} />
              <Text style={[styles.locationText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {item.location}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.itemDesc, { color: colors.mutedForeground }]} numberOfLines={3}>
            {item.description}
          </Text>
        </View>
      </View>

      {/* Footer: Price & Booking Action */}
      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <View style={styles.priceBlock}>
          {item.estimatedPriceKes != null ? (
            <>
              <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>ESTIMATED</Text>
              <Text style={[styles.priceAmount, { color: colors.text }]}>
                KSh {Number(item.estimatedPriceKes).toLocaleString()}
              </Text>
            </>
          ) : (
            <Text style={[styles.freeLabel, { color: '#10B981' }]}>Included in day</Text>
          )}
        </View>

        {item.experienceId && item.isBookable ? (
          <Pressable
            testID={`book-item-${item.id}`}
            onPress={() => onBookExperience(item.experienceId!)}
            style={styles.bookBtn}
            accessibilityRole="button"
            accessibilityLabel={`Reserve ${item.title}`}
          >
            <Text style={styles.bookBtnText}>{isStay ? 'View Stay' : 'Book Activity'}</Text>
            <Feather name="arrow-right" size={13} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timeBadgeText: {
    fontSize: 10.5,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.3,
  },
  reorderArrows: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  arrowBtn: {
    padding: 2,
  },
  cardBody: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  itemDetails: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
  },
  itemDesc: {
    fontSize: 12.5,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 17,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  priceBlock: {
    gap: 1,
  },
  priceLabel: {
    fontSize: 9.5,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.4,
  },
  priceAmount: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  freeLabel: {
    fontSize: 12.5,
    fontFamily: 'DMSans_600SemiBold',
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F26522',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontFamily: 'DMSans_700Bold',
  },
});
