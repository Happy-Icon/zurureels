import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { HistoryBottomSheet } from '@/components/history/HistoryBottomSheet';

export default function HistoryScreen() {
  const router = useRouter();
  const colors = useColors();
  const [visible, setVisible] = useState(true);

  const handleClose = () => {
    setVisible(false);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(tabs)/profile');
    }
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <HistoryBottomSheet visible={visible} onClose={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
