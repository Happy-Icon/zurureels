/**
 * Semantic design tokens synced from the ZuruSasa web app (src/index.css).
 * Orange brand primary, warm neutral surfaces, dark mode supported.
 */

const colors = {
  light: {
    // Legacy aliases
    text: '#1c1a17',
    tint: '#e86817',

    background: '#fbfaf9',
    foreground: '#1c1a17',

    card: '#f8f7f6',
    cardForeground: '#1c1a17',

    primary: '#e86817',
    primaryForeground: '#ffffff',

    secondary: '#f0edeb',
    secondaryForeground: '#383330',

    muted: '#f2f0ee',
    mutedForeground: '#7e7367',

    accent: '#dc7c3c',
    accentForeground: '#ffffff',

    destructive: '#dc2828',
    destructiveForeground: '#ffffff',

    border: '#e5e1dc',
    input: '#e5e1dc',
  },

  dark: {
    text: '#f4f2f1',
    tint: '#f1711e',

    background: '#161412',
    foreground: '#f4f2f1',

    card: '#221f1c',
    cardForeground: '#f4f2f1',

    primary: '#f1711e',
    primaryForeground: '#ffffff',

    secondary: '#332e29',
    secondaryForeground: '#e8e5e3',

    muted: '#383330',
    mutedForeground: '#a3998f',

    accent: '#e08b52',
    accentForeground: '#ffffff',

    destructive: '#bb2b2b',
    destructiveForeground: '#ffffff',

    border: '#383330',
    input: '#383330',
  },

  // Synced from web --radius: 0.75rem
  radius: 12,
};

export default colors;
