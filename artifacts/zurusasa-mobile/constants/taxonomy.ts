import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export type PublishingContentType = 'experience' | 'event' | 'special_offer';

export type PrimaryCategoryId =
  | 'accommodation'
  | 'land_experience'
  | 'water_experience'
  | 'food_dining';

export interface SubcategoryOption {
  id: string;
  label: string;
  icon: IoniconsName;
}

export interface PrimaryCategoryMeta {
  id: PrimaryCategoryId;
  label: string;
  shortLabel: string;
  subtitle: string;
  icon: IoniconsName;
  activeIcon: IoniconsName;
  defaultPriceUnit: 'night' | 'person' | 'booking' | 'group';
  accentColor: string;
  softBg: string;
  aliases: readonly string[];
  subcategories: readonly SubcategoryOption[];
}

export interface PublishingFormatMeta {
  id: PublishingContentType;
  title: string;
  subtitle: string;
  icon: IoniconsName;
  accentColor: string;
  softBg: string;
}

export const PUBLISHING_FORMATS: readonly PublishingFormatMeta[] = [
  {
    id: 'experience',
    title: 'Establishment / Experience Listing',
    subtitle: 'Hotels, villas, safaris, boat trips, restaurants...',
    icon: 'home-outline',
    accentColor: '#F26522',
    softBg: '#F7F7F7',
  },
  {
    id: 'event',
    title: 'Create an Event',
    subtitle: 'Promote an upcoming party, festival, or concert',
    icon: 'calendar-outline',
    accentColor: '#F26522',
    softBg: '#F7F7F7',
  },
  {
    id: 'special_offer',
    title: 'Create a Special Offer',
    subtitle: 'Share a limited-time deal, happy hour, or discount',
    icon: 'pricetag-outline',
    accentColor: '#F26522',
    softBg: '#F7F7F7',
  },
] as const;

