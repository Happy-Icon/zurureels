export const CATEGORIES = [
  { label: 'Stays & Villas', value: 'stays' },
  { label: 'Tours & Excursions', value: 'tours' },
  { label: 'Food & Dining', value: 'food' },
  { label: 'Nightlife & Clubs', value: 'nightlife' },
  { label: 'Events & Festivals', value: 'events' },
  { label: 'Boats & Water Sports', value: 'boats' },
];

export const LOCATIONS = ['Diani', 'Watamu', 'Lamu', 'Mombasa', 'Malindi', 'Kilifi'];

export const POPULAR_AMENITIES = [
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
];

export const CANCELLATION_POLICIES = [
  {
    id: 'flexible',
    title: 'Flexible',
    desc: 'Full refund up to 24 hours before check-in',
  },
  {
    id: 'moderate',
    title: 'Moderate',
    desc: 'Full refund up to 5 days before check-in',
  },
  {
    id: 'strict',
    title: 'Strict',
    desc: 'Full refund up to 7 days before check-in, 50% thereafter',
  },
] as const;

export type BookingMode = 'approval_required' | 'instant';
export type CancellationPolicyId = (typeof CANCELLATION_POLICIES)[number]['id'];
