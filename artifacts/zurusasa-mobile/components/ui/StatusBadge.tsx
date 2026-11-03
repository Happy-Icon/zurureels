import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { ThemedText } from './ThemedText';

export type BadgeStatus =
  | 'confirmed'
  | 'paid'
  | 'completed'
  | 'pending'
  | 'processing'
  | 'approval_required'
  | 'declined'
  | 'cancelled'
  | 'refunded'
  | 'instant'
  | 'verified';

export interface StatusBadgeProps {
  status: BadgeStatus | string;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function StatusBadge({ status, label, style }: StatusBadgeProps) {
  const colors = useColors();
  const { isDark } = useTheme();

  const normalized = (status || '').toLowerCase().trim();

  let dotColor = '#10B981';
  let badgeBg = isDark ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5';
  let textColor = '#059669';
  let defaultLabel = 'Confirmed';

  if (normalized === 'confirmed' || normalized === 'paid') {
    dotColor = '#10B981';
    badgeBg = isDark ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5';
    textColor = isDark ? '#34D399' : '#059669';
    defaultLabel = 'Confirmed';
  } else if (normalized === 'completed') {
    dotColor = '#3B82F6';
    badgeBg = isDark ? 'rgba(59, 130, 246, 0.16)' : '#EFF6FF';
    textColor = isDark ? '#60A5FA' : '#2563EB';
    defaultLabel = 'Completed';
  } else if (normalized === 'pending' || normalized === 'processing' || normalized === 'approval_required') {
    dotColor = '#F59E0B';
    badgeBg = isDark ? 'rgba(245, 158, 11, 0.16)' : '#FFFBEB';
    textColor = isDark ? '#FBBF24' : '#D97706';
    defaultLabel = 'Pending Approval';
  } else if (normalized === 'declined' || normalized === 'cancelled' || normalized === 'failed') {
    dotColor = '#EF4444';
    badgeBg = isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2';
    textColor = isDark ? '#F87171' : '#DC2626';
    defaultLabel = normalized === 'declined' ? 'Declined' : 'Cancelled';
  } else if (normalized === 'refunded') {
    dotColor = '#8B5CF6';
    badgeBg = isDark ? 'rgba(139, 92, 246, 0.16)' : '#F5F3FF';
    textColor = isDark ? '#A78BFA' : '#7C3AED';
    defaultLabel = 'Refunded';
  } else if (normalized === 'instant') {
    dotColor = '#F26522';
    badgeBg = isDark ? 'rgba(242, 101, 34, 0.16)' : '#FFF5EF';
    textColor = isDark ? '#FB923C' : '#F26522';
    defaultLabel = 'Instant Booking';
  }

  const displayLabel = label || defaultLabel;

  return (
    <View
      accessibilityLabel={`Status: ${displayLabel}`}
      style={[styles.badge, { backgroundColor: badgeBg }, style]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <ThemedText variant="captionBold" color={textColor}>
        {displayLabel}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 1,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