export const PRIMARY_EXPERIENCE_CATEGORIES: readonly PrimaryCategoryMeta[] = [
  {
    id: 'accommodation',
    label: 'Accommodation',
    shortLabel: 'Stays',
    subtitle: 'Hotels, villas, resorts and lodges.',
    icon: 'bed-outline',
    activeIcon: 'bed',
    defaultPriceUnit: 'night',
    accentColor: '#F26522',
    softBg: '#F7F7F7',
    aliases: [
      'accommodation',
      'stay',
      'stays',
      'hotel',
      'hotels',
      'villa',
      'villas',
      'apartment',
      'apartments',
      'resort',
      'lodge',
      'guesthouse',
      'bnb',
      'campsite',
      'glamping',
      'parks_camps',
      'beach_house',
    ],
    subcategories: [
      { id: 'hotel_resort', label: 'Hotels & Resorts', icon: 'business-outline' },
      { id: 'villa_holiday_home', label: 'Villas & Holiday Homes', icon: 'home-outline' },
      { id: 'apartment', label: 'Serviced Apartments', icon: 'layers-outline' },
      { id: 'boutique_lodge', label: 'Boutique Hotels & Lodges', icon: 'sparkles-outline' },
      { id: 'guesthouse_bnb', label: 'Guesthouses & B&Bs', icon: 'cafe-outline' },
      { id: 'campsite_glamping', label: 'Campsites & Glamping', icon: 'bonfire-outline' },
    ],
  },
  {
    id: 'land_experience',
    label: 'Land Experiences',
    shortLabel: 'Land',
    subtitle: 'Safaris, tours, hiking and adventures.',
    icon: 'compass-outline',
    activeIcon: 'compass',
    defaultPriceUnit: 'person',
    accentColor: '#F26522',
    softBg: '#F7F7F7',
    aliases: [
      'land_experience',
      'land_experiences',
      'land_adventure',
      'air_adventure',
      'air_experience',
      'tour',
      'tours',
      'safari',
      'safaris',
      'hiking',
      'adventure',
      'excursion',
      'experience',
      'experiences',
    ],
    subcategories: [
      { id: 'safari_wildlife', label: 'Safaris & Wildlife', icon: 'paw-outline' },
      { id: 'adventure', label: 'Adventure & Quad Biking', icon: 'bicycle-outline' },
      { id: 'nature_hiking', label: 'Nature Walks & Hiking', icon: 'footsteps-outline' },
      { id: 'cultural_heritage', label: 'Cultural & City Tours', icon: 'earth-outline' },
      { id: 'horse_camel_riding', label: 'Horse & Camel Riding', icon: 'trail-sign-outline' },
      { id: 'air_experience', label: 'Air Experiences', icon: 'airplane-outline' },
    ],
  },
  {
    id: 'water_experience',
    label: 'Water Experiences',
    shortLabel: 'Water',
    subtitle: 'Boat rides, cruises, diving and water sports.',
    icon: 'boat-outline',
    activeIcon: 'boat',
    defaultPriceUnit: 'person',
    accentColor: '#F26522',
    softBg: '#F7F7F7',
    aliases: [
      'water_experience',
      'water_experiences',
      'water_adventure',
      'boat',
      'boats',
      'cruise',
      'dhow',
      'marine',
      'snorkelling',
      'diving',
      'water_sports',
    ],
    subcategories: [
      { id: 'boat_charter', label: 'Boat Rides & Charters', icon: 'boat-outline' },
      { id: 'dhow_sunset_cruise', label: 'Dhow & Sunset Cruises', icon: 'sunny-outline' },
      { id: 'snorkelling_diving', label: 'Snorkelling & Scuba Diving', icon: 'water-outline' },
      { id: 'jet_ski_watersports', label: 'Jet Skiing & Water Sports', icon: 'speedometer-outline' },
      { id: 'deep_sea_fishing', label: 'Deep-Sea & Sport Fishing', icon: 'fish-outline' },
      { id: 'dolphin_island_hopping', label: 'Dolphin & Island Hopping', icon: 'map-outline' },
    ],
  },
  {
    id: 'food_dining',
    label: 'Food, Drinks & Dining',
    shortLabel: 'Dining',
    subtitle: 'Restaurants, bars, cocktails and nightlife.',
    icon: 'restaurant-outline',
    activeIcon: 'restaurant',
    defaultPriceUnit: 'person',
    accentColor: '#F26522',
    softBg: '#F7F7F7',
    aliases: [
      'food_dining',
      'food',
      'dining',
      'restaurant',
      'restaurants',
      'drinks',
      'bar',
      'cocktails',
      'nightlife',
      'club',
      'cafe',
    ],
    subcategories: [
      { id: 'restaurant_beach_dining', label: 'Restaurants & Beach Dining', icon: 'restaurant-outline' },
      { id: 'cocktail_mixology_bar', label: 'Cocktails, Bars & Lounges', icon: 'wine-outline' },
      { id: 'nightlife_club', label: 'Nightlife & Beach Clubs', icon: 'musical-notes-outline' },
      { id: 'fine_dining_chef', label: 'Fine Dining & Private Chefs', icon: 'sparkles-outline' },
      { id: 'cafe_bakery', label: 'Cafes, Brunch & Bakeries', icon: 'cafe-outline' },
      { id: 'street_food_local', label: 'Swahili & Street Food', icon: 'fast-food-outline' },
    ],
  },
] as const;

export const EVENT_SUBCATEGORIES: readonly SubcategoryOption[] = [
  { id: 'beach_pool_party', label: 'Beach / Pool Party', icon: 'sunny-outline' },
  { id: 'music_festival_concert', label: 'Music Festival & Concert', icon: 'musical-notes-outline' },
  { id: 'boat_party_cruise', label: 'Boat Party & Sunset Session', icon: 'boat-outline' },
  { id: 'food_cultural_festival', label: 'Food & Cultural Festival', icon: 'restaurant-outline' },
  { id: 'nightlife_special_night', label: 'Nightlife & DJ Night', icon: 'flame-outline' },
  { id: 'sports_wellness_event', label: 'Sports, Run & Wellness', icon: 'trophy-outline' },
] as const;

export const OFFER_TYPES: readonly SubcategoryOption[] = [
  { id: 'happy_hour', label: 'Happy Hour & Cocktails', icon: 'wine-outline' },
  { id: 'stay_discount', label: 'Accommodation Deal', icon: 'bed-outline' },
  { id: 'dining_deal', label: 'Dining & Chef Special', icon: 'restaurant-outline' },
  { id: 'activity_deal', label: 'Tour & Water Deal', icon: 'compass-outline' },
  { id: 'seasonal_package', label: 'Weekend / Group Package', icon: 'gift-outline' },
] as const;

export interface DiscoverTabItem {
  id: 'all' | PrimaryCategoryId | 'events' | 'offers' | 'ai';
  label: string;
  icon: IoniconsName;
  activeIcon: IoniconsName;
  categories: readonly string[];
}

