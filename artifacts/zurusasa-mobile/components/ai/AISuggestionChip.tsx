import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { AI_COLORS, AI_FONTS, AI_RADIUS, AI_SHADOW } from './tokens';

interface AISuggestionChipProps {
  label: string;
  onPress: (label: string) => void;
}

export function AISuggestionChip({ label, onPress }: AISuggestionChipProps) {
  return (
    <Pressable
      onPress={() => onPress(label)}
      style={({ pressed }) => [
        styles.chip,
        pressed && styles.chipPressed,
      ]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

interface AISuggestionChipsProps {
  chips: string[];
  onSelect: (chip: string) => void;
}

export function AISuggestionChips({ chips, onSelect }: AISuggestionChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {chips.map((chip) => (
        <AISuggestionChip key={chip} label={chip} onPress={onSelect} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: AI_COLORS.border,
    borderRadius: AI_RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...AI_SHADOW.subtle,
  },
  chipPressed: {
    backgroundColor: AI_COLORS.orangeLight,
    borderColor: AI_COLORS.orange,
  },
  chipText: {
    fontSize: 13,
    fontFamily: AI_FONTS.medium,
    color: AI_COLORS.textPrimary,
  },
});
