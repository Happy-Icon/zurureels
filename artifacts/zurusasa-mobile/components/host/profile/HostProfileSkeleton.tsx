import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Skeleton } from '@/components/Skeleton';

export function HostProfileSkeleton() {
  return (
    <View style={styles.container}>
      {/* Header Avatar & Name Skeleton */}
      <View style={styles.centerSection}>
        <Skeleton style={{ width: 96, height: 96, borderRadius: 48 }} />
        <Skeleton style={{ width: 160, height: 26, borderRadius: 6 }} />
        <Skeleton style={{ width: 120, height: 16, borderRadius: 4 }} />
      </View>

      {/* Stats Card Skeleton */}
      <Skeleton style={{ width: '100%', height: 120, borderRadius: 20 }} />

      {/* Trust Badges Skeleton */}
      <View style={{ gap: 10 }}>
        <Skeleton style={{ width: 160, height: 20, borderRadius: 4 }} />
        <View style={styles.badgeRow}>
          <Skeleton style={{ width: 140, height: 40, borderRadius: 14 }} />
          <Skeleton style={{ width: 140, height: 40, borderRadius: 14 }} />
        </View>
      </View>

      {/* Bio Skeleton */}
      <View style={{ gap: 8 }}>
        <Skeleton style={{ width: 120, height: 20, borderRadius: 4 }} />
        <Skeleton style={{ width: '100%', height: 16, borderRadius: 4 }} />
        <Skeleton style={{ width: '85%', height: 16, borderRadius: 4 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 24,
  },
  centerSection: {
    alignItems: 'center',
    gap: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
