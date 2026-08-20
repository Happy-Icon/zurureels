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
import { useExperienceBlockedDates } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import type { ReelRow } from '@/lib/supabase';
import { AvailabilityCalendar } from '@/components/booking/AvailabilityCalendar';
import { GuestSelector, type GuestCounts } from '@/components/booking/GuestSelector';
import { PriceBreakdown } from '@/components/booking/PriceBreakdown';
import { useColors, useTheme } from '@/hooks/useColors';

const ORANGE = '#F26522';
const DAY_MS = 86_400_000;

function generateUUID(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
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
  const busy = phase === 'sending' || phase === 'pin';
  const { data: blockedDateRows = [] } = useExperienceBlockedDates(exp?.id);
  const blockedRanges = useMemo(() => blockedDateRows.map((block) => ({
    from: new Date(`${block.start_date}T00:00:00`),
    to: new Date(`${block.end_date}T00:00:00`),
  })), [blockedDateRows]);

  // ── Polling & Realtime ref ───────────────────────────────────────────────
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeChannelRef = useRef<any>(null);

  const cleanupPaymentListeners = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
  };

  useEffect(() => () => cleanupPaymentListeners(), []);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetState = () => {
    setFrom(undefined);
    setTo(undefined);
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setGuests({ adults: 1, children: 0, infants: 0, pets: 0 });
    setMpesaPhone('');
    setPhase('idle');
    setActiveSection('dates');
  };

  const handleClose = () => {
    cleanupPaymentListeners();
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

  // ── Secure Server-Owned Paystack Payment Flow ─────────────────────────────
  const startStkFlow = async () => {
    const experienceId = exp?.id || reel.experience_id;
    if (!from) return;
    if (!experienceId) {
      Alert.alert('Listing unavailable', "This experience listing details are incomplete.");
      return;
    }
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
      // 1. Server calculates quote (locking listing & computing KES minor units)
      const checkInDate = new Date(from);
      checkInDate.setHours(12, 0, 0, 0);

      const checkOutDate = to ? new Date(to) : addDays(from, 1);
      checkOutDate.setHours(11, 0, 0, 0);

      const quoteIdempotencyKey = generateUUID();
      const { data: quote, error: quoteError } = await supabase.rpc('create_booking_quote', {
        p_experience_id: experienceId,
        p_check_in: checkInDate.toISOString(),
        p_check_out: checkOutDate.toISOString(),
        p_guest_count: Math.max(1, totalGuests),
        p_idempotency_key: quoteIdempotencyKey,
      });

      if (quoteError || !quote) {
        console.error('create_booking_quote RPC error:', quoteError);
        throw new Error(quoteError?.message ?? 'Failed to prepare booking quote');
      }

      // 2. Initiate Paystack charge using server-owned amount & reference
      const paymentIdempotencyKey = generateUUID();
      const { data, error } = await supabase.functions.invoke('create-booking-payment', {
        body: {
          quoteId: quote.id,
          phone,
          idempotencyKey: paymentIdempotencyKey,
        },
      });

      if (error) {
        let errorMessage = error.message;
        try {
          if ('context' in error && error.context) {
            const errBody = await (error.context as Response).json();
            if (errBody?.error) errorMessage = errBody.error;
          }
        } catch {}
        throw new Error(errorMessage || 'Failed to initiate payment');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const attemptId: string | undefined = data?.attemptId;
      if (!attemptId) throw new Error('Payment attempt could not be created');

      setPhase('pin');

      // 3. Instant Realtime Subscription for Webhook Confirmation
      const channel = supabase
        .channel(`pay_status_${attemptId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payment_attempts',
            filter: `id=eq.${attemptId}`,
          },
          (payload) => {
            const paStatus = (payload.new as any)?.status;
            if (paStatus === 'succeeded') {
              cleanupPaymentListeners();
              queryClient.invalidateQueries({ queryKey: ['bookings'] });
              setPhase('success');
            } else if (paStatus === 'failed' || paStatus === 'cancelled' || paStatus === 'expired') {
              cleanupPaymentListeners();
              setPhase('idle');
              Alert.alert('Payment failed', 'The M-Pesa payment was cancelled or declined.');
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'bookings',
            filter: `quote_id=eq.${quote.id}`,
          },
          (payload) => {
            const bStatus = (payload.new as any)?.status;
            if (bStatus === 'paid' || bStatus === 'confirmed') {
              cleanupPaymentListeners();
              queryClient.invalidateQueries({ queryKey: ['bookings'] });
              setPhase('success');
            }
          },
        )
        .subscribe();

      realtimeChannelRef.current = channel;

      // 4. Polling fallback (every 3s for 20 attempts = 60s)
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;

        // Check if booking was settled authoritatively by server webhook
        const { data: b } = await supabase
          .from('bookings')
          .select('id, status')
          .eq('quote_id', quote.id)
          .maybeSingle();

        if (b?.status === 'paid' || b?.status === 'confirmed') {
          cleanupPaymentListeners();
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          setPhase('success');
          return;
        }

        // Check payment attempt status
        const { data: pa } = await supabase
          .from('payment_attempts')
          .select('status')
          .eq('id', attemptId)
          .maybeSingle();

        if (pa?.status === 'failed' || pa?.status === 'cancelled' || pa?.status === 'expired') {
          cleanupPaymentListeners();
          setPhase('idle');
          Alert.alert('Payment failed', 'The M-Pesa payment was cancelled or declined.');
          return;
        }

        if (attempts >= 20) {
          cleanupPaymentListeners();
          setPhase('idle');
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          Alert.alert(
            'Still processing',
            'Payment confirmation is taking longer than expected. We will update your booking once the network confirms it — check My Bookings.',
          );
          handleDone();
        }
      }, 3000);
    } catch (err) {
      setPhase('idle');
      Alert.alert('Payment failed', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const handleConfirm = () => {
    if (!user) {
      handleClose();
      router.push('/auth');
      return;
    }
    if (!from || busy) return;
    startStkFlow();
  };

  const confirmLabel =
    phase === 'pin'
      ? 'Waiting for M-Pesa PIN…'
      : phase === 'sending'
        ? 'Sending STK push…'
        : 'Confirm & Pay';

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
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={handleClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <View style={[styles.sheet, { backgroundColor: colors.card }]} testID="booking-sheet">
            {/* Drag handle */}
            <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />

            {/* Close button */}
            <Pressable
              testID="booking-close"
              onPress={handleClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}
              hitSlop={8}
            >
              <Feather name="x" size={18} color={colors.text} />
            </Pressable>

            {/* ── SUCCESS STATE ──────────────────────────────────────── */}
            {phase === 'success' ? (
              <View style={[styles.successWrap, { paddingBottom: insets.bottom + 24 }]}>
                <View style={styles.successCircle}>
                  <Feather name="check" size={36} color="#10B981" />
                </View>
                <Text style={[styles.successTitle, { color: colors.text }]}>
                  Payment Received! 🎉
                </Text>
                <Text style={[styles.successBody, { color: colors.mutedForeground }]}>
                  {`Your payment for ${title} is secure. The host will confirm your reservation shortly.`}
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
                    <Text style={[styles.plainTitle, { color: colors.text }]}>{title}</Text>
                    {exp?.location ? (
                      <View style={styles.heroMetaItem}>
                        <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                        <Text style={[styles.plainSub, { color: colors.mutedForeground }]}>{exp.location}</Text>
                      </View>
                    ) : null}
                  </View>
                )}

                <View style={styles.body}>

                  {/* ── SECTION TABS ──────────────────────────────── */}
                  <View style={[styles.sectionTabs, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
                    {(['dates', 'guests', 'payment'] as const).map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => setActiveSection(s)}
                        style={[
                          styles.tab,
                          activeSection === s && [styles.tabActive, { backgroundColor: colors.card }],
                        ]}
                      >
                        <Text
                          style={[
                            styles.tabText,
                            { color: colors.mutedForeground },
                            activeSection === s && [styles.tabTextActive, { color: colors.text }],
                          ]}
                        >
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* ── DATES SECTION ─────────────────────────────── */}
                  {activeSection === 'dates' ? (
                    <View style={styles.sectionBlock}>
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Dates</Text>

                      {/* Selected date pill summary */}
                      {from ? (
                        <View style={styles.dateSummaryRow}>
                          <View style={[styles.datePill, { backgroundColor: isDark ? '#2A1810' : '#FFFBF8' }]}>
                            <Feather name="log-in" size={13} color={ORANGE} />
                            <Text style={styles.datePillText}>{fmtShort(from)}</Text>
                          </View>
                          <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
                          <View
                            style={[
                              styles.datePill,
                              to
                                ? { backgroundColor: isDark ? '#2A1810' : '#FFFBF8' }
                                : [styles.datePillEmpty, { backgroundColor: isDark ? '#27272A' : '#F9FAFB', borderColor: colors.border }],
                            ]}
                          >
                            <Feather name="log-out" size={13} color={to ? ORANGE : colors.mutedForeground} />
                            <Text style={[styles.datePillText, !to && { color: colors.mutedForeground }]}>
                              {to ? fmtShort(to) : 'End date'}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <Text style={[styles.dateHint, { color: colors.mutedForeground }]}>
                          Tap a date to set your check-in, then tap another for checkout.
                        </Text>
                      )}

                      <AvailabilityCalendar
                        startDate={from}
                        endDate={to}
                        viewMonth={viewMonth}
                        blockedRanges={blockedRanges}
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
                        <View
                          style={[
                            styles.nightsBadge,
                            { backgroundColor: isDark ? '#2A1810' : '#FFFBF8', borderColor: isDark ? '#5C2D16' : '#FCE3D6' },
                          ]}
                        >
                          <Feather name="moon" size={13} color={ORANGE} />
                          <Text style={styles.nightsBadgeText}>
                            {nights} night{nights !== 1 ? 's' : ''}
                          </Text>
                          <Pressable
                            onPress={() => { setFrom(undefined); setTo(undefined); }}
                            style={styles.clearDatesBtn}
                          >
                            <Text style={[styles.clearDatesText, { color: colors.mutedForeground }]}>Clear</Text>
                          </Pressable>
                        </View>
                      ) : null}

                      {from ? (
                        <Pressable
                          onPress={() => setActiveSection('guests')}
                          style={({ pressed }) => [
                            styles.nextStepBtn,
                            { backgroundColor: isDark ? '#333338' : '#222222', opacity: pressed ? 0.88 : 1 },
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
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>Who's Coming?</Text>
                      <GuestSelector
                        guests={guests}
                        maxGuests={20}
                        onChange={setGuests}
                      />
                      <Pressable
                        onPress={() => setActiveSection('payment')}
                        style={({ pressed }) => [
                          styles.nextStepBtn,
                          { backgroundColor: isDark ? '#333338' : '#222222', opacity: pressed ? 0.88 : 1 },
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
                      <View style={[styles.summaryCard, { backgroundColor: isDark ? '#27272A' : '#F9FAFB', borderColor: colors.border }]}>
                        <Text style={styles.summarySectionLabel}>Booking Summary</Text>
                        <View style={styles.summaryRow}>
                          <Feather name="calendar" size={14} color={colors.mutedForeground} />
                          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Dates</Text>
                          <Text style={[styles.summaryValue, { color: colors.text }]}>
                            {from ? `${fmtShort(from)} → ${to ? fmtFull(to) : 'Flexible'}` : 'Not selected'}
                          </Text>
                        </View>
                        <View style={styles.summaryRow}>
                          <Feather name="users" size={14} color={colors.mutedForeground} />
                          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Guests</Text>
                          <Text style={[styles.summaryValue, { color: colors.text }]}>{guestSummary}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                          <Feather name="map-pin" size={14} color={colors.mutedForeground} />
                          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Location</Text>
                          <Text style={[styles.summaryValue, { color: colors.text }]} numberOfLines={1}>
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

                      <View style={styles.methodBlock}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Method</Text>
                        <View
                          style={[
                            styles.methodCard,
                            styles.methodCardActive,
                            { backgroundColor: isDark ? '#2A1810' : '#FFFBF8', borderColor: ORANGE },
                          ]}
                        >
                          <Feather name="smartphone" size={18} color={ORANGE} />
                          <Text style={[styles.methodTitle, { color: ORANGE }]}>M-Pesa</Text>
                          <Text style={[styles.methodSub, { color: colors.mutedForeground }]}>Secure STK push</Text>
                        </View>
                      </View>

                      {/* M-Pesa phone input */}
                      <View style={[styles.mpesaCard, { backgroundColor: isDark ? '#27272A' : '#F9FAFB', borderColor: colors.border }]}>
                          <Text style={styles.mpesaLabel}>M-PESA PHONE NUMBER</Text>
                          <TextInput
                            testID="mpesa-phone"
                            value={mpesaPhone}
                            onChangeText={setMpesaPhone}
                            placeholder="e.g. 0712345678"
                            placeholderTextColor={colors.mutedForeground}
                            keyboardType="phone-pad"
                            style={[
                              styles.mpesaInput,
                              { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                            ]}
                            editable={!busy}
                          />
                          <Text style={[styles.mpesaHint, { color: colors.mutedForeground }]}>
                            An STK PIN prompt will be sent directly to your phone.
                          </Text>
                      </View>

                      {/* Escrow trust notice */}
                      <View
                        style={[
                          styles.escrow,
                          { backgroundColor: isDark ? '#064E3B20' : '#10B98110', borderColor: isDark ? '#05966940' : '#10B98130' },
                        ]}
                      >
                        <MaterialCommunityIcons name="shield-check" size={18} color="#10B981" />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={styles.escrowTitle}>ZURU SECURE ESCROW</Text>
                          <Text style={[styles.escrowBody, { color: isDark ? '#A7F3D0' : '#065F46' }]}>
                            Your payment is held by ZuruSasa and only released to the host after you confirm receipt of the service.
                          </Text>
                        </View>
                      </View>

                      {/* Cancellation policy */}
                      <View style={styles.cancellationRow}>
                        <Feather name="refresh-ccw" size={13} color={colors.mutedForeground} />
                        <Text style={[styles.cancellationText, { color: colors.mutedForeground }]}>
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
                        <Text style={[styles.footNote, { color: colors.mutedForeground }]}>
                          Enter your M-Pesa PIN on your phone — keep this screen open while we confirm.
                        </Text>
                      ) : !user ? (
                        <Text style={[styles.footNote, { color: colors.mutedForeground }]}>
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
