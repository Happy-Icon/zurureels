export type NotificationPriority = 'critical' | 'normal' | 'promotional';
export type NotificationChannel = 'in_app' | 'push' | 'email' | 'sms';

export interface ChannelPrefFlags {
  email?: boolean;
  push?: boolean;
  sms?: boolean;
  phone_calls?: boolean;
}

export type NotificationSettingsMap = Record<string, ChannelPrefFlags | undefined>;

export interface PolicyDescriptor {
  priority: NotificationPriority;
  category: string;
  defaultChannels: NotificationChannel[];
}

export const PRIVILEGED_SERVER_ONLY_TYPES = new Set<string>([
  'payment_success',
  'payment_failed',
  'payout_completed',
  'payout_failed',
  'refund_processed',
  'verification',
  'verification_approved',
  'verification_declined',
  'booking_confirmed',
  'booking_request',
  'booking_declined',
  'booking_cancelled',
  'booking_checked_in',
  'arrival_issue_reported',
  'listing_approved',
  'listing_rejected',
]);

export const OFFER_SETTING_KEYS = [
  'recognition',
  'insights',
  'pricing',
  'hosting_perks',
  'news_updates',
  'local_laws',
  'inspiration',
  'trip_planning',
  'zurusasa_news',
  'feedback',
  'travel_regulations',
  'all_offers',
] as const;

const POLICY_BY_KEY: Record<string, PolicyDescriptor> = {
  // Critical: always attempt in_app + push + email; SMS enabled by default for key booking/financial events (respects explicit sms: false opt-out)
  payment_success: { priority: 'critical', category: 'account_activity', defaultChannels: ['in_app', 'push', 'email', 'sms'] },
  payment_receipt: { priority: 'critical', category: 'account_activity', defaultChannels: ['in_app', 'push', 'email', 'sms'] },
  payment_failed: { priority: 'critical', category: 'account_activity', defaultChannels: ['in_app', 'push', 'email', 'sms'] },
  booking_confirmed: { priority: 'critical', category: 'account_activity', defaultChannels: ['in_app', 'push', 'email', 'sms'] },
  booking_request: { priority: 'critical', category: 'listing_activity', defaultChannels: ['in_app', 'push', 'email', 'sms'] },
  booking_declined: { priority: 'critical', category: 'account_activity', defaultChannels: ['in_app', 'push', 'email', 'sms'] },
  booking_cancelled: { priority: 'critical', category: 'account_activity', defaultChannels: ['in_app', 'push', 'email', 'sms'] },
  booking_cancelled_host: { priority: 'critical', category: 'listing_activity', defaultChannels: ['in_app', 'push', 'email', 'sms'] },
  booking_cancelled_guest: { priority: 'critical', category: 'account_activity', defaultChannels: ['in_app', 'push', 'email', 'sms'] },
  booking_rescheduled: { priority: 'critical', category: 'account_activity', defaultChannels: ['in_app', 'push', 'email', 'sms'] },
  refund_processed: { priority: 'critical', category: 'account_activity', defaultChannels: ['in_app', 'push', 'email', 'sms'] },
  payout_completed: { priority: 'critical', category: 'account_activity', defaultChannels: ['in_app', 'push', 'email', 'sms'] },
  payout_failed: { priority: 'critical', category: 'account_activity', defaultChannels: ['in_app', 'push', 'email', 'sms'] },
  verification_approved: { priority: 'critical', category: 'listing_activity', defaultChannels: ['in_app', 'push', 'email'] },
  verification_declined: { priority: 'critical', category: 'listing_activity', defaultChannels: ['in_app', 'push', 'email'] },
  arrival_issue_reported: { priority: 'critical', category: 'listing_activity', defaultChannels: ['in_app', 'push', 'email', 'sms'] },
  data_export_otp: { priority: 'critical', category: 'account_activity', defaultChannels: ['email'] },
  data_export_ready: { priority: 'critical', category: 'account_activity', defaultChannels: ['in_app', 'email'] },
  host_application: { priority: 'critical', category: 'listing_activity', defaultChannels: ['in_app', 'email'] },
  host_welcome: { priority: 'critical', category: 'listing_activity', defaultChannels: ['in_app', 'email'] },

  // Normal (transactional optional): respects user per-channel preferences
  message: { priority: 'normal', category: 'messages', defaultChannels: ['in_app', 'push'] },
  new_message: { priority: 'normal', category: 'messages', defaultChannels: ['in_app', 'push'] },
  booking_checked_in: { priority: 'normal', category: 'account_activity', defaultChannels: ['in_app', 'push'] },
  booking_reminder_24h: { priority: 'normal', category: 'reminders', defaultChannels: ['in_app', 'push', 'email', 'sms'] },
  booking_reminder_1h: { priority: 'normal', category: 'reminders', defaultChannels: ['in_app', 'push', 'sms'] },
  zuruplan_reminder: { priority: 'normal', category: 'reminders', defaultChannels: ['in_app', 'push'] },
  review_reminder: { priority: 'normal', category: 'reminders', defaultChannels: ['in_app', 'push', 'email'] },
  new_review: { priority: 'normal', category: 'listing_activity', defaultChannels: ['in_app', 'push'] },
  listing_approved: { priority: 'normal', category: 'listing_activity', defaultChannels: ['in_app', 'push'] },
  listing_rejected: { priority: 'normal', category: 'listing_activity', defaultChannels: ['in_app', 'push', 'email'] },

  // Promotional: strict opt-in only (blocked unless marketing_opt_in === true AND explicit channel opt-in)
  promotion: { priority: 'promotional', category: 'all_offers', defaultChannels: ['in_app', 'push', 'email'] },
  promotional_offer: { priority: 'promotional', category: 'all_offers', defaultChannels: ['in_app', 'push', 'email'] },
  wishlist_available: { priority: 'promotional', category: 'inspiration', defaultChannels: ['in_app', 'push'] },
  performance: { priority: 'promotional', category: 'insights', defaultChannels: ['in_app', 'email'] },
};

