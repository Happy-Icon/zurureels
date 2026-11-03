import React from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { spacing } from '@/theme/spacing';
import { ThemedText } from './ThemedText';

export interface SettingsRowProps {
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  valueText?: string;
  isSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (val: boolean) => void;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function SettingsRow({
  label,
  sublabel,
  icon,
  iconBg,
  valueText,
  isSwitch = false,
  switchValue = false,
  onSwitchChange,
  onPress,
  showChevron = true,
  destructive = false,
  style,
  accessibilityLabel,
}: SettingsRowProps) {
  const colors = useColors();

  const handlePress = () => {
    if (isSwitch) {
      Haptics.selectionAsync().catch(() => {});
      onSwitchChange?.(!switchValue);
      return;
    }
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onPress();
    }
  };

  const interactive = Boolean(onPress || isSwitch);

  return (
    <Pressable
      accessibilityRole={isSwitch ? 'switch' : interactive ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={isSwitch ? { checked: switchValue } : undefined}
      disabled={!interactive}
      onPress={interactive ? handlePress : undefined}
      style={({ pressed }) => [
        styles.row,
        { opacity: pressed && interactive ? 0.75 : 1 },
        style,
      ]}
    >
      {icon ? (
        <View style={[styles.iconBox, { backgroundColor: iconBg ?? (destructive ? 'rgba(239, 68, 68, 0.12)' : colors.secondary) }]}>
          {icon}
        </View>
      ) : null}

      <View style={styles.textCol}>
        <ThemedText
          variant="bodyMedium"
          color={destructive ? colors.destructive : colors.text}
          numberOfLines={1}
        >
          {label}
        </ThemedText>
        {sublabel ? (
          <ThemedText variant="caption" secondary numberOfLines={2}>
            {sublabel}
          </ThemedText>
        ) : null}
      </View>

      {valueText ? (
        <ThemedText variant="callout" secondary style={styles.valueText}>
          {valueText}
        </ThemedText>
      ) : null}

      {isSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={(val) => {
            Haptics.selectionAsync().catch(() => {});
            onSwitchChange?.(val);
          }}
          trackColor={{ false: colors.border, true: colors.primary }}
        />
      ) : showChevron && onPress ? (
        <Feather name="chevron-right" size={18} color={colors.textSecondary} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    gap: spacing.md,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  valueText: {
    marginRight: 4,
  },
});
