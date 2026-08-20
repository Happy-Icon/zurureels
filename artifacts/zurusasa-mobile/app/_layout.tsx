import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { CustomAlertProvider } from '@/context/CustomAlertContext';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavThemeProvider,
} from '@react-navigation/native';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';
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
import { StatusBar } from 'expo-status-bar';
import { initSentry, Sentry } from '@/lib/sentry';

// Initialize Sentry Monitoring
initSentry();

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

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
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
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

function RootLayoutInner() {
  const colors = useColors();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardProvider>
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

export default Sentry.wrap(RootLayout);
