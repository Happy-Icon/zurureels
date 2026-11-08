import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const rawSupabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const rawSupabaseKey = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

if (!rawSupabaseUrl || !rawSupabaseKey) {
  console.error(
    '[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and configure your project credentials.',
  );
}

const supabaseUrl = rawSupabaseUrl || 'https://unconfigured.invalid';
const supabaseKey = rawSupabaseKey || 'unconfigured';

const DEFAULT_FETCH_TIMEOUT_MS = 15_000; // 15s timeout on mobile requests

/**
 * Resilient fetch wrapper with AbortController timeout.
 * Prevents dead/dropped mobile connections from hanging requests indefinitely.
 */
const customFetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error('Network request timed out'));
  }, DEFAULT_FETCH_TIMEOUT_MS);

  if (init?.signal) {
    if (init.signal.aborted) {
      clearTimeout(timeoutId);
      controller.abort(init.signal.reason);
    } else {
      init.signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        controller.abort(init.signal?.reason);
      });
    }
  }

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (controller.signal.aborted) {
      const err = new Error('Network request timed out. Please check your internet connection.');
      (err as any).name = 'TimeoutError';
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    experimental: {
      passkey: true,
    },
  },
  global: {
    fetch: customFetchWithTimeout,
  },
});

// ---- Structured marketplace types ----

export interface HouseRules {
  smoking_allowed: boolean;
  pets_allowed: boolean;
  parties_allowed: boolean;
  children_allowed: boolean;
  additional_guests_allowed: boolean;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  custom_rules?: string | null;
}

export interface ArrivalInstructions {
  check_in_method: string;
  directions?: string | null;
  parking_info?: string | null;
  wifi_ssid?: string | null;
  wifi_password?: string | null;
  access_instructions?: string | null;
}

export interface CheckoutInstructions {
  key_return_instructions?: string | null;
  trash_instructions?: string | null;
  cleaning_expectations?: string | null;
  custom_notes?: string | null;
}

export interface TermsSnapshot {
  title: string;
  category?: string | null;
  location?: string | null;
  host_name?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  booking_mode?: 'instant' | 'approval_required';
  image_url?: string | null;
}

export interface CancellationPolicySnapshot {
  policy_type: 'flexible' | 'moderate' | 'strict';
  type?: 'flexible' | 'moderate' | 'strict';
  free_cancellation_until?: string;
  after_free_cancellation_refund_bps?: number;
  policy_note?: string;
}

// ---- Shared row types (mirrors web app tables) ----

export type LocationPrecision = 'exact' | 'approximate' | 'city_only';

export interface ExperienceRow {
  id: string;
  user_id?: string;
  title: string | null;
  description: string | null;
  location: string | null;
  city?: string | null;
  formatted_address?: string | null;
  country_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  display_latitude?: number | null;
  display_longitude?: number | null;
  location_precision?: LocationPrecision | null;
  current_price: number | null;
  price_unit: string | null;
  entity_name: string | null;
  category: string | null;
  availability_status: string | null;
  max_guests?: number | null;
  min_stay_nights?: number | null;
  max_stay_nights?: number | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  booking_mode?: 'instant' | 'approval_required' | null;
  cancellation_policy?: 'flexible' | 'moderate' | 'strict' | null;
  house_rules?: HouseRules | null;
  arrival_instructions?: ArrivalInstructions | null;
  checkout_instructions?: CheckoutInstructions | null;
  amenities?: string[] | null;
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
  is_verified?: boolean;
  metadata: Record<string, unknown> | null;
  avatar_url?: string | null;
  created_at?: string | null;
  bio?: string | null;
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
  lat?: number | null;
  lng?: number | null;
  experience?: Pick<
    ExperienceRow,
    | 'id'
    | 'title'
    | 'entity_name'
    | 'description'
    | 'location'
    | 'city'
    | 'formatted_address'
    | 'country_code'
    | 'display_latitude'
    | 'display_longitude'
    | 'location_precision'
    | 'current_price'
    | 'price_unit'
    | 'availability_status'
    | 'max_guests'
    | 'min_stay_nights'
    | 'max_stay_nights'
    | 'check_in_time'
    | 'check_out_time'
    | 'booking_mode'
    | 'cancellation_policy'
    | 'house_rules'
    | 'arrival_instructions'
    | 'checkout_instructions'
    | 'amenities'
    | 'metadata'
    | 'image_url'
  > | null;
  host?: Pick<
    ProfileRow,
    'id' | 'full_name' | 'email' | 'avatar_url' | 'verification_status' | 'is_verified' | 'metadata' | 'created_at' | 'bio' | 'role'
  > | null;
}

export interface BookingRow {
  id: string;
  user_id: string | null;
  experience_id: string | null;
  reel_id: string | null;
  quote_id?: string | null;
  payment_attempt_id?: string | null;
  trip_title?: string | null;
  amount: number | null;
  status: string | null;
  check_in: string | null;
  check_out: string | null;
  guests: number | null;
  created_at?: string | null;
  terms_snapshot?: TermsSnapshot | null;
  house_rules_snapshot?: HouseRules | null;
  cancellation_policy_snapshot?: CancellationPolicySnapshot | null;
  arrival_snapshot?: ArrivalInstructions | null;
  checkout_snapshot?: CheckoutInstructions | null;
  terms_acknowledged_at?: string | null;
  experience?: Pick<
    ExperienceRow,
    | 'id'
    | 'user_id'
    | 'title'
    | 'location'
    | 'city'
    | 'formatted_address'
    | 'country_code'
    | 'display_latitude'
    | 'display_longitude'
    | 'location_precision'
    | 'current_price'
    | 'price_unit'
    | 'image_url'
    | 'entity_name'
    | 'max_guests'
    | 'check_in_time'
    | 'check_out_time'
    | 'cancellation_policy'
    | 'house_rules'
    | 'arrival_instructions'
    | 'checkout_instructions'
    | 'amenities'
    | 'metadata'
  > | null;
  guest?: ProfileRow | null;
  host?: ProfileRow | null;
}

export interface HostBlockedDateRow {
  id: string;
  experience_id: string;
  host_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  event_date: string | null;
  price: number | null;
  location?: string | null;
  image_url?: string | null;
  start_time?: string | null;
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
  image_url?: string | null;
  metadata?: Record<string, unknown> | null;
  is_read: boolean | null;
  created_at: string;
}

export type NotificationType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_declined'
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
  data?: Record<string, unknown> | null;
  action_type?: NotificationActionType | null;
  action_id?: string | null;
  metadata?: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  updated_at?: string;
}

export interface UserDeviceRow {
  id: string;
  user_id: string;
  push_token: string;
  device_type?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type PersonalDataRequestStatus =
  | 'pending_verification'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelled';

export type PersonalDataExportFormat = 'json' | 'pdf' | 'both';

export interface PersonalDataRequestRow {
  id: string;
  user_id: string;
  status: PersonalDataRequestStatus;
  format: PersonalDataExportFormat;
  otp_attempts: number;
  otp_max_attempts: number;
  otp_expires_at?: string | null;
  verified_at?: string | null;
  json_storage_path?: string | null;
  pdf_storage_path?: string | null;
  file_size_bytes?: number | null;
  checksum_sha256?: string | null;
  expires_at?: string | null;
  download_count: number;
  last_downloaded_at?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PersonalDataAuditLogRow {
  id: string;
  request_id?: string | null;
  user_id: string;
  event_type: string;
  actor_role: string;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: Record<string, unknown>;
  created_at: string;
}

export { resolveAvatarUrl } from '@/lib/avatar';

