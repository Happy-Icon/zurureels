import type { ExperienceRow } from '@/lib/supabase';

export type { ExperienceRow };

// ── Destination System (Expanded for Kenya Coastal & Safari Hubs) ───────────

export type DestinationId =
  | 'diani'
  | 'lamu'
  | 'watamu'
  | 'kilifi'
  | 'mombasa'
  | 'nairobi'
  | 'malindi'
  | 'naivasha'
  | 'mara';

// Backward compatibility alias
export type CoastalDestinationId = DestinationId;

export interface DestinationConfig {
  id: DestinationId;
  name: string;
  region: string;
  tagline: string;
  image: string;
  accentColor: string;
}

export type CoastalDestination = DestinationConfig;

export const DESTINATIONS: DestinationConfig[] = [
  {
    id: 'diani',
    name: 'Diani Beach',
    region: 'South Coast',
    tagline: 'White sand beaches, coral reefs, and skydiving',
    image: 'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=800',
    accentColor: '#F26522',
  },
  {
    id: 'lamu',
    name: 'Lamu Island',
    region: 'North Coast',
    tagline: 'Swahili heritage, dhow safaris, and tranquil car-free streets',
    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
    accentColor: '#D97706',
  },
  {
    id: 'watamu',
    name: 'Watamu',
    region: 'North Coast',
    tagline: 'Marine parks, sunken sandbars, and coastal Italian dining',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
    accentColor: '#059669',
  },
  {
    id: 'kilifi',
    name: 'Kilifi Creek',
    region: 'Central Coast',
    tagline: 'Sunset dhows, bioluminescence, and creative boho coastal vibes',
    image: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
    accentColor: '#2563EB',
  },
  {
    id: 'mombasa',
    name: 'Mombasa Old Town',
    region: 'Island Coast',
    tagline: 'Fort Jesus, spiced street food, and vibrant coastal culture',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800',
    accentColor: '#9333EA',
  },
  {
    id: 'nairobi',
    name: 'Nairobi Safari Hub',
    region: 'Highland Gateway',
    tagline: 'Urban national park, giraffe sanctuary, and gateway to the coast',
    image: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800',
    accentColor: '#0D9488',
  },
  {
    id: 'malindi',
    name: 'Malindi',
    region: 'North Coast',
    tagline: 'Vasco da Gama Pillar, marine reserve, and coastal Swahili fusion',
    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
    accentColor: '#E11D48',
  },
  {
    id: 'naivasha',
    name: 'Lake Naivasha',
    region: 'Rift Valley Gateway',
    tagline: 'Crescent Island wildlife walks, Hell’s Gate cycling, and freshwater boating',
    image: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800',
    accentColor: '#10B981',
  },
  {
    id: 'mara',
    name: 'Maasai Mara',
    region: 'Rift Valley Safari',
    tagline: 'Great Migration, world-class game drives, and hot air balloon safaris',
    image: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800',
    accentColor: '#F59E0B',
  },
];

export const COASTAL_DESTINATIONS = DESTINATIONS;

// ── Budget & Preferences ───────────────────────────────────────────────────

export type BudgetTier = 'budget' | 'comfort' | 'luxury';

export interface BudgetTierOption {
  id: BudgetTier;
  label: string;
  perDayEstimate: string;
  description: string;
}

export const BUDGET_TIERS: BudgetTierOption[] = [
  {
    id: 'budget',
    label: 'Backpacker & Budget',
    perDayEstimate: 'KSh 3,500 – 7,000 / day',
    description: 'Eco-hostels, boutique stays, local seafood, shared excursions',
  },
  {
    id: 'comfort',
    label: 'Comfort & Balanced',
    perDayEstimate: 'KSh 8,000 – 18,000 / day',
    description: 'Private coastal villas, dhow sunset cruises, guided snorkeling',
  },
  {
    id: 'luxury',
    label: 'Luxury & Exclusive',
    perDayEstimate: 'KSh 25,000+ / day',
    description: 'Private beachfront estates, private charters, fine coastal dining',
  },
];

export type InterestTag =
  | 'beaches'
  | 'watersports'
  | 'dhow_cruises'
  | 'seafood_dining'
  | 'culture_heritage'
  | 'nightlife'
  | 'wellness'
  | 'safari_nature';

