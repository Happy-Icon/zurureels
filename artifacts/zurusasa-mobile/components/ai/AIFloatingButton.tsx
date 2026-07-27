import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AI_COLORS, AI_FONTS, AI_RADIUS, AI_SHADOW } from './tokens';

interface AIFloatingButtonProps {
  onPress: () => void;
  label?: string;
  visible?: boolean;
}

export function AIFloatingButton({
  onPress,
  label = 'Ask Zuru AI',
  visible = true,
}: AIFloatingButtonProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          tension: 80,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 80,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View
      style={[
        styles.fab,
        {
          transform: [{ scale }, { translateY }],
          opacity: scale,
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.inner,
          pressed && { opacity: 0.88, transform: [{ scale: 0.96 }] },
        ]}
      >
        <View style={styles.iconWrap}>
          <Text style={styles.sparkle}>✦</Text>
        </View>
        <Text style={styles.label}>{label}</Text>
        <Feather name="arrow-up-right" size={14} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    zIndex: 200,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: AI_COLORS.textPrimary,
    borderRadius: AI_RADIUS.full,
    paddingVertical: 12,
    paddingHorizontal: 18,
    ...AI_SHADOW.card,
  },
  iconWrap: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: AI_COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    fontSize: 11,
    color: '#FFFFFF',
  },
  label: {
    fontSize: 13.5,
    fontFamily: AI_FONTS.semibold,
    color: '#FFFFFF',
  },
});
