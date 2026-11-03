import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { ThemedText } from './ThemedText';

export interface GroupedListProps {
  title?: string;
  footer?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function GroupedList({ title, footer, children, style }: GroupedListProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, style]}>
      {title ? (
        <ThemedText variant="subheadMedium" secondary style={styles.sectionTitle}>
          {title.toUpperCase()}
        </ThemedText>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {React.Children.map(children, (child, index) => {
          if (!React.isValidElement(child)) return child;
          const isLast = index === React.Children.count(children) - 1;

          return (
            <>
              {child}
              {!isLast ? (
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              ) : null}
            </>
          );
        })}
      </View>

      {footer ? (
        <ThemedText variant="caption" secondary style={styles.sectionFooter}>
          {footer}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  sectionTitle: {
    paddingHorizontal: spacing.sm,
    letterSpacing: 0.6,
  },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56, // Inset aligned with text column
  },
  sectionFooter: {
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xxs,
  },
});
