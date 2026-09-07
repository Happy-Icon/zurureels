import React, { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/context/ThemeContext';

export function Skeleton({ style }: { style?: ViewStyle }) {
  let isDark = false;
  try {
    const theme = useTheme();
    isDark = theme?.isDark ?? false;
  } catch {}

  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 650 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.base,
        { backgroundColor: isDark ? '#27272A' : '#E2E8F0' },
        style,
        animatedStyle,
      ]}
    />
  );
}

export function CenteredState({
  children,
}: {
  children: React.ReactNode;
}) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
});
