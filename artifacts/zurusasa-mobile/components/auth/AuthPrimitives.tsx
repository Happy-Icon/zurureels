import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

import { MUTED } from './authConstants';
import { authStyles as styles } from './authStyles';

// ── Google SVG Logo ───────────────────────────────────────────────────────────
export function GoogleLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

// ── Premium Auth Button ────────────────────────────────────────────────────────
export interface AuthButtonProps {
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  disabled?: boolean;
  delay?: number;
  animValue: Animated.Value;
}

export function AuthButton({
  onPress,
  icon,
  label,
  sublabel,
  disabled,
  animValue,
}: AuthButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const opacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      <Pressable
        onPress={() => {
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={styles.authButton}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {/* Left icon */}
        <View style={styles.authButtonIcon}>{icon}</View>

        {/* Labels */}
        <View style={styles.authButtonLabels}>
          <Text style={styles.authButtonLabel}>{label}</Text>
          {sublabel ? (
            <Text style={styles.authButtonSublabel}>{sublabel}</Text>
          ) : null}
        </View>

        {/* Right chevron */}
        <Feather name="chevron-right" size={18} color={MUTED} />
      </Pressable>
    </Animated.View>
  );
}

// ── Animated Destination Indicator ────────────────────────────────────────────
export function DestinationDot({
  active,
}: {
  active: boolean;
  index: number;
  current: number;
}) {
  const width = useRef(new Animated.Value(active ? 24 : 6)).current;
  useEffect(() => {
    Animated.spring(width, {
      toValue: active ? 24 : 6,
      useNativeDriver: false,
      tension: 200,
      friction: 15,
    }).start();
  }, [active]);
  return (
    <Animated.View
      style={[
        styles.dot,
        { width, backgroundColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.4)' },
      ]}
    />
  );
}
