import { useTheme } from '@/context/ThemeContext';

/**
 * Returns dynamic semantic design tokens for ZuruSasa native app
 * based on user's selected Appearance mode (System, Light, Dark).
 */
export function useColors() {
  const { colors } = useTheme();
  return colors;
}

export function useAppearance() {
  const { theme, appearanceMode, setAppearanceMode, isDark, colorScheme } = useTheme();
  return {
    theme,
    appearance: appearanceMode,
    setAppearance: setAppearanceMode,
    isDark,
    colorScheme,
  };
}

export { useTheme } from '@/context/ThemeContext';

