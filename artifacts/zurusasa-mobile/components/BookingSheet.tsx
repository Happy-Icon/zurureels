import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useCreateBooking } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import type { ReelRow } from '@/lib/supabase';
import { notificationService } from '@/services/notificationService';
import { AvailabilityCalendar } from '@/components/booking/AvailabilityCalendar';
import { GuestSelector, type GuestCounts } from '@/components/booking/GuestSelector';
import { PriceBreakdown } from '@/components/booking/PriceBreakdown';

const ORANGE = '#F26522';
const DAY_MS = 86_400_000;

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtShort(d: Date): string {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function fmtFull(d: Date): string {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface BookingSheetProps {
  reel: ReelRow;
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Phase = 'idle' | 'sending' | 'pin' | 'success';
type ActiveSection = 'dates' | 'guests' | 'payment';

// ─── Component ───────────────────────────────────────────────────────────────

export function BookingSheet({ reel, visible, onClose, onSuccess }: BookingSheetProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const createBooking = useCreateBooking();

  const exp = reel.experience;
  const meta = (exp?.metadata ?? {}) as Record<string, unknown>;
  const rating = Number((meta.rating as number | string | undefined) ?? 5);
  const title = exp?.title ?? 'Coastal experience';
  const category = (reel.category ?? '').toLowerCase();
  const price = exp?.current_price != null ? Number(exp.current_price) : null;
  const priceUnit = exp?.price_unit ?? 'person';
  const hostId = reel.user_id ?? null;
  const isNightBased = ['hotel', 'villa', 'apartment', 'stay'].includes(category);

  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = useMemo(() => addDays(today, 365), [today]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [viewMonth, setViewMonth] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [guests, setGuests] = useState<GuestCounts>({
    adults: 1,
    children: 0,
    infants: 0,
    pets: 0,
  });
  const [method, setMethod] = useState<'mpesa' | 'reserve'>(
    price != null ? 'mpesa' : 'reserve',
  );
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [successKind, setSuccessKind] = useState<'paid' | 'requested'>('paid');
  const [activeSection, setActiveSection] = useState<ActiveSection>('dates');

  // ── Calendar nav ──────────────────────────────────────────────────────────
  const canPrev =
    viewMonth.getFullYear() > today.getFullYear() ||
    viewMonth.getMonth() > today.getMonth();
  const canNext =
    viewMonth.getFullYear() < maxDate.getFullYear() ||
    (viewMonth.getFullYear() === maxDate.getFullYear() &&
      viewMonth.getMonth() < maxDate.getMonth());

  // ── Derived ───────────────────────────────────────────────────────────────
  const totalGuests = guests.adults + guests.children;
  const nights =
    from && to ? Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS)) : 1;
  const units = isNightBased ? nights : totalGuests;
  const baseTotal = (price ?? 0) * units;
  const busy = phase === 'sending' || phase === 'pin';

  // ── Polling ref ───────────────────────────────────────────────────────────
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  useEffect(() => () => stopPolling(), []);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetState = () => {
    setFrom(undefined);
    setTo(undefined);
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setGuests({ adults: 1, children: 0, infants: 0, pets: 0 });
    setMethod(price != null ? 'mpesa' : 'reserve');
    setMpesaPhone('');
    setPhase('idle');
    setActiveSection('dates');
  };

  const handleClose = () => {
    stopPolling();
    onClose();
    setTimeout(resetState, 350);
  };

  const handleDone = () => {
    onSuccess?.();
    handleClose();
  };

  // ── Calendar ──────────────────────────────────────────────────────────────
  const onDayPress = (day: Date) => {
    if (!from || (from && to)) {
      setFrom(day);
      setTo(undefined);
      return;
    }
    if (day.getTime() < from.getTime()) {
      setFrom(day);
      return;
    }
    setTo(day);
    // Auto-advance to guests step
    setTimeout(() => setActiveSection('guests'), 200);
  };

  // ── Payment flows (unchanged from original) ───────────────────────────────
  const startStkFlow = async () => {
    if (!from) return;
    if (!hostId) {
      Alert.alert('Host unavailable', "This listing doesn't have a host configured yet.");
      return;
    }
    let phone = mpesaPhone.trim().replace(/^\+/, '');
    if (phone.startsWith('0')) phone = `254${phone.substring(1)}`;
    else if (phone && !phone.startsWith('254')) phone = `254${phone}`;

    if (!phone || !/^(254)(7|1)\d{8}$/.test(phone)) {
      Alert.alert(
        'Invalid phone number',
        'Please enter a valid Safaricom M-Pesa number (e.g. 0712345678).',
      );
      return;
    }

    setPhase('sending');
    try {
      const { data, error } = await supabase.functions.invoke('initiate-paystack-stk', {
        body: {
          phone,
          amount: baseTotal,
          experience_id: exp!.id,
          trip_title: title,
          guests: totalGuests,
          check_in: from.toISOString(),
          check_out: (to ?? addDays(from, 1)).toISOString(),
        },
      });
      if (error || data?.error) {
        throw new Error((data?.error as string) ?? error?.message ?? 'Failed to initiate payment');
      }
      const bookingId: string | undefined = data?.booking?.id;
      if (!bookingId) throw new Error('Payment could not be started.');

      setPhase('pin');
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        const { data: b } = await supabase
          .from('bookings')
          .select('status')
          .eq('id', bookingId)
          .single();
        if (b?.status === 'paid') {
          stopPolling();
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          if (user) {
            notificationService.createNotification({
              userId: user.id,
              type: 'payment_success',
              title: 'Payment Received! 🎉',
              message: `Your payment of KES ${baseTotal.toLocaleString()} for ${title} was successful.`,
              actionType: 'booking',
              actionId: bookingId,
            });
            if (hostId) {
              notificationService.createNotification({
                userId: hostId,
                type: 'booking_request',
                title: 'New Booking Request',
                message: `You received a new reservation request for ${title}.`,
                actionType: 'booking',
                actionId: bookingId,
              });
            }
          }
          setSuccessKind('paid');
          setPhase('success');
        } else if (b?.status === 'failed') {
          stopPolling();
          setPhase('idle');
          Alert.alert('Payment failed', 'The M-Pesa payment was cancelled or declined.');
        } else if (attempts >= 20) {
          stopPolling();
          setPhase('idle');
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          Alert.alert(
            'Still processing',
            'Payment confirmation is taking longer than expected. We will update your booking once the network confirms it — check Transactions & Receipts.',
          );
          handleDone();
        }
      }, 3000);
    } catch (err) {
      setPhase('idle');
      Alert.alert('Payment failed', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const startReserveFlow = async () => {
    if (!from || !user || !exp?.id) return;
    setPhase('sending');
    try {
      await createBooking.mutateAsync({
        userId: user.id,
        experienceId: exp.id,
        reelId: reel.id,
        tripTitle: title,
        amount: price != null ? baseTotal : null,
        guests: totalGuests,
        checkIn: from.toISOString(),
        checkOut: (to ?? addDays(from, 1)).toISOString(),
      });
      setSuccessKind('requested');
      setPhase('success');
    } catch (err) {
      setPhase('idle');
      Alert.alert('Booking failed', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const handleConfirm = () => {
    if (!user) {
      handleClose();
      router.push('/auth');
      return;
    }
    if (!from || busy) return;
    if (method === 'mpesa') startStkFlow();
    else startReserveFlow();
  };

  const confirmLabel =
    phase === 'pin'
      ? 'Waiting for M-Pesa PIN…'
      : phase === 'sending'
        ? method === 'mpesa'
          ? 'Sending STK push…'
          : 'Sending request…'
        : method === 'mpesa'
          ? 'Confirm & Pay'
          : 'Request to Book';

  // ── Guest summary label ───────────────────────────────────────────────────
  const guestSummary = [
    `${guests.adults} adult${guests.adults !== 1 ? 's' : ''}`,
    guests.children > 0 ? `${guests.children} child${guests.children !== 1 ? 'ren' : ''}` : null,
    guests.infants > 0 ? `${guests.infants} infant${guests.infants !== 1 ? 's' : ''}` : null,
    guests.pets > 0 ? `${guests.pets} pet${guests.pets !== 1 ? 's' : ''}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.root}>
        {/* Dimmed backdrop */}
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <View style={styles.sheet} testID="booking-sheet">
            {/* Drag handle */}
            <View style={styles.dragHandle} />

            {/* Close button */}
            <Pressable
              testID="booking-close"
              onPress={handleClose}
              style={styles.closeBtn}
              hitSlop={8}
            >
              <Feather name="x" size={18} color="#222222" />
            </Pressable>

            {/* ── SUCCESS STATE ──────────────────────────────────────── */}
            {phase === 'success' ? (
              <View style={[styles.successWrap, { paddingBottom: insets.bottom + 24 }]}>
                <View style={styles.successCircle}>
                  <Feather name="check" size={36} color="#10B981" />
                </View>
                <Text style={styles.successTitle}>
                  {successKind === 'paid' ? 'Booking Confirmed! 🎉' : 'Request Sent!'}
                </Text>
                <Text style={styles.successBody}>
                  {successKind === 'paid'
                    ? `You're all set for ${title}. Check Transactions & Receipts for your booking details.`
                    : `Your request for ${title} is with the host. Track it in Transactions & Receipts.`}
                </Text>
                <Pressable
                  testID="booking-done"
                  onPress={handleDone}
                  style={({ pressed }) => [styles.confirmBtn, { opacity: pressed ? 0.88 : 1 }]}
                >
                  <Text style={styles.confirmBtnText}>Done</Text>
                </Pressable>
              </View>
            ) : (
              /* ── MAIN BOOKING FLOW ───────────────────────────────── */
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                keyboardShouldPersistTaps="handled"
              >
                {/* ── HERO SECTION ─────────────────────────────── */}
                {reel.thumbnail_url ? (
                  <View style={styles.hero}>
                    <Image
                      source={{ uri: reel.thumbnail_url }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.68)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.heroContent}>
                      {reel.category ? (
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryText}>
                            {reel.category.replace(/_/g, ' ')}
                          </Text>
                        </View>
                      ) : null}
                      <Text style={styles.heroTitle} numberOfLines={2}>
                        {title}
                      </Text>
                      <View style={styles.heroMeta}>
                        {exp?.location ? (
                          <View style={styles.heroMetaItem}>
                            <Feather name="map-pin" size={11} color="rgba(255,255,255,0.8)" />
                            <Text style={styles.heroMetaText} numberOfLines={1}>
                              {exp.location}
                            </Text>
                          </View>
                        ) : null}
                        <View style={styles.heroMetaItem}>
                          <Ionicons name="star" size={11} color="#FACC15" />
                          <Text style={styles.heroMetaText}>{rating.toFixed(1)}</Text>
                        </View>
                        {price != null ? (
                          <View style={styles.heroMetaItem}>
                            <Text style={styles.heroPrice}>
                              KES {price.toLocaleString()}/{priceUnit}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.plainHeader}>
                    <Text style={styles.plainTitle}>{title}</Text>
                    {exp?.location ? (
                      <View style={styles.heroMetaItem}>
                        <Feather name="map-pin" size={12} color="#9CA3AF" />
                        <Text style={styles.plainSub}>{exp.location}</Text>
                      </View>
                    ) : null}
                  </View>
                )}

                <View style={styles.body}>

                  {/* ── SECTION TABS ──────────────────────────────── */}
                  <View style={styles.sectionTabs}>
                    {(['dates', 'guests', 'payment'] as const).map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => setActiveSection(s)}
                        style={[styles.tab, activeSection === s && styles.tabActive]}
                      >
                        <Text style={[styles.tabText, activeSection === s && styles.tabTextActive]}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* ── DATES SECTION ─────────────────────────────── */}
                  {activeSection === 'dates' ? (
                    <View style={styles.sectionBlock}>
                      <Text style={styles.sectionTitle}>Select Dates</Text>

                      {/* Selected date pill summary */}
                      {from ? (
                        <View style={styles.dateSummaryRow}>
                          <View style={styles.datePill}>
                            <Feather name="log-in" size={13} color={ORANGE} />
                            <Text style={styles.datePillText}>{fmtShort(from)}</Text>
                          </View>
                          <Feather name="arrow-right" size={14} color="#9CA3AF" />
                          <View style={[styles.datePill, to ? null : styles.datePillEmpty]}>
                            <Feather name="log-out" size={13} color={to ? ORANGE : '#9CA3AF'} />
                            <Text style={[styles.datePillText, !to && { color: '#9CA3AF' }]}>
                              {to ? fmtShort(to) : 'End date'}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <Text style={styles.dateHint}>
                          Tap a date to set your check-in, then tap another for checkout.
                        </Text>
                      )}

                      <AvailabilityCalendar
                        startDate={from}
                        endDate={to}
                        viewMonth={viewMonth}
                        onDayPress={onDayPress}
                        onPrevMonth={() =>
                          setViewMonth(
                            new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
                          )
                        }
                        onNextMonth={() =>
                          setViewMonth(
                            new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
                          )
                        }
                        canPrev={canPrev}
                        canNext={canNext}
                      />

                      {/* Night count badge */}
                      {from && to ? (
                        <View style={styles.nightsBadge}>
                          <Feather name="moon" size={13} color={ORANGE} />
                          <Text style={styles.nightsBadgeText}>
                            {nights} night{nights !== 1 ? 's' : ''}
                          </Text>
                          <Pressable
                            onPress={() => { setFrom(undefined); setTo(undefined); }}
                            style={styles.clearDatesBtn}
                          >
                            <Text style={styles.clearDatesText}>Clear</Text>
                          </Pressable>
                        </View>
                      ) : null}

                      {from ? (
                        <Pressable
                          onPress={() => setActiveSection('guests')}
                          style={({ pressed }) => [
                            styles.nextStepBtn,
                            { opacity: pressed ? 0.88 : 1 },
                          ]}
                        >
                          <Text style={styles.nextStepBtnText}>Next: Select Guests</Text>
                          <Feather name="arrow-right" size={16} color="#FFFFFF" />
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}

                  {/* ── GUESTS SECTION ────────────────────────────── */}
                  {activeSection === 'guests' ? (
                    <View style={styles.sectionBlock}>
                      <Text style={styles.sectionTitle}>Who's Coming?</Text>
                      <GuestSelector
                        guests={guests}
                        maxGuests={20}
                        onChange={setGuests}
                      />
                      <Pressable
                        onPress={() => setActiveSection('payment')}
                        style={({ pressed }) => [
                          styles.nextStepBtn,
                          { opacity: pressed ? 0.88 : 1 },
                        ]}
                      >
                        <Text style={styles.nextStepBtnText}>Next: Review & Pay</Text>
                        <Feather name="arrow-right" size={16} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ) : null}

                  {/* ── PAYMENT & SUMMARY SECTION ─────────────────── */}
                  {activeSection === 'payment' ? (
                    <View style={styles.sectionBlock}>
                      {/* Booking summary card */}
                      <View style={styles.summaryCard}>
                        <Text style={styles.summarySectionLabel}>Booking Summary</Text>
                        <View style={styles.summaryRow}>
                          <Feather name="calendar" size={14} color="#717171" />
                          <Text style={styles.summaryLabel}>Dates</Text>
                          <Text style={styles.summaryValue}>
                            {from ? `${fmtShort(from)} → ${to ? fmtFull(to) : 'Flexible'}` : 'Not selected'}
                          </Text>
                        </View>
                        <View style={styles.summaryRow}>
                          <Feather name="users" size={14} color="#717171" />
                          <Text style={styles.summaryLabel}>Guests</Text>
                          <Text style={styles.summaryValue}>{guestSummary}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                          <Feather name="map-pin" size={14} color="#717171" />
                          <Text style={styles.summaryLabel}>Location</Text>
                          <Text style={styles.summaryValue} numberOfLines={1}>
                            {exp?.location ?? 'Kenya Coast'}
                          </Text>
                        </View>
                      </View>

                      {/* Price Breakdown */}
                      {price != null && from ? (
                        <PriceBreakdown
                          pricePerUnit={price}
                          priceUnit={priceUnit}
                          units={units}
                          isNightBased={isNightBased}
                        />
                      ) : null}

                      {/* Payment method selector */}
                      <View style={styles.methodBlock}>
                        <Text style={styles.sectionTitle}>Payment Method</Text>
                        <View style={styles.methodRow}>
                          {price != null ? (
                            <Pressable
                              testID="method-mpesa"
                              onPress={() => setMethod('mpesa')}
                              style={[
                                styles.methodCard,
                                method === 'mpesa' && styles.methodCardActive,
                              ]}
                            >
                              <Feather
                                name="smartphone"
                                size={18}
                                color={method === 'mpesa' ? ORANGE : '#9CA3AF'}
                              />
                              <Text
                                style={[
                                  styles.methodTitle,
                                  method === 'mpesa' && { color: ORANGE },
                                ]}
                              >
                                M-Pesa
                              </Text>
                              <Text style={styles.methodSub}>STK push</Text>
                            </Pressable>
                          ) : null}
                          <Pressable
                            testID="method-reserve"
                            onPress={() => setMethod('reserve')}
                            style={[
                              styles.methodCard,
                              method === 'reserve' && styles.methodCardActive,
                            ]}
                          >
                            <Feather
                              name="clock"
                              size={18}
                              color={method === 'reserve' ? ORANGE : '#9CA3AF'}
                            />
                            <Text
                              style={[
                                styles.methodTitle,
                                method === 'reserve' && { color: ORANGE },
                              ]}
                            >
                              Reserve
                            </Text>
                            <Text style={styles.methodSub}>Pay later</Text>
                          </Pressable>
                        </View>
                      </View>

                      {/* M-Pesa phone input */}
                      {method === 'mpesa' ? (
                        <View style={styles.mpesaCard}>
                          <Text style={styles.mpesaLabel}>M-PESA PHONE NUMBER</Text>
                          <TextInput
                            testID="mpesa-phone"
                            value={mpesaPhone}
                            onChangeText={setMpesaPhone}
                            placeholder="e.g. 0712345678"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="phone-pad"
                            style={styles.mpesaInput}
                            editable={!busy}
                          />
                          <Text style={styles.mpesaHint}>
                            An STK PIN prompt will be sent directly to your phone.
                          </Text>
                        </View>
                      ) : null}

                      {/* Escrow trust notice */}
                      <View style={styles.escrow}>
                        <MaterialCommunityIcons name="shield-check" size={18} color="#10B981" />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={styles.escrowTitle}>ZURU SECURE ESCROW</Text>
                          <Text style={styles.escrowBody}>
                            Your payment is held by ZuruSasa and only released to the host after you confirm receipt of the service.
                          </Text>
                        </View>
                      </View>

                      {/* Cancellation policy */}
                      <View style={styles.cancellationRow}>
                        <Feather name="refresh-ccw" size={13} color="#717171" />
                        <Text style={styles.cancellationText}>
                          Free cancellation within 24 hours of booking.
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {/* ── STICKY CONFIRM BUTTON ─────────────────────── */}
                  {activeSection === 'payment' ? (
                    <View style={styles.footerBlock}>
                      <Pressable
                        testID="booking-confirm"
                        onPress={handleConfirm}
                        disabled={!from || busy}
                        style={({ pressed }) => [
                          styles.confirmBtn,
                          { opacity: !from ? 0.5 : pressed ? 0.88 : 1 },
                        ]}
                      >
                        {busy ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Feather name="check-circle" size={18} color="#FFFFFF" />
                        )}
                        <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
                      </Pressable>

                      {phase === 'pin' ? (
                        <Text style={styles.footNote}>
                          Enter your M-Pesa PIN on your phone — keep this screen open while we confirm.
                        </Text>
                      ) : !user ? (
                        <Text style={styles.footNote}>
                          You'll be asked to sign in before confirming.
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '92%',
  },
  dragHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginTop: 10,
    marginBottom: 4,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 50,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Hero ───────────────────────────────────────────────────────────────────
  hero: {
    height: 190,
    justifyContent: 'flex-end',
  },
  heroContent: {
    padding: 16,
    paddingBottom: 14,
    gap: 4,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(242,101,34,0.85)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    textTransform: 'capitalize',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 27,
    fontFamily: 'DMSans_700Bold',
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
  },
  heroPrice: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  plainHeader: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 4,
    gap: 6,
  },
  plainTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
    paddingRight: 44,
  },
  plainSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },

  // ── Body ───────────────────────────────────────────────────────────────────
  body: {
    padding: 20,
    gap: 18,
  },

  // ── Section tabs ───────────────────────────────────────────────────────────
  sectionTabs: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 4,
    gap: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 11,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_500Medium',
    color: '#9CA3AF',
  },
  tabTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },

  // ── Section blocks ─────────────────────────────────────────────────────────
  sectionBlock: {
    gap: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },

  // ── Date section ───────────────────────────────────────────────────────────
  dateSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  datePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ORANGE,
    backgroundColor: '#FFFBF8',
  },
  datePillEmpty: {
    borderColor: '#EBEBEB',
    backgroundColor: '#F9FAFB',
  },
  datePillText: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },
  dateHint: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
  nightsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFBF8',
    borderWidth: 1,
    borderColor: '#FCE3D6',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'center',
  },
  nightsBadgeText: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },
  clearDatesBtn: {
    marginLeft: 8,
    paddingHorizontal: 8,
  },
  clearDatesText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#9CA3AF',
    textDecorationLine: 'underline',
  },

  // ── Next step button ───────────────────────────────────────────────────────
  nextStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#222222',
    marginTop: 4,
  },
  nextStepBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },

  // ── Booking summary card ────────────────────────────────────────────────────
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    backgroundColor: '#F9FAFB',
    padding: 16,
    gap: 10,
  },
  summarySectionLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
    width: 68,
  },
  summaryValue: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },

  // ── Method ─────────────────────────────────────────────────────────────────
  methodBlock: {
    gap: 10,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  methodCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  methodCardActive: {
    borderColor: ORANGE,
    backgroundColor: '#FFFBF8',
  },
  methodTitle: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  methodSub: {
    fontSize: 10.5,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },

  // ── M-Pesa ─────────────────────────────────────────────────────────────────
  mpesaCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 14,
    gap: 8,
    backgroundColor: '#F9FAFB',
  },
  mpesaLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: '#9CA3AF',
    letterSpacing: 1.2,
  },
  mpesaInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    color: '#111827',
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
  },
  mpesaHint: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },

  // ── Escrow ─────────────────────────────────────────────────────────────────
  escrow: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#10B98110',
    borderWidth: 1,
    borderColor: '#10B98130',
    borderRadius: 16,
    padding: 14,
    alignItems: 'flex-start',
  },
  escrowTitle: {
    color: '#10B981',
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 1,
  },
  escrowBody: {
    color: '#065F46',
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: 'DMSans_400Regular',
  },
  cancellationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cancellationText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },

  // ── Footer confirm ─────────────────────────────────────────────────────────
  footerBlock: {
    gap: 10,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  footNote: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
    textAlign: 'center',
  },

  // ── Success ────────────────────────────────────────────────────────────────
  successWrap: {
    paddingHorizontal: 28,
    paddingTop: 48,
    alignItems: 'center',
    gap: 14,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B98115',
    borderWidth: 1.5,
    borderColor: '#10B98140',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 26,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
    textAlign: 'center',
  },
  successBody: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'DMSans_400Regular',
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 8,
  },
});
