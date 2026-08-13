import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/context/AuthContext';
import { CustomAlertProvider } from '@/context/CustomAlertContext';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { initSentry, Sentry } from '@/lib/sentry';

// Initialize Sentry Monitoring
initSentry();

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const router = useRouter();

  useEffect(() => {
    let sub: any = null;
    try {
      const Constants = require('expo-constants').default;
      const isExpoGo =
        Constants?.executionEnvironment === 'storeClient' ||
        Constants?.appOwnership === 'expo';

      if (!isExpoGo) {
        const Notifs = require('expo-notifications');
        if (Notifs?.addNotificationResponseReceivedListener) {
          sub = Notifs.addNotificationResponseReceivedListener((response: any) => {
            const data = response?.notification?.request?.content?.data;
            const actionType = data?.actionType || data?.type;
            const conversationId = data?.conversationId || (actionType === 'chat' ? data?.actionId : null);
            const bookingId = data?.bookingId || (actionType === 'booking' ? data?.actionId : null);

            if (conversationId) {
              router.push(`/chat/${conversationId}`);
            } else if (bookingId || actionType === 'booking') {
              router.push('/reservations');
            }
          });
        }
      }
    } catch (e) {
      console.warn('Push tap listener setup note:', e);
    }

    return () => {
      if (sub?.remove) sub.remove();
    };
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="auth"
        options={{ headerShown: false, presentation: 'formSheet' }}
      />
      <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="notifications/index" options={{ headerShown: false }} />
      <Stack.Screen name="reviews/index" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="host" options={{ headerShown: false }} />
      <Stack.Screen name="become-host" options={{ headerShown: false }} />
    </Stack>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    InstrumentSerif_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <CustomAlertProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </CustomAlertProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
