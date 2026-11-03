import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { reservationsStyles as styles } from './reservationsStyles';

export function StatusPill({ status }: { status: string | null }) {
  const s = (status ?? 'pending').toLowerCase();
  let bg = '#FFF7ED';
  let color = '#D97706';
  let iconName: keyof typeof Feather.glyphMap = 'clock';
  let label = 'Pending';

  if (s === 'paid') {
    bg = '#EFF6FF';
    color = '#2563EB';
    iconName = 'clock';
    label = 'Awaiting Host';
  } else if (s === 'confirmed') {
    bg = '#ECFDF5';
    color = '#059669';
    iconName = 'check-circle';
    label = 'Confirmed';
  } else if (s === 'completed') {
    bg = '#EFF6FF';
    color = '#2563EB';
    iconName = 'check-square';
    label = 'Completed';
  } else if (s === 'refund_pending') {
    bg = '#FFFBEB';
    color = '#D97706';
    iconName = 'refresh-cw';
    label = 'Refund Pending';
  } else if (s === 'cancelled' || s === 'refunded') {
    bg = '#FEF2F2';
    color = '#DC2626';
    iconName = 'x-circle';
    label = s === 'refunded' ? 'Refunded' : 'Cancelled';
  }

  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <Feather name={iconName} size={11} color={color} />
      <Text style={[styles.statusPillText, { color }]}>{label}</Text>
    </View>
  );
}
