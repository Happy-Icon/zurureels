import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

/**
 * Sticky sub-screen header matching the web app's "Back to Profile" bar.
 */
export function ScreenHeader({ label = 'Back to Profile' }: { label?: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: topPad + 8,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Pressable
        testID="back-to-profile"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)/profile');
          }
        }}
        style={({ pressed }) => [styles.backRow, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Feather name="arrow-left" size={20} color={colors.mutedForeground} />
        <Text style={[styles.backText, { color: colors.mutedForeground }]}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
  },
});
