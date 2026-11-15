import type { PrimaryCategoryId, PublishingContentType } from '@/constants/taxonomy';

export type BookingFlowKind = 'stay' | 'activity' | 'dining' | 'event' | 'offer';

export interface TicketTierOption {
  id: string;
  label: string;
  price: number;
  description?: string;
}

export interface CategoryFlowConfig {
  kind: BookingFlowKind;
  isStay: boolean;
  isRangePicker: boolean;
  isFixedDate: boolean;
  requiresTimeSlot: boolean;
  isFlatUnit: boolean;
  isNightUnit: boolean;
  defaultTimeSlots: string[];
  seatingOptions: string[];
  detailsCtaLabel: string;
  datesStepHeader: string;
  datesCtaLabel: string;
  scheduleSectionLabel: string;
  participantSectionLabel: string;
  cancellationNoun: string;
  escrowText: string;
  successStatusPill: string;
  successHeadline: string;
  successVerbPhrase: string;
  defaultHighlights: string[];
}

const NIGHT_UNITS = new Set(['night', 'nights', 'per_night']);

const FLAT_UNITS = new Set([
  'group',
  'groups',
  'per_group',
  'boat',
  'boats',
  'charter',
  'charters',
  'trip',
  'trips',
  'booking',
  'bookings',
  'table',
  'tables',
  'offer',
  'offers',
  'package',
  'packages',
  'bundle',
  'deal',
  'session',
  'sessions',
  'vehicle',
  'vehicles',
]);

export function isNightPriceUnit(unit: string | null | undefined): boolean {
  return NIGHT_UNITS.has(String(unit ?? 'night').trim().toLowerCase());
}

export function isFlatPriceUnit(unit: string | null | undefined): boolean {
  return FLAT_UNITS.has(String(unit ?? '').trim().toLowerCase());
}

export function computeBookingUnits({
  kind,
  priceUnit,
  nights,
  totalGuests,
  voucherQty = 1,
}: {
  kind: BookingFlowKind;
  priceUnit: string;
  nights: number;
  totalGuests: number;
  voucherQty?: number;
}): number {
  if (isNightPriceUnit(priceUnit) || (kind === 'stay' && !isFlatPriceUnit(priceUnit))) {
    return Math.max(1, nights);
  }
  if (isFlatPriceUnit(priceUnit)) {
    return kind === 'offer' ? Math.max(1, voucherQty) : 1;
  }
  if (kind === 'offer') {
    return Math.max(1, voucherQty);
  }
  return Math.max(1, totalGuests);
}

/**
 * Extracts "08:30 Morning" or "19:30" into concrete Date start/end timestamps
 * so server quotes and check-in release windows reflect the selected session.
 */
export function buildSlotTimestamps(
  baseDate: Date,
  slotLabel: string | null | undefined,
  durationInfo?: string | null,
  fallbackHours = 3,
): { checkIn: Date; checkOut: Date } {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 10, 0, 0, 0);
  const raw = (slotLabel || '').trim();

  // Support "17:30", "5:30 PM", "09:00 AM"
  const match24 = raw.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
  if (match24) {
    let h = parseInt(match24[1], 10);
    const m = Math.min(59, Math.max(0, parseInt(match24[2], 10)));
    const meridiem = (match24[3] || '').toLowerCase();
    if (meridiem === 'pm' && h < 12) h += 12;
    if (meridiem === 'am' && h === 12) h = 0;
    start.setHours(Math.min(23, Math.max(0, h)), m, 0, 0);
  }

  let hours = fallbackHours;
  if (durationInfo) {
    const durMatch = durationInfo.match(/(\d+(?:\.\d+)?)\s*(hour|hr|h)/i);
    if (durMatch) {
      hours = Math.max(1, Math.min(12, Math.ceil(parseFloat(durMatch[1]))));
    } else if (/full\s*day/i.test(durationInfo)) {
      hours = 8;
    } else if (/half\s*day/i.test(durationInfo)) {
      hours = 4;
    }
  }

  const end = new Date(start.getTime() + hours * 3_600_000);
  return { checkIn: start, checkOut: end };
}

