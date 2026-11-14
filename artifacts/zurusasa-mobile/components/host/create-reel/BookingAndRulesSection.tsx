import React from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { useColors } from '@/hooks/useColors';
import type { CreateReelFormState } from '@/hooks/useCreateReelForm';
import { CANCELLATION_POLICIES } from './createReelConstants';
import { createReelStyles as styles } from './createReelStyles';

export interface BookingAndRulesSectionProps {
  form: CreateReelFormState;
  colors: ReturnType<typeof useColors>;
  isDark: boolean;
}

interface BookingPolicyFieldsProps {
  form: CreateReelFormState;
  colors: ReturnType<typeof useColors>;
  isDark: boolean;
  approvalLabel?: string;
}

function BookingPolicyFields({
  form,
  colors,
  isDark,
  approvalLabel = 'Host Approval Required',
}: BookingPolicyFieldsProps) {
  const activePolicy =
    CANCELLATION_POLICIES.find((cp) => cp.id === form.cancellationPolicy) ??
    CANCELLATION_POLICIES[0];

  return (
    <>
      {/* Booking Mode */}
      <View style={styles.formGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Booking Mode</Text>
        <View style={styles.segmentContainer}>
          <Pressable
            onPress={() => form.setBookingMode('approval_required')}
            style={[
              styles.segmentBtn,
              {
                backgroundColor:
                  form.bookingMode === 'approval_required'
                    ? '#F26522'
                    : isDark
                    ? '#27272A'
                    : '#F3F4F6',
              },
            ]}
          >
            <Ionicons
              name="person-outline"
              size={15}
              color={form.bookingMode === 'approval_required' ? '#FFFFFF' : colors.text}
            />
            <Text
              style={[
                styles.segmentBtnText,
                { color: form.bookingMode === 'approval_required' ? '#FFFFFF' : colors.text },
              ]}
            >
              {approvalLabel}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => form.setBookingMode('instant')}
            style={[
              styles.segmentBtn,
              {
                backgroundColor:
                  form.bookingMode === 'instant'
                    ? '#F26522'
                    : isDark
                    ? '#27272A'
                    : '#F3F4F6',
              },
            ]}
          >
            <Ionicons
              name="flash-outline"
              size={15}
              color={form.bookingMode === 'instant' ? '#FFFFFF' : colors.text}
            />
            <Text
              style={[
                styles.segmentBtnText,
                { color: form.bookingMode === 'instant' ? '#FFFFFF' : colors.text },
              ]}
            >
              Instant Booking
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Compact Horizontal Cancellation Policy Pills + Single Summary Line */}
      <View style={styles.formGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Cancellation Policy</Text>
        <View style={styles.policyPillRow}>
          {CANCELLATION_POLICIES.map((cp) => {
            const sel = form.cancellationPolicy === cp.id;
            return (
              <Pressable
                key={cp.id}
                onPress={() => form.setCancellationPolicy(cp.id)}
                style={[
                  styles.policyPill,
                  {
                    backgroundColor: sel
                      ? isDark
                        ? '#3B2314'
                        : '#FFF8F5'
                      : isDark
                      ? '#27272A'
                      : '#F7F7F7',
                    borderColor: sel ? '#F26522' : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.policyPillText,
                    { color: sel ? '#F26522' : colors.text },
                  ]}
                >
                  {cp.title}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            styles.policyDescCallout,
            {
              backgroundColor: isDark ? '#27272A' : '#F9FAFB',
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="information-circle-outline" size={16} color="#F26522" />
          <Text style={[styles.policyCardDesc, { color: colors.mutedForeground, flex: 1 }]}>
            {activePolicy.desc}
          </Text>
        </View>
      </View>
    </>
  );
}

export function BookingAndRulesSection({ form, colors, isDark }: BookingAndRulesSectionProps) {
  if (form.isAttachingToExistingExp || !form.isLastStep) {
    return null;
  }

  const inputStyle = [
    styles.textInput,
    { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text },
  ];

  // =========================================================================
  // 1. EVENT FINAL STEP: Entry Rules, Capacity, Policy & Summary
  // =========================================================================
  if (form.contentType === 'event') {
    return (
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>
          Entry Rules & Booking Policy
        </Text>
        <Text style={[styles.sectionSubText, { color: colors.mutedForeground }]}>
          Finalize ticket limits, door rules, and publish directly to ZuruFlow.
        </Text>

        <View style={styles.formGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>
            Entry Conditions & Dress Code
          </Text>
          <TextInput
            placeholder="e.g. 21+ ID required · Coastal chic dress code"
            placeholderTextColor={colors.mutedForeground}
            value={form.entryConditions}
            onChangeText={form.setEntryConditions}
            style={inputStyle}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>
            Ticket & Booking Instructions
          </Text>
          <TextInput
            placeholder="e.g. Reserve directly on ZuruSasa or pay at gate before 8 PM"
            placeholderTextColor={colors.mutedForeground}
            value={form.bookingInstructions}
            onChangeText={form.setBookingInstructions}
            style={inputStyle}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>
            Max Attendees / Tickets
          </Text>
          <TextInput
            placeholder="e.g. 100"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            value={form.maxGuests}
            onChangeText={form.setMaxGuests}
            style={inputStyle}
          />
        </View>

        <BookingPolicyFields
          form={form}
          colors={colors}
          isDark={isDark}
          approvalLabel="Host Approval"
        />

        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryCardTitle, { color: colors.text }]}>
            Ready to Publish Event
          </Text>
          <View style={styles.summaryCardRow}>
            <Text style={[styles.summaryCardLabel, { color: colors.mutedForeground }]}>Title</Text>
            <Text style={[styles.summaryCardValue, { color: colors.text }]} numberOfLines={1}>
              {form.title || 'Untitled Event'}
            </Text>
          </View>
          <View style={styles.summaryCardRow}>
            <Text style={[styles.summaryCardLabel, { color: colors.mutedForeground }]}>Schedule</Text>
            <Text style={[styles.summaryCardValue, { color: colors.text }]}>
              {form.eventDate} · {form.eventStartTime}–{form.eventEndTime}
            </Text>
          </View>
          <View style={styles.summaryCardRow}>
            <Text style={[styles.summaryCardLabel, { color: colors.mutedForeground }]}>Location</Text>
            <Text style={[styles.summaryCardValue, { color: colors.text }]}>
              {form.pinnedLocation?.city || form.location}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // =========================================================================
  // 2. SPECIAL OFFER FINAL STEP: Redemption, Terms, Policy & Summary
  // =========================================================================
  if (form.contentType === 'special_offer') {
    return (
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>
          Redemption & Booking Policy
        </Text>
        <Text style={[styles.sectionSubText, { color: colors.mutedForeground }]}>
          Share how guests claim this offer and confirm when it expires.
        </Text>

        <View style={styles.formGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>
            Redemption Instructions
          </Text>
          <TextInput
            placeholder="e.g. Show this offer in ZuruSasa upon arrival or book ahead"
            placeholderTextColor={colors.mutedForeground}
            value={form.redemptionInstructions}
            onChangeText={form.setRedemptionInstructions}
            style={inputStyle}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Terms & Conditions</Text>
          <TextInput
            placeholder="e.g. Valid on selected cocktails; cannot be combined with other deals"
            placeholderTextColor={colors.mutedForeground}
            value={form.termsConditions}
            onChangeText={form.setTermsConditions}
            style={inputStyle}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>
            Max Guests / Redemptions
          </Text>
          <TextInput
            placeholder="e.g. 20"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            value={form.maxGuests}
            onChangeText={form.setMaxGuests}
            style={inputStyle}
          />
        </View>

        <BookingPolicyFields
          form={form}
          colors={colors}
          isDark={isDark}
          approvalLabel="Confirm Request"
        />

        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryCardTitle, { color: colors.text }]}>
            Ready to Publish Offer
          </Text>
          <View style={styles.summaryCardRow}>
            <Text style={[styles.summaryCardLabel, { color: colors.mutedForeground }]}>Offer</Text>
            <Text style={[styles.summaryCardValue, { color: colors.text }]} numberOfLines={1}>
              {form.title || 'Special Offer'}
            </Text>
          </View>
          <View style={styles.summaryCardRow}>
            <Text style={[styles.summaryCardLabel, { color: colors.mutedForeground }]}>Badge</Text>
            <Text style={[styles.summaryCardValue, { color: '#F26522' }]}>
              {form.discountLabel || 'Deal'} · Expires {form.offerExpiryDate}
            </Text>
          </View>
          <View style={styles.summaryCardRow}>
            <Text style={[styles.summaryCardLabel, { color: colors.mutedForeground }]}>Location</Text>
            <Text style={[styles.summaryCardValue, { color: colors.text }]}>
              {form.pinnedLocation?.city || form.location}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // =========================================================================
  // 3. EXPERIENCE FINAL STEP: Booking Policy & Collapsible House Rules
  // =========================================================================
  const houseRuleToggles = [
    {
      title: 'Smoking Allowed',
      sub: 'Allow smoking inside the property',
      value: form.smokingAllowed,
      onChange: form.setSmokingAllowed,
    },
    {
      title: 'Pets Allowed',
      sub: 'Welcome guests with pets',
      value: form.petsAllowed,
      onChange: form.setPetsAllowed,
    },
    {
      title: 'Parties & Events',
      sub: 'Allow gatherings or celebrations',
      value: form.partiesAllowed,
      onChange: form.setPartiesAllowed,
    },
    {
      title: 'Children & Infants',
      sub: 'Property suitable for kids',
      value: form.childrenAllowed,
      onChange: form.setChildrenAllowed,
    },
    {
      title: 'Additional Unregistered Guests',
      sub: 'Allow non-registered visitors',
      value: form.additionalGuestsAllowed,
      onChange: form.setAdditionalGuestsAllowed,
    },
  ] as const;

  const isStay = form.category === 'accommodation';
  const rulesSummary = `${form.childrenAllowed ? 'Family friendly' : 'Adults only'} · ${
    form.petsAllowed ? 'Pets OK' : 'No pets'
  } · Quiet ${form.quietHoursStart}–${form.quietHoursEnd}`;

  return (
    <View style={styles.sectionBlock}>
      <Text style={[styles.sectionHeading, { color: colors.text }]}>
        Policies, Highlights & Extras
      </Text>
      <Text style={[styles.sectionSubText, { color: colors.mutedForeground }]}>
        Set reservation confirmation rules and customize guest details below.
      </Text>

      <BookingPolicyFields form={form} colors={colors} isDark={isDark} />

      {isStay ? (
        <View style={[styles.accordionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable
            onPress={() => form.setShowHouseRules(!form.showHouseRules)}
            style={({ pressed }) => [styles.accordionHeader, { opacity: pressed ? 0.85 : 1 }]}
          >
            <View
              style={[
                styles.accordionIconBox,
                { backgroundColor: isDark ? '#27272A' : '#FFF8F5' },
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color="#F26522" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.accordionTitle, { color: colors.text }]}>
                House Rules (Optional)
              </Text>
              <Text style={[styles.accordionSummary, { color: colors.mutedForeground }]} numberOfLines={1}>
                {rulesSummary}
              </Text>
            </View>
            <Ionicons
              name={form.showHouseRules ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.mutedForeground}
            />
          </Pressable>

          {form.showHouseRules ? (
            <View style={[styles.accordionBody, { borderTopColor: colors.border }]}>
              <View style={[styles.rulesListCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                {houseRuleToggles.map((rule, idx) => (
                  <React.Fragment key={rule.title}>
                    {idx > 0 ? <View style={[styles.ruleDivider, { backgroundColor: colors.border }]} /> : null}
                    <View style={styles.ruleToggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.ruleToggleTitle, { color: colors.text }]}>{rule.title}</Text>
                        <Text style={[styles.ruleToggleSub, { color: colors.mutedForeground }]}>{rule.sub}</Text>
                      </View>
                      <Switch
                        value={rule.value}
                        onValueChange={rule.onChange}
                        trackColor={{ false: '#767577', true: '#F26522' }}
                      />
                    </View>
                  </React.Fragment>
                ))}
              </View>

              <View style={styles.rowTwoCol}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Quiet Hours Start</Text>
                  <TextInput
                    placeholder="22:00"
                    placeholderTextColor={colors.mutedForeground}
                    value={form.quietHoursStart}
                    onChangeText={form.setQuietHoursStart}
                    style={inputStyle}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Quiet Hours End</Text>
                  <TextInput
                    placeholder="07:00"
                    placeholderTextColor={colors.mutedForeground}
                    value={form.quietHoursEnd}
                    onChangeText={form.setQuietHoursEnd}
                    style={inputStyle}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Custom House Rules</Text>
                <TextInput
                  placeholder="e.g. Remove shoes at the door, no pool after 10 PM..."
                  placeholderTextColor={colors.mutedForeground}
                  value={form.customRules}
                  onChangeText={form.setCustomRules}
                  style={inputStyle}
                />
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
