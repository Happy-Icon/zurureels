import {
  AMENITIES_BY_CATEGORY,
  EVENT_SUBCATEGORIES,
  OFFER_TYPES,
  PRIMARY_EXPERIENCE_CATEGORIES,
  PUBLISHING_FORMATS,
  type PrimaryCategoryId,
  type PublishingContentType,
} from '@/constants/taxonomy';

export {
  AMENITIES_BY_CATEGORY,
  EVENT_SUBCATEGORIES,
  OFFER_TYPES,
  PRIMARY_EXPERIENCE_CATEGORIES,
  PUBLISHING_FORMATS,
  type PrimaryCategoryId,
  type PublishingContentType,
};

export const CATEGORIES = PRIMARY_EXPERIENCE_CATEGORIES.map((c) => ({
  label: c.label,
  value: c.id,
}));

export const LOCATIONS = [
  'Diani',
  'Mombasa',
  'Watamu',
  'Malindi',
  'Lamu',
  'Kilifi',
  'Nairobi',
  'Naivasha',
  'Nanyuki',
  'Maasai Mara',
  'Zanzibar',
];

export const POPULAR_AMENITIES = AMENITIES_BY_CATEGORY.accommodation;

export const CANCELLATION_POLICIES = [
  {
    id: 'flexible',
    title: 'Flexible',
    desc: 'Full refund up to 24 hours before check-in or start time',
  },
  {
    id: 'moderate',
    title: 'Moderate',
    desc: 'Full refund up to 5 days before check-in or start time',
  },
  {
    id: 'strict',
    title: 'Strict',
    desc: 'Full refund up to 7 days before check-in, 50% thereafter',
  },
] as const;

export type BookingMode = 'approval_required' | 'instant';
export type CancellationPolicyId = (typeof CANCELLATION_POLICIES)[number]['id'];
