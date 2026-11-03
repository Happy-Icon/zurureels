import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { zuruAIService } from '@/services/zuruAIService';
import { zuruPlanService } from '@/services/zuruPlanService';
import type { ExperienceRow, ItineraryItem, TripPlan } from '@/types/zuruPlan';

export interface AgentItinerarySheetProps {
  visible: boolean;
  onClose: () => void;
  trip: TripPlan;
  onApplyItem: (dayNumber: number, newItem: ItineraryItem) => void;
}

export function AgentItinerarySheet({
  visible,
  onClose,
  trip,
  onApplyItem,
}: AgentItinerarySheetProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(1);
  const [suggestions, setSuggestions] = useState<ExperienceRow[]>([]);

  const handleSendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isThinking) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsThinking(true);
    setInput('');

    try {
      const aiResponse = await zuruAIService.discover(
        `${trimmed} in ${trip.destination}`,
        { stream: false }
      );

      const realCards: ExperienceRow[] = (aiResponse.cards || [])
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
            location: c.location || trip.destination,
            category: c.category || 'adventure',
            current_price: c.price ?? 0,
            image_url: c.imageUrl || c.thumbnailUrl || null,
            availability_status: 'available',
          } as ExperienceRow;
        })
        .filter(Boolean);

      if (realCards.length > 0) {
        setSuggestions(realCards.slice(0, 4));
      } else {
        const candidates = await zuruPlanService.fetchCandidateExperiences(trip.destination);
        setSuggestions(candidates.slice(0, 4));
      }
    } catch {
      const candidates = await zuruPlanService.fetchCandidateExperiences(trip.destination);
      setSuggestions(candidates.slice(0, 4));
    } finally {
      setIsThinking(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  const handleApplyExperience = (exp: ExperienceRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const newItem: ItineraryItem = {
      id: `act-${exp.id}-agent-${Date.now()}`,
      timeSlot: 'afternoon',
      timeLabel: '02:30 PM',
      title: exp.title || 'Coastal Experience',
      description: exp.description || `Special experience added via Zuru Agent in ${trip.destination}.`,
      location: exp.location || undefined,
      type: 'activity',
      experienceId: exp.id,
      experienceTitle: exp.title,
      experienceImageUrl: exp.image_url,
      rating: 4.9,
      estimatedPriceKes: Number(exp.current_price || 0),
      isBookable: true,
    };

    onApplyItem(selectedDayNumber, newItem);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <Pressable
          style={styles.sheetBackdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close agent drawer"
        />

        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.card,
              paddingBottom: Math.max(20, insets.bottom + 12),
            },
          ]}
        >
          {/* Handle */}
          <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.agentTitleBox}>
              <View style={styles.robotBadge}>
                <MaterialCommunityIcons name="robot" size={16} color="#FFFFFF" />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Zuru Agent Assistant</Text>
                <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
                  Modifying {trip.destination} Itinerary
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, gap: 14 }}>
            {/* Target Day Picker */}
            <View style={styles.dayPickerBox}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                TARGET DAY TO MODIFY:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {trip.days.map((d) => {
                  const isSelected = selectedDayNumber === d.dayNumber;
                  return (
                    <Pressable
                      key={d.dayNumber}
                      onPress={() => setSelectedDayNumber(d.dayNumber)}
                      style={[
                        styles.dayPill,
                        {
                          backgroundColor: isSelected ? '#F26522' : isDark ? '#27272A' : '#F3F4F6',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayPillText,
                          { color: isSelected ? '#FFFFFF' : colors.text },
                        ]}
                      >
                        Day {d.dayNumber}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Quick Suggestions */}
            <View style={{ gap: 8 }}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                RECOMMENDED REQUESTS:
              </Text>
              <View style={styles.chipsRow}>
                {[
                  'Find top seafood dinner',
                  'Add a sunset dhow sail',
                  'Suggest watersports',
                  'Find relaxing beach club',
                ].map((prompt) => (
                  <Pressable
                    key={prompt}
                    onPress={() => handleSendPrompt(prompt)}
                    style={[
                      styles.suggestionChip,
                      { backgroundColor: isDark ? '#27272A' : '#F9FAFB', borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.suggestionChipText, { color: colors.text }]}>{prompt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Thinking Spinner */}
            {isThinking && (
              <View style={styles.thinkingBox}>
                <ActivityIndicator size="small" color="#F26522" />
                <Text style={[styles.thinkingText, { color: colors.mutedForeground }]}>
                  Finding verified experiences in {trip.destination}...
                </Text>
              </View>
            )}

            {/* Suggestion Cards */}
            {suggestions.length > 0 && (
              <View style={{ gap: 10, marginTop: 4 }}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  TAP TO ADD TO DAY {selectedDayNumber}:
                </Text>
                {suggestions.map((exp) => (
                  <View
                    key={exp.id}
                    style={[
                      styles.suggestionCard,
                      { backgroundColor: isDark ? '#1C1917' : '#FAFAFA', borderColor: colors.border },
                    ]}
                  >
                    {exp.image_url ? (
                      <Image source={{ uri: exp.image_url }} style={styles.sugImage} contentFit="cover" />
                    ) : null}
                    <View style={styles.sugBody}>
                      <Text style={[styles.sugTitle, { color: colors.text }]} numberOfLines={1}>
                        {exp.title}
                      </Text>
                      <Text style={[styles.sugPrice, { color: '#F26522' }]}>
                        KSh {Number(exp.current_price ?? 3500).toLocaleString()}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleApplyExperience(exp)}
                      style={styles.applyBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Apply ${exp.title} to Day ${selectedDayNumber}`}
                    >
                      <Text style={styles.applyBtnText}>Apply</Text>
                      <Feather name="plus" size={13} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Input Bar */}
          <View style={[styles.dockBar, { borderTopColor: colors.border }]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask Agent to change an activity or add a meal..."
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
            <Pressable
              onPress={() => handleSendPrompt(input)}
              disabled={!input.trim()}
              style={[styles.sendBtn, !input.trim() && { opacity: 0.5 }]}
            >
              <Feather name="arrow-up" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheetContainer: {
    height: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  agentTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  robotBadge: {
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
  headerSub: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  closeBtn: {
    padding: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.5,
  },
  dayPickerBox: {
    gap: 8,
  },
  dayPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  dayPillText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  suggestionChipText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_500Medium',
  },
  thinkingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  thinkingText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    gap: 10,
  },
  sugImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
  },
  sugBody: {
    flex: 1,
    gap: 2,
  },
  sugTitle: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
  },
  sugPrice: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F26522',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  dockBar: {
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
    fontSize: 13.5,
    fontFamily: 'DMSans_400Regular',
    borderWidth: 1,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