export const DISCOVER_CATEGORY_TABS: readonly DiscoverTabItem[] = [
  {
    id: 'all',
    label: 'All',
    icon: 'grid-outline',
    activeIcon: 'grid',
    categories: ['all'],
  },
  {
    id: 'accommodation',
    label: 'Stays',
    icon: 'bed-outline',
    activeIcon: 'bed',
    categories: ['accommodation', 'stay', 'stays', 'hotel', 'villa', 'apartment', 'parks_camps'],
  },
  {
    id: 'land_experience',
    label: 'Land',
    icon: 'compass-outline',
    activeIcon: 'compass',
    categories: ['land_experience', 'land_adventure', 'air_adventure', 'tour', 'tours'],
  },
  {
    id: 'water_experience',
    label: 'Water',
    icon: 'boat-outline',
    activeIcon: 'boat',
    categories: ['water_experience', 'water_adventure', 'boat', 'boats'],
  },
  {
    id: 'food_dining',
    label: 'Dining',
    icon: 'restaurant-outline',
    activeIcon: 'restaurant',
    categories: ['food_dining', 'food', 'drinks', 'nightlife', 'restaurant'],
  },
  {
    id: 'events',
    label: 'Events',
    icon: 'calendar-outline',
    activeIcon: 'calendar',
    categories: ['event', 'events'],
  },
  {
    id: 'offers',
    label: 'Offers',
    icon: 'pricetag-outline',
    activeIcon: 'pricetag',
    categories: ['special_offer', 'offer'],
  },
  {
    id: 'ai',
    label: 'Zuru Agent',
    icon: 'sparkles-outline',
    activeIcon: 'sparkles',
    categories: [],
  },
] as const;

export const AMENITIES_BY_CATEGORY: Record<PrimaryCategoryId, readonly string[]> = {
  accommodation: [
    'Fast Wi-Fi',
    'Air Conditioning',
    'Swimming Pool',
    'Ocean View',
    'Free Parking',
    'Fully Equipped Kitchen',
    'TV / Streaming',
    'Hot Water',
    '24/7 Security',
    'Dedicated Workspace',
    'Balcony / Terrace',
    'Beach Access',
  ],
  land_experience: [
    'Certified Local Guide',
    'Hotel Pickup & Drop-off',
    'Safety Gear Included',
    'Bottled Water & Snacks',
    'Park Entry Assistance',
    'Small Group Friendly',
    'Photography Stops',
    'Family Friendly',
    'Private Tour Option',
  ],
  water_experience: [
    'Life Jackets Included',
    'Snorkel Gear Provided',
    'Licensed Skipper & Crew',
    'Refreshments Onboard',
    'Sunset Viewing Deck',
    'Freshwater Shower',
    'Sound System',
    'Private Charter Option',
    'Beginner Friendly',
  ],
  food_dining: [
    'Oceanfront Seating',
    'Signature Cocktails',
    'Live DJ / Music',
    'Halal Options',
    'Vegan / Vegetarian Friendly',
    'Private Dining / Groups',
    'Outdoor Terrace',
    'Fast Wi-Fi',
    'Valet / Free Parking',
  ],
};

export function normalizePrimaryCategory(raw?: string | null): PrimaryCategoryId {
  const val = (raw || '').trim().toLowerCase();
  if (!val) return 'accommodation';
  for (const cat of PRIMARY_EXPERIENCE_CATEGORIES) {
    if (cat.id === val || cat.aliases.includes(val)) {
      return cat.id;
    }
  }
  if (val.includes('water') || val.includes('boat') || val.includes('marine') || val.includes('dive') || val.includes('cruise')) {
    return 'water_experience';
  }
  if (
    val.includes('food') ||
    val.includes('dining') ||
    val.includes('restaurant') ||
    val.includes('bar') ||
    val.includes('cocktail') ||
    val.includes('nightlife') ||
    val.includes('drink')
  ) {
    return 'food_dining';
  }
  if (
    val.includes('land') ||
    val.includes('tour') ||
    val.includes('safari') ||
    val.includes('air') ||
    val.includes('hik') ||
    val.includes('adventure')
  ) {
    return 'land_experience';
  }
  return 'accommodation';
}

