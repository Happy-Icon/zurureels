/**
 * Semantic design tokens for ZuruSasa native app.
 * Light mode palette: clean off-white background, crisp dark text, white surfaces, warm orange accent (#F26522).
 * Dark mode palette: sleek deep dark surfaces (#121212 / #1E1E1E), soft white text, subtle borders, warm orange accent (#F26522).
 */

const colors = {
  light: {
    text: '#111827',
    textSecondary: '#6B7280',
    tint: '#F26522',

    background: '#FAFAFA',
    foreground: '#111827',

    card: '#FFFFFF',
    cardForeground: '#111827',
    surface: '#FFFFFF',
    surfaceSecondary: '#F3F4F6',

    primary: '#F26522',
    primaryForeground: '#FFFFFF',

    secondary: '#F3F4F6',
    secondaryForeground: '#1F2937',

    muted: '#F9FAFB',
    mutedForeground: '#6B7280',

    accent: '#F26522',
    accentForeground: '#FFFFFF',

    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',
    danger: '#EF4444',
    success: '#10B981',

    border: '#E5E7EB',
    input: '#E5E7EB',
    overlay: 'rgba(0, 0, 0, 0.52)',
    shadow: 'rgba(0, 0, 0, 0.05)',
  },

  dark: {
    text: '#F9FAFB',
    textSecondary: '#9CA3AF',
    tint: '#F26522',

    background: '#121212',
    foreground: '#F9FAFB',

    card: '#1E1E1E',
    cardForeground: '#F9FAFB',
    surface: '#1E1E1E',
    surfaceSecondary: '#27272A',

    primary: '#F26522',
    primaryForeground: '#FFFFFF',

    secondary: '#27272A',
    secondaryForeground: '#E4E4E7',

    muted: '#18181B',
    mutedForeground: '#9CA3AF',

    accent: '#F26522',
    accentForeground: '#FFFFFF',

    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',
    danger: '#EF4444',
    success: '#10B981',

    border: '#2E2E32',
    input: '#2E2E32',
    overlay: 'rgba(0, 0, 0, 0.72)',
    shadow: 'rgba(0, 0, 0, 0.45)',
  },

  radius: 16,
};

export type ThemeColors = typeof colors.light;
export default colors;


