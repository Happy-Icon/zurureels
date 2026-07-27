import React, { useEffect, useRef } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AI_COLORS, AI_FONTS, AI_RADIUS, AI_SHADOW, SUGGESTION_CHIPS } from './tokens';
import { AISuggestionChips } from './AISuggestionChip';

interface AIEmptyStateProps {
  onSuggestionSelect: (text: string) => void;
}

export function AIEmptyState({ onSuggestionSelect }: AIEmptyStateProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 9,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
      {/* Illustration / Brand graphic */}
      <View style={styles.illustrationWrap}>
        <View style={styles.outerRing}>
          <View style={styles.innerRing}>
            <View style={styles.logoMark}>
              <Text style={styles.logoEmoji}>✦</Text>
            </View>
          </View>
        </View>

        {/* Orbiting dots */}
        <View style={[styles.orbitDot, { top: 10, right: 30 }]}>
          <Text style={{ fontSize: 16 }}>🏖</Text>
        </View>
        <View style={[styles.orbitDot, { top: 20, left: 20 }]}>
          <Text style={{ fontSize: 16 }}>🚤</Text>
        </View>
        <View style={[styles.orbitDot, { bottom: 8, right: 20 }]}>
          <Text style={{ fontSize: 16 }}>🏨</Text>
        </View>
        <View style={[styles.orbitDot, { bottom: 14, left: 32 }]}>
          <Text style={{ fontSize: 16 }}>🍽</Text>
        </View>
      </View>

      {/* Greeting */}
      <View style={styles.textBlock}>
        <Text style={styles.greeting}>Your AI travel companion.</Text>
        <Text style={styles.subGreeting}>
          Ask me anything about Kenya's best experiences, stays, food, and adventures.
        </Text>
      </View>

      {/* Capability pills */}
      <View style={styles.capabilities}>
        {[
          { icon: 'search', label: 'Search experiences' },
          { icon: 'calendar', label: 'Plan itineraries' },
          { icon: 'heart', label: 'Personalized picks' },
        ].map((cap) => (
          <View key={cap.label} style={styles.capPill}>
            <Feather name={cap.icon as any} size={12} color={AI_COLORS.orange} />
            <Text style={styles.capText}>{cap.label}</Text>
          </View>
        ))}
      </View>

      {/* Suggestion chips */}
      <View style={styles.chipsSection}>
        <Text style={styles.chipsLabel}>Try asking</Text>
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
    gap: 28,
    paddingBottom: 40,
  },

  // Illustration
  illustrationWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  outerRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: AI_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  innerRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    borderColor: AI_COLORS.orangeMid,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AI_COLORS.orangeLight,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: AI_COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    ...AI_SHADOW.orange,
  },
  logoEmoji: {
    fontSize: 26,
    color: '#FFFFFF',
  },
  orbitDot: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AI_COLORS.border,
    ...AI_SHADOW.subtle,
  },

  // Text
  textBlock: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  greeting: {
    fontSize: 22,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.textPrimary,
    textAlign: 'center',
  },
  subGreeting: {
    fontSize: 14,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },

  // Capability pills
  capabilities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  capPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: AI_COLORS.orangeLight,
    borderWidth: 1,
    borderColor: AI_COLORS.orangeMid,
    borderRadius: AI_RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  capText: {
    fontSize: 12,
    fontFamily: AI_FONTS.medium,
    color: AI_COLORS.orange,
  },

  // Chips section
  chipsSection: {
    width: '100%',
    gap: 10,
  },
  chipsLabel: {
    fontSize: 12,
    fontFamily: AI_FONTS.semibold,
    color: AI_COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 20,
  },
});