export function getPrimaryCategoryMeta(id?: string | null): PrimaryCategoryMeta {
  const normalized = normalizePrimaryCategory(id);
  return (
    PRIMARY_EXPERIENCE_CATEGORIES.find((c) => c.id === normalized) ??
    PRIMARY_EXPERIENCE_CATEGORIES[0]
  );
}

export function getSubcategoryLabel(subId?: string | null): string | null {
  if (!subId) return null;
  const val = subId.trim().toLowerCase();
  for (const cat of PRIMARY_EXPERIENCE_CATEGORIES) {
    const found = cat.subcategories.find((s) => s.id === val);
    if (found) return found.label;
  }
  const evFound = EVENT_SUBCATEGORIES.find((s) => s.id === val);
  if (evFound) return evFound.label;
  const offFound = OFFER_TYPES.find((s) => s.id === val);
  if (offFound) return offFound.label;
  return subId.replace(/_/g, ' ');
}

export function resolveReelContentType(reel: {
  content_type?: string | null;
  category?: string | null;
  event_id?: string | null;
  offer_id?: string | null;
  experience?: { metadata?: Record<string, unknown> | null; category?: string | null } | null;
}): PublishingContentType {
  const explicit = (reel.content_type || '').toLowerCase();
  if (explicit === 'event' || reel.event_id) return 'event';
  if (explicit === 'special_offer' || reel.offer_id) return 'special_offer';

  const meta = (reel.experience?.metadata ?? {}) as Record<string, unknown>;
  const metaType = String(meta.content_type || '').toLowerCase();
  if (metaType === 'event' || meta.event_details) return 'event';
  if (metaType === 'special_offer' || meta.offer_details) return 'special_offer';

  const cat = (reel.category || reel.experience?.category || '').toLowerCase();
  if (cat === 'event' || cat === 'events') return 'event';
  if (cat === 'special_offer' || cat === 'offer') return 'special_offer';

  return 'experience';
}

export function getCategoryDisplayMeta(
  category?: string | null,
  contentType?: PublishingContentType | null,
  subcategory?: string | null,
): {
  label: string;
  shortLabel: string;
  icon: IoniconsName;
  accentColor: string;
  badgeBg: string;
  primaryCtaLabel: string;
} {
  if (contentType === 'event') {
    return {
      label: getSubcategoryLabel(subcategory) || 'Upcoming Event',
      shortLabel: 'Event',
      icon: 'calendar-outline',
      accentColor: '#F26522',
      badgeBg: 'rgba(17, 24, 39, 0.78)',
      primaryCtaLabel: 'View Event',
    };
  }
  if (contentType === 'special_offer') {
    return {
      label: getSubcategoryLabel(subcategory) || 'Special Offer',
      shortLabel: 'Offer',
      icon: 'pricetag-outline',
      accentColor: '#F26522',
      badgeBg: 'rgba(17, 24, 39, 0.78)',
      primaryCtaLabel: 'View Offer',
    };
  }
  const catMeta = getPrimaryCategoryMeta(category);
  const subLabel = getSubcategoryLabel(subcategory);
  return {
    label: subLabel || catMeta.label,
    shortLabel: catMeta.shortLabel,
    icon: catMeta.icon,
    accentColor: catMeta.accentColor,
    badgeBg: 'rgba(17, 24, 39, 0.78)',
    primaryCtaLabel: 'Book Now',
  };
}

export function parseExpiryTimestamp(value?: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Date-only YYYY-MM-DD remains valid until end of that day in local time
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  }
  const parsed = new Date(trimmed).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function parseEventTimeParts(
  timeStr?: string | null,
): { hours: number; minutes: number; hasMeridiem: boolean } | null {
  if (!timeStr) return null;
  const clean = timeStr.trim();
  if (!clean) return null;
  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([ap]m)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3]?.toLowerCase() ?? null;
  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }

  if (meridiem === 'pm') {
    if (hours < 12) hours += 12;
  } else if (meridiem === 'am') {
    if (hours === 12) hours = 0;
  }

  if (hours < 0 || hours > 23) return null;
  return { hours, minutes, hasMeridiem: Boolean(meridiem) };
}

