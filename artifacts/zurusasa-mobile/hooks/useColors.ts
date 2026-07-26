import colors from '@/constants/colors';

/**
 * Returns the Light Mode design tokens for ZuruSasa native app.
 * Light mode everywhere palette with warm orange accent (#EE7D30).
 */
export function useColors() {
  return { ...colors.light, radius: colors.radius };
}
