import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://rjzgzxxdrltlteeshtuw.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqemd6eHhkcmx0bHRlZXNodHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDc4MjUsImV4cCI6MjA4MzkyMzgyNX0.rRudHu14sWNALKESz2Wwsjn_40xYaStRUlfdXZFVikA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect() {
  const { data: exp } = await supabase.from('experiences').select('*').limit(1);
  console.log('--- EXPERIENCES COLUMNS ---');
  console.log(exp?.[0] ? Object.keys(exp[0]) : 'No experience records, sample:', exp);

  const { data: bkg } = await supabase.from('bookings').select('*').limit(1);
  console.log('--- BOOKINGS COLUMNS ---');
  console.log(bkg?.[0] ? Object.keys(bkg[0]) : 'No booking records, sample:', bkg);

  const { data: quote } = await supabase.from('booking_quotes').select('*').limit(1);
  console.log('--- BOOKING_QUOTES COLUMNS ---');
  console.log(quote?.[0] ? Object.keys(quote[0]) : 'No quote records, sample:', quote);

  const { data: rev } = await supabase.from('reviews').select('*').limit(1);
  console.log('--- REVIEWS COLUMNS ---');
  console.log(rev?.[0] ? Object.keys(rev[0]) : 'No review records, sample:', rev);
}

inspect().catch(console.error);
