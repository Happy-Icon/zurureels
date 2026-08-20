import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  AI_COLORS,
  AI_FONTS,
  AI_RADIUS,
  AI_SHADOW,
  QUICK_ACTIONS,
  SUGGESTION_CHIPS,
  type QuickAction,
} from '@/components/ai/tokens';
import { AIQuickActionCard } from '@/components/ai/AIQuickActionCard';
import { AISuggestionChips } from '@/components/ai/AISuggestionChip';
import { AIInputBar } from '@/components/ai/AIInputBar';

/**
 * AIHomeScreen — Beautiful landing screen before the conversation starts.
 *
 * Features:
 * - Time-aware greeting (Good Morning / Afternoon / Evening)
 * - Quick action grid
 * - Suggestion chips
 * - Premium AI input bar at bottom
 */
export default function AIHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [inputText, setInputText] = React.useState('');

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const handlePrompt = (text: string) => {
    // Navigate to chat with pre-filled prompt
    router.push({ pathname: '/ai/chat' as any, params: { initialPrompt: text } });
  };

  const handleActionPress = (action: QuickAction) => {
    handlePrompt(action.prompt);
  };

  const handleSend = () => {
    if (inputText.trim()) {
      handlePrompt(inputText.trim());
      setInputText('');
    }
  };

  // Split quick actions into rows of 3 for the grid
  const rows: QuickAction[][] = [];
  for (let i = 0; i < QUICK_ACTIONS.length; i += 3) {
    rows.push(QUICK_ACTIONS.slice(i, i + 3));
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        {/* Back button */}
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={AI_COLORS.textPrimary} />
        </Pressable>

        <View style={styles.headerLeft}>
          <View style={styles.logoMark}>
            <Text style={styles.logoEmoji}>✦</Text>
          </View>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.brandName}>Zuru AI</Text>
              <View style={styles.betaBadge}>
                <Text style={styles.betaText}>BETA</Text>
              </View>
            </View>
            <Text style={styles.tagline}>Your intelligent travel companion</Text>
          </View>
        </View>

        <Pressable style={styles.historyBtn} hitSlop={8}>
          <Feather name="clock" size={18} color={AI_COLORS.textSecondary} />
        </Pressable>
      </View>

      {/* ── Scrollable content ──────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting section */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingText}>
            {greeting} 👋
          </Text>
          <Text style={styles.greetingSubtitle}>
            How can I help you explore today?
          </Text>
        </View>

        {/* Featured prompt suggestions */}
        <View style={styles.featuredPrompts}>
          {[
            { icon: '🗺', text: 'Plan a 3-day Mombasa itinerary' },
            { icon: '💎', text: 'Best luxury experiences in Kenya' },
            { icon: '🌊', text: 'Hidden beach gems near Diani' },
          ].map((item) => (
            <Pressable
              key={item.text}
              onPress={() => handlePrompt(item.text)}
              style={({ pressed }) => [
                styles.featuredCard,
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={styles.featuredEmoji}>{item.icon}</Text>
              <Text style={styles.featuredText}>{item.text}</Text>
              <Feather name="arrow-up-right" size={14} color={AI_COLORS.textTertiary} />
            </Pressable>
          ))}
        </View>

        {/* Section: Quick actions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Explore</Text>
          <Text style={styles.sectionSub}>What are you looking for?</Text>
        </View>

        {/* Quick action cards — horizontal scroll by row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActionsRow}
        >
          {QUICK_ACTIONS.map((action) => (
            <AIQuickActionCard
              key={action.id}
              action={action}
              onPress={handleActionPress}
            />
          ))}
        </ScrollView>

        {/* Section: Try asking */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Suggestions</Text>
        </View>
        <AISuggestionChips chips={SUGGESTION_CHIPS} onSelect={handlePrompt} />

        {/* Trust badge */}
        <View style={styles.trustCard}>
          <Feather name="zap" size={14} color={AI_COLORS.orange} />
          <Text style={styles.trustText}>
            Powered by real-time ZuruSasa listings and personalized to your preferences.
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Bottom input bar ─────────────────────────────────────── */}
      <View style={styles.inputContainer}>
        <AIInputBar
          value={inputText}
          onChangeText={setInputText}
          onSend={handleSend}
          placeholder="Ask Zuru AI anything…"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AI_COLORS.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: AI_COLORS.border,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AI_COLORS.bgCardAlt,
    borderWidth: 1,
    borderColor: AI_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  logoMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: AI_COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    ...AI_SHADOW.orange,
  },
  logoEmoji: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandName: {
    fontSize: 19,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.textPrimary,
  },
  betaBadge: {
    backgroundColor: AI_COLORS.orangeSoft,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  betaText: {
    fontSize: 9,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.orange,
    letterSpacing: 0.8,
  },
  tagline: {
    fontSize: 11.5,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textTertiary,
    marginTop: 1,
  },
  historyBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: AI_COLORS.bgCardAlt,
    borderWidth: 1,
    borderColor: AI_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: 24,
    gap: 20,
  },

  // Greeting
  greetingSection: {
    paddingHorizontal: 20,
    gap: 4,
  },
  greetingText: {
    fontSize: 30,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.textPrimary,
    lineHeight: 36,
  },
  greetingSubtitle: {
    fontSize: 15.5,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textSecondary,
    marginTop: 2,
  },

  // Featured prompts
  featuredPrompts: {
    paddingHorizontal: 20,
    gap: 8,
  },
  featuredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: AI_RADIUS.lg,
    borderWidth: 1,
    borderColor: AI_COLORS.border,
    padding: 14,
    ...AI_SHADOW.subtle,
  },
  featuredEmoji: {
    fontSize: 20,
    width: 28,
  },
  featuredText: {
    flex: 1,
    fontSize: 14,
    fontFamily: AI_FONTS.medium,
    color: AI_COLORS.textPrimary,
  },

  // Section header
  sectionHeader: {
    paddingHorizontal: 20,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.textPrimary,
  },
  sectionSub: {
    fontSize: 12.5,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textTertiary,
  },

  // Quick actions
  quickActionsRow: {
    paddingHorizontal: 20,
    gap: 10,
  },

  // Trust card
  trustCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 20,
    backgroundColor: AI_COLORS.orangeLight,
    borderWidth: 1,
    borderColor: AI_COLORS.orangeMid,
    borderRadius: AI_RADIUS.md,
    padding: 12,
  },
  trustText: {
    flex: 1,
    fontSize: 12,
    fontFamily: AI_FONTS.regular,
    color: '#92400E',
    lineHeight: 18,
  },

  // Input container
  inputContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
