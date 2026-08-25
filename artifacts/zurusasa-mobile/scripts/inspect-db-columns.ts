import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://rjzgzxxdrltlteeshtuw.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqemd6eHhkcmx0bHRlZXNodHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDc4MjUsImV4cCI6MjA4MzkyMzgyNX0.rRudHu14sWNALKESz2Wwsjn_40xYaStRUlfdXZFVikA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect() {
  // Let's query an RPC or run schema query
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
