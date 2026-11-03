import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import type { BookingRow } from '@/lib/supabase';
import { formatDay, ORANGE } from './reservationHelpers';
import { StatusPill } from './StatusPill';
import { reservationsStyles as styles } from './reservationsStyles';

export interface BookingDetailModalProps {
  booking: BookingRow;
  onClose: () => void;
  onMessageHost: () => void;
  onDirections: () => void;
  onCancelBooking?: () => void;
  onWriteReview?: () => void;
  isCancelling?: boolean;
}

export function BookingDetailModal({
  booking,
  onClose,
  onMessageHost,
  onDirections,
  onCancelBooking,
  onWriteReview,
  isCancelling,
}: BookingDetailModalProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const exp = booking.experience;
  const status = (booking.status ?? '').toLowerCase();
  const canCancel = status === 'pending' || status === 'confirmed' || status === 'paid';

  // Snapshot data with fallbacks
  const houseRules = booking.house_rules_snapshot || exp?.house_rules || (exp?.metadata as any)?.house_rules || {};
  const cancellationPolicyType = booking.cancellation_policy_snapshot?.type || exp?.cancellation_policy || (exp?.metadata as any)?.cancellation_policy || 'flexible';
  const arrival = booking.arrival_snapshot || exp?.arrival_instructions || (exp?.metadata as any)?.arrival_instructions || {};
  const checkout = booking.checkout_snapshot || exp?.checkout_instructions || (exp?.metadata as any)?.checkout_instructions || {};

  const checkOutIso = booking.check_out || new Date().toISOString();
  const checkInIso = booking.check_in || new Date().toISOString();
  const isConfirmed = status === 'confirmed' || status === 'paid' || status === 'completed';
  const isCompleted = status === 'completed' || (isConfirmed && Boolean(booking.check_out) && new Date(booking.check_out!) < new Date());

  const checkInTime = exp?.check_in_time || '14:00';
  const checkOutTime = exp?.check_out_time || '10:00';

  // Calculate nights
  const checkInDate = new Date(checkInIso);
  const checkOutDate = new Date(checkOutIso);
  const nights = Math.max(1, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close booking details modal"
        />

        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Pressable
            style={[styles.modalCloseBtn, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close details"
          >
            <Feather name="x" size={18} color={colors.text} />
          </Pressable>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 18 }}>
            {/* Header & Ref */}
            <View style={styles.modalHeader}>
              <StatusPill status={booking.status} />
              <Text style={[styles.modalRefText, { color: colors.mutedForeground }]}>
                REF: #{booking.id.slice(0, 8).toUpperCase()}
              </Text>
            </View>

            {/* Listing Title & Location */}
            <View style={{ gap: 4 }}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{exp?.title ?? 'Coastal Experience'}</Text>
              {exp?.location ? (
                <View style={styles.cardLocationRow}>
                  <Feather name="map-pin" size={13} color="#F26522" />
                  <Text style={[styles.modalLocationText, { color: colors.mutedForeground }]}>{exp.location}</Text>
                </View>
              ) : null}
            </View>

            {/* Lifecycle Timeline */}
            <View style={[styles.modalTimelineBlock, { backgroundColor: isDark ? '#27272A' : '#F9FAFB', borderColor: colors.border }]}>
              <Text style={[styles.modalTimelineHeading, { color: colors.text }]}>Reservation Timeline</Text>
              <View style={styles.modalTimelineRow}>
                {/* Step 1 */}
                <View style={styles.modalTimelineStep}>
                  <View style={[styles.stepDot, styles.stepDotActive]}>
                    <Feather name="check" size={10} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.stepLabel, { color: colors.text }]}>Booked</Text>
                </View>
                <View style={[styles.stepLine, isConfirmed && styles.stepLineActive]} />

                {/* Step 2 */}
                <View style={styles.modalTimelineStep}>
                  <View style={[styles.stepDot, isConfirmed ? styles.stepDotActive : styles.stepDotInactive]}>
                    {isConfirmed ? <Feather name="check" size={10} color="#FFFFFF" /> : <View style={styles.dotMini} />}
                  </View>
                  <Text style={[styles.stepLabel, { color: isConfirmed ? colors.text : colors.mutedForeground }]}>
                    Paid & Secure
                  </Text>
                </View>
                <View style={[styles.stepLine, (status === 'confirmed' || isCompleted) && styles.stepLineActive]} />

                {/* Step 3 */}
                <View style={styles.modalTimelineStep}>
                  <View style={[styles.stepDot, (status === 'confirmed' || isCompleted) ? styles.stepDotActive : styles.stepDotInactive]}>
                    {(status === 'confirmed' || isCompleted) ? <Feather name="check" size={10} color="#FFFFFF" /> : <View style={styles.dotMini} />}
                  </View>
                  <Text style={[styles.stepLabel, { color: (status === 'confirmed' || isCompleted) ? colors.text : colors.mutedForeground }]}>
                    Confirmed
                  </Text>
                </View>
                <View style={[styles.stepLine, isCompleted && styles.stepLineActive]} />

                {/* Step 4 */}
                <View style={styles.modalTimelineStep}>
                  <View style={[styles.stepDot, isCompleted ? styles.stepDotActive : styles.stepDotInactive]}>
                    {isCompleted ? <Feather name="star" size={10} color="#FFFFFF" /> : <View style={styles.dotMini} />}
                  </View>
                  <Text style={[styles.stepLabel, { color: isCompleted ? colors.text : colors.mutedForeground }]}>
                    Completed
                  </Text>
                </View>
              </View>
            </View>

            {/* Travel dates block */}
            <View style={[styles.modalDatesBlock, { backgroundColor: isDark ? '#27272A' : '#F9FAFB', borderColor: colors.border }]}>
              <View style={styles.modalDateCol}>
                <Text style={[styles.modalDateLabel, { color: colors.mutedForeground }]}>CHECK-IN ({checkInTime})</Text>
                <Text style={[styles.modalDateVal, { color: colors.text }]}>{formatDay(booking.check_in) || 'Set date'}</Text>
              </View>
              <Feather name="arrow-right" size={16} color={colors.mutedForeground} />
              <View style={styles.modalDateCol}>
                <Text style={[styles.modalDateLabel, { color: colors.mutedForeground }]}>CHECK-OUT ({checkOutTime})</Text>
                <Text style={[styles.modalDateVal, { color: colors.text }]}>{formatDay(booking.check_out) || 'Set date'}</Text>
              </View>
            </View>

            {/* Guest & Price info */}
            <View style={styles.modalInfoRow}>
              <View style={[styles.modalInfoBox, { backgroundColor: isDark ? '#27272A' : '#F9FAFB', borderColor: colors.border }]}>
                <Feather name="users" size={14} color={ORANGE} />
                <Text style={[styles.modalInfoBoxLabel, { color: colors.mutedForeground }]}>Guests & Stay</Text>
                <Text style={[styles.modalInfoBoxVal, { color: colors.text }]}>
                  {booking.guests ?? 1} Guests · {nights} Night{nights !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={[styles.modalInfoBox, { backgroundColor: isDark ? '#27272A' : '#F9FAFB', borderColor: colors.border }]}>
                <Feather name="credit-card" size={14} color={ORANGE} />
                <Text style={[styles.modalInfoBoxLabel, { color: colors.mutedForeground }]}>Total Paid</Text>
                <Text style={[styles.modalInfoBoxVal, { color: colors.text }]}>
                  KES {Number(booking.amount ?? 0).toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Arrival Instructions (Revealed for Confirmed Bookings) */}
            {isConfirmed ? (
              <View style={[styles.infoCardBlock, { backgroundColor: isDark ? '#1C2922' : '#ECFDF5', borderColor: isDark ? '#05966940' : '#A7F3D0' }]}>
                <View style={styles.infoCardHeader}>
                  <Feather name="key" size={16} color="#10B981" />
                  <Text style={[styles.infoCardTitle, { color: isDark ? '#6EE7B7' : '#065F46' }]}>Arrival & Access Info</Text>
                </View>

                <View style={styles.infoCardContent}>
                  <View style={styles.infoField}>
                    <Text style={[styles.infoFieldLabel, { color: isDark ? '#A7F3D0' : '#047857' }]}>CHECK-IN METHOD</Text>
                    <Text style={[styles.infoFieldValue, { color: isDark ? '#FFFFFF' : '#064E3B' }]}>
                      {arrival.check_in_method || 'Self check-in with keypad / Host greeting'}
                    </Text>
                  </View>

                  {arrival.wifi_name || arrival.wifi_password ? (
                    <View style={styles.infoField}>
                      <Text style={[styles.infoFieldLabel, { color: isDark ? '#A7F3D0' : '#047857' }]}>WI-FI CREDENTIALS</Text>
                      <Text style={[styles.infoFieldValue, { color: isDark ? '#FFFFFF' : '#064E3B' }]}>
                        SSID: {arrival.wifi_name || 'Coastal-Villa-Guest'} | Password: {arrival.wifi_password || 'coastalguest2026'}
                      </Text>
                    </View>
                  ) : null}

                  {arrival.access_instructions ? (
                    <View style={styles.infoField}>
                      <Text style={[styles.infoFieldLabel, { color: isDark ? '#A7F3D0' : '#047857' }]}>ACCESS INSTRUCTIONS</Text>
                      <Text style={[styles.infoFieldValue, { color: isDark ? '#FFFFFF' : '#064E3B' }]}>
                        {arrival.access_instructions}
                      </Text>
                    </View>
                  ) : null}

                  {arrival.parking_notes ? (
                    <View style={styles.infoField}>
                      <Text style={[styles.infoFieldLabel, { color: isDark ? '#A7F3D0' : '#047857' }]}>PARKING</Text>
                      <Text style={[styles.infoFieldValue, { color: isDark ? '#FFFFFF' : '#064E3B' }]}>
                        {arrival.parking_notes}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Checkout Instructions (Revealed for Confirmed Bookings) */}
            {isConfirmed && (checkout.checkout_time || checkout.key_return || checkout.cleaning_notes) ? (
              <View style={[styles.infoCardBlock, { backgroundColor: isDark ? '#27272A' : '#F9FAFB', borderColor: colors.border }]}>
                <View style={styles.infoCardHeader}>
                  <Feather name="log-out" size={16} color={ORANGE} />
                  <Text style={[styles.infoCardTitle, { color: colors.text }]}>Checkout Instructions</Text>
                </View>

                <View style={styles.infoCardContent}>
                  {checkout.key_return ? (
                    <View style={styles.infoField}>
                      <Text style={[styles.infoFieldLabel, { color: colors.mutedForeground }]}>KEY RETURN</Text>
                      <Text style={[styles.infoFieldValue, { color: colors.text }]}>{checkout.key_return}</Text>
                    </View>
                  ) : null}
                  {checkout.cleaning_notes ? (
                    <View style={styles.infoField}>
                      <Text style={[styles.infoFieldLabel, { color: colors.mutedForeground }]}>CLEANING / TRASH</Text>
                      <Text style={[styles.infoFieldValue, { color: colors.text }]}>{checkout.cleaning_notes}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Preserved House Rules Snapshot */}
            <View style={[styles.infoCardBlock, { backgroundColor: isDark ? '#27272A' : '#F9FAFB', borderColor: colors.border }]}>
              <View style={styles.infoCardHeader}>
                <Feather name="shield" size={16} color={ORANGE} />
                <Text style={[styles.infoCardTitle, { color: colors.text }]}>House Rules Snapshot</Text>
              </View>

              <View style={styles.rulesSnapshotRow}>
                <View style={styles.ruleBadgeItem}>
                  <Feather name={houseRules.smoking_allowed ? 'check' : 'x'} size={12} color={houseRules.smoking_allowed ? '#10B981' : '#EF4444'} />
                  <Text style={[styles.ruleBadgeText, { color: colors.text }]}>
                    {houseRules.smoking_allowed ? 'Smoking allowed' : 'No smoking'}
                  </Text>
                </View>
                <View style={styles.ruleBadgeItem}>
                  <Feather name={houseRules.pets_allowed ? 'check' : 'x'} size={12} color={houseRules.pets_allowed ? '#10B981' : '#EF4444'} />
                  <Text style={[styles.ruleBadgeText, { color: colors.text }]}>
                    {houseRules.pets_allowed ? 'Pets allowed' : 'No pets'}
                  </Text>
                </View>
                <View style={styles.ruleBadgeItem}>
                  <Feather name={houseRules.parties_allowed ? 'check' : 'x'} size={12} color={houseRules.parties_allowed ? '#10B981' : '#EF4444'} />
                  <Text style={[styles.ruleBadgeText, { color: colors.text }]}>
                    {houseRules.parties_allowed ? 'Events allowed' : 'No parties'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Preserved Cancellation Policy Snapshot */}
            <View style={[styles.infoCardBlock, { backgroundColor: isDark ? '#27272A' : '#F9FAFB', borderColor: colors.border }]}>
              <View style={styles.infoCardHeader}>
                <Feather name="refresh-ccw" size={16} color={ORANGE} />
                <Text style={[styles.infoCardTitle, { color: colors.text }]}>
                  {cancellationPolicyType.charAt(0).toUpperCase() + cancellationPolicyType.slice(1)} Cancellation Policy
                </Text>
              </View>
              <Text style={[styles.policyDescText, { color: colors.mutedForeground }]}>
                {cancellationPolicyType === 'strict'
                  ? 'Strict policy locked at booking: Full refund if cancelled 7+ days before check-in, 50% thereafter.'
                  : cancellationPolicyType === 'moderate'
                  ? 'Moderate policy locked at booking: Full refund up to 5 days before check-in.'
                  : 'Flexible policy locked at booking: Full refund up to 24 hours before check-in.'}
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              {/* Leave Review Action (for completed trips) */}
              {isCompleted && onWriteReview ? (
                <Pressable
                  onPress={onWriteReview}
                  style={styles.modalReviewBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Write a review for this completed stay"
                >
                  <Feather name="star" size={16} color="#FFFFFF" />
                  <Text style={styles.modalReviewBtnText}>Write a Review</Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={onMessageHost}
                style={styles.modalPrimaryBtn}
                accessibilityRole="button"
                accessibilityLabel="Message the host"
              >
                <Feather name="message-square" size={16} color="#FFFFFF" />
                <Text style={styles.modalPrimaryBtnText}>Message Host</Text>
              </Pressable>

              <Pressable
                onPress={onDirections}
                style={[styles.modalSecondaryBtn, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}
                accessibilityRole="button"
                accessibilityLabel="Get directions in maps"
              >
                <Feather name="navigation" size={16} color={colors.text} />
                <Text style={[styles.modalSecondaryBtnText, { color: colors.text }]}>Get Directions</Text>
              </Pressable>

              {canCancel && onCancelBooking ? (
                <Pressable
                  onPress={onCancelBooking}
                  disabled={isCancelling}
                  style={({ pressed }) => [
                    styles.modalCancelBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel reservation"
                >
                  <Feather name="x-circle" size={16} color="#DC2626" />
                  <Text style={styles.modalCancelBtnText}>
                    {isCancelling ? 'Cancelling...' : 'Cancel Reservation'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
