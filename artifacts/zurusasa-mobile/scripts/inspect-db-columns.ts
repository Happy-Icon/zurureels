import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in environment.',
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect() {
  const tables = ['experiences', 'bookings', 'booking_quotes', 'reviews', 'host_blocked_dates', 'platform_settings'];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    console.log(`\n=== TABLE: ${table} ===`);
    if (error) {
      console.log('Error querying table:', error.message);
    } else {
      console.log('Sample record:', data?.[0] || 'Empty table (0 rows)');
    }
  }
}

inspect().catch(console.error);
