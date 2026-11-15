import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import {
  useEnquire,
  useHostBookings,
  useHostCheckInBooking,
  useHostConfirmBooking,
  useHostDeclineBooking,
} from '@/lib/queries';
import { isCheckInWindowOpen } from '../reservations/reservationHelpers';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { Skeleton } from '@/components/Skeleton';
import { PremiumLoader } from '@/components/PremiumLoader';
import type { BookingRow } from '@/lib/supabase';

type ReservationTab = 'requests' | 'upcoming' | 'history';

const DECLINE_REASONS = [
  'Dates no longer available',
  'Guest does not meet house rules',
  'Property undergoing maintenance',
  'Pricing or availability adjustment needed',
  'Other operational reasons',
];

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatBookingDates(checkIn: string | null | undefined, checkOut: string | null | undefined) {
  if (!checkIn && !checkOut) return 'Flexible Dates';
  const fmt = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.split('T')[0] || iso;
    const year = d.getFullYear() === new Date().getFullYear() ? '' : `, ${d.getFullYear()}`;
    return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}${year}`;
  };
  const ci = fmt(checkIn);
  const co = fmt(checkOut);
  if (ci && co) return `${ci} – ${co}`;
  return ci || co || 'Flexible Dates';
}

interface HostReservationsViewProps {
  initialTab?: ReservationTab;
}

export function HostReservationsView({ initialTab = 'requests' }: HostReservationsViewProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useCustomAlert();
  const enquire = useEnquire();

  const confirmBookingMutation = useHostConfirmBooking();
  const declineBookingMutation = useHostDeclineBooking();

  const [activeTab, setActiveTab] = useState<ReservationTab>(initialTab);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  // Modal workflows
  const [acceptModalBooking, setAcceptModalBooking] = useState<BookingRow | null>(null);
  const [declineModalBooking, setDeclineModalBooking] = useState<BookingRow | null>(null);
  const [selectedDeclineReason, setSelectedDeclineReason] = useState<string>(DECLINE_REASONS[0]);
  const [processingAction, setProcessingAction] = useState<boolean>(false);
  const hostCheckInMutation = useHostCheckInBooking();
  const [checkInModalBooking, setCheckInModalBooking] = useState<BookingRow | null>(null);
  const [checkInPinInput, setCheckInPinInput] = useState<string>('');

  const handleVerifyGuestPin = async () => {
    if (!checkInModalBooking) return;
    const cleanPin = checkInPinInput.replace(/\D/g, '');
    if (cleanPin.length !== 6) {
      showAlert({
        title: 'Invalid PIN',
        message: 'Please enter the 6-digit arrival PIN shown by your guest.',
        icon: 'alert-circle',
      });
      return;
    }
    try {
      await hostCheckInMutation.mutateAsync({
        bookingId: checkInModalBooking.id,
        pin: cleanPin,
      });
      setCheckInModalBooking(null);
      setCheckInPinInput('');
      showAlert({
        title: 'Guest Checked In ✓',
        message: 'Arrival verified! Payout is scheduled for 24 hours after check-in unless an arrival issue is reported.',
        icon: 'check-circle',
      });
      refetch();
    } catch (err: any) {
      showAlert({
        title: 'PIN Verification Failed',
        message: err?.message || 'Incorrect arrival PIN or check-in window is not open yet.',
        icon: 'alert-circle',
      });
    }
  };

  const {
    data: bookings = [],
    isLoading,
    isRefetching,
    refetch,
  } = useHostBookings(user?.id);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 10;
  const bottomPad = Platform.OS === 'web' ? 110 : insets.bottom + 90;

  // Tab categorization
  const { requestsList, upcomingList, historyList } = useMemo(() => {
    const reqs: BookingRow[] = [];
    const upcom: BookingRow[] = [];
    const hist: BookingRow[] = [];

    for (const b of bookings) {
      const s = (b.status ?? '').toLowerCase();
      if (s === 'paid' || s === 'pending') {
        reqs.push(b);
      } else if (s === 'confirmed') {
        upcom.push(b);
      } else {
        hist.push(b);
      }
    }

    return {
      requestsList: reqs,
      upcomingList: upcom,
      historyList: hist,
    };
  }, [bookings]);

  const currentList = useMemo(() => {
    switch (activeTab) {
      case 'requests':
        return requestsList;
      case 'upcoming':
        return upcomingList;
      case 'history':
        return historyList;
    }
  }, [activeTab, requestsList, upcomingList, historyList]);

  // ── Accept Action ──────────────────────────────────────────────────────────
  const handleExecuteAccept = async () => {
    if (!acceptModalBooking) return;
    const b = acceptModalBooking;
    setProcessingAction(true);

    try {
      await confirmBookingMutation.mutateAsync(b.id);
      setAcceptModalBooking(null);
      showAlert({
        title: 'Reservation Confirmed! 🎉',
        message: 'The booking is now confirmed and moved to your Upcoming list.',
        icon: 'check-circle',
      });
      refetch();
    } catch (err: any) {
      showAlert({
        title: 'Action Failed',
        message: err?.message || 'Could not confirm reservation.',
        icon: 'alert-circle',
      });
    } finally {
      setProcessingAction(false);
    }
  };

  // ── Decline Action ─────────────────────────────────────────────────────────
  const handleExecuteDecline = async () => {
    if (!declineModalBooking) return;
    const b = declineModalBooking;
    setProcessingAction(true);

    try {
      await declineBookingMutation.mutateAsync({
        bookingId: b.id,
        reason: selectedDeclineReason,
      });
      setDeclineModalBooking(null);
      showAlert({
        title: 'Reservation Declined',
        message: 'The guest has been notified and refund processing initiated.',
        icon: 'info',
      });
      refetch();
    } catch (err: any) {
      showAlert({
        title: 'Action Failed',
        message: err?.message || 'Could not decline reservation.',
        icon: 'alert-circle',
      });
    } finally {
      setProcessingAction(false);
    }
  };

  // ── Message Guest ──────────────────────────────────────────────────────────
  const handleMessageGuest = (booking: BookingRow) => {
    if (!user?.id || !booking.user_id) {
      showAlert({
        title: 'Cannot Start Chat',
        message: 'Guest profile ID not found on this reservation.',
        icon: 'alert-circle',
      });
      return;
    }

    enquire.mutate(
      {
        userId: user.id,
        hostId: booking.user_id,
      },
      {
        onSuccess: (convoId) => {
          if (convoId) {
            router.push(`/chat/${convoId}`);
          }
        },
        onError: (err: any) => {
          showAlert({
            title: 'Chat Error',
            message: err?.message || 'Could not open conversation.',
            icon: 'alert-circle',
          });
        },
      }
    );
  };

  const getStatusBadge = (status?: string | null) => {
    const s = (status || 'pending').toLowerCase();
    switch (s) {
      case 'confirmed':
        return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0', label: 'Confirmed' };
      case 'paid':
        return { bg: '#FFF7ED', text: '#EA580C', border: '#FFEDD5', label: 'Paid — Awaiting Approval' };
      case 'completed':
        return { bg: '#F0F9FF', text: '#0284C7', border: '#BAE6FD', label: 'Completed' };
      case 'refund_pending':
        return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A', label: 'Refund Pending' };
      case 'refunded':
        return { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE', label: 'Refunded' };
      case 'cancelled':
        return { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', label: 'Cancelled' };
      default:
        return { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB', label: status || 'Pending' };
    }
  };

  return (
    <View testID="host-reservations-view" style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#F26522"
            colors={['#F26522']}
          />
        }
        contentContainerStyle={{
          paddingTop: topPad,
          paddingBottom: bottomPad,
          paddingHorizontal: 20,
          gap: 18,
        }}
      >
        {/* ── Top Header ────────────────────────────────────────────── */}
        <View style={styles.headerBlock}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Host Reservations</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              Review reservation requests and oversee guest stays.
            </Text>
          </View>
        </View>

        {/* ── Segmented Control Filter Tabs ──────────────────────────── */}
        <View style={[styles.tabTrack, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
          <Pressable
            testID="host-tab-requests"
            onPress={() => setActiveTab('requests')}
            style={[
              styles.tabBtn,
              activeTab === 'requests' && [styles.tabBtnActive, { backgroundColor: colors.card }],
            ]}
          >
            <View style={styles.tabLabelRow}>
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'requests' ? colors.text : colors.mutedForeground },
                  activeTab === 'requests' && styles.tabBtnTextActive,
                ]}
              >
                Requests
              </Text>
              {requestsList.length > 0 ? (
                <View
                  style={[
                    styles.tabBadge,
                    activeTab === 'requests' && styles.tabBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      activeTab === 'requests' && styles.tabBadgeTextActive,
                    ]}
                  >
                    {requestsList.length}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>

          <Pressable
            testID="host-tab-upcoming"
            onPress={() => setActiveTab('upcoming')}
            style={[
              styles.tabBtn,
              activeTab === 'upcoming' && [styles.tabBtnActive, { backgroundColor: colors.card }],
            ]}
          >
            <View style={styles.tabLabelRow}>
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'upcoming' ? colors.text : colors.mutedForeground },
                  activeTab === 'upcoming' && styles.tabBtnTextActive,
                ]}
              >
                Upcoming ({upcomingList.length})
              </Text>
            </View>
          </Pressable>

          <Pressable
            testID="host-tab-history"
            onPress={() => setActiveTab('history')}
            style={[
              styles.tabBtn,
              activeTab === 'history' && [styles.tabBtnActive, { backgroundColor: colors.card }],
            ]}
          >
            <Text
              style={[
                styles.tabBtnText,
                { color: activeTab === 'history' ? colors.text : colors.mutedForeground },
                activeTab === 'history' && styles.tabBtnTextActive,
              ]}
            >
              History ({historyList.length})
            </Text>
          </Pressable>
        </View>

        {/* ── List Content ────────────────────────────────────────────── */}
        {isLoading && bookings.length === 0 ? (
          <View style={{ gap: 14 }}>
            <Skeleton style={{ height: 160, borderRadius: 20 }} />
            <Skeleton style={{ height: 160, borderRadius: 20 }} />
            <Skeleton style={{ height: 160, borderRadius: 20 }} />
          </View>
        ) : currentList.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Feather
                name={
                  activeTab === 'requests'
                    ? 'inbox'
                    : activeTab === 'upcoming'
                    ? 'calendar'
                    : 'archive'
                }
                size={26}
                color="#F26522"
              />
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === 'requests'
                ? 'No Pending Requests'
                : activeTab === 'upcoming'
                ? 'No Upcoming Reservations'
                : 'No Reservation History'}
            </Text>
            <Text style={styles.emptySub}>
              {activeTab === 'requests'
                ? "You're all caught up! New guest booking requests will appear here for your confirmation."
                : activeTab === 'upcoming'
                ? 'Confirmed guest bookings will appear here ahead of check-in.'
                : 'Past, completed, or cancelled reservations will be archived here.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {currentList.map((b) => {
              const badge = getStatusBadge(b.status);
              const isExpanded = expandedBookingId === b.id;
              const titleStr = b.experience?.title || b.trip_title || 'Coastal Stay';
              const locationStr = b.experience?.location || 'Kenya';
              const imgUrl = b.experience?.image_url || null;
              const totalAmount = b.amount ?? 0;
              const isPaidPending = b.status === 'paid' || b.status === 'pending';

              const guestName =
                b.guest?.full_name ||
                (b.guest?.metadata as any)?.full_name ||
                (b.guest?.metadata as any)?.legal_name ||
                b.guest?.email?.split('@')[0] ||
                b.guest?.phone ||
                'Guest Traveler';

              const guestAvatar =
                (b.guest?.metadata as any)?.avatar_url ||
                (b.guest as any)?.avatar_url ||
                null;

              const guestInitial = guestName.charAt(0).toUpperCase();

              const guestContact =
                b.guest?.phone ||
                (b.guest?.metadata as any)?.phone ||
                b.guest?.email ||
                (b.guest?.metadata as any)?.email ||
                'Contact upon confirmation';

              const isGuestVerified =
                b.guest?.verification_status === 'verified' ||
                (b.guest?.metadata as any)?.verification_status === 'verified';

              const formattedDates = formatBookingDates(b.check_in, b.check_out);

              return (
                <View key={b.id} style={styles.bookingCard}>
                  {/* Card Header Top */}
                  <Pressable
                    onPress={() => setExpandedBookingId(isExpanded ? null : b.id)}
                    style={styles.cardHeader}
                  >
                    {imgUrl ? (
                      <Image
                        source={{ uri: imgUrl }}
                        style={styles.expImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.expImage, styles.expImageFallback]}>
                        <Feather name="home" size={24} color="#F26522" />
                        <Text style={styles.expImageFallbackText} numberOfLines={1}>
                          {titleStr.slice(0, 4)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.cardInfo}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={styles.expTitle} numberOfLines={1}>
                          {titleStr}
                        </Text>
                        <Feather
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color="#717171"
                        />
                      </View>

                      <Text style={styles.locationText} numberOfLines={1}>
                        <Feather name="map-pin" size={11} color="#717171" /> {locationStr}
                      </Text>

                      {/* Guest Banner */}
                      <View style={styles.guestInfoRow}>
                        {guestAvatar ? (
                          <Image
                            source={{ uri: guestAvatar }}
                            style={styles.guestAvatarSmall}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={styles.guestAvatarPlaceholderSmall}>
                            <Text style={styles.guestAvatarInitial}>{guestInitial}</Text>
                          </View>
                        )}
                        <Text style={styles.guestNameText} numberOfLines={1}>
                          {guestName}
                        </Text>
                        {isGuestVerified ? (
                          <Feather name="check-circle" size={12} color="#16A34A" />
                        ) : null}
                      </View>

                      <View style={styles.dateAndGuestsRow}>
                        <Feather name="calendar" size={12} color="#1E1E1E" />
                        <Text style={styles.dateText}>
                          {formattedDates}
                        </Text>
                      </View>

                      <View style={styles.amountStatusRow}>
                        <Text style={styles.amountText}>
                          KES {totalAmount.toLocaleString()}
                        </Text>
                        {b.arrival_issue_status === 'open' ? (
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
                            ]}
                          >
                            <Text style={[styles.statusBadgeText, { color: '#92400E' }]}>
                              Arrival Issue — Payout On Hold
                            </Text>
                          </View>
                        ) : b.checked_in_at ? (
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: '#D1FAE5', borderColor: '#10B981' },
                            ]}
                          >
                            <Text style={[styles.statusBadgeText, { color: '#065F46' }]}>
                              Checked In ✓
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: badge.bg, borderColor: badge.border },
                            ]}
                          >
                            <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                              {badge.label}
                            </Text>
                          </View>
                        )}
                      </View>
                      {b.arrival_issue_status === 'open' ? (
                        <Text style={{ fontSize: 12, color: '#B45309', marginTop: 4 }}>
                          Issue: {b.arrival_issue_reason || 'Guest reported an arrival issue'} (payout frozen)
                        </Text>
                      ) : b.checked_in_at ? (
                        <Text style={{ fontSize: 12, color: '#047857', marginTop: 4 }}>
                          Checked in via {b.check_in_method === 'pin_verified' || b.check_in_method === 'pin' ? 'Host PIN Verification' : 'Guest App'}
                          {b.checked_in_at ? ` • ${new Date(b.checked_in_at).toLocaleString()}` : ''}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>

                  {/* Expanded Information Accordion */}
                  {isExpanded ? (
                    <View style={styles.expandedDetails}>
                      <View style={styles.divider} />
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Guest Name</Text>
                        <Text style={styles.detailValue}>{guestName}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Guest Contact</Text>
                        <Text style={styles.detailValue}>{guestContact}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Verification</Text>
                        <Text style={styles.detailValue}>{isGuestVerified ? 'Verified Traveler' : 'Registered Traveler'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Guests</Text>
                        <Text style={styles.detailValue}>{b.guests || 1} Guest(s)</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Booking ID</Text>
                        <Text style={styles.detailValueCode}>{b.id.substring(0, 13)}...</Text>
                      </View>
                      {(b.cancellation_policy_snapshot?.policy_type || b.cancellation_policy_snapshot?.type) ? (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Cancellation Policy</Text>
                          <Text style={styles.detailValue}>
                            {((b.cancellation_policy_snapshot.policy_type || b.cancellation_policy_snapshot.type)!).charAt(0).toUpperCase() + ((b.cancellation_policy_snapshot.policy_type || b.cancellation_policy_snapshot.type)!).slice(1)} (Locked)
                          </Text>
                        </View>
                      ) : null}
                      {b.house_rules_snapshot ? (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>House Rules</Text>
                          <Text style={styles.detailValue}>
                            {b.house_rules_snapshot.smoking_allowed ? 'Smoking OK' : 'No smoking'} · {b.house_rules_snapshot.pets_allowed ? 'Pets OK' : 'No pets'} · {b.house_rules_snapshot.parties_allowed ? 'Events OK' : 'No parties'}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Net Host Payout</Text>
                        <Text style={[styles.detailValue, { color: '#16A34A', fontFamily: 'DMSans_700Bold' }]}>
                          KES {Math.round(totalAmount * 0.85).toLocaleString()} (85%)
                        </Text>
                      </View>
                      {b.checked_in_at ? (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Check-In Verified</Text>
                          <Text style={[styles.detailValue, { color: '#047857' }]}>
                            {b.check_in_method === 'pin_verified' || b.check_in_method === 'pin' ? 'Host PIN' : 'Guest App'} · {new Date(b.checked_in_at).toLocaleString()}
                          </Text>
                        </View>
                      ) : null}
                      {b.arrival_issue_status === 'open' ? (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Arrival Issue</Text>
                          <Text style={[styles.detailValue, { color: '#B45309' }]}>
                            On Hold — {b.arrival_issue_reason || 'Under review'}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Action Buttons Row */}
                  <View style={styles.cardActions}>
                    <Pressable
                      testID={`host-message-btn-${b.id}`}
                      onPress={() => handleMessageGuest(b)}
                      style={({ pressed }) => [
                        styles.messageBtn,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Ionicons name="chatbubble-outline" size={15} color="#1E1E1E" />
                      <Text style={styles.messageBtnText}>Message Guest</Text>
                    </Pressable>

                    {(b.status ?? '').toLowerCase() === 'confirmed' &&
                    !b.checked_in_at &&
                    b.arrival_issue_status !== 'open' ? (
                      <Pressable
                        testID={`host-check-in-btn-${b.id}`}
                        onPress={() => {
                          setCheckInPinInput('');
                          setCheckInModalBooking(b);
                        }}
                        style={({ pressed }) => [
                          {
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            backgroundColor: isCheckInWindowOpen(b) ? '#059669' : '#334155',
                            paddingHorizontal: 14,
                            paddingVertical: 9,
                            borderRadius: 10,
                          },
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Ionicons name="key-outline" size={15} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                          Check In Guest
                        </Text>
                      </Pressable>
                    ) : null}

                    {isPaidPending ? (
                      <View style={styles.actionButtonsGroup}>
                        <Pressable
                          testID={`host-decline-btn-${b.id}`}
                          onPress={() => {
                            setDeclineModalBooking(b);
                            setSelectedDeclineReason(DECLINE_REASONS[0]);
                          }}
                          style={({ pressed }) => [
                            styles.declineBtn,
                            pressed && { opacity: 0.8 },
                          ]}
                        >
                          <Text style={styles.declineBtnText}>Decline</Text>
                        </Pressable>

                        <Pressable
                          testID={`host-accept-btn-${b.id}`}
                          onPress={() => setAcceptModalBooking(b)}
                          style={({ pressed }) => [
                            styles.acceptBtn,
                            pressed && { opacity: 0.88 },
                          ]}
                        >
                          <Feather name="check" size={15} color="#FFFFFF" />
                          <Text style={styles.acceptBtnText}>Accept</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── ACCEPT CONFIRMATION MODAL ──────────────────────────────── */}
      <Modal
        visible={!!acceptModalBooking}
        transparent
        animationType="fade"
        onRequestClose={() => setAcceptModalBooking(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrapGreen}>
              <Feather name="check-circle" size={28} color="#16A34A" />
            </View>
            <Text style={styles.modalTitle}>Confirm Reservation?</Text>
            <Text style={styles.modalSub}>
              By accepting, the dates will be permanently locked on your calendar and the guest will receive an instant confirmation notification with check-in instructions.
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setAcceptModalBooking(null)}
                style={styles.modalCancelBtn}
                disabled={processingAction}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                testID="confirm-accept-submit-btn"
                onPress={handleExecuteAccept}
                style={[styles.modalAcceptSubmitBtn, processingAction && { opacity: 0.7 }]}
                disabled={processingAction}
              >
                {processingAction ? (
                  <PremiumLoader size={6} color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalAcceptSubmitBtnText}>Yes, Confirm Booking</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── VERIFY GUEST CHECK-IN PIN MODAL ─────────────────────────── */}
      <Modal
        visible={!!checkInModalBooking}
        transparent
        animationType="fade"
        onRequestClose={() => setCheckInModalBooking(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrapGreen}>
              <Ionicons name="key-outline" size={26} color="#059669" />
            </View>
            <Text style={styles.modalTitle}>Check In Guest</Text>
            <Text style={styles.modalSub}>
              {checkInModalBooking && !isCheckInWindowOpen(checkInModalBooking)
                ? 'Check-in opens at 6:00 AM EAT on the guest arrival date. You can enter their 6-digit arrival PIN once the window opens.'
                : 'Ask your guest in person for the 6-digit secret PIN shown in their ZuruSasa Trips pass to verify arrival.'}
            </Text>

            <TextInput
              testID="host-check-in-pin-input"
              value={checkInPinInput}
              onChangeText={(txt) => setCheckInPinInput(txt.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit PIN"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={6}
              style={{
                width: '100%',
                borderWidth: 1.5,
                borderColor: '#D1D5DB',
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 16,
                fontSize: 22,
                fontWeight: '800',
                letterSpacing: 6,
                textAlign: 'center',
                color: '#111827',
                backgroundColor: '#F9FAFB',
                marginBottom: 16,
              }}
            />

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setCheckInModalBooking(null);
                  setCheckInPinInput('');
                }}
                style={styles.modalCancelBtn}
                disabled={hostCheckInMutation.isPending}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                testID="host-verify-pin-submit-btn"
                onPress={handleVerifyGuestPin}
                style={[
                  styles.modalAcceptSubmitBtn,
                  (hostCheckInMutation.isPending || checkInPinInput.replace(/\D/g, '').length !== 6) && {
                    opacity: 0.65,
                  },
                ]}
                disabled={
                  hostCheckInMutation.isPending || checkInPinInput.replace(/\D/g, '').length !== 6
                }
              >
                {hostCheckInMutation.isPending ? (
                  <PremiumLoader size={6} color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalAcceptSubmitBtnText}>Verify PIN & Check In</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── DECLINE CONFIRMATION MODAL ──────────────────────────────── */}
      <Modal
        visible={!!declineModalBooking}
        transparent
        animationType="fade"
        onRequestClose={() => setDeclineModalBooking(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrapRed}>
              <Feather name="alert-circle" size={28} color="#DC2626" />
            </View>
            <Text style={styles.modalTitle}>Decline Reservation Request</Text>
            <Text style={styles.modalSub}>
              Please select a reason for declining. The guest will receive an immediate notification and their full payment will be refunded.
            </Text>

            <View style={styles.reasonList}>
              {DECLINE_REASONS.map((r) => {
                const isSelected = selectedDeclineReason === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setSelectedDeclineReason(r)}
                    style={[styles.reasonTile, isSelected && styles.reasonTileSelected]}
                  >
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={isSelected ? '#F26522' : '#717171'}
                    />
                    <Text style={[styles.reasonText, isSelected && styles.reasonTextSelected]}>
                      {r}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setDeclineModalBooking(null)}
                style={styles.modalCancelBtn}
                disabled={processingAction}
              >
                <Text style={styles.modalCancelBtnText}>Back</Text>
              </Pressable>
              <Pressable
                testID="confirm-decline-submit-btn"
                onPress={handleExecuteDecline}
                style={[styles.modalDeclineSubmitBtn, processingAction && { opacity: 0.7 }]}
                disabled={processingAction}
              >
                {processingAction ? (
                  <PremiumLoader size={6} color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalDeclineSubmitBtnText}>Decline & Refund</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  headerBlock: {
    paddingVertical: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    marginTop: 3,
  },
  tabTrack: {
    flexDirection: 'row',
    backgroundColor: '#EDEDED',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabBtnText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#6B7280',
  },
  tabBtnTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  tabBadge: {
    backgroundColor: '#F26522',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: '#F26522',
  },
  tabBadgeText: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 12,
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
  },
  expImage: {
    width: 84,
    height: 84,
    borderRadius: 14,
  },
  expImageFallback: {
    backgroundColor: '#FFF5EF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDDFCB',
    gap: 4,
  },
  expImageFallbackText: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
    textTransform: 'uppercase',
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  expTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
    flex: 1,
    marginRight: 6,
  },
  locationText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  guestInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  guestAvatarSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  guestAvatarPlaceholderSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestAvatarInitial: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  guestNameText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#374151',
    maxWidth: 160,
  },
  dateAndGuestsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#1F2937',
  },
  amountStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  amountText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
  },
  expandedDetails: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#111827',
  },
  detailValueCode: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  messageBtnText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#1F2937',
  },
  actionButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  declineBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  declineBtnText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#DC2626',
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16A34A',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  acceptBtnText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalIconWrapGreen: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalIconWrapRed: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 19,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  reasonList: {
    width: '100%',
    gap: 8,
    marginBottom: 18,
  },
  reasonTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  reasonTileSelected: {
    borderColor: '#F26522',
    backgroundColor: '#FFF7ED',
  },
  reasonText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#374151',
    flex: 1,
  },
  reasonTextSelected: {
    fontFamily: 'DMSans_600SemiBold',
    color: '#C2410C',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#4B5563',
  },
  modalAcceptSubmitBtn: {
    flex: 1.5,
    backgroundColor: '#16A34A',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAcceptSubmitBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  modalDeclineSubmitBtn: {
    flex: 1.5,
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDeclineSubmitBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
});