export function extractTimeSlotsFromMeta(
  meta: Record<string, any>,
  kind: BookingFlowKind,
  primaryCategory: PrimaryCategoryId,
  operatingHours?: string | null,
  applicableSchedule?: string | null,
): string[] {
  const rawSlots = meta?.time_slots;
  if (Array.isArray(rawSlots) && rawSlots.length > 0) {
    const cleaned = rawSlots.map((s) => String(s).trim()).filter(Boolean);
    if (cleaned.length > 0) return cleaned;
  }

  if (kind === 'dining') {
    return ['12:30 Lunch', '14:30 Afternoon', '17:30 Sunset Drinks', '19:30 Dinner', '21:00 Late Seating'];
  }
  if (kind === 'offer') {
    if (applicableSchedule && applicableSchedule.trim()) {
      return [applicableSchedule.trim(), 'Afternoon (12:00–16:00)', 'Sunset (16:30–19:30)', 'Evening (19:30–22:30)'];
    }
    return ['Afternoon (12:00–16:00)', 'Sunset (16:30–19:30)', 'Evening (19:30–22:30)'];
  }
  if (primaryCategory === 'water_experience') {
    return ['08:30 Morning Sail', '13:00 Afternoon Session', '16:30 Sunset Cruise'];
  }
  if (operatingHours && /sunset/i.test(operatingHours)) {
    return ['16:00 Sunset Tour', '08:30 Morning Tour', '13:30 Afternoon Tour'];
  }
  return ['08:00 Morning Session', '13:30 Afternoon Session', '16:30 Sunset Session'];
}

export function extractEventTiers(
  meta: Record<string, any>,
  fallbackPrice: number,
): TicketTierOption[] {
  const rawTiers = meta?.event_details?.ticket_tiers;
  if (Array.isArray(rawTiers) && rawTiers.length > 0) {
    const valid = rawTiers
      .filter((t) => t && t.label && Number.isFinite(Number(t.price)))
      .map((t, idx) => ({
        id: String(t.id || `tier_${idx + 1}`),
        label: String(t.label).trim(),
        price: Math.max(0, Number(t.price)),
        description: t.description ? String(t.description).trim() : undefined,
      }));
    if (valid.length > 0) return valid;
  }
  return [
    {
      id: 'general',
      label: fallbackPrice === 0 ? 'Free RSVP Pass' : 'General Admission',
      price: Math.max(0, fallbackPrice),
    },
  ];
}

