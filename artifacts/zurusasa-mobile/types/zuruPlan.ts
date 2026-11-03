import type { ExperienceRow } from '@/lib/supabase';

export type { ExperienceRow };

export type CoastalDestinationId =
  | 'diani'
  | 'lamu'
  | 'watamu'
  | 'kilifi'
  | 'mombasa'
  | 'nairobi';

export interface CoastalDestination {
  id: CoastalDestinationId;
  name: string;
  region: string;
  tagline: string;
  image: string;
  accentColor: string;
}

export const COASTAL_DESTINATIONS: CoastalDestination[] = [
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
    name: 'Watamu & Malindi',
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
    image: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=800',
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
];

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
  destinationId: CoastalDestinationId;
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
}

export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';

export type ItineraryItemType = 'stay' | 'activity' | 'dining' | 'transit' | 'custom';

export interface ItineraryItem {
  id: string;
  timeSlot: TimeSlot;
  timeLabel?: string;
  title: string;
  description: string;
  location?: string;
  type: ItineraryItemType;
  experienceId?: string | null;
  experienceTitle?: string | null;
  experienceImageUrl?: string | null;
  rating?: number | null;
  estimatedPriceKes?: number;
  isBookable: boolean;
  notes?: string;
}

export interface TripDay {
  dayNumber: number;
  dateLabel: string;
  theme: string;
  items: ItineraryItem[];
  notes?: string;
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
  destinationId: CoastalDestinationId;
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
}
