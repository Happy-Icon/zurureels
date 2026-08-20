import React, { useState, useEffect } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import type { SearchFilters } from '@/services/filterService';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

interface FilterSheetProps {
  visible: boolean;
  filters: SearchFilters;
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
  onReset: () => void;
}

const CATEGORIES = [
  { id: 'stay', label: 'Stays', icon: 'home' },
  { id: 'tour', label: 'Tours', icon: 'compass' },
  { id: 'boat', label: 'Boats', icon: 'anchor' },
  { id: 'event', label: 'Events', icon: 'calendar' },
  { id: 'food', label: 'Food', icon: 'coffee' },
  { id: 'nightlife', label: 'Nightlife', icon: 'moon' },
];

const CITIES = ['Diani', 'Mombasa', 'Watamu', 'Nairobi', 'Lamu', 'Malindi'];

const PRICE_PRESETS = [
  { label: 'Under 10k', max: 10000 },
  { label: 'Under 25k', max: 25000 },
  { label: 'Under 50k', max: 50000 },
  { label: 'Any Price', max: 150000 },
];

const AMENITIES = [
  'Beach Front',
  'Pool',
  'Wi-Fi',
  'Air Conditioning',
  'Kitchen',
  'Parking',
  'Breakfast',
  'Workspace',
  'Pet Friendly',
];