export function resolveCategoryFlowConfig({
  contentType,
  primaryCategory,
  priceUnit,
  offerType,
  meta = {},
  operatingHours,
  applicableSchedule,
}: {
  contentType: PublishingContentType;
  primaryCategory: PrimaryCategoryId;
  priceUnit: string;
  offerType?: string | null;
  meta?: Record<string, any>;
  operatingHours?: string | null;
  applicableSchedule?: string | null;
}): CategoryFlowConfig {
  const flat = isFlatPriceUnit(priceUnit);
  const night = isNightPriceUnit(priceUnit);

  if (contentType === 'event') {
    return {
      kind: 'event',
      isStay: false,
      isRangePicker: false,
      isFixedDate: true,
      requiresTimeSlot: false,
      isFlatUnit: flat,
      isNightUnit: false,
      defaultTimeSlots: [],
      seatingOptions: [],
      detailsCtaLabel: 'Get Tickets',
      datesStepHeader: 'Select tickets',
      datesCtaLabel: 'Continue',
      scheduleSectionLabel: 'Event schedule',
      participantSectionLabel: 'Tickets',
      cancellationNoun: 'the event starts',
      escrowText: 'Protected by ZuruSasa Secure Escrow until event check-in.',
      successStatusPill: 'TICKETS CONFIRMED',
      successHeadline: 'You’re on the list!',
      successVerbPhrase: 'Your tickets for',
      defaultHighlights: ['Instant digital pass', 'Verified venue entry', 'Host check-in QR'],
    };
  }

  if (contentType === 'special_offer') {
    const normalizedOfferType = String(offerType || '').toLowerCase();
    const isStayOffer =
      normalizedOfferType === 'stay_discount' ||
      normalizedOfferType === 'accommodation_deal' ||
      night;
    return {
      kind: 'offer',
      isStay: isStayOffer,
      isRangePicker: isStayOffer,
      isFixedDate: false,
      requiresTimeSlot: !isStayOffer,
      isFlatUnit: flat || !night,
      isNightUnit: night,
      defaultTimeSlots: extractTimeSlotsFromMeta(meta, 'offer', primaryCategory, operatingHours, applicableSchedule),
      seatingOptions: [],
      detailsCtaLabel: 'Claim Offer',
      datesStepHeader: isStayOffer ? 'Choose deal dates' : 'Choose redemption date',
      datesCtaLabel: 'Continue',
      scheduleSectionLabel: isStayOffer ? 'Stay dates' : 'Redemption date',
      participantSectionLabel: isStayOffer ? 'Guests' : 'Vouchers / Guests',
      cancellationNoun: 'redemption starts',
      escrowText: 'Protected by ZuruSasa Escrow until voucher redemption.',
      successStatusPill: 'OFFER CLAIMED',
      successHeadline: 'Deal Unlocked!',
      successVerbPhrase: 'Your special offer at',
      defaultHighlights: ['Limited-time ZuruSasa offer', 'Instant redemption pass', 'Verified local venue'],
    };
  }

  if (primaryCategory === 'food_dining') {
    return {
      kind: 'dining',
      isStay: false,
      isRangePicker: false,
      isFixedDate: false,
      requiresTimeSlot: true,
      isFlatUnit: flat,
      isNightUnit: false,
      defaultTimeSlots: extractTimeSlotsFromMeta(meta, 'dining', primaryCategory, operatingHours),
      seatingOptions: [
        'Beachfront / Ocean View',
        'Outdoor Terrace',
        'Indoor Dining',
        'Lounge / Bar',
        'Private Table',
      ],
      detailsCtaLabel: 'Reserve a table',
      datesStepHeader: 'Pick date & seating',
      datesCtaLabel: 'Continue',
      scheduleSectionLabel: 'Date & seating',
      participantSectionLabel: 'Party size',
      cancellationNoun: 'your seating time',
      escrowText: 'Protected by ZuruSasa Escrow until dining arrival check-in.',
      successStatusPill: 'TABLE RESERVED',
      successHeadline: 'Table Reserved!',
      successVerbPhrase: 'Your table at',
      defaultHighlights: ['Oceanfront dining', 'Live sunset vibe', 'Verified local kitchen', 'Fresh coastal menu'],
    };
  }

  if (primaryCategory === 'land_experience' || primaryCategory === 'water_experience') {
    return {
      kind: 'activity',
      isStay: false,
      isRangePicker: false,
      isFixedDate: false,
      requiresTimeSlot: true,
      isFlatUnit: flat,
      isNightUnit: false,
      defaultTimeSlots: extractTimeSlotsFromMeta(meta, 'activity', primaryCategory, operatingHours),
      seatingOptions: [],
      detailsCtaLabel: 'Choose date & time',
      datesStepHeader: 'Pick date & session',
      datesCtaLabel: 'Reserve spot',
      scheduleSectionLabel: 'Date & session',
      participantSectionLabel: flat ? 'Group size' : 'Participants',
      cancellationNoun: 'departure',
      escrowText: 'Protected by ZuruSasa Secure Escrow until tour check-in.',
      successStatusPill: 'EXPERIENCE BOOKED',
      successHeadline: 'Adventure Confirmed!',
      successVerbPhrase: 'Your spot for',
      defaultHighlights:
        primaryCategory === 'water_experience'
          ? ['Life jackets included', 'Experienced captain', 'Safety briefing', 'Coastal pickup']
          : ['Local guide included', 'Safety gear provided', 'Flexible pickup', 'Verified operator'],
    };
  }

  // Default: Accommodation / Stays
  return {
    kind: 'stay',
    isStay: true,
    isRangePicker: true,
    isFixedDate: false,
    requiresTimeSlot: false,
    isFlatUnit: false,
    isNightUnit: true,
    defaultTimeSlots: [],
    seatingOptions: [],
    detailsCtaLabel: 'Check availability',
    datesStepHeader: 'Change dates',
    datesCtaLabel: 'Reserve',
    scheduleSectionLabel: 'Dates',
    participantSectionLabel: 'Guests',
    cancellationNoun: 'check-in',
    escrowText: 'Protected by ZuruSasa Secure Escrow. Payment is released to the host only after check-in.',
    successStatusPill: 'RESERVATION SECURED',
    successHeadline: 'Booking Confirmed!',
    successVerbPhrase: 'Your stay at',
    defaultHighlights: ['Fast Wifi', 'Free parking on premises', 'Air Conditioning', 'Swimming Pool'],
  };
}