export function formatEventClockTime(
  timeStr?: string | null,
  fallbackIso?: string | null,
): string | null {
  const parts = parseEventTimeParts(timeStr);
  let hours: number | null = parts ? parts.hours : null;
  let minutes: number | null = parts ? parts.minutes : null;

  if (hours === null && fallbackIso) {
    const trimmed = fallbackIso.trim();
    if (trimmed && !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const dt = new Date(trimmed);
      if (!Number.isNaN(dt.getTime())) {
        hours = dt.getHours();
        minutes = dt.getMinutes();
      }
    }
  }

  if (hours === null || minutes === null) {
    return timeStr?.trim() || null;
  }

  const suffix = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function formatCountdownRemaining(ms: number, compact = false): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3_600);
  const mins = Math.floor((totalSec % 3_600) / 60);
  const secs = totalSec % 60;

  if (compact) {
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${mins}m left`;
    if (mins > 0) return `${mins}m left`;
    return '< 1m left';
  }

  if (days > 0) {
    return `${days}d ${hours}h ${String(mins).padStart(2, '0')}m`;
  }
  if (hours > 0) {
    return `${hours}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

function applyTimeOnLocalDate(
  baseDateStr: string | null | undefined,
  parts: { hours: number; minutes: number },
): number | null {
  if (!baseDateStr) return null;
  const trimmed = baseDateStr.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    return new Date(y, m - 1, d, parts.hours, parts.minutes, 0, 0).getTime();
  }
  const dt = new Date(trimmed);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(
    dt.getFullYear(),
    dt.getMonth(),
    dt.getDate(),
    parts.hours,
    parts.minutes,
    0,
    0,
  ).getTime();
}

export type EventLifecyclePhase = 'upcoming' | 'live' | 'ended';

export interface EventLifecycleInput {
  eventDate?: string | null;
  endDate?: string | null;
  expiresAt?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  status?: string | null;
}

export interface EventLifecycleState {
  phase: EventLifecyclePhase;
  isLive: boolean;
  isEnded: boolean;
  isUpcoming: boolean;
  startMs: number | null;
  endMs: number | null;
  remainingMs: number | null;
  timeWindowLabel: string | null;
  countdownLabel: string | null;
  compactCountdownLabel: string | null;
}

export function getEventLifecycleState(
  input: EventLifecycleInput,
  nowMs: number = Date.now(),
): EventLifecycleState {
  const { eventDate, endDate, expiresAt, startTime, endTime, status } = input;
  const statusCancelled = Boolean(
    status && ['cancelled', 'expired', 'draft', 'archived'].includes(status.toLowerCase()),
  );

  // 1. Resolve authoritative start timestamp
  let startMs: number | null = null;
  const startParts = parseEventTimeParts(startTime);
  if (eventDate) {
    const trimmed = eventDate.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      startMs = startParts
        ? applyTimeOnLocalDate(trimmed, startParts)
        : new Date(
            ...((trimmed.split('-').map(Number) as [number, number, number]).map((n, i) =>
              i === 1 ? n - 1 : n,
            ) as [number, number, number]),
            0,
            0,
            0,
            0,
          ).getTime();
    } else {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        const isIsoMidnight = /T00:00(?::00(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/i.test(trimmed);
        const meridiemMismatch = Boolean(
          startParts?.hasMeridiem && parsed.getHours() !== startParts.hours,
        );
        startMs =
          startParts && (isIsoMidnight || meridiemMismatch)
            ? applyTimeOnLocalDate(trimmed, startParts)
            : parsed.getTime();
      }
    }
  }

  // 2. Resolve authoritative end timestamp
  const endParts = parseEventTimeParts(endTime);
  const rawExpires = parseExpiryTimestamp(expiresAt);
  const rawEndDate = parseExpiryTimestamp(endDate);
  let endMs: number | null = rawExpires ?? rawEndDate ?? null;

  if (endParts) {
    let derivedEnd = applyTimeOnLocalDate(endDate || eventDate, endParts);
    if (derivedEnd !== null && startMs !== null && derivedEnd <= startMs) {
      // Overnight event (e.g. 9:00 PM -> 2:00 AM next day)
      derivedEnd += 86_400_000;
    }
    if (derivedEnd !== null) {
      const shouldPreferDerived =
        endParts.hasMeridiem ||
        endMs === null ||
        (startMs !== null && endMs <= startMs && derivedEnd > startMs);
      if (shouldPreferDerived) {
        endMs = derivedEnd;
      }
    }
  } else if (endMs === null && startMs !== null) {
    // Legacy same-day event without explicit end/expiry stays live until end of that day
    const startDt = new Date(startMs);
    endMs = new Date(
      startDt.getFullYear(),
      startDt.getMonth(),
      startDt.getDate(),
      23,
      59,
      59,
      999,
    ).getTime();
  }

  let phase: EventLifecyclePhase = 'upcoming';
  if (statusCancelled || (endMs !== null && nowMs >= endMs)) {
    phase = 'ended';
  } else if (startMs !== null && nowMs >= startMs) {
    phase = 'live';
  }

  const startLabel = formatEventClockTime(
    startTime,
    startMs !== null ? new Date(startMs).toISOString() : eventDate,
  );
  const endLabel = formatEventClockTime(
    endTime,
    endMs !== null ? new Date(endMs).toISOString() : endDate || expiresAt,
  );
  const timeWindowLabel =
    startLabel && endLabel ? `${startLabel} – ${endLabel}` : startLabel || endLabel || null;

  let remainingMs: number | null = null;
  let countdownLabel: string | null = null;
  let compactCountdownLabel: string | null = null;

  if (phase === 'live') {
    remainingMs = endMs !== null ? Math.max(0, endMs - nowMs) : null;
    countdownLabel =
      remainingMs !== null ? `${formatCountdownRemaining(remainingMs)} remaining` : 'Live now';
    compactCountdownLabel =
      remainingMs !== null ? formatCountdownRemaining(remainingMs, true) : 'Live now';
  } else if (phase === 'upcoming') {
    remainingMs = startMs !== null ? Math.max(0, startMs - nowMs) : null;
    countdownLabel =
      remainingMs !== null ? `Starts in ${formatCountdownRemaining(remainingMs)}` : 'Upcoming';
    compactCountdownLabel =
      remainingMs !== null ? `In ${formatCountdownRemaining(remainingMs, true)}` : 'Upcoming';
  } else {
    remainingMs = 0;
    countdownLabel = 'Event ended';
    compactCountdownLabel = 'Ended';
  }

  return {
    phase,
    isLive: phase === 'live',
    isEnded: phase === 'ended',
    isUpcoming: phase === 'upcoming',
    startMs,
    endMs,
    remainingMs,
    timeWindowLabel,
    countdownLabel,
    compactCountdownLabel,
  };
}

