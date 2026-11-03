import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

export interface ZuruCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  elevated?: boolean;
  accessibilityLabel?: string;
}

export function ZuruCard({
  children,
  onPress,
  style,
  padding = spacing.md,
  elevated = false,
  accessibilityLabel,
}: ZuruCardProps) {
  const colors = useColors();

  const handlePress = () => {
    if (!onPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const cardStyle: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: elevated ? 0 : 1,
    borderColor: colors.border,
    padding,
  };

  if (!onPress) {
    return <View style={[cardStyle, style]}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={handlePress}
      style={({ pressed }) => [
        cardStyle,
        {
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
