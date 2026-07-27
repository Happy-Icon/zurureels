import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AI_COLORS, AI_FONTS, AI_RADIUS, AI_SHADOW, type QuickAction } from './tokens';

interface AIQuickActionCardProps {
  action: QuickAction;
  onPress: (action: QuickAction) => void;
}

export function AIQuickActionCard({ action, onPress }: AIQuickActionCardProps) {
  return (
    <Pressable
      onPress={() => onPress(action)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: action.color },
        pressed && styles.cardPressed,
      ]}
    >
      <Text style={styles.emoji}>{action.emoji}</Text>
      <Text style={styles.label} numberOfLines={2}>{action.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 100,
    borderRadius: AI_RADIUS.lg,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    ...AI_SHADOW.subtle,
  },
  cardPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.92,
  },
  emoji: {
    fontSize: 26,
  },
  label: {
    fontSize: 12,
    fontFamily: AI_FONTS.semibold,
    color: AI_COLORS.textPrimary,
    lineHeight: 16,
  },
});
