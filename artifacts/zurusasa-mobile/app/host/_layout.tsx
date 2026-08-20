import React from 'react';
import { Stack } from 'expo-router';
import { useColors } from '@/hooks/useColors';

export default function HostLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="create-reel" options={{ presentation: 'modal' }} />
      <Stack.Screen name="payouts" />
      <Stack.Screen name="verification" />
    </Stack>
  );
}
