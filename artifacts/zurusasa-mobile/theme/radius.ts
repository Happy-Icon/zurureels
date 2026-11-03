/**
 * Corner Radii Tokens for ZuruSasa
 * Non-pill curves pair with borderCurve: 'continuous'.
 */

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  card: 16,
  modal: 24,
  full: 9999, // Pill / Circular capsules
} as const;

export type RadiusToken = keyof typeof radius;
