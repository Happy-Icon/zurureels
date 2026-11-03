import React from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { useColors } from '@/hooks/useColors';
import type { CreateReelFormState } from '@/hooks/useCreateReelForm';
import { CANCELLATION_POLICIES } from './createReelConstants';
import { createReelStyles as styles } from './createReelStyles';

export interface BookingAndRulesSectionProps {
  form: CreateReelFormState;
  colors: ReturnType<typeof useColors>;
  isDark: boolean;
}

export function BookingAndRulesSection({ form, colors, isDark }: BookingAndRulesSectionProps) {
  return (
    <>
      {/* Step 3: Capacity & Booking Settings */}
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>3. Capacity & Booking Settings</Text>

        <View style={styles.rowTwoCol}>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Max Guests</Text>
            <TextInput
              placeholder="2"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={form.maxGuests}
              onChangeText={form.setMaxGuests}
              style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
            />
          </View>

          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Min Stay (Nights)</Text>
            <TextInput
              placeholder="1"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={form.minStayNights}
              onChangeText={form.setMinStayNights}
              style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
            />
          </View>
        </View>

        <View style={styles.rowTwoCol}>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Check-in Time</Text>
            <TextInput
              placeholder="14:00"
              placeholderTextColor={colors.mutedForeground}
              value={form.checkInTime}
              onChangeText={form.setCheckInTime}
              style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
            />
          </View>

          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Check-out Time</Text>
            <TextInput
              placeholder="10:00"
              placeholderTextColor={colors.mutedForeground}
              value={form.checkOutTime}
              onChangeText={form.setCheckOutTime}
              style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
            />
          </View>
        </View>

        {/* Booking Mode */}
        <View style={styles.formGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Booking Mode</Text>
          <View style={styles.segmentContainer}>
            <Pressable
              onPress={() => form.setBookingMode('approval_required')}
              style={[
                styles.segmentBtn,
                { backgroundColor: form.bookingMode === 'approval_required' ? '#F26522' : isDark ? '#27272A' : '#F3F4F6' },
              ]}
            >
              <Feather
                name="user-check"
                size={14}
                color={form.bookingMode === 'approval_required' ? '#FFFFFF' : colors.text}
              />
              <Text
                style={[
                  styles.segmentBtnText,
                  { color: form.bookingMode === 'approval_required' ? '#FFFFFF' : colors.text },
                ]}
              >
                Host Approval Required
              </Text>
            </Pressable>

            <Pressable
              onPress={() => form.setBookingMode('instant')}
              style={[
                styles.segmentBtn,
                { backgroundColor: form.bookingMode === 'instant' ? '#F26522' : isDark ? '#27272A' : '#F3F4F6' },
              ]}
            >
              <Feather
                name="zap"
                size={14}
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

        {/* Cancellation Policy */}
        <View style={styles.formGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Cancellation Policy</Text>
          <View style={{ gap: 8 }}>
            {CANCELLATION_POLICIES.map((cp) => {
              const sel = form.cancellationPolicy === cp.id;
              return (
                <Pressable
                  key={cp.id}
                  onPress={() => form.setCancellationPolicy(cp.id)}
                  style={[
                    styles.policyCard,
                    {
                      backgroundColor: sel ? (isDark ? '#3B2314' : '#FFF8F5') : (isDark ? '#27272A' : '#F9FAFB'),
                      borderColor: sel ? '#F26522' : colors.border,
                    },
                  ]}
                >
                  <View style={styles.policyCardHeader}>
                    <Text style={[styles.policyCardTitle, { color: sel ? '#F26522' : colors.text }]}>
                      {cp.title}
                    </Text>
                    <View style={[styles.radioCircle, sel && styles.radioCircleActive]}>
                      {sel ? <View style={styles.radioDot} /> : null}
                    </View>
                  </View>
                  <Text style={[styles.policyCardDesc, { color: colors.mutedForeground }]}>{cp.desc}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Step 4: Structured House Rules */}
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>4. House Rules</Text>

        <View style={[styles.rulesListCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.ruleToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.ruleToggleTitle, { color: colors.text }]}>Smoking Allowed</Text>
              <Text style={[styles.ruleToggleSub, { color: colors.mutedForeground }]}>Allow smoking inside the property</Text>
            </View>
            <Switch
              value={form.smokingAllowed}
              onValueChange={form.setSmokingAllowed}
              trackColor={{ false: '#767577', true: '#F26522' }}
            />
          </View>

          <View style={[styles.ruleDivider, { backgroundColor: colors.border }]} />

          <View style={styles.ruleToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.ruleToggleTitle, { color: colors.text }]}>Pets Allowed</Text>
              <Text style={[styles.ruleToggleSub, { color: colors.mutedForeground }]}>Welcome guests with pets</Text>
            </View>
            <Switch
              value={form.petsAllowed}
              onValueChange={form.setPetsAllowed}
              trackColor={{ false: '#767577', true: '#F26522' }}
            />
          </View>

          <View style={[styles.ruleDivider, { backgroundColor: colors.border }]} />

          <View style={styles.ruleToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.ruleToggleTitle, { color: colors.text }]}>Parties & Events</Text>
              <Text style={[styles.ruleToggleSub, { color: colors.mutedForeground }]}>Allow gatherings or celebrations</Text>
            </View>
            <Switch
              value={form.partiesAllowed}
              onValueChange={form.setPartiesAllowed}
              trackColor={{ false: '#767577', true: '#F26522' }}
            />
          </View>

          <View style={[styles.ruleDivider, { backgroundColor: colors.border }]} />

          <View style={styles.ruleToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.ruleToggleTitle, { color: colors.text }]}>Children & Infants</Text>
              <Text style={[styles.ruleToggleSub, { color: colors.mutedForeground }]}>Property suitable for kids</Text>
            </View>
            <Switch
              value={form.childrenAllowed}
              onValueChange={form.setChildrenAllowed}
              trackColor={{ false: '#767577', true: '#F26522' }}
            />
          </View>

          <View style={[styles.ruleDivider, { backgroundColor: colors.border }]} />

          <View style={styles.ruleToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.ruleToggleTitle, { color: colors.text }]}>Additional Unregistered Guests</Text>
              <Text style={[styles.ruleToggleSub, { color: colors.mutedForeground }]}>Allow non-registered visitors</Text>
            </View>
            <Switch
              value={form.additionalGuestsAllowed}
              onValueChange={form.setAdditionalGuestsAllowed}
              trackColor={{ false: '#767577', true: '#F26522' }}
            />
          </View>
        </View>

        {/* Quiet Hours Row */}
        <View style={styles.rowTwoCol}>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Quiet Hours Start</Text>
            <TextInput
              placeholder="22:00"
              placeholderTextColor={colors.mutedForeground}
              value={form.quietHoursStart}
              onChangeText={form.setQuietHoursStart}
              style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
            />
          </View>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Quiet Hours End</Text>
            <TextInput
              placeholder="07:00"
              placeholderTextColor={colors.mutedForeground}
              value={form.quietHoursEnd}
              onChangeText={form.setQuietHoursEnd}
              style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Custom House Rules (Optional)</Text>
          <TextInput
            placeholder="e.g. Please remove shoes at the door, no swimming after 10 PM..."
            placeholderTextColor={colors.mutedForeground}
            value={form.customRules}
            onChangeText={form.setCustomRules}
            style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
          />
        </View>
      </View>
    </>
  );
}
