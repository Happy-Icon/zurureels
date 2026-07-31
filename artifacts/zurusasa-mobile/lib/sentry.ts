import * as Sentry from '@sentry/react-native';

export const SENTRY_DSN =
  'https://71ea0a19db54fa68bc3f803b06d4a427@o4511392943898625.ingest.us.sentry.io/4511829829287936';

export function initSentry() {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 1.0,
    tracePropagationTargets: ['localhost', /^https:\/\/.*\.supabase\.co\/api/],
    enableAutoSessionTracking: true,
    enableNative: true,
    debug: __DEV__,
  });
}

/** Helper logger for sending logs & breadcrumbs to Sentry */
export const sentryLogger = {
  info: (message: string, extra?: Record<string, any>) => {
    Sentry.addBreadcrumb({
      category: 'info',
      message,
      data: extra,
      level: 'info',
    });
    if (__DEV__) {
      console.log('[Sentry Info]', message, extra ?? '');
    }
  },
  error: (error: any, extra?: Record<string, any>) => {
    Sentry.captureException(error, { extra });
    if (__DEV__) {
      console.error('[Sentry Error]', error, extra ?? '');
    }
  },
};

export { Sentry };
