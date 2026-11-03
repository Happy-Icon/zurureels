/**
 * 4-Point Grid Spacing Tokens for ZuruSasa
 * Always use gap or padding multiples rather than arbitrary numbers.
 */

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export type SpacingToken = keyof typeof spacing;
