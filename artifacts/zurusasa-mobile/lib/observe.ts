import React from 'react';
import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';

/**
 * EAS Observe Safe Wrapper
 *
 * EAS Observe requires native modules ('ExpoAppMetrics' & 'ExpoObserve')
 * which are not present in Expo Go or uncompiled dev clients.
 * This wrapper gracefully provides no-ops when running in Expo Go or
 * when native modules aren't linked, preventing fatal module loading crashes.
 */

export interface ObserveConfig {
  integrations?: {
    'expo-router'?: boolean;
    'react-navigation'?: boolean;
  };
  [key: string]: any;
}

interface ObserveModuleInterface {
  configure: (config: ObserveConfig) => void;
  reportError?: (error: any, options?: any) => void;
  setBundleDefaults?: (defaults: any) => void;
  [key: string]: any;
}

let realObserve: any = null;

const isNativeAvailable = (() => {
  try {
    if (isRunningInExpoGo()) {
      return false;
    }
    const hasAppMetrics = !!requireOptionalNativeModule('ExpoAppMetrics');
    const hasExpoObserve = !!requireOptionalNativeModule('ExpoObserve');
    return hasAppMetrics && hasExpoObserve;
  } catch {
    return false;
  }
})();

if (isNativeAvailable) {
  try {
    // Dynamically require so Metro doesn't execute native initialization in Expo Go
    realObserve = require('expo-observe');
  } catch (err) {
    if (__DEV__) {
      console.warn('[EAS Observe] Failed to initialize native expo-observe:', err);
    }
    realObserve = null;
  }
} else if (__DEV__) {
  console.log(
    '[EAS Observe] Running in Expo Go or unlinked environment. Observe telemetry is safely mocked.'
  );
}

// Observe proxy / fallback
export const Observe: ObserveModuleInterface = realObserve?.Observe ?? {
  configure: (_config: ObserveConfig) => {
    // No-op in Expo Go / unlinked builds
  },
  reportError: (_error: any, _options?: any) => {},
  setBundleDefaults: (_defaults: any) => {},
};

// ObserveRoot fallback
export const ObserveRoot = realObserve?.ObserveRoot ?? {
  wrap: function wrap<P extends Record<string, unknown>>(
    Component: React.ComponentType<P>
  ): React.ComponentType<P> {
    return Component;
  },
};

// useObserve hook fallback
const noopMarkInteractive = () => {};
const fallbackUseObserve = () => ({ markInteractive: noopMarkInteractive });

export const useObserve: () => { markInteractive: () => void } =
  realObserve?.useObserve ?? fallbackUseObserve;
