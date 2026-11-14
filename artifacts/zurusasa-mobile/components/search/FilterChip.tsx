import React from 'react';
import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SearchFilters } from '@/services/filterService';
import {
  getPrimaryCategoryMeta,
  getSubcategoryLabel,
} from '@/constants/taxonomy';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

interface FilterChipProps {
  filters: SearchFilters;
  onRemoveCategory: () => void;
  onRemoveSubcategory?: () => void;
  onRemoveOnlySpecialOffers?: () => void;
  onRemoveOnlyUpcomingEvents?: () => void;
  onRemoveCity: (city: string) => void;
  onRemovePrice: () => void;
  onRemoveRating: () => void;
  onRemoveAmenity: (amenity: string) => void;
  onResetAll: () => void;
}

function formatCategoryFilterLabel(rawCategory: string): string {
  const lower = rawCategory.trim().toLowerCase();
  if (lower === 'events' || lower === 'event') return 'Events';
  if (lower === 'offers' || lower === 'offer' || lower === 'special_offer') {
    return 'Special Offers';
  }
  return getPrimaryCategoryMeta(rawCategory).label;
}

export function FilterChip({
  filters,
  onRemoveCategory,
  onRemoveSubcategory,
  onRemoveOnlySpecialOffers,
  onRemoveOnlyUpcomingEvents,
  onRemoveCity,
  onRemovePrice,
  onRemoveRating,
  onRemoveAmenity,
  onResetAll,
}: FilterChipProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const chips: Array<{ label: string; onRemove: () => void }> = [];

  if (filters.category) {
    chips.push({
      label: formatCategoryFilterLabel(filters.category),
      onRemove: onRemoveCategory,
    });
  }

  if (filters.subcategory && onRemoveSubcategory) {
    chips.push({
      label: getSubcategoryLabel(filters.subcategory) || filters.subcategory,
      onRemove: onRemoveSubcategory,
    });
  }

  if (filters.onlySpecialOffers && onRemoveOnlySpecialOffers) {
    chips.push({
      label: 'Special Offers & Deals',
      onRemove: onRemoveOnlySpecialOffers,
    });
  }

  if (filters.onlyUpcomingEvents && onRemoveOnlyUpcomingEvents) {
    chips.push({
      label: 'Upcoming Events',
      onRemove: onRemoveOnlyUpcomingEvents,
    });
  }

  if (filters.cities && filters.cities.length > 0) {
    for (const city of filters.cities) {
      chips.push({
        label: city,
        onRemove: () => onRemoveCity(city),
      });
    }
  }

  if ((filters.minPrice ?? 0) > 0 || (filters.maxPrice ?? 150000) < 150000) {
    const maxP = filters.maxPrice ?? 150000;
    chips.push({
      label: `KES < ${maxP.toLocaleString()}`,
      onRemove: onRemovePrice,
    });
  }

  if (filters.minRating) {
    chips.push({
      label: `${filters.minRating}★+`,
      onRemove: onRemoveRating,
    });
  }

  if (filters.amenities && filters.amenities.length > 0) {
    for (const amenity of filters.amenities) {
      chips.push({
        label: amenity,
        onRemove: () => onRemoveAmenity(amenity),
      });
    }
  }

  if (chips.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Pressable
          onPress={onResetAll}
          style={({ pressed }) => [
            styles.resetChip,
            {
              backgroundColor: isDark ? '#27272A' : '#F7F7F7',
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.resetText, { color: colors.mutedForeground }]}>Clear All</Text>
        </Pressable>

        {chips.map((chip, idx) => (
          <View
            key={`${chip.label}-${idx}`}
            style={[
              styles.chip,
              {
                backgroundColor: isDark ? '#2A1F1A' : '#FFFBF8',
                borderColor: isDark ? '#5A2A1A' : '#FCE3D6',
              },
            ]}
          >
            <Text style={styles.chipText}>{chip.label}</Text>
            <Pressable onPress={chip.onRemove} hitSlop={6} style={styles.removeIconBtn}>
              <Ionicons name="close" size={13} color="#F26522" />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  resetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  resetText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  removeIconBtn: {
    padding: 2,
  },
});
