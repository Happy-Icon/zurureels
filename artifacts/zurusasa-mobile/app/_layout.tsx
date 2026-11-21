import React, { useCallback, useEffect, useRef } from 'react';
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
import { realtimeManager } from '@/lib/realtimeManager';
import { notificationService } from '@/services/notificationService';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavThemeProvider,
  Stack,
  useRouter,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});
try {
  SplashScreen.setOptions({ duration: 220, fade: true });
} catch {}
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

  const navigateFromNotificationData = useCallback(
    (data: Record<string, any> | undefined | null) => {
      if (!data) return;
      const actionType = data.actionType || data.action_type || data.type;
      const actionId = data.actionId || data.action_id;
      const conversationId = data.conversationId || data.conversation_id || (actionType === 'chat' ? actionId : null);
      const bookingId = data.bookingId || data.booking_id || (actionType === 'booking' ? actionId : null);

      if (conversationId) {
        router.push(`/chat/${conversationId}`);
      } else if (actionType === 'chat') {
        router.push('/(tabs)/inbox');
      } else if (bookingId || actionType === 'booking') {
        router.push('/(tabs)/reservations');
      } else if (actionType === 'payout') {
        router.push('/host/wallet');
      } else if (actionType === 'listing') {
        router.push('/(tabs)/listings');
      } else if (actionType === 'discover') {
        router.push('/(tabs)/discover');
      } else if (actionType === 'profile') {
        router.push('/(tabs)/profile');
      } else if (actionType === 'support') {
        router.push('/profile/support');
      }
    },
    [router],
  );

  useEffect(() => {
    let sub: any = null;
    try {
      const Notifs = require('expo-notifications');
      if (Notifs?.addNotificationResponseReceivedListener) {
        sub = Notifs.addNotificationResponseReceivedListener((response: any) => {
          navigateFromNotificationData(response?.notification?.request?.content?.data);
        });
      }

      // Cold-start notification tap deep-linking
      if (Notifs?.getLastNotificationResponseAsync) {
        Notifs.getLastNotificationResponseAsync()
          .then((response: any) => {
            if (response) {
              navigateFromNotificationData(response?.notification?.request?.content?.data);
            }
          })
          .catch((e: any) => console.log('[Push] Cold start notification note:', e));
      }
    } catch (e) {
      console.warn('[Push] Tap listener setup note:', e);
    }

    return () => {
      if (sub?.remove) sub.remove();
    };
  }, [navigateFromNotificationData]);

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
        <Stack.Screen
          name="payment-callback"
          options={{ headerShown: false, animation: 'fade' }}
        />
      </Stack>
    </NavThemeProvider>
  );
}

function GlobalNotificationSubscriber() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    // 1. Configure Android channel, push token registration & OS token rotation listener (single owner)
    notificationService.registerPushToken(userId).catch((e) => {
      console.log('[Push] Global token registration note:', e);
    });
    const stopTokenRefresh = notificationService.startPushTokenRefreshListener(userId);
    const stopForegroundDedupe = notificationService.startForegroundPushListener();

    // 2. Global shared Realtime subscription for incoming notifications (ref-counted with useNotifications)
    const unsubscribe = realtimeManager.subscribe(
      {
        key: `notifications:${userId}`,
        topicPrefix: `notifs_${userId}`,
        bindings: [
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
        ],
      },
      (payload) => {
        if (payload.eventType !== 'INSERT') return;
        const newNotif = payload.new as any;
        if (newNotif) {
          // Deduplicate against remote Expo push already shown in foreground
          const fallbackKey =
            newNotif.type && newNotif.action_id ? `${newNotif.type}:${newNotif.action_id}` : null;
          if (!notificationService.wasRecentlyPresentedByRemotePush(newNotif.id, fallbackKey)) {
            notificationService.presentLocalNotification({
              title: newNotif.title || 'ZuruSasa Notification',
              body: newNotif.message || '',
              data: {
                id: newNotif.id,
                notificationId: newNotif.id,
                type: newNotif.type,
                actionType: newNotif.action_type,
                actionId: newNotif.action_id,
              },
            });
          }

          // Invalidate React Query caches so all screens update seamlessly
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
          if (
            newNotif.action_type === 'booking' ||
            newNotif.type?.startsWith('booking_') ||
            newNotif.type?.startsWith('payment_') ||
            newNotif.type === 'refund_processed' ||
            newNotif.type === 'arrival_issue_reported'
          ) {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['host-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['host-calendar-bookings'] });
          }
        }
      },
      {
        onReconnect: () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
        },
      },
    );

    return () => {
      stopTokenRefresh();
      stopForegroundDedupe();
      unsubscribe();
    };
  }, [userId, queryClient]);

  return null;
}

function RootLayoutInner() {
  const colors = useColors();
  const { isReady: themeReady } = useTheme();
  const { isBootReady } = useAuth();
  const { markInteractive } = useObserve();
  const hasHiddenSplashRef = useRef(false);
  const appReady = isBootReady && themeReady;

  const hideNativeSplashOnce = useCallback(() => {
    if (hasHiddenSplashRef.current || !appReady) return;
    hasHiddenSplashRef.current = true;
    requestAnimationFrame(() => {
      SplashScreen.hideAsync().catch(() => {});
      markInteractive();
    });
  }, [appReady, markInteractive]);

  // Safety fallback in case layout already occurred before appReady transitioned to true
  useEffect(() => {
    if (appReady) {
      hideNativeSplashOnce();
    }
  }, [appReady, hideNativeSplashOnce]);

  if (!appReady) {
    // Keep the single native OS splash screen visible until local auth + theme are hydrated
    return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
  }

  return (
    <GestureHandlerRootView
      onLayout={hideNativeSplashOnce}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
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
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary
        onError={(error, componentStack) => {
          console.error('[RootErrorBoundary] Unhandled rendering error caught:', error, componentStack);
          try {
            Sentry.captureException(error, { extra: { componentStack } });
          } catch {}
        }}
      >
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
