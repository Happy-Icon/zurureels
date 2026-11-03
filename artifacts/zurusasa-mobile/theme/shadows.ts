/**
 * Box Shadow Tokens for ZuruSasa
 * Modern continuous CSS boxShadow syntax (supported across native Fabric and Web).
 */

export const shadows = {
  none: 'none',
  card: '0 1px 3px rgba(0, 0, 0, 0.06)',
  raised: '0 4px 12px rgba(0, 0, 0, 0.08)',
  overlay: '0 8px 24px rgba(0, 0, 0, 0.16)',
  dock: '0 -2px 10px rgba(0, 0, 0, 0.04)',
} as const;

export type ShadowToken = keyof typeof shadows;
