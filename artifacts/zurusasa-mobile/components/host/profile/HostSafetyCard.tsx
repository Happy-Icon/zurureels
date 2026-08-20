import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors, useTheme } from '@/hooks/useColors';

export function HostSafetyCard() {
  const colors = useColors();
  const { isDark } = useTheme();

  const safetyPoints = [
    { title: 'Bookings Protected', sub: '24/7 guest protection & emergency support' },
    { title: 'Identity Verified', sub: 'Government ID & phone check verified' },
    { title: 'Secure Payments', sub: 'Encrypted transactions via M-Pesa & Card' },
    { title: 'Community Standards', sub: 'Adheres to ZuruSasa host quality code' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Feather name="shield" size={18} color="#F26522" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>ZuruSasa Protection & Trust</Text>
      </View>

      <View style={styles.listStack}>
        {safetyPoints.map((pt, idx) => (
          <View key={idx} style={styles.pointRow}>
            <Feather name="check-circle" size={15} color="#10B981" style={{ marginTop: 2 }} />
            <View style={styles.pointTextGroup}>
              <Text style={[styles.pointTitle, { color: colors.text }]}>{pt.title}</Text>
              <Text style={[styles.pointSub, { color: colors.mutedForeground }]}>{pt.sub}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    padding: 18,
    gap: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(242, 101, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  listStack: {
    gap: 12,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  pointTextGroup: {
    flex: 1,
    gap: 2,
  },
  pointTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  pointSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
});
