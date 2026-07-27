import React from 'react';
import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { SearchFilters } from '@/services/filterService';

interface FilterChipProps {
  filters: SearchFilters;
  onRemoveCategory: () => void;
  onRemoveCity: (city: string) => void;
  onRemovePrice: () => void;
  onRemoveRating: () => void;
  onRemoveAmenity: (amenity: string) => void;
  onResetAll: () => void;
}

export function FilterChip({
  filters,
  onRemoveCategory,
  onRemoveCity,
  onRemovePrice,
  onRemoveRating,
  onRemoveAmenity,
  onResetAll,
}: FilterChipProps) {
  const chips: Array<{ label: string; onRemove: () => void }> = [];

  if (filters.category) {
    chips.push({
      label: `Category: ${filters.category}`,
      onRemove: onRemoveCategory,
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
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={styles.resetText}>Clear All</Text>
        </Pressable>

        {chips.map((chip, idx) => (
          <View key={idx} style={styles.chip}>
            <Text style={styles.chipText}>{chip.label}</Text>
            <Pressable onPress={chip.onRemove} hitSlop={6} style={styles.removeIconBtn}>
              <Feather name="x" size={12} color="#F26522" />
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
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  resetText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#717171',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFBF8',
    borderWidth: 1,
    borderColor: '#FCE3D6',
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
