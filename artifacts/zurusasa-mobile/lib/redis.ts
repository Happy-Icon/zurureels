/**
 * Upstash Redis Server-Delegated Caching Bridge for ZuruSasa Mobile
 * Invokes Supabase Edge Function 'redis-cache' which securely holds
 * UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN server-side.
 */

import { supabase } from '@/lib/supabase';

/**
 * Invokes the server-side redis-cache Edge Function to get cached feeds.
 * Includes complete fallback protection: if Edge Function or Redis is unreachable,
 * gracefully falls back to executing the database query directly.
 */
export async function fetchServerCachedQuery<T>(
  action: 'get_reels_feed' | 'get_experiences',
  dbFallbackFn: () => Promise<T>,
  params?: { category?: string }
): Promise<T> {
  try {
    const edgePromise = supabase.functions.invoke('redis-cache', {
      body: { action, ...params },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Redis cache timeout')), 5000)
    );

    const { data: res, error } = (await Promise.race([
      edgePromise,
      timeoutPromise,
    ])) as any;

    if (!error && res?.data) {
      return res.data as T;
    }
  } catch {
    // Seamless fallback to direct database query without noisy console warnings
  }

  return await dbFallbackFn();
}

/**
 * Invokes the server-side redis-cache Edge Function to invalidate cache keys.
 */
export async function invalidateServerCache(
  action: 'invalidate_reels_feed',
  params?: Record<string, any>
): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('redis-cache', {
      body: { action, ...params },
    });
    return !error;
  } catch {
    return false;
  }
}
