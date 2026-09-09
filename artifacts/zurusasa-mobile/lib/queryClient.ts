import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Do not retry aborted requests or 4xx client errors
        if (error?.name === 'AbortError') return false;
        if (error?.status && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      networkMode: 'online', // Automatically pauses when offline and resumes upon reconnect
      refetchOnReconnect: true, // Refetches active queries when internet returns
      refetchOnWindowFocus: true, // Refetches stale queries when returning to active app
      staleTime: 15_000,
    },
    mutations: {
      // NEVER retry mutations automatically on reconnect (Requirements 7 & 8)
      // Prevents double booking charges or duplicate message sends
      retry: 0,
      networkMode: 'always',
    },
  },
});
