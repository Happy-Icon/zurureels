/**
 * Zuru AI – Design Tokens & Shared Types
 * Central source of truth for the AI feature design system.
 */

export const AI_COLORS = {
  // Brand
  orange: '#F26522',
  orangeLight: '#FFF5EF',
  orangeMid: '#FDDFCB',
  orangeSoft: 'rgba(242,101,34,0.10)',

  // Backgrounds
  bg: '#FAFAFA',
  bgCard: '#FFFFFF',
  bgCardAlt: '#F7F7F7',

  // Text
  textPrimary: '#111111',
  textSecondary: '#666666',
  textTertiary: '#9CA3AF',
  textOnDark: '#FFFFFF',

  // Borders
  border: '#EBEBEB',
  borderStrong: '#D1D5DB',

  // Semantic
  success: '#10B981',
  successBg: 'rgba(16,185,129,0.1)',
  star: '#F59E0B',

  // AI bubble
  userBubble: '#111111',
  aiBubble: '#FFFFFF',
  userText: '#FFFFFF',
  aiText: '#111111',
} as const;

export const AI_FONTS = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
} as const;

export const AI_RADIUS = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  full: 999,
} as const;

export const AI_SHADOW = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  subtle: {
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  orange: {
    shadowColor: '#F26522',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;

// Quick action card definitions
export interface QuickAction {
  id: string;
  emoji: string;
  label: string;
  prompt: string;
  color: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'beaches',   emoji: '🏖',  label: 'Find Beaches',      prompt: 'Show me the best beaches in Kenya',        color: '#E0F2FE' },
  { id: 'stays',     emoji: '🏨',  label: 'Find Stays',        prompt: 'Find me a great place to stay',            color: '#F0FDF4' },
  { id: 'food',      emoji: '🍽',  label: 'Restaurants',       prompt: 'Best restaurants near me',                 color: '#FFF7ED' },
  { id: 'events',    emoji: '🎉',  label: 'Events Tonight',    prompt: 'What events are happening tonight?',       color: '#F5F3FF' },
  { id: 'boats',     emoji: '🚤',  label: 'Boat Trips',        prompt: 'Find exciting boat trips and water tours', color: '#EFF6FF' },
  { id: 'plan',      emoji: '🗓',  label: 'Plan My Trip',      prompt: 'Help me plan a trip itinerary',            color: '#FFF7ED' },
  { id: 'nearby',    emoji: '📍',  label: 'Near Me',           prompt: 'What is popular near my location?',       color: '#F0FDF4' },
  { id: 'budget',    emoji: '💰',  label: 'Budget Travel',     prompt: 'Show budget-friendly travel options',      color: '#ECFDF5' },
  { id: 'romantic',  emoji: '❤️', label: 'Romantic Getaway',  prompt: 'Plan a romantic getaway for two',          color: '#FFF1F2' },
  { id: 'family',    emoji: '👨‍👩‍👧', label: 'Family Vacation', prompt: 'Find family-friendly activities and stays', color: '#FFFBEB' },
];

export const SUGGESTION_CHIPS = [
  'Weekend in Diani',
  'Best seafood',
  'Luxury villas',
  'Hidden beaches',
  'Things to do tonight',
  'Family friendly',
  'Budget stays',
  'Trending places',
  'Romantic spots',
  'Adventure tours',
];

// AI Message types
export type MessageRole = 'user' | 'ai';

export interface AIMessage {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: Date;
  cards?: AICard[];
}

export interface AICard {
  id: string;
  type: 'listing' | 'recommendation';
  title: string;
  subtitle?: string;
  location?: string;
  rating?: number;
  reviewCount?: number;
  price?: number;
  priceUnit?: string;
  imageUrl?: string;
  category?: string;
  tags?: string[];
}
