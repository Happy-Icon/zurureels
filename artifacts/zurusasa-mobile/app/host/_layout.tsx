import React from 'react';
import { Stack } from 'expo-router';

export default function HostLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="create-reel" options={{ presentation: 'modal' }} />
      <Stack.Screen name="payouts" />
      <Stack.Screen name="verification" />
    </Stack>
  );
}
