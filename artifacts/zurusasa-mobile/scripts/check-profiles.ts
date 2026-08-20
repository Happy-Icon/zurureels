import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://rjzgzxxdrltlteeshtuw.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqemd6eHhkcmx0bHRlZXNodHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDc4MjUsImV4cCI6MjA4MzkyMzgyNX0.rRudHu14sWNALKESz2Wwsjn_40xYaStRUlfdXZFVikA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, verification_status, is_verified, identity_verification_status, verified_at, metadata');

  if (error) {
    console.error('Error querying profiles:', error);
    return;
  }

  console.log(`Total profiles in database: ${data?.length || 0}`);
  data?.forEach((p, idx) => {
    console.log(`[${idx + 1}] ID: ${p.id}`);
    console.log(`    Name: ${p.full_name || 'N/A'}`);
    console.log(`    Email: ${p.email || 'N/A'}`);
    console.log(`    Role: ${p.role}`);
    console.log(`    verification_status: ${p.verification_status}`);
    console.log(`    identity_verification_status: ${p.identity_verification_status}`);
    console.log(`    is_verified: ${p.is_verified}`);
    console.log(`    verified_at: ${p.verified_at}`);
    console.log(`    metadata:`, JSON.stringify(p.metadata));
    console.log('--------------------------------------------------');
  });
}

main().catch(console.error);
