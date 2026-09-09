import React, { useEffect } from 'react';
import { View } from 'react-native';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CustomAlertProvider } from '@/context/CustomAlertContext';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';
import { supabase } from '@/lib/supabase';
import { notificationService } from '@/services/notificationService';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavThemeProvider,
  Stack,
  useRouter,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { initSentry, Sentry } from '@/lib/sentry';
import { Observe, ObserveRoot, useObserve } from '@/lib/observe';

// Initialize Sentry Monitoring
initSentry();

// Initialize EAS Observe with Expo Router per-route navigation metrics
Observe.configure({
  integrations: { 'expo-router': true },
});

import { setupNetworkAndFocusManagers } from '@/lib/networkManager';

// Initialize network and app state listeners for React Query auto-recovery
setupNetworkAndFocusManagers();

import { queryClient } from '@/lib/queryClient';

function RootLayoutNav() {
  const router = useRouter();
  const colors = useColors();
  const { isDark } = useTheme();

  const navTheme = React.useMemo(() => {
    const baseTheme = isDark ? DarkTheme : DefaultTheme;
    return {
      ...baseTheme,
      dark: isDark,
      colors: {
        ...baseTheme.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.card,
        text: colors.text,
        border: colors.border,
        notification: colors.accent,
      },
    };
  }, [isDark, colors]);

  useEffect(() => {
    let sub: any = null;
    try {
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

      // Cold-start notification tap deep-linking
      if (Notifs?.getLastNotificationResponseAsync) {
        Notifs.getLastNotificationResponseAsync().then((response: any) => {
          if (response) {
            const data = response?.notification?.request?.content?.data;
            const actionType = data?.actionType || data?.type;
            const conversationId = data?.conversationId || (actionType === 'chat' ? data?.actionId : null);
            const bookingId = data?.bookingId || (actionType === 'booking' ? data?.actionId : null);

            if (conversationId) {
              router.push(`/chat/${conversationId}`);
            } else if (bookingId || actionType === 'booking') {
              router.push('/reservations');
            }
          }
        }).catch((e: any) => console.log('[Push] Cold start notification note:', e));
      }
    } catch (e) {
      console.warn('[Push] Tap listener setup note:', e);
    }

    return () => {
      if (sub?.remove) sub.remove();
    };
  }, [router]);

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
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
    </NavThemeProvider>
  );
}

function GlobalNotificationSubscriber() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    // 1. Configure Android channel and push token registration
    notificationService.registerPushToken(user.id).catch((e) => {
      console.log('[Push] Global token registration note:', e);
    });

    // 2. Global Realtime subscription for incoming notifications to drop local banners on device
    const channelName = `global_notifs_${user.id}_${Math.random().toString(36).substring(2, 6)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as any;
          if (newNotif) {
            // Trigger native notification heads-up banner on device immediately
            notificationService.presentLocalNotification({
              title: newNotif.title || 'ZuruSasa Notification',
              body: newNotif.message || '',
              data: {
                id: newNotif.id,
                type: newNotif.type,
                actionType: newNotif.action_type,
                actionId: newNotif.action_id,
              },
            });

            // Invalidate React Query caches so all screens update seamlessly
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
            if (
              newNotif.action_type === 'booking' ||
              newNotif.type?.startsWith('booking_') ||
              newNotif.type === 'payment_success' ||
              newNotif.type === 'refund_processed'
            ) {
              queryClient.invalidateQueries({ queryKey: ['bookings'] });
              queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
              queryClient.invalidateQueries({ queryKey: ['host-bookings'] });
              queryClient.invalidateQueries({ queryKey: ['host-calendar-bookings'] });
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [user, queryClient]);

  return null;
}

function RootLayoutInner() {
  const colors = useColors();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardProvider>
        <GlobalNotificationSubscriber />
        <RootLayoutNav />
      </KeyboardProvider>
    </GestureHandlerRootView>
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
  const { markInteractive } = useObserve();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
      markInteractive();
    }
  }, [fontsLoaded, fontError, markInteractive]);

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <CustomAlertProvider>
                <RootLayoutInner />
              </CustomAlertProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default ObserveRoot.wrap(Sentry.wrap(RootLayout));
