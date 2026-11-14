import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { AI_FONTS } from './tokens';

export type TextShimmerWaveProps = {
  children: string;
  duration?: number;
  baseColor?: string;
  shimmerColor?: string;
  yDistance?: number;
  spread?: number;
  scaleDistance?: number;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

function ShimmerChar({
  char,
  index,
  totalChars,
  duration,
  baseColor,
  shimmerColor,
  yDistance,
  spread,
  scaleDistance,
  style,
}: {
  char: string;
  index: number;
  totalChars: number;
  duration: number;
  baseColor: string;
  shimmerColor: string;
  yDistance: number;
  spread: number;
  scaleDistance: number;
  style?: StyleProp<TextStyle>;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = ((index * duration * (1 / spread)) / Math.max(totalChars, 1)) * 1000;
    const cycleDuration = duration * 1000;
    const restDuration = ((totalChars * 0.05) / spread) * 1000;

    const waveAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: cycleDuration * 0.5,
          useNativeDriver: false,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: cycleDuration * 0.5,
          useNativeDriver: false,
        }),
        Animated.delay(restDuration),
      ])
    );

    waveAnimation.start();

    return () => {
      waveAnimation.stop();
    };
  }, [anim, index, totalChars, duration, spread]);

  const translateY = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, yDistance, 0],
  });

  const scale = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, scaleDistance, 1],
  });

  const color = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [baseColor, shimmerColor, baseColor],
  });

  return (
    <Animated.Text
      style={[
        styles.char,
        style,
        {
          color,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      {char}
    </Animated.Text>
  );
}

export function TextShimmerWave({
  children,
  duration = 1.2,
  baseColor = '#888888',
  shimmerColor = '#F26522',
  yDistance = -2.5,
  spread = 1.2,
  scaleDistance = 1.06,
  style,
  containerStyle,
}: TextShimmerWaveProps) {
  const text = typeof children === 'string' ? children : String(children ?? '');
  const chars = text.split('');

  return (
    <View style={[styles.container, containerStyle]}>
      {chars.map((char, index) => (
        <ShimmerChar
          key={`${char}-${index}`}
          char={char}
          index={index}
          totalChars={chars.length}
          duration={duration}
          baseColor={baseColor}
          shimmerColor={shimmerColor}
          yDistance={yDistance}
          spread={spread}
          scaleDistance={scaleDistance}
          style={style}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  char: {
    fontFamily: AI_FONTS.regular,
    fontSize: 13.5,
  },
});
