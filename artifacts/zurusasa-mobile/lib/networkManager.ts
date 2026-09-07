import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';

let isNetworkSetup = false;

/**
 * Connects React Native NetInfo and AppState to TanStack React Query.
 * Guarantees that when internet connectivity is restored or the app returns to
 * the foreground, all active queries automatically resume and refetch.
 */
export function setupNetworkAndFocusManagers() {
  if (isNetworkSetup) return;
  isNetworkSetup = true;

  // 1. Hook React Query's onlineManager to NetInfo
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state: NetInfoState) => {
      const isOnline = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );
      setOnline(isOnline);
    });
  });

  // 2. Hook React Query's focusManager to AppState (foreground / background)
  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
      if (status === 'active') {
        // Re-check network connectivity when user returns to the app
        NetInfo.fetch().then((state) => {
          const isOnline = Boolean(
            state.isConnected && state.isInternetReachable !== false,
          );
          onlineManager.setOnline(isOnline);
        });
      }
    });
  }
}

export interface NetworkStatus {
  isOnline: boolean;
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}

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
    // Initial fetch
    NetInfo.fetch().then((state) => {
      const isOnline = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );
      setStatus({
        isOnline,
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
      });
    });

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
      unsubscribe();
    };
  }, []);

  return status;
}
