import { supabase } from '@/lib/supabase';
import {
  RealtimeSubscriptionManager,
  type SupabaseRealtimeClientLike,
} from '@/lib/realtimeManagerCore';

export * from '@/lib/realtimeManagerCore';

/**
 * App-wide singleton Realtime subscription manager bound to the shared Supabase client.
 */
export const realtimeManager = new RealtimeSubscriptionManager(
  supabase as unknown as SupabaseRealtimeClientLike,
);
