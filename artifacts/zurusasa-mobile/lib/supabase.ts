import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. They are mapped from the VITE_ secrets in the dev script.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ---- Shared row types (mirrors web app tables) ----

export interface ExperienceRow {
  id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  current_price: number | null;
  price_unit: string | null;
  entity_name: string | null;
  category: string | null;
  availability_status: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  verification_status: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ReelRow {
  id: string;
  video_url: string | null;
  thumbnail_url: string | null;
  experience_id: string | null;
  user_id: string | null;
  category: string | null;
  duration: number | null;
  is_live: boolean | null;
  status: string | null;
  created_at?: string | null;
  experience?: Pick<
    ExperienceRow,
    | 'id'
    | 'title'
    | 'description'
    | 'location'
    | 'current_price'
    | 'price_unit'
    | 'metadata'
  > | null;
  host?: Pick<
    ProfileRow,
    'full_name' | 'verification_status' | 'metadata'
  > | null;
}

export interface BookingRow {
  id: string;
  user_id: string | null;
  experience_id: string | null;
  reel_id: string | null;
  amount: number | null;
  status: string | null;
  check_in: string | null;
  check_out: string | null;
  guests: number | null;
  created_at?: string | null;
  experience?: Pick<
    ExperienceRow,
    'id' | 'title' | 'location' | 'current_price' | 'price_unit'
  > | null;
}
