import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors, useTheme } from '@/hooks/useColors';

const ORANGE = '#F26522';

interface PriceBreakdownProps {
  pricePerUnit: number;
  priceUnit: string;
  units: number;          // nights or guests
  isNightBased: boolean;
  cleaningFee?: number;
  serviceFeeRate?: number; // 0.1 = 10%
}

export function PriceBreakdown({
  pricePerUnit,
  priceUnit,
  units,
  isNightBased,
  cleaningFee = 0,
  serviceFeeRate = 0.08,
}: PriceBreakdownProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const subtotal = pricePerUnit * units;
  const serviceFee = Math.round(subtotal * serviceFeeRate);
  const total = subtotal + cleaningFee + serviceFee;

  const unitLabel = isNightBased
    ? `${units} night${units !== 1 ? 's' : ''}`
    : `${units} guest${units !== 1 ? 's' : ''}`;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#27272A' : '#FFFBF8', borderColor: isDark ? '#3F3F46' : '#FCE3D6' }]}>
      <View style={styles.titleRow}>
        <MaterialCommunityIcons name="calculator" size={16} color={colors.mutedForeground} />
        <Text style={[styles.title, { color: colors.mutedForeground }]}>Price Breakdown</Text>
      </View>

      {/* Nightly/per-unit rate */}
      <View style={styles.lineRow}>
        <Text style={[styles.lineLabel, { color: colors.mutedForeground }]}>
          KES {pricePerUnit.toLocaleString()} × {unitLabel}
        </Text>
        <Text style={[styles.lineValue, { color: colors.text }]}>
          KES {subtotal.toLocaleString()}
        </Text>
      </View>

      {/* Cleaning fee */}
      {cleaningFee > 0 ? (
        <View style={styles.lineRow}>
          <Text style={[styles.lineLabel, { color: colors.mutedForeground }]}>Cleaning fee</Text>
          <Text style={[styles.lineValue, { color: colors.text }]}>KES {cleaningFee.toLocaleString()}</Text>
        </View>
      ) : null}

      {/* Service fee */}
      <View style={styles.lineRow}>
        <View style={styles.feeLabelRow}>
          <Text style={[styles.lineLabel, { color: colors.mutedForeground }]}>Service fee</Text>
          <View style={styles.feeBadge}>
            <Text style={styles.feeBadgeText}>ZuruSasa</Text>
          </View>
        </View>
        <Text style={[styles.lineValue, { color: colors.text }]}>KES {serviceFee.toLocaleString()}</Text>
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: isDark ? '#3F3F46' : '#FCE3D6' }]} />

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={[styles.totalLabel, { color: colors.text }]}>Total (KES)</Text>
        <Text style={styles.totalValue}>KES {total.toLocaleString()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFBF8',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FCE3D6',
    padding: 16,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  title: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#717171',
    letterSpacing: 0.3,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lineLabel: {
    fontSize: 13.5,
    fontFamily: 'DMSans_400Regular',
    color: '#4B5563',
  },
  lineValue: {
    fontSize: 13.5,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  feeBadge: {
    backgroundColor: ORANGE + '18',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  feeBadgeText: {
    fontSize: 9,
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#FCE3D6',
    marginVertical: 2,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  totalValue: {
    fontSize: 17,
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },
});
