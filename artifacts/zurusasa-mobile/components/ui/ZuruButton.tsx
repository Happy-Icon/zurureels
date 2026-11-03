import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { ThemedText } from './ThemedText';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ZuruButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  enableHaptics?: boolean;
}

export function ZuruButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
  enableHaptics = true,
}: ZuruButtonProps) {
  const colors = useColors();
  const { isDark } = useTheme();

  const handlePress = () => {
    if (disabled || loading) return;
    if (enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress?.();
  };

  const isInteractive = !disabled && !loading;

  // Resolve Variant Colors
  let bg = colors.primary;
  let textColor = '#FFFFFF';
  let borderColor = 'transparent';
  let borderWidth = 0;

  if (variant === 'secondary') {
    bg = isDark ? '#27272A' : '#F3F4F6';
    textColor = colors.text;
  } else if (variant === 'outline') {
    bg = 'transparent';
    borderColor = colors.border;
    borderWidth = 1.5;
    textColor = colors.text;
  } else if (variant === 'ghost') {
    bg = 'transparent';
    textColor = colors.text;
  } else if (variant === 'destructive') {
    bg = colors.destructive;
    textColor = '#FFFFFF';
  }

  // Resolve Size Dimensions
  const height = size === 'sm' ? 38 : size === 'lg' ? 54 : 48;
  const paddingHorizontal = size === 'sm' ? spacing.md : spacing.lg;
  const fontVariant = size === 'sm' ? 'callout' : 'headline';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      disabled={!isInteractive}
      onPress={handlePress}
      hitSlop={size === 'sm' ? { top: 6, bottom: 6, left: 6, right: 6 } : undefined}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          paddingHorizontal,
          backgroundColor: bg,
          borderColor,
          borderWidth,
          borderRadius: radius.card,
          opacity: disabled ? 0.45 : pressed ? 0.90 : 1,
          transform: [{ scale: pressed && isInteractive ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {leftIcon}
          <ThemedText
            variant={fontVariant}
            color={textColor}
            style={[styles.label, textStyle]}
          >
            {title}
          </ThemedText>
          {rightIcon}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    textAlign: 'center',
  },
});
