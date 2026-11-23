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

export const OTP_RESEND_COOLDOWN_SECONDS = 60;

export const COUNTRY_OPTIONS = [
  {
    code: '+254',
    dialDigits: '254',
    shortLabel: 'KE',
    label: 'Kenya (+254)',
    flag: '🇰🇪',
    placeholder: '712 345 678',
    hint: 'Safaricom, Airtel or Telkom mobile number',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    code: '+255',
    dialDigits: '255',
    shortLabel: 'TZ',
    label: 'Tanzania (+255)',
    flag: '🇹🇿',
    placeholder: '712 345 678',
    hint: 'Enter mobile number without leading 0',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    code: '+256',
    dialDigits: '256',
    shortLabel: 'UG',
    label: 'Uganda (+256)',
    flag: '🇺🇬',
    placeholder: '772 123 456',
    hint: 'Enter mobile number without leading 0',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    code: '+1',
    dialDigits: '1',
    shortLabel: 'US',
    label: 'United States (+1)',
    flag: '🇺🇸',
    placeholder: '415 555 0199',
    hint: '10-digit US or Canada mobile number',
    minDigits: 10,
    maxDigits: 10,
  },
  {
    code: '+44',
    dialDigits: '44',
    shortLabel: 'UK',
    label: 'United Kingdom (+44)',
    flag: '🇬🇧',
    placeholder: '7700 900123',
    hint: 'UK mobile number without leading 0',
    minDigits: 10,
    maxDigits: 10,
  },
] as const;

export type CountryOption = (typeof COUNTRY_OPTIONS)[number];

export interface NormalizedAuthPhone {
  e164: string;
  display: string;
  localDigits: string;
  valid: boolean;
  error: string | null;
}

/**
 * Strips spaces, dashes, pasted country prefixes, and leading zeros to produce
 * strict E.164 phone numbers and clean formatted display strings.
 */
export function normalizeAuthPhoneNumber(
  countryCode: string,
  rawPhone: string,
): NormalizedAuthPhone {
  const selected =
    COUNTRY_OPTIONS.find((c) => c.code === countryCode) ?? COUNTRY_OPTIONS[0];

  let digits = String(rawPhone || '').replace(/\D/g, '');

  // Handle pasted numbers that already include the selected country dial code (e.g. +254712... or 254712...)
  if (
    digits.startsWith(selected.dialDigits) &&
    digits.length >= selected.dialDigits.length + selected.minDigits
  ) {
    digits = digits.slice(selected.dialDigits.length);
  }

  // Strip leading trunk zeros (e.g. 0712345678 -> 712345678)
  digits = digits.replace(/^0+/, '');

  const e164 = digits ? `${selected.code}${digits}` : selected.code;

  let grouped = digits;
  if (digits.length === 9) {
    grouped = `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  } else if (digits.length === 10) {
    grouped = `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  const display = grouped ? `${selected.code} ${grouped}` : selected.code;

  if (!digits) {
    return {
      e164,
      display,
      localDigits: digits,
      valid: false,
      error: 'Please enter your mobile number.',
    };
  }

  if (selected.code === '+254') {
    const validKe = /^(?:7|1)\d{8}$/.test(digits);
    return {
      e164,
      display,
      localDigits: digits,
      valid: validKe,
      error: validKe
        ? null
        : 'Enter a valid Kenyan mobile number starting with 7 or 1 (e.g. 712 345 678).',
    };
  }

  const validOther =
    digits.length >= selected.minDigits && digits.length <= Math.max(selected.maxDigits, 12);
  return {
    e164,
    display,
    localDigits: digits,
    valid: validOther,
    error: validOther
      ? null
      : `Enter a valid ${selected.label.split(' (')[0]} mobile number.`,
  };
}

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
