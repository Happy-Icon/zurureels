import type { TextStyle } from 'react-native';

/**
 * DM Sans Typography Ramp for ZuruSasa
 * Bundled fonts loaded in root layout:
 * - DMSans_400Regular
 * - DMSans_500Medium
 * - DMSans_600SemiBold
 * - DMSans_700Bold
 * - InstrumentSerif_400Regular
 */

export const typography = {
  largeTitle: {
    fontSize: 32,
    fontFamily: 'DMSans_700Bold',
    lineHeight: 38,
    letterSpacing: -0.4,
  },
  title1: {
    fontSize: 24,
    fontFamily: 'DMSans_700Bold',
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  title2: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  title3: {
    fontSize: 18,
    fontFamily: 'DMSans_600SemiBold',
    lineHeight: 24,
  },
  headline: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    lineHeight: 22,
  },
  body: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 21,
  },
  bodyMedium: {
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    lineHeight: 21,
  },
  callout: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    lineHeight: 19,
  },
  subhead: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 18,
  },
  subheadMedium: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    lineHeight: 18,
  },
  subheadBold: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    lineHeight: 18,
  },
  footnote: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 16,
  },
  caption: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 15,
  },
  captionBold: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    lineHeight: 15,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