export interface InterestOption {
  id: InterestTag;
  label: string;
  icon: string;
}

export const INTEREST_OPTIONS: InterestOption[] = [
  { id: 'beaches', label: 'Beach Relaxation', icon: 'sun' },
  { id: 'watersports', label: 'Kitesurfing & Diving', icon: 'activity' },
  { id: 'dhow_cruises', label: 'Sunset Dhow Safaris', icon: 'navigation' },
  { id: 'seafood_dining', label: 'Coastal Swahili Dining', icon: 'coffee' },
  { id: 'culture_heritage', label: 'Historic Swahili Towns', icon: 'bookmark' },
  { id: 'nightlife', label: 'Beach Clubs & Bars', icon: 'music' },
  { id: 'wellness', label: 'Yoga & Spa Retreats', icon: 'heart' },
  { id: 'safari_nature', label: 'Marine & Wildlife Parks', icon: 'compass' },
];

export type AccommodationType = 'villa' | 'resort' | 'boutique_hotel' | 'eco_cottage';

export interface TripPreferences {
  destinationId: DestinationId;
  destinationName: string;
  durationDays: number;
  startDate?: string | null;
  endDate?: string | null;
  adultsCount: number;
  childrenCount: number;
  budgetTier: BudgetTier;
  interests: InterestTag[];
  accommodationType?: AccommodationType;
  specialRequests?: string;
  // Conversational constraint extensions (REM-03)
  budgetMaxKes?: number | null;
  dietaryRestrictions?: string[]; // e.g. ['halal', 'vegetarian', 'vegan']
  accessibility?: string[];       // e.g. ['wheelchair_accessible']
  pace?: 'relaxed' | 'moderate' | 'packed';
  exclusions?: string[];          // e.g. ['scuba_diving', 'nightlife']
}

// ── Schedule & Itinerary Items (REM-08 & REM-09) ───────────────────────────

export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';

export type ItineraryItemType = 'stay' | 'activity' | 'dining' | 'transit' | 'custom';

export interface ItineraryItem {
  id: string;
  timeSlot: TimeSlot;
  slot?: 'morning' | 'afternoon' | 'evening'; // Semantic alias
  timeLabel?: string;
  startTime?: string;                        // e.g. "09:00 AM" (REM-09)
  title: string;
  description: string;
  location?: string;
  type: ItineraryItemType;
  experienceId?: string | null;
  experienceTitle?: string | null;
  experienceImageUrl?: string | null;
  rating?: number | null;                    // Authentic DB rating or null (REM-09)
  reviewsCount?: number;                     // Authentic DB review count (REM-09)
  estimatedPriceKes?: number;
  isBookable: boolean;
  notes?: string;
  userModified?: boolean;                    // Manual edit flag (REM-08)
}

export interface TripDay {
  dayNumber: number;
  dateLabel: string;
  theme: string;
  items: ItineraryItem[];
  notes?: string;
  revision?: number;                         // Optimistic concurrency (REM-08)
  updatedAt?: string;
}

export interface BudgetBreakdown {
  accommodationTotal: number;
  activitiesTotal: number;
  diningEstimate: number;
  totalEstimatedKes: number;
}

export interface TripPlan {
  id: string;
  title: string;
  destination: string;
  destinationId: DestinationId;
  coverImage: string;
  startDate?: string | null;
  endDate?: string | null;
  durationDays: number;
  guestCount: number;
  budgetTier: BudgetTier;
  days: TripDay[];
  budgetBreakdown: BudgetBreakdown;
  status: 'draft' | 'planned' | 'booked';
  createdAt: string;
  updatedAt: string;
  // Concurrency & Grounding / Degradation Metadata (REM-08, REM-10)
  revision?: number;
  generationEngine?: string;                // e.g. 'claude-3-5-sonnet-20241022' | 'grounded_local_planner'
  degraded?: boolean;                       // Transparent fallback flag (REM-10)
  fallbackReason?: string;                  // Honest reason for degradation (REM-10)
  preferences?: TripPreferences;            // Preserved context for regeneration
  metadata?: Record<string, any>;
}
