import React from 'react';
import { Text, type TextProps, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { typography, type TypographyVariant } from '@/theme/typography';

export interface ThemedTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: string;
  secondary?: boolean;
}

export function ThemedText({
  variant = 'body',
  color,
  secondary,
  style,
  ...props
}: ThemedTextProps) {
  const colors = useColors();
  const resolvedColor = color ?? (secondary ? colors.textSecondary : colors.text);

  return (
    <Text
      style={[
        typography[variant],
        { color: resolvedColor },
        style,
      ]}
      {...props}
    />
  );
}
