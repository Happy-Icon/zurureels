import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { AI_COLORS, AI_FONTS, AI_RADIUS, AI_SHADOW, SUGGESTION_CHIPS } from './tokens';
import { AISuggestionChips } from './AISuggestionChip';

interface AIEmptyStateProps {
  onSuggestionSelect: (text: string) => void;
}

export function AIEmptyState({ onSuggestionSelect }: AIEmptyStateProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 9,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Concierge Avatar Icon */}
      <View style={styles.iconContainer}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="compass-outline" size={32} color="#FFFFFF" />
        </View>
      </View>

      {/* Title & Subtitle */}
      <View style={styles.textBlock}>
        <Text style={styles.title}>Your Personal Travel Concierge</Text>
        <Text style={styles.subtitle}>
          Ask me anything about verified stays, ocean villas, dining, and activities across Kenya.
        </Text>
      </View>

      {/* Value props */}
      <View style={styles.capabilities}>
        {[
          { icon: 'check-circle', label: 'Verified listings' },
          { icon: 'calendar', label: 'Trip itineraries' },
          { icon: 'heart', label: 'Curated stays' },
        ].map((cap) => (
          <View key={cap.label} style={styles.capPill}>
            <Feather name={cap.icon as any} size={11} color={AI_COLORS.orange} />
            <Text style={styles.capText}>{cap.label}</Text>
          </View>
        ))}
      </View>

      {/* Suggestion Chips */}
      <View style={styles.chipsSection}>
        <Text style={styles.chipsLabel}>Suggested ideas</Text>
        <AISuggestionChips chips={SUGGESTION_CHIPS} onSelect={onSuggestionSelect} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    paddingBottom: 30,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: AI_COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    ...AI_SHADOW.orange,
  },
  textBlock: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 20,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13.5,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  capabilities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  capPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: AI_RADIUS.full,
    paddingHorizontal: 11,
    paddingVertical: 5.5,
    ...AI_SHADOW.subtle,
  },
  capText: {
    fontSize: 11.5,
    fontFamily: AI_FONTS.medium,
    color: '#4B5563',
  },
  chipsSection: {
    width: '100%',
    gap: 8,
    marginTop: 6,
  },
  chipsLabel: {
    fontSize: 11.5,
    fontFamily: AI_FONTS.semibold,
    color: AI_COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
  },
});
