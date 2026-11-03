/**
 * Motion & Transition Tokens for ZuruSasa
 */

export const motion = {
  fast: 150, // press feedback, toggles
  base: 250, // element transitions, sheet entries
  slow: 380, // full screen modals, complex card transforms

  spring: {
    snappy: { damping: 20, stiffness: 220, mass: 0.8 },
    bouncy: { damping: 12, stiffness: 180, mass: 1 },
    gentle: { damping: 26, stiffness: 160, mass: 1 },
  },
} as const;
