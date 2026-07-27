import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://rjzgzxxdrltlteeshtuw.supabase.co';
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqemd6eHhkcmx0bHRlZXNodHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDc4MjUsImV4cCI6MjA4MzkyMzgyNX0.rRudHu14sWNALKESz2Wwsjn_40xYaStRUlfdXZFVikA';

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
  image_url?: string | null;
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

export interface HostReviewRow {
  id: string;
  reviewer_name: string;
  reviewer_avatar?: string | null;
  rating: number;
  comment: string;
  created_at: string;
}

export interface FullReviewRow {
  id: string;
  booking_id: string;
  reviewer_id: string;
  reviewee_id: string;
  listing_id?: string | null;
  rating: number;
  cleanliness?: number | null;
  communication?: number | null;
  accuracy?: number | null;
  location?: number | null;
  value?: number | null;
  check_in?: number | null;
  comment: string;
  photos?: string[] | null;
  is_host_review: boolean;
  helpful_count?: number;
  created_at: string;
  updated_at?: string;
  reviewer?: {
    full_name: string;
    avatar_url?: string | null;
    verification_status?: string | null;
  } | null;
}

export interface HostProfileData {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  verification_status?: string | null;
  host_bio?: string | null;
  languages?: string[];
  joined_date?: string | null;
  response_rate?: string | null;
  response_time?: string | null;
  is_super_host?: boolean;
  is_verified?: boolean;
  years_hosting?: number;
  repeat_guest_rate?: string | null;
  host_badges?: string[];
  location?: string | null;
  properties_count?: number;
  trips_hosted?: number;
  average_rating?: number;
  reviews_count?: number;
  metadata?: Record<string, unknown> | null;
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
    | 'availability_status'
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
    'id' | 'title' | 'location' | 'current_price' | 'price_unit' | 'image_url'
  > | null;
}

export interface EventRow {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  event_date: string | null;
  price: number | null;
  location?: string | null;
}

export interface ConversationRow {
  id: string;
  participant_one: string;
  participant_two: string;
  last_message_at: string | null;
  other: {
    id: string;
    full_name: string;
    username: string;
    role: string;
    avatar_url: string | null;
  };
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean | null;
  created_at: string;
}

export type NotificationType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'payment_success'
  | 'refund_processed'
  | 'message'
  | 'review_reminder'
  | 'promotion'
  | 'wishlist_available'
  | 'booking_request'
  | 'payout_completed'
  | 'verification'
  | 'listing_approved'
  | 'listing_rejected'
  | 'performance';

export type NotificationActionType =
  | 'booking'
  | 'chat'
  | 'payout'
  | 'listing'
  | 'discover'
  | 'profile'
  | 'support';

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  image_url?: string | null;
  action_type?: NotificationActionType | null;
  action_id?: string | null;
  metadata?: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  updated_at?: string;
}
