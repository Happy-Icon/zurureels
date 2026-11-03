import * as Sentry from '@sentry/react-native';

export const SENTRY_DSN = (process.env.EXPO_PUBLIC_SENTRY_DSN ?? '').trim();

export function initSentry() {
  if (!SENTRY_DSN) {
    if (__DEV__) {
      console.warn('[Sentry] EXPO_PUBLIC_SENTRY_DSN is not configured; skipping initialization.');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    tracePropagationTargets: ['localhost', /^https:\/\/.*\.supabase\.co\/api/],
    enableAutoSessionTracking: true,
    enableNative: true,
    debug: __DEV__,
  });
}

/** Helper logger for sending logs & breadcrumbs to Sentry */
export const sentryLogger = {
  info: (message: string, extra?: Record<string, any>) => {
    if (SENTRY_DSN) {
      Sentry.addBreadcrumb({
        category: 'info',
        message,
        data: extra,
        level: 'info',
      });
    }
    if (__DEV__) {
      console.log('[Sentry Info]', message, extra ?? '');
    }
  },
  error: (error: any, extra?: Record<string, any>) => {
    if (SENTRY_DSN) {
      Sentry.captureException(error, { extra });
    }
    if (__DEV__) {
      console.error('[Sentry Error]', error, extra ?? '');
    }
  },
};

export { Sentry };