export function FilterSheet({
  visible,
  filters: initialFilters,
  onClose,
  onApply,
  onReset,
}: FilterSheetProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const [draft, setDraft] = useState<SearchFilters>(initialFilters);

  useEffect(() => {
    setDraft(initialFilters);
  }, [initialFilters, visible]);

  const toggleCategory = (catId: string) => {
    setDraft((prev) => ({
      ...prev,
      category: prev.category === catId ? null : catId,
    }));
  };

  const toggleCity = (city: string) => {
    setDraft((prev) => {
      const current = prev.cities || [];
      const next = current.includes(city)
        ? current.filter((c) => c !== city)
        : [...current, city];
      return { ...prev, cities: next };
    });
  };

  const toggleAmenity = (amenity: string) => {
    setDraft((prev) => {
      const current = prev.amenities || [];
      const next = current.includes(amenity)
        ? current.filter((a) => a !== amenity)
        : [...current, amenity];
      return { ...prev, amenities: next };
    });
  };

  const toggleHostType = (type: 'super_host' | 'verified' | 'instant_book') => {
    setDraft((prev) => {
      const current = prev.hostType || [];
      const next = current.includes(type)
        ? current.filter((t) => t !== type)
        : [...current, type];
      return { ...prev, hostType: next };
    });
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheetContainer, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Filters</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* 1. CATEGORIES */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>Category</Text>
              <View style={styles.gridRow}>
                {CATEGORIES.map((cat) => {
                  const isSelected = draft.category === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => toggleCategory(cat.id)}
                      style={[
                        styles.catTile,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? '#2A1F1A'
                              : '#FFFBF8'
                            : isDark
                            ? '#27272A'
                            : '#F9F9F9',
                          borderColor: isSelected ? '#F26522' : colors.border,
                        },
                      ]}
                    >
                      <Feather
                        name={cat.icon as any}
                        size={18}
                        color={isSelected ? '#F26522' : colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.catTileText,
                          { color: isSelected ? '#F26522' : colors.text },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* 2. PRICE RANGE */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>Max Price</Text>
              <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                Up to KES {(draft.maxPrice ?? 150000).toLocaleString()} / night
              </Text>
              <View style={styles.pillRow}>
                {PRICE_PRESETS.map((p, idx) => {
                  const isSelected = draft.maxPrice === p.max;
                  return (
                    <Pressable
                      key={idx}
                      onPress={() => setDraft((prev) => ({ ...prev, maxPrice: p.max }))}
                      style={[
                        styles.presetPill,
                        {
                          backgroundColor: isSelected
                            ? '#F26522'
                            : isDark
                            ? '#27272A'
                            : '#F7F7F7',
                          borderColor: isSelected ? '#F26522' : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.presetText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* 3. DESTINATIONS / CITIES */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>Location / Destination</Text>
              <View style={styles.pillRow}>
                {CITIES.map((city) => {
                  const isSelected = (draft.cities || []).includes(city);
                  return (
                    <Pressable
                      key={city}
                      onPress={() => toggleCity(city)}
                      style={[
                        styles.cityChip,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? '#2A1F1A'
                              : '#FFFBF8'
                            : isDark
                            ? '#27272A'
                            : '#F7F7F7',
                          borderColor: isSelected ? '#F26522' : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.cityChipText, { color: isSelected ? '#F26522' : colors.text }]}>
                        {city}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* 4. RATING */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>Minimum Rating</Text>
              <View style={styles.pillRow}>
                {[5, 4.5, 4.0].map((star) => {
                  const isSelected = draft.minRating === star;
                  return (
                    <Pressable
                      key={star}
                      onPress={() =>
                        setDraft((prev) => ({
                          ...prev,
                          minRating: isSelected ? null : star,
                        }))
                      }
                      style={[
                        styles.starChip,
                        {
                          backgroundColor: isSelected
                            ? '#F26522'
                            : isDark
                            ? '#27272A'
                            : '#F7F7F7',
                          borderColor: isSelected ? '#F26522' : colors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name="star"
                        size={14}
                        color={isSelected ? '#FFFFFF' : '#F26522'}
                      />
                      <Text style={[styles.starChipText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                        {star}★+
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* 5. AMENITIES */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>Amenities</Text>
              <View style={styles.pillRow}>
                {AMENITIES.map((amenity) => {
                  const isSelected = (draft.amenities || []).includes(amenity);
                  return (
                    <Pressable
                      key={amenity}
                      onPress={() => toggleAmenity(amenity)}
                      style={[
                        styles.amenityChip,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? '#2A1F1A'
                              : '#FFFBF8'
                            : isDark
                            ? '#27272A'
                            : '#F7F7F7',
                          borderColor: isSelected ? '#F26522' : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.amenityText, { color: isSelected ? '#F26522' : colors.text }]}>
                        {amenity}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* 6. HOST TYPE */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>Host Type & Booking</Text>
              <View style={styles.pillRow}>
                {[
                  { id: 'super_host', label: 'Super Host' },
                  { id: 'verified', label: 'Verified Host' },
                  { id: 'instant_book', label: 'Instant Book' },
                ].map((ht) => {
                  const isSelected = (draft.hostType || []).includes(ht.id as any);
                  return (
                    <Pressable
                      key={ht.id}
                      onPress={() => toggleHostType(ht.id as any)}
                      style={[
                        styles.hostTypeChip,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? '#2A1F1A'
                              : '#FFFBF8'
                            : isDark
                            ? '#27272A'
                            : '#F7F7F7',
                          borderColor: isSelected ? '#F26522' : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.hostTypeText, { color: isSelected ? '#F26522' : colors.text }]}>
                        {ht.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Sticky Bottom Actions */}
          <View style={[styles.bottomBar, { borderTopColor: colors.border }]}>
            <Pressable onPress={onReset} style={styles.resetBtn}>
              <Text style={[styles.resetBtnText, { color: colors.text }]}>Clear all</Text>
            </Pressable>

            <Pressable
              onPress={handleApply}
              style={({ pressed }) => [
                styles.applyBtn,
                { opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 20,
    paddingHorizontal: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 24,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeading: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    marginTop: -6,
  },
  divider: {
    height: 1,
    backgroundColor: '#EBEBEB',
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  catTile: {
    width: '30%',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    alignItems: 'center',
    gap: 6,
  },
  catTileActive: {
    backgroundColor: '#FFFBF8',
    borderColor: '#FCE3D6',
  },
  catTileText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  catTileTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  presetPillActive: {
    backgroundColor: '#F26522',
    borderColor: '#F26522',
  },
  presetText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  presetTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  cityChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  cityChipActive: {
    backgroundColor: '#FFFBF8',
    borderColor: '#FCE3D6',
  },
  cityChipText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  cityChipTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  starChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  starChipActive: {
    backgroundColor: '#F26522',
    borderColor: '#F26522',
  },
  starChipText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  starChipTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  amenityChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  amenityChipActive: {
    backgroundColor: '#FFFBF8',
    borderColor: '#FCE3D6',
  },
  amenityText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  amenityTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  hostTypeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  hostTypeChipActive: {
    backgroundColor: '#FFFBF8',
    borderColor: '#FCE3D6',
  },
  hostTypeText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  hostTypeTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
  },
  resetBtn: {
    paddingVertical: 8,
  },
  resetBtnText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    textDecorationLine: 'underline',
  },
  applyBtn: {
    height: 48,
    paddingHorizontal: 32,
    borderRadius: 24,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
