import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { AI_COLORS } from './tokens';

// ── Shimmer loading placeholder ─────────────────────────────────────────────
export function AIShimmer({ width = '100%', height = 16, radius = 8 }: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });

  return (
    <Animated.View
      style={{
        width: width as any,
        height,
        borderRadius: radius,
        backgroundColor: '#E5E7EB',
        opacity,
      }}
    />
  );
}

// ── Typing indicator (three bouncing dots) ──────────────────────────────────
export function AITypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  const bounce = (dot: Animated.Value, delay: number) =>
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: -5, duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(600),
      ])
    );

  useEffect(() => {
    const a1 = bounce(dot1, 0);
    const a2 = bounce(dot2, 150);
    const a3 = bounce(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={styles.typingWrap}>
      <View style={styles.typingBubble}>
        <View style={styles.typingDots}>
          {[dot1, dot2, dot3].map((dot, i) => (
            <Animated.View
              key={i}
              style={[styles.dot, { transform: [{ translateY: dot }] }]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ── Card shimmer skeleton ───────────────────────────────────────────────────
export function AICardSkeleton() {
  return (
    <View style={styles.cardSkeleton}>
      <AIShimmer width="100%" height={130} radius={14} />
      <View style={{ gap: 6, marginTop: 8 }}>
        <AIShimmer width="70%" height={14} radius={7} />
        <AIShimmer width="50%" height={11} radius={5} />
        <AIShimmer width="40%" height={11} radius={5} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  typingWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: 16,
    paddingBottom: 4,
  },
  typingBubble: {
    backgroundColor: AI_COLORS.aiBubble,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: AI_COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 18,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#9CA3AF',
  },
  cardSkeleton: {
    width: 190,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderWidth: 1,
    borderColor: AI_COLORS.border,
  },
});
