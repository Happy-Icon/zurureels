import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { zuruPlanService } from '@/services/zuruPlanService';
import {
  BUDGET_TIERS,
  COASTAL_DESTINATIONS,
  INTEREST_OPTIONS,
  type AccommodationType,
  type BudgetTier,
  type CoastalDestinationId,
  type InterestTag,
  type TripPreferences,
} from '@/types/zuruPlan';

const { width } = Dimensions.get('window');

const ACCOMMODATION_OPTIONS: { id: AccommodationType; label: string; icon: string }[] = [
  { id: 'villa', label: 'Private Villa', icon: 'home' },
  { id: 'resort', label: 'Beachfront Resort', icon: 'sun' },
  { id: 'boutique_hotel', label: 'Boutique Hotel', icon: 'compass' },
  { id: 'eco_cottage', label: 'Eco Cottage', icon: 'feather' },
];

export default function GuidedTripBuilderScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form State
  const [selectedDestination, setSelectedDestination] = useState<CoastalDestinationId>('diani');
  const [durationDays, setDurationDays] = useState<number>(3);
  const [adultsCount, setAdultsCount] = useState<number>(2);
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [budgetTier, setBudgetTier] = useState<BudgetTier>('comfort');
  const [accommodationType, setAccommodationType] = useState<AccommodationType>('villa');
  const [selectedInterests, setSelectedInterests] = useState<InterestTag[]>([
    'beaches',
    'dhow_cruises',
    'seafood_dining',
  ]);

  const toggleInterest = (tag: InterestTag) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (step < 4) {
      setStep((s) => s + 1);
    } else {
      handleGenerate();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((s) => s - 1);
    } else {
      router.back();
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      const destConfig = COASTAL_DESTINATIONS.find((d) => d.id === selectedDestination)!;
      const prefs: TripPreferences = {
        destinationId: selectedDestination,
        destinationName: destConfig.name,
        durationDays,
        adultsCount,
        childrenCount,
        budgetTier,
        accommodationType,
        interests: selectedInterests,
      };

      const newTrip = await zuruPlanService.generateItineraryFromPreferences(prefs);
      await zuruPlanService.saveTrip(user?.id, newTrip);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace({
        pathname: '/plan/[id]',
        params: { id: newTrip.id },
      } as any);
    } catch (e) {
      console.warn('Trip generation failed:', e);
      setIsGenerating(false);
    }
  };

  const topInset = Platform.OS === 'web' ? 20 : insets.top + 10;
  const bottomInset = Platform.OS === 'web' ? 30 : insets.bottom + 20;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Navigation */}
      <View style={[styles.navHeader, { paddingTop: topInset, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={handleBack}
          style={styles.circleBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>

        {/* Step Indicator Dots */}
        <View style={styles.stepDotsRow}>
          {[1, 2, 3, 4].map((s) => (
            <View
              key={s}
              style={[
                styles.stepDot,
                { backgroundColor: s <= step ? '#F26522' : colors.border },
                s === step && styles.stepDotActive,
              ]}
            />
          ))}
        </View>

        <Pressable
          onPress={() => router.back()}
          style={styles.circleBtn}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Feather name="x" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: bottomInset + 80,
          gap: 22,
        }}
      >
        {/* STEP 1: DESTINATION */}
        {step === 1 && (
          <View style={styles.stepBlock}>
            <Text style={[styles.stepEyebrow, { color: '#F26522' }]}>STEP 1 OF 4</Text>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Where are you headed?</Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
              Select your coastal Kenya destination to discover real villas, marine safaris, and local gems.
            </Text>

            <View style={styles.destinationsGrid}>
              {COASTAL_DESTINATIONS.map((d) => {
                const isSelected = selectedDestination === d.id;
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setSelectedDestination(d.id);
                    }}
                    style={({ pressed }) => [
                      styles.destinationCard,
                      { borderColor: isSelected ? '#F26522' : colors.border },
                      isSelected && { borderWidth: 2 },
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={d.name}
                  >
                    <Image source={{ uri: d.image }} style={styles.destinationImage} contentFit="cover" />
                    <LinearGradient
                      colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.7)']}
                      style={StyleSheet.absoluteFill}
                    />

                    <View style={styles.destinationContent}>
                      <View style={styles.regionBadge}>
                        <Text style={styles.regionBadgeText}>{d.region}</Text>
                      </View>
                      <Text style={styles.destinationName}>{d.name}</Text>
                      <Text style={styles.destinationTagline} numberOfLines={2}>
                        {d.tagline}
                      </Text>
                    </View>

                    {isSelected && (
                      <View style={styles.selectedCheckBadge}>
                        <Feather name="check" size={14} color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* STEP 2: DURATION & TRAVELLERS */}
        {step === 2 && (
          <View style={styles.stepBlock}>
            <Text style={[styles.stepEyebrow, { color: '#F26522' }]}>STEP 2 OF 4</Text>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Duration & Travellers</Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
              How many days are you escaping for, and who is joining your party?
            </Text>

            {/* Duration Stepper */}
            <View style={[styles.stepperCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View>
                <Text style={[styles.stepperLabel, { color: colors.text }]}>Trip Duration</Text>
                <Text style={[styles.stepperSub, { color: colors.mutedForeground }]}>Total days on the coast</Text>
              </View>
              <View style={styles.stepperControls}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setDurationDays((d) => Math.max(1, d - 1));
                  }}
                  style={[styles.stepperBtn, { borderColor: colors.border }]}
                >
                  <Feather name="minus" size={16} color={colors.text} />
                </Pressable>
                <Text style={[styles.stepperValue, { color: colors.text }]}>{durationDays} Days</Text>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setDurationDays((d) => Math.min(14, d + 1));
                  }}
                  style={[styles.stepperBtn, { borderColor: colors.border }]}
                >
                  <Feather name="plus" size={16} color={colors.text} />
                </Pressable>
              </View>
            </View>

            {/* Adults Stepper */}
            <View style={[styles.stepperCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View>
                <Text style={[styles.stepperLabel, { color: colors.text }]}>Adults</Text>
                <Text style={[styles.stepperSub, { color: colors.mutedForeground }]}>Ages 13 and above</Text>
              </View>
              <View style={styles.stepperControls}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setAdultsCount((a) => Math.max(1, a - 1));
                  }}
                  style={[styles.stepperBtn, { borderColor: colors.border }]}
                >
                  <Feather name="minus" size={16} color={colors.text} />
                </Pressable>
                <Text style={[styles.stepperValue, { color: colors.text }]}>{adultsCount}</Text>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setAdultsCount((a) => Math.min(12, a + 1));
                  }}
                  style={[styles.stepperBtn, { borderColor: colors.border }]}
                >
                  <Feather name="plus" size={16} color={colors.text} />
                </Pressable>
              </View>
            </View>

            {/* Children Stepper */}
            <View style={[styles.stepperCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View>
                <Text style={[styles.stepperLabel, { color: colors.text }]}>Children</Text>
                <Text style={[styles.stepperSub, { color: colors.mutedForeground }]}>Ages 2 to 12</Text>
              </View>
              <View style={styles.stepperControls}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setChildrenCount((c) => Math.max(0, c - 1));
                  }}
                  style={[styles.stepperBtn, { borderColor: colors.border }]}
                >
                  <Feather name="minus" size={16} color={colors.text} />
                </Pressable>
                <Text style={[styles.stepperValue, { color: colors.text }]}>{childrenCount}</Text>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setChildrenCount((c) => Math.min(8, c + 1));
                  }}
                  style={[styles.stepperBtn, { borderColor: colors.border }]}
                >
                  <Feather name="plus" size={16} color={colors.text} />
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* STEP 3: STYLE & BUDGET */}
        {step === 3 && (
          <View style={styles.stepBlock}>
            <Text style={[styles.stepEyebrow, { color: '#F26522' }]}>STEP 3 OF 4</Text>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Style & Budget Tier</Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
              Select your accommodation preference and daily spending range.
            </Text>

            {/* Budget Tiers */}
            <View style={{ gap: 10 }}>
              {BUDGET_TIERS.map((tier) => {
                const isSelected = budgetTier === tier.id;
                return (
                  <Pressable
                    key={tier.id}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setBudgetTier(tier.id);
                    }}
                    style={[
                      styles.tierCard,
                      { backgroundColor: colors.card, borderColor: isSelected ? '#F26522' : colors.border },
                      isSelected && { borderWidth: 2 },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <View style={styles.tierHeaderRow}>
                      <Text style={[styles.tierLabel, { color: colors.text }]}>{tier.label}</Text>
                      <Text style={[styles.tierEstimate, { color: '#F26522' }]}>{tier.perDayEstimate}</Text>
                    </View>
                    <Text style={[styles.tierDesc, { color: colors.mutedForeground }]}>{tier.description}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Accommodation Type */}
            <Text style={[styles.sectionMiniHeader, { color: colors.text, marginTop: 12 }]}>
              Preferred Stay Type
            </Text>
            <View style={styles.accommodationGrid}>
              {ACCOMMODATION_OPTIONS.map((acc) => {
                const isSelected = accommodationType === acc.id;
                return (
                  <Pressable
                    key={acc.id}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setAccommodationType(acc.id);
                    }}
                    style={[
                      styles.accommodationBtn,
                      {
                        backgroundColor: isSelected ? '#F26522' : isDark ? '#27272A' : '#F3F4F6',
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.accommodationText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                      {acc.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* STEP 4: VIBES & INTERESTS */}
        {step === 4 && (
          <View style={styles.stepBlock}>
            <Text style={[styles.stepEyebrow, { color: '#F26522' }]}>STEP 4 OF 4</Text>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Vibes & Coastal Interests</Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
              What experiences are essential to your holiday? Choose all that inspire you.
            </Text>

            <View style={styles.interestsGrid}>
              {INTEREST_OPTIONS.map((item) => {
                const isSelected = selectedInterests.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleInterest(item.id)}
                    style={[
                      styles.interestChip,
                      {
                        backgroundColor: isSelected ? (isDark ? '#3D1515' : '#FFF7ED') : colors.card,
                        borderColor: isSelected ? '#F26522' : colors.border,
                      },
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={item.label}
                  >
                    <Feather
                      name={item.icon as any}
                      size={18}
                      color={isSelected ? '#F26522' : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.interestChipText,
                        {
                          color: isSelected ? '#F26522' : colors.text,
                          fontFamily: isSelected ? 'DMSans_700Bold' : 'DMSans_500Medium',
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Sticky Action Dock */}
      <View style={[styles.bottomDock, { paddingBottom: bottomInset, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Pressable
          testID="builder-next-btn"
          onPress={handleNext}
          disabled={isGenerating}
          style={({ pressed }) => [
            styles.primaryCtaBtn,
            pressed && { opacity: 0.9 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={step === 4 ? 'Generate complete itinerary' : 'Next step'}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.primaryCtaBtnText}>
                {step === 4 ? 'Generate Itinerary' : 'Continue'}
              </Text>
              {step === 4 ? (
                <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              ) : (
                <Feather name="arrow-right" size={18} color="#FFFFFF" />
              )}
            </>
          )}
        </Pressable>
      </View>
    </View>
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
  stepDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepDotActive: {
    width: 20,
  },
  stepBlock: {
    gap: 8,
  },
  stepEyebrow: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.5,
  },
  stepTitle: {
    fontSize: 26,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.4,
  },
  stepSubtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 20,
    marginBottom: 10,
  },

  /* Destinations */
  destinationsGrid: {
    gap: 12,
  },
  destinationCard: {
    height: 125,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    justifyContent: 'flex-end',
    padding: 14,
  },
  destinationImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  destinationContent: {
    gap: 3,
  },
  regionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  regionBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontFamily: 'DMSans_600SemiBold',
  },
  destinationName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
  },
  destinationTagline: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  selectedCheckBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Steppers */
  stepperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
  },
  stepperLabel: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  stepperSub: {
    fontSize: 12.5,
    fontFamily: 'DMSans_400Regular',
    marginTop: 2,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    minWidth: 50,
    textAlign: 'center',
  },

  /* Budget Tiers */
  tierCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  tierHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierLabel: {
    fontSize: 15.5,
    fontFamily: 'DMSans_700Bold',
  },
  tierEstimate: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
  },
  tierDesc: {
    fontSize: 12.5,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 17,
  },
  sectionMiniHeader: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  accommodationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accommodationBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  accommodationText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
  },

  /* Interests */
  interestsGrid: {
    gap: 10,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  interestChipText: {
    fontSize: 15,
  },

  /* Bottom Dock */
  bottomDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  primaryCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F26522',
    height: 52,
    borderRadius: 14,
  },
  primaryCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
});
