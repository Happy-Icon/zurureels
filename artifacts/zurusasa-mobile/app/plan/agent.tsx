import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { zuruAIService } from '@/services/zuruAIService';
import { zuruPlanService } from '@/services/zuruPlanService';
import { distillCardsForHistory } from '@/services/aiConversationService';
import {
  DESTINATIONS,
  type BudgetTier,
  type CoastalDestinationId,
  type DestinationId,
  type ExperienceRow,
  type InterestTag,
  type TripPlan,
  type TripPreferences,
} from '@/types/zuruPlan';

import {
  type ExtractedTripConstraints,
  parseConstraintsFromConversation,
} from '@/services/zuruPlanService';

export {
  type ExtractedTripConstraints,
  parseConstraintsFromConversation,
};

interface AgentChatMessage {
  id: string;
  sender: 'agent' | 'user';
  text: string;
  timestamp: string;
  suggestedExperiences?: ExperienceRow[];
}

const QUICK_PROMPTS = [
  '3 days in Diani Beach with water sports',
  'Weekend cultural escape to Lamu Island',
  'Relaxed 4-day stay in Kilifi Creek for a couple',
  'Family holiday in Watamu with marine park',
];

export default function ConversationalPlanAgentScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [aiStatusText, setAiStatusText] = useState('');
  const [dynamicPrompts, setDynamicPrompts] = useState<string[]>(QUICK_PROMPTS);
  const [constraints, setConstraints] = useState<ExtractedTripConstraints>({
    destinationId: 'diani',
    destinationName: 'Diani Beach',
    durationDays: 3,
    adultsCount: 2,
    childrenCount: 0,
    budgetTier: 'comfort',
    dietaryRestrictions: [],
    pace: 'moderate',
    interests: ['beaches', 'dhow_cruises', 'seafood_dining'],
    exclusions: [],
  });
  const [extractedGuestCount, setExtractedGuestCount] = useState<number>(2);
  const [extractedDuration, setExtractedDuration] = useState<number>(3);
  const [messages, setMessages] = useState<AgentChatMessage[]>([
    {
      id: 'welcome_1',
      sender: 'agent',
      text: "Jambo! I'm Zuru Agent, your personal coastal Kenya itinerary planner. Tell me where you'd like to go, who is travelling, or pick a vibe below to get started.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [currentDestination, setCurrentDestination] = useState<CoastalDestinationId>('diani');
  const [candidateExperiences, setCandidateExperiences] = useState<ExperienceRow[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const deltaBufferRef = useRef<string>('');
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushDeltaBuffer = (msgId: string) => {
    if (!deltaBufferRef.current) return;
    const incoming = deltaBufferRef.current;
    deltaBufferRef.current = '';
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, text: m.text + incoming } : m))
    );
    flatListRef.current?.scrollToEnd({ animated: false });
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
    deltaBufferRef.current = '';
    setIsThinking(false);
    setAiStatusText('');
  };

  // Load candidate experiences on mount
  useEffect(() => {
    (async () => {
      const candidates = await zuruPlanService.fetchCandidateExperiences('Diani Beach');
      setCandidateExperiences(candidates.slice(0, 3));
    })();
  }, []);

  const handleSendPrompt = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isThinking) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const userMsg: AgentChatMessage = {
      id: `msg_u_${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const agentMsgId = `msg_a_${Date.now()}`;
    const initialAgentMsg: AgentChatMessage = {
      id: agentMsgId,
      sender: 'agent',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg, initialAgentMsg]);
    setInput('');
    setIsThinking(true);
    setAiStatusText('Understanding your travel request…');

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const history = messages
      .filter((m) => m.id !== 'welcome_1' && m.text.length > 0)
      .slice(-12)
      .map((m) => {
        let content = m.text;
        if (m.sender === 'agent' && m.suggestedExperiences && m.suggestedExperiences.length > 0) {
          content += distillCardsForHistory(m.suggestedExperiences);
        }
        return {
          role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
          content,
        };
      });

    try {
      const response = await zuruAIService.discover(trimmed, {
        history,
        stream: true,
        signal: controller.signal,
        onStatusChange: (status) => {
          setAiStatusText(status.text);
        },
        onTextDelta: (delta) => {
          deltaBufferRef.current += delta;
          if (!throttleTimerRef.current) {
            throttleTimerRef.current = setTimeout(() => {
              throttleTimerRef.current = null;
              flushDeltaBuffer(agentMsgId);
            }, 50);
          }
        },
      });

      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      flushDeltaBuffer(agentMsgId);

      // Extract comprehensive constraints from conversational dialogue and AI criteria (REM-03)
      const nextConstraints = parseConstraintsFromConversation(trimmed, constraints, response.criteria);
      setConstraints(nextConstraints);
      setCurrentDestination(nextConstraints.destinationId as CoastalDestinationId);
      setExtractedGuestCount(nextConstraints.adultsCount + nextConstraints.childrenCount);
      setExtractedDuration(nextConstraints.durationDays);

      const destName = nextConstraints.destinationName;

      // Convert AI listing cards to real ExperienceRow objects
      const realCards: ExperienceRow[] = (response.cards || [])
        .map((c) => {
          if (c.experience) {
            return {
              ...c.experience,
              image_url: c.imageUrl || c.thumbnailUrl || c.experience.image_url,
            };
          }
          return {
            id: c.experienceId || c.id,
            title: c.title,
            location: c.location || destName,
            category: c.category || 'stay',
            current_price: c.price ?? 0,
            image_url: c.imageUrl || c.thumbnailUrl || null,
            availability_status: 'available',
          } as ExperienceRow;
        })
        .filter(Boolean);

      // If AI didn't return cards directly, fetch real candidate experiences for the active destination
      const finalExperiences =
        realCards.length > 0
          ? realCards.slice(0, 4)
          : (await zuruPlanService.fetchCandidateExperiences(destName)).slice(0, 4);

      setCandidateExperiences(finalExperiences);

      if (response.followUps && response.followUps.length > 0) {
        setDynamicPrompts(response.followUps);
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? {
                ...m,
                text:
                  m.text ||
                  response.text ||
                  `Here are verified authentic experiences in ${destName} for your trip:`,
                suggestedExperiences: finalExperiences,
              }
            : m
        )
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError' || controller.signal.aborted;
      if (isAbort) {
        return;
      }
      console.warn('AI discover error, using live candidate experiences fallback:', err);
      // REM-10: Fall back to active destination instead of hardcoded Diani Beach
      const activeDest = constraints.destinationName;
      const fallbackExps = await zuruPlanService.fetchCandidateExperiences(activeDest);
      setCandidateExperiences(fallbackExps.slice(0, 3));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? {
                ...m,
                text:
                  m.text ||
                  `I've searched our real verified database in ${activeDest} for you! Here are authentic stays and excursions:`,
                suggestedExperiences: fallbackExps.slice(0, 3),
              }
            : m
        )
      );
    } finally {
      setIsThinking(false);
      setAiStatusText('');
      abortControllerRef.current = null;
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleBuildFullItinerary = async () => {
    setIsThinking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      // Conversational constraint preservation (REM-03)
      const prefs: TripPreferences = {
        destinationId: constraints.destinationId,
        destinationName: constraints.destinationName,
        durationDays: constraints.durationDays,
        adultsCount: constraints.adultsCount,
        childrenCount: constraints.childrenCount,
        budgetTier: constraints.budgetTier,
        budgetMaxKes: constraints.budgetMaxKes,
        dietaryRestrictions: constraints.dietaryRestrictions,
        pace: constraints.pace,
        interests:
          constraints.interests.length > 0
            ? constraints.interests
            : ['beaches', 'dhow_cruises', 'seafood_dining'],
        exclusions: constraints.exclusions,
        startDate: constraints.startDate,
        endDate: constraints.endDate,
      };

      const trip = await zuruPlanService.generateItineraryFromPreferences(prefs);
      await zuruPlanService.saveTrip(user?.id, trip);

      router.replace({
        pathname: '/plan/[id]',
        params: { id: trip.id },
      } as any);
    } catch (e) {
      console.warn('Agent itinerary creation failed:', e);
      setIsThinking(false);
    }
  };

  const topInset = Platform.OS === 'web' ? 20 : insets.top + 10;
  const bottomInset = Platform.OS === 'web' ? 20 : insets.bottom + 10;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={[styles.navHeader, { paddingTop: topInset, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.circleBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>

        <View style={styles.headerTitleBox}>
          <View style={styles.agentAvatarBox}>
            <MaterialCommunityIcons name="robot" size={18} color="#FFFFFF" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Zuru Agent</Text>
            <Text style={[styles.headerSubtitle, { color: '#10B981' }]}>● Online Coastal Concierge</Text>
          </View>
        </View>

        <View style={{ width: 38 }} />
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isUser = item.sender === 'user';
          return (
            <View style={[styles.messageBubbleWrap, isUser && styles.messageBubbleWrapUser]}>
              <View
                style={[
                  styles.messageBubble,
                  {
                    backgroundColor: isUser
                      ? '#F26522'
                      : isDark
                      ? '#27272A'
                      : '#F3F4F6',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    { color: isUser ? '#FFFFFF' : colors.text },
                  ]}
                >
                  {item.text}
                </Text>
                <Text
                  style={[
                    styles.timestampText,
                    { color: isUser ? 'rgba(255,255,255,0.7)' : colors.mutedForeground },
                  ]}
                >
                  {item.timestamp}
                </Text>
              </View>

              {/* Inline Real Listing Cards */}
              {item.suggestedExperiences && item.suggestedExperiences.length > 0 && (
                <View style={styles.cardsRow}>
                  {item.suggestedExperiences.map((exp: ExperienceRow) => (
                    <View
                      key={exp.id}
                      style={[
                        styles.inlineCard,
                        { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                    >
                      {exp.image_url ? (
                        <Image source={{ uri: exp.image_url }} style={styles.inlineCardImage} contentFit="cover" />
                      ) : null}
                      <View style={styles.inlineCardBody}>
                        <Text style={[styles.inlineCardTitle, { color: colors.text }]} numberOfLines={1}>
                          {exp.title}
                        </Text>
                        <Text style={[styles.inlineCardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                          {exp.location || 'Kenyan Coast'}
                        </Text>
                        {exp.current_price != null ? (
                          <Text style={styles.inlineCardPrice}>
                            KSh {Number(exp.current_price).toLocaleString()}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          isThinking ? (
            <View style={styles.thinkingRow}>
              <ActivityIndicator size="small" color="#F26522" />
              <Text style={[styles.thinkingText, { color: colors.mutedForeground }]}>
                {aiStatusText || 'Zuru Agent is querying coastal experiences...'}
              </Text>
            </View>
          ) : null
        }
      />

      {/* Suggested Quick Prompts */}
      {messages.length < 6 && (
        <View style={styles.promptsContainer}>
          <Text style={[styles.promptsTitle, { color: colors.mutedForeground }]}>
            {dynamicPrompts !== QUICK_PROMPTS ? 'Suggested Next Steps:' : 'Try asking:'}
          </Text>
          <View style={styles.promptsGrid}>
            {dynamicPrompts.map((prompt) => (
              <Pressable
                key={prompt}
                onPress={() => handleSendPrompt(prompt)}
                style={[
                  styles.promptChip,
                  { backgroundColor: isDark ? '#27272A' : '#F9FAFB', borderColor: colors.border },
                ]}
                accessibilityRole="button"
                accessibilityLabel={prompt}
              >
                <Text style={[styles.promptText, { color: colors.text }]}>{prompt}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Generate Full Itinerary Sticky Action */}
      {candidateExperiences.length > 0 && (
        <View style={[styles.ctaBanner, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Pressable
            testID="agent-build-itinerary-btn"
            onPress={handleBuildFullItinerary}
            style={styles.ctaButton}
            accessibilityRole="button"
            accessibilityLabel="Generate full editable itinerary from this conversation"
          >
            <Ionicons name="sparkles" size={16} color="#FFFFFF" />
            <Text style={styles.ctaButtonText}>Generate Full Itinerary</Text>
            <Feather name="arrow-right" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      {/* Input Dock */}
      <View style={[styles.inputDock, { paddingBottom: bottomInset, borderTopColor: colors.border }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask Zuru Agent (e.g. 4 days in Kilifi with a boat trip)..."
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.textInput,
            {
              backgroundColor: isDark ? '#27272A' : '#F3F4F6',
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          onSubmitEditing={() => handleSendPrompt(input)}
          returnKeyType="send"
        />
        {isThinking ? (
          <Pressable
            onPress={handleStopGeneration}
            style={[styles.sendBtn, { backgroundColor: '#EF4444' }]}
            accessibilityRole="button"
            accessibilityLabel="Stop generation"
          >
            <Feather name="square" size={16} color="#FFFFFF" />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => handleSendPrompt(input)}
            disabled={!input.trim()}
            style={[styles.sendBtn, !input.trim() && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Feather name="arrow-up" size={20} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  agentAvatarBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  headerSubtitle: {
    fontSize: 11,
    fontFamily: 'DMSans_500Medium',
  },

  /* Messages */
  messageBubbleWrap: {
    alignItems: 'flex-start',
    gap: 10,
    maxWidth: '85%',
  },
  messageBubbleWrapUser: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  messageText: {
    fontSize: 14.5,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 20,
  },
  timestampText: {
    fontSize: 10.5,
    fontFamily: 'DMSans_400Regular',
    alignSelf: 'flex-end',
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  thinkingText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
  },

  /* Inline Listing Cards */
  cardsRow: {
    gap: 8,
    width: '100%',
  },
  inlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    paddingRight: 12,
  },
  inlineCardImage: {
    width: 65,
    height: 65,
  },
  inlineCardBody: {
    flex: 1,
    paddingLeft: 10,
    gap: 2,
  },
  inlineCardTitle: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
  },
  inlineCardSub: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
  },
  inlineCardPrice: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },

  /* Prompts */
  promptsContainer: {
    paddingHorizontal: 18,
    paddingBottom: 10,
    gap: 8,
  },
  promptsTitle: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    letterSpacing: 0.3,
  },
  promptsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  promptText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_500Medium',
  },

  /* CTA Banner */
  ctaBanner: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F26522',
    height: 44,
    borderRadius: 12,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },

  /* Input Dock */
  inputDock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 10,
  },
  textInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    borderWidth: 1,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