export function isEventActive(
  eventDate?: string | null,
  endDate?: string | null,
  expiresAt?: string | null,
  status?: string | null,
  startTime?: string | null,
  endTime?: string | null,
): boolean {
  return !getEventLifecycleState({
    eventDate,
    endDate,
    expiresAt,
    startTime,
    endTime,
    status,
  }).isEnded;
}

export function isOfferActive(
  expiresAt?: string | null,
  status?: string | null,
  nowMs: number = Date.now(),
): boolean {
  if (status && ['expired', 'inactive', 'draft', 'archived', 'cancelled'].includes(status.toLowerCase())) {
    return false;
  }
  const cutoff = parseExpiryTimestamp(expiresAt);
  if (cutoff === null) return true;
  return cutoff > nowMs;
}

export function formatEventScheduleBadge(
  eventDate?: string | null,
  startTime?: string | null,
): string {
  if (!eventDate && !startTime) return 'Upcoming Event';

  let datePart = '';
  if (eventDate) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(eventDate.trim())
      ? new Date(`${eventDate.trim()}T12:00:00`)
      : new Date(eventDate);
    if (!Number.isNaN(d.getTime())) {
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayMonth = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      const diffDays = Math.round((d.getTime() - Date.now()) / 86_400_000);
      datePart = diffDays >= 0 && diffDays <= 6 ? weekday : dayMonth;
    }
  }

  const timePart = formatEventClockTime(startTime) ?? '';

  if (datePart && timePart) return `${datePart}, ${timePart}`;
  return datePart || timePart || 'Upcoming Event';
}

export function formatExpiryCountdown(
  expiresAt?: string | null,
  nowMs: number = Date.now(),
  compact = false,
): string {
  const cutoff = parseExpiryTimestamp(expiresAt);
  if (cutoff === null) return 'Limited-time offer';
  const diffMs = cutoff - nowMs;
  if (diffMs <= 0) return 'Expired';
  if (diffMs < 86_400_000) {
    return compact
      ? formatCountdownRemaining(diffMs, true)
      : `Ends in ${formatCountdownRemaining(diffMs, false)}`;
  }
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 1) return '1 day left';
  if (diffDays <= 7) return `${diffDays} days left`;
  const d = new Date(cutoff);
  return `Valid until ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}
