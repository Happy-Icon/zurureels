/**
 * Semantic design tokens for ZuruSasa native app.
 * Light mode everywhere theme: clean off-white background, crisp dark text,
 * white surfaces with soft shadows, and warm orange accent (#EE7D30).
 */

const colors = {
  light: {
    text: '#111827',
    tint: '#EE7D30',

    background: '#FAFAFA',
    foreground: '#111827',

    card: '#FFFFFF',
    cardForeground: '#111827',

    primary: '#EE7D30',
    primaryForeground: '#ffffff',

    secondary: '#F3F4F6',
    secondaryForeground: '#1F2937',

    muted: '#F9FAFB',
    mutedForeground: '#6B7280',

    accent: '#EE7D30',
    accentForeground: '#ffffff',

    destructive: '#EF4444',
    destructiveForeground: '#ffffff',

    border: '#E5E7EB',
    input: '#E5E7EB',
  },

  // Enforce clean Light Mode everywhere for consistent premium visual experience
  dark: {
    text: '#111827',
    tint: '#EE7D30',

    background: '#FAFAFA',
    foreground: '#111827',

    card: '#FFFFFF',
    cardForeground: '#111827',

    primary: '#EE7D30',
    primaryForeground: '#ffffff',

    secondary: '#F3F4F6',
    secondaryForeground: '#1F2937',

    muted: '#F9FAFB',
    mutedForeground: '#6B7280',

    accent: '#EE7D30',
    accentForeground: '#ffffff',

    destructive: '#EF4444',
    destructiveForeground: '#ffffff',

    border: '#E5E7EB',
    input: '#E5E7EB',
  },

  radius: 16,
};

export default colors;