export function resolvePolicy(templateOrType: string | null | undefined): PolicyDescriptor {
  const key = String(templateOrType || '').trim().toLowerCase();
  if (POLICY_BY_KEY[key]) {
    return POLICY_BY_KEY[key];
  }
  if (key.startsWith('booking_') || key.startsWith('payment_') || key.startsWith('payout_') || key.startsWith('refund_')) {
    return { priority: 'critical', category: 'account_activity', defaultChannels: ['in_app', 'push', 'email'] };
  }
  if (key.startsWith('listing_') || key.startsWith('verification')) {
    return { priority: 'normal', category: 'listing_activity', defaultChannels: ['in_app', 'push'] };
  }
  if (key.includes('reminder')) {
    return { priority: 'normal', category: 'reminders', defaultChannels: ['in_app', 'push'] };
  }
  if (key.includes('promo') || key.includes('offer')) {
    return { priority: 'promotional', category: 'all_offers', defaultChannels: ['in_app', 'push', 'email'] };
  }
  return { priority: 'normal', category: 'account_activity', defaultChannels: ['in_app', 'push'] };
}

export interface ChannelEligibilityInput {
  priority: NotificationPriority;
  category: string | null;
  channel: NotificationChannel;
  masterEnabled: boolean;
  settings: NotificationSettingsMap | null | undefined;
  marketingOptIn: boolean;
}

export interface ChannelEligibilityResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Evaluates whether a given notification channel is allowed for a recipient:
 * - Critical notifications ALWAYS attempt in_app, push, and email (cannot be silenced).
 * - Promotional notifications require explicit marketing_opt_in === true AND explicit channel opt-in
 *   (new users with null/empty settings NEVER receive marketing notifications).
 * - Normal transactional notifications respect masterEnabled and per-category channel opt-out.
 */
export function evaluateChannelEligibility(
  input: ChannelEligibilityInput,
): ChannelEligibilityResult {
  const { priority, category, channel, masterEnabled, settings, marketingOptIn } = input;

  if (priority === 'critical') {
    if (channel === 'in_app' || channel === 'push' || channel === 'email') {
      return { allowed: true };
    }
    // SMS even for critical respects explicit opt-out
    const catPrefs = category && settings ? settings[category] : undefined;
    if (catPrefs?.sms === false) {
      return { allowed: false, reason: 'sms_disabled_by_user' };
    }
    return { allowed: true };
  }

  if (priority === 'promotional') {
    if (!marketingOptIn) {
      return { allowed: false, reason: 'marketing_not_opted_in' };
    }
    if (!masterEnabled) {
      return { allowed: false, reason: 'master_notifications_disabled' };
    }
    const catPrefs = category && settings ? settings[category] : undefined;
    const allOffersPrefs = settings?.all_offers;

    if (channel === 'in_app') {
      return { allowed: true };
    }

    const explicitCategoryOn = catPrefs?.[channel] === true;
    const explicitAllOffersOn = allOffersPrefs?.[channel] === true;
    const explicitCategoryOff = catPrefs?.[channel] === false;

    if (explicitCategoryOff) {
      return { allowed: false, reason: 'promotional_category_channel_disabled' };
    }
    if (explicitCategoryOn || explicitAllOffersOn) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'promotional_channel_not_opted_in' };
  }

  // Normal (transactional_optional)
  if (channel === 'in_app') {
    return { allowed: true };
  }
  if (!masterEnabled) {
    return { allowed: false, reason: 'master_notifications_disabled' };
  }
  const catPrefs = category && settings ? settings[category] : undefined;
  if (catPrefs && catPrefs[channel] === false) {
    return { allowed: false, reason: `disabled_by_preference:${category}.${channel}` };
  }
  return { allowed: true };
}

export function chunkArray<T>(items: T[], maxChunkSize = 100): T[][] {
  if (items.length === 0) return [];
  const size = Math.max(1, maxChunkSize);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

const RETRY_DELAYS_MINUTES = [1, 5, 15, 60, 240];

export function computeNextRetryIso(attemptCount: number, nowMs = Date.now()): string {
  const idx = Math.min(Math.max(0, attemptCount - 1), RETRY_DELAYS_MINUTES.length - 1);
  const delayMs = RETRY_DELAYS_MINUTES[idx] * 60_000;
  return new Date(nowMs + delayMs).toISOString();
}
