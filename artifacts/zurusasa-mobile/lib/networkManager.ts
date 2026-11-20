import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { realtimeManager } from '@/lib/realtimeManager';
import { supabase } from '@/lib/supabase';

let isNetworkSetup = false;

/**
 * Connects React Native NetInfo and AppState to TanStack React Query,
 * Supabase auth auto-refresh, and the centralized Realtime subscription manager.
 * Guarantees that when internet connectivity is restored or the app returns to
 * the foreground, active queries and Realtime subscriptions recover cleanly.
 */
export function setupNetworkAndFocusManagers() {
  if (isNetworkSetup) return;
  isNetworkSetup = true;

  // 1. Hook React Query's onlineManager & RealtimeManager to NetInfo
  try {
    onlineManager.setEventListener((setOnline) => {
      try {
        return NetInfo.addEventListener((state: NetInfoState) => {
          const isOnline = Boolean(
            state.isConnected && state.isInternetReachable !== false,
          );
          setOnline(isOnline);
          realtimeManager.setOnline(isOnline);
        });
      } catch (err) {
        console.warn('[NetworkManager] NetInfo listener setup fallback:', err);
        return () => {};
      }
    });
  } catch (err) {
    console.warn('[NetworkManager] NetInfo module not in binary:', err);
  }

  // 2. Hook React Query's focusManager, Supabase auth refresh, and RealtimeManager to AppState
  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (status: AppStateStatus) => {
      const isForeground = status === 'active';
      focusManager.setFocused(isForeground);

      if (isForeground) {
        supabase.auth.startAutoRefresh();
        realtimeManager.setForeground(true);

        // Re-check network connectivity when user returns to the app
        try {
          NetInfo.fetch()
            .then((state) => {
              const isOnline = Boolean(
                state.isConnected && state.isInternetReachable !== false,
              );
              onlineManager.setOnline(isOnline);
              realtimeManager.setOnline(isOnline);
            })
            .catch(() => {});
        } catch {}
      } else {
        supabase.auth.stopAutoRefresh();
        realtimeManager.setForeground(false);
      }
    });
  }
}

export interface NetworkStatus {
  isOnline: boolean;
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}

export const networkManager = {
  isOnline: (): boolean => onlineManager.isOnline(),
};


/**
 * Hook to inspect the real-time network connectivity of the device.
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => ({
    isOnline: onlineManager.isOnline(),
    isConnected: true,
    isInternetReachable: true,
  }));

  useEffect(() => {
    try {
      NetInfo.fetch()
        .then((state) => {
          const isOnline = Boolean(
            state.isConnected && state.isInternetReachable !== false,
          );
          setStatus({
            isOnline,
            isConnected: state.isConnected,
            isInternetReachable: state.isInternetReachable,
          });
        })
        .catch(() => {});

      const unsubscribe = NetInfo.addEventListener((state) => {
        const isOnline = Boolean(
          state.isConnected && state.isInternetReachable !== false,
        );
        setStatus({
          isOnline,
          isConnected: state.isConnected,
          isInternetReachable: state.isInternetReachable,
        });
      });

      return () => {
        try {
          unsubscribe();
        } catch {}
      };
    } catch (err) {
      console.warn('[NetworkStatus] NetInfo native module note:', err);
      return () => {};
    }
  }, []);

  return status;
}
