import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';

interface PremiumLoaderProps {
  color?: string;
  size?: number;
  style?: ViewStyle;
}

export function PremiumLoader({
  color = '#FFFFFF',
  size = 9,
  style,
}: PremiumLoaderProps) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const wave = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 380,
            easing: Easing.in(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.delay(260),
        ]),
      );

    const a1 = wave(dot1, 0);
    const a2 = wave(dot2, 140);
    const a3 = wave(dot3, 280);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  const lift = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [0, -(size + 5)] });
  const fade = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const scl = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.15] });

  return (
    <View style={[styles.container, { gap: size * 0.9 }, style]}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: fade(d),
            transform: [{ translateY: lift(d) }, { scale: scl(d) }],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
