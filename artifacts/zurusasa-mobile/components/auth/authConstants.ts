import { Dimensions } from 'react-native';

export const { width: SW, height: SH } = Dimensions.get('window');

// ── Brand colours ─────────────────────────────────────────────────────────────
export const ORANGE = '#F47C20';
export const ORANGE_DARK = '#D96518';
export const INK = '#1A1A1A';
export const CHARCOAL = '#2D2D2D';
export const MUTED = '#888888';
export const HAIR = '#CCCCCC';

// ── Destinations ──────────────────────────────────────────────────────────────
export const DESTINATIONS = [
  {
    name: 'Diani Beach',
    tagline: 'Kenya',
    image: require('@/assets/images/hero_diani.jpg'),
  },
  {
    name: 'Lamu Island',
    tagline: 'Kenya',
    image: require('@/assets/images/hero_lamu.jpg'),
  },
  {
    name: 'Watamu',
    tagline: 'Kenya',
    image: require('@/assets/images/hero_watamu.jpg'),
  },
  {
    name: 'Zanzibar',
    tagline: 'Tanzania',
    image: require('@/assets/images/hero_zanzibar.jpg'),
  },
  {
    name: 'Kilifi Creek',
    tagline: 'Kenya',
    image: require('@/assets/images/hero_kilifi.jpg'),
  },
];

export const COUNTRY_OPTIONS = [
  { code: '+254', label: 'Kenya (+254)', flag: '🇰🇪' },
  { code: '+255', label: 'Tanzania (+255)', flag: '🇹🇿' },
  { code: '+256', label: 'Uganda (+256)', flag: '🇺🇬' },
  { code: '+1', label: 'United States (+1)', flag: '🇺🇸' },
  { code: '+44', label: 'United Kingdom (+44)', flag: '🇬🇧' },
] as const;

// ── Auth flow steps ────────────────────────────────────────────────────────────
export type AuthStep =
  | 'landing'
  | 'phone'
  | 'otp'
  | 'profile'
  | 'commitment'
  | 'email_sent'
  | 'email'
  | 'email_otp';
