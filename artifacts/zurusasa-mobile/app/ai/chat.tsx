import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AI_COLORS,
  AI_FONTS,
  AI_RADIUS,
  AI_SHADOW,
  SUGGESTION_CHIPS,
  type AIMessage,
  type AICard,
} from '@/components/ai/tokens';
import { AIMessageBubble } from '@/components/ai/AIMessageBubble';
import { AITypingIndicator } from '@/components/ai/AITypingIndicator';
import { AIInputBar } from '@/components/ai/AIInputBar';
import { AIEmptyState } from '@/components/ai/AIEmptyState';
import { AISuggestionChips } from '@/components/ai/AISuggestionChip';

// ── Demo response generator (UI only — no real AI calls) ────────────────────
function generateDemoResponse(prompt: string): { text: string; cards?: AICard[] } {
  const lower = prompt.toLowerCase();

  if (lower.includes('beach') || lower.includes('diani') || lower.includes('coastal')) {
    return {
      text: "Here are some stunning beach experiences along the Kenya coast 🏖 Each of these has been curated for their beauty, accessibility, and guest satisfaction.",
      cards: [
        {
          id: '1', type: 'listing', title: 'Diani Beach Villa', location: 'Diani, Kwale',
          rating: 4.9, reviewCount: 124, price: 8500, priceUnit: 'night',
          category: 'villa', imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400',
        },
        {
          id: '2', type: 'listing', title: 'Watamu Beach Resort', location: 'Watamu, Kilifi',
          rating: 4.7, reviewCount: 89, price: 5200, priceUnit: 'night',
          category: 'hotel', imageUrl: 'https://images.unsplash.com/photo-1439405326854-014607f694d7?w=400',
        },
        {
          id: '3', type: 'listing', title: 'Lamu Island Stay', location: 'Lamu, Kenya',
          rating: 4.8, reviewCount: 67, price: 6800, priceUnit: 'night',
          category: 'stay', imageUrl: 'https://images.unsplash.com/photo-1503917988258-f87a78e3c995?w=400',
        },
      ],
    };
  }

  if (lower.includes('restaurant') || lower.includes('food') || lower.includes('seafood')) {
    return {
      text: "Great choice! Here are the top-rated restaurants I'd recommend 🍽 These are loved by both locals and visitors for quality and ambiance.",
      cards: [
        {
          id: '4', type: 'recommendation', title: 'The Tamarind Restaurant', subtitle: 'Seafood & Swahili cuisine',
          location: 'Mombasa', rating: 4.8, category: 'food',
          imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400',
        },
        {
          id: '5', type: 'recommendation', title: 'Ali Barbour\'s Cave', subtitle: 'Romantic seafood dining',
          location: 'Diani Beach', rating: 4.9, category: 'food',
          imageUrl: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=400',
        },
      ],
    };
  }

  if (lower.includes('plan') || lower.includes('itinerary') || lower.includes('trip')) {
    return {
      text: "I'd love to help you plan your perfect trip! Here's a suggested 3-day coastal Kenya itinerary:\n\n**Day 1** — Arrive in Mombasa, explore the Old Town, dinner at The Tamarind\n\n**Day 2** — Drive to Diani Beach, snorkeling at the reef, sunset boat cruise\n\n**Day 3** — Visit Wasini Island, dolphin spotting, fly back from Ukunda\n\nWould you like me to find specific bookings for any of these activities?",
    };
  }

  if (lower.includes('boat') || lower.includes('water') || lower.includes('cruise')) {
    return {
      text: "Kenya's coast has incredible boat experiences! Here are the best ones I found 🚤",
      cards: [
        {
          id: '6', type: 'listing', title: 'Sunset Dhow Cruise', location: 'Mombasa Harbour',
          rating: 4.8, reviewCount: 203, price: 3500, priceUnit: 'person',
          category: 'boats', imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400',
        },
        {
          id: '7', type: 'listing', title: 'Glass Bottom Boat Tour', location: 'Diani',
          rating: 4.6, reviewCount: 91, price: 2200, priceUnit: 'person',
          category: 'boats', imageUrl: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400',
        },
      ],
    };
  }

  // Default
  return {
    text: `Great question! I'm searching ZuruSasa's listings for "${prompt}" and will have personalized recommendations ready for you shortly. In the meantime, could you tell me more about your preferences — dates, budget, or group size?`,
  };
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AIChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { initialPrompt } = useLocalSearchParams<{ initialPrompt?: string }>();

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const listRef = useRef<FlatList>(null);

  const scrollToBottom = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Send a message and simulate AI response ───────────────────────────────
  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;

    const userMsg: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);
    scrollToBottom();

    // Simulate AI thinking time (UI only)
    const delay = 1200 + Math.random() * 800;
    setTimeout(() => {
      const response = generateDemoResponse(text);
      const aiMsg: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: response.text,
        timestamp: new Date(),
        cards: response.cards,
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
      scrollToBottom();
    }, delay);
  }, []);

  // Auto-send initial prompt if navigated with one
  useEffect(() => {
    if (initialPrompt) {
      sendMessage(initialPrompt);
    }
  }, [initialPrompt]);

  const handleSend = () => sendMessage(inputText);

  const handleSuggestion = (chip: string) => sendMessage(chip);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={AI_COLORS.textPrimary} />
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={styles.logoMini}>
            <Text style={styles.logoMiniEmoji}>✦</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Zuru AI</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Ready to explore</Text>
            </View>
          </View>
        </View>

        <Pressable style={styles.moreBtn} hitSlop={8}>
          <Feather name="more-horizontal" size={20} color={AI_COLORS.textSecondary} />
        </Pressable>
      </View>

      {/* Messages area */}
      {messages.length === 0 && !isTyping ? (
        <View style={styles.emptyContainer}>
          <AIEmptyState onSuggestionSelect={handleSuggestion} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <AIMessageBubble
              message={item}
              isLatest={index === messages.length - 1}
            />
          )}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={isTyping ? <AITypingIndicator /> : null}
          onContentSizeChange={scrollToBottom}
        />
      )}

      {/* Suggestion chips — shown when conversation has messages */}
      {messages.length > 0 && !isTyping ? (
        <View style={styles.chipsBar}>
          <AISuggestionChips
            chips={SUGGESTION_CHIPS.slice(0, 5)}
            onSelect={handleSuggestion}
          />
        </View>
      ) : null}

      {/* Input bar */}
      <AIInputBar
        value={inputText}
        onChangeText={setInputText}
        onSend={handleSend}
        disabled={isTyping}
        placeholder={isTyping ? 'Zuru AI is thinking…' : 'Ask Zuru AI anything…'}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AI_COLORS.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: AI_COLORS.border,
    gap: 10,
    ...AI_SHADOW.subtle,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: AI_COLORS.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AI_COLORS.border,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  logoMini: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: AI_COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMiniEmoji: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.textPrimary,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: AI_COLORS.success,
  },
  onlineText: {
    fontSize: 11,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textTertiary,
  },
  moreBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Messages
  emptyContainer: {
    flex: 1,
  },
  messagesList: {
    paddingTop: 16,
    paddingBottom: 8,
  },

  // Chips bar
  chipsBar: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: AI_COLORS.border,
  },
});
