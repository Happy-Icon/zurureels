import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useNetworkStatus } from '@/lib/networkManager';

interface OfflineStateProps {
  title?: string;
  message?: string;
  onRetry: () => void | Promise<unknown>;
  style?: StyleProp<ViewStyle>;
  fullScreen?: boolean;
}

/**
 * Reusable, theme-aware offline screen.
 * - Distinguishes offline vs loading vs generic server errors.
 * - Displays a clear "You're offline" state with a Retry button.
 * - Automatically executes onRetry when internet connectivity returns.
 */
export function OfflineState({
  title = "You're offline",
  message = "Please check your internet connection. We'll automatically reload when you're back online.",
  onRetry,
  style,
  fullScreen = true,
}: OfflineStateProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const { isOnline } = useNetworkStatus();
  const [retrying, setRetrying] = useState(false);

  // Auto-recovery: when connection is restored, immediately trigger onRetry
  useEffect(() => {
    if (isOnline) {
      handleRetry();
    }
  }, [isOnline]);

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await Promise.resolve(onRetry());
    } finally {
      setRetrying(false);
    }
  };

  const content = (
    <View style={styles.content}>
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: isDark ? 'rgba(238, 125, 48, 0.15)' : '#FFF7ED',
          },
        ]}
      >
        <Feather name="wifi-off" size={36} color="#EE7D30" />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.mutedForeground }]}>
        {message}
      </Text>

      <Pressable
        testID="offline-retry-btn"
        onPress={handleRetry}
        disabled={retrying}
        style={({ pressed }) => [
          styles.retryBtn,
          {
            backgroundColor: '#EE7D30',
            opacity: pressed || retrying ? 0.85 : 1,
          },
        ]}
      >
        {retrying ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Feather name="refresh-cw" size={16} color="#FFFFFF" />
            <Text style={styles.retryBtnText}>Try again</Text>
          </>
        )}
      </Pressable>
    </View>
  );

  if (!fullScreen) {
    return <View style={[styles.inlineContainer, style]}>{content}</View>;
  }

  return (
    <View
      style={[
        styles.fullContainer,
        { backgroundColor: colors.background },
        style,
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  inlineContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 340,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 140,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
