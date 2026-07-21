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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useCreateBooking } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import type { ReelRow } from '@/lib/supabase';

const ORANGE = '#EE7D30';

// Same palette as ReelCard categoryColors (web parity)
const CATEGORY_COLORS: Record<string, string> = {
  hotel: '#3B82F6E6',
  villa: '#10B981E6',
  boats: '#06B6D4E6',
  tours: '#F59E0BE6',
  events: '#A855F7E6',
  apartment: '#6366F1E6',
  food: '#F97316E6',
  drinks: '#EC4899E6',
  rentals: '#14B8A6E6',
  adventure: '#EF4444E6',
  parks_camps: '#16A34AE6',
  land_adventure: '#D97706E6',
  air_adventure: '#0EA5E9E6',
  water_adventure: '#2563EBE6',
};

// ---- Tiny date helpers (avoids a date-fns dependency) ----

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_MS = 86_400_000;

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

interface BookingSheetProps {
  reel: ReelRow;
  visible: boolean;
  onClose: () => void;
  /** Called after a booking was created (paid or requested). */
  onSuccess?: () => void;
}

type Phase = 'idle' | 'sending' | 'pin' | 'success';

export function BookingSheet({
  reel,
  visible,
  onClose,
  onSuccess,
}: BookingSheetProps) {
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
  const categoryColor = category
    ? (CATEGORY_COLORS[category] ?? `${ORANGE}E6`)
    : `${ORANGE}E6`;
  const price = exp?.current_price != null ? Number(exp.current_price) : null;
  const priceUnit = exp?.price_unit ?? 'person';
  const hostId = reel.user_id ?? null;

  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = useMemo(() => addDays(today, 365), [today]);

  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [guests, setGuests] = useState(1);
  const [method, setMethod] = useState<'mpesa' | 'reserve'>(
    price != null ? 'mpesa' : 'reserve',
  );
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [successKind, setSuccessKind] = useState<'paid' | 'requested'>('paid');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  useEffect(() => stopPolling, []);

  // Web parity: nights for stays, guests for everything else
  const isNightBased = ['hotel', 'villa', 'apartment'].includes(category);
  const nights =
    from && to
      ? Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS))
      : 1;
  const units = isNightBased ? nights : guests;
  const total = (price ?? 0) * units;
  const busy = phase === 'sending' || phase === 'pin';

  const resetState = () => {
    setFrom(undefined);
    setTo(undefined);
    setShowCalendar(false);
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setGuests(1);
    setMethod(price != null ? 'mpesa' : 'reserve');
    setMpesaPhone('');
    setPhase('idle');
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

  // ---- Calendar ----

  const monthCells = useMemo(() => {
    const y = viewMonth.getFullYear();
    const m = viewMonth.getMonth();
    const lead = new Date(y, m, 1).getDay();
    const count = new Date(y, m + 1, 0).getDate();
    const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= count; d++) cells.push(new Date(y, m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  const canPrev =
    viewMonth.getFullYear() > today.getFullYear() ||
    viewMonth.getMonth() > today.getMonth();
  const canNext =
    viewMonth.getFullYear() < maxDate.getFullYear() ||
    (viewMonth.getFullYear() === maxDate.getFullYear() &&
      viewMonth.getMonth() < maxDate.getMonth());

  const onDayPress = (day: Date) => {
    Haptics.selectionAsync();
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
    setShowCalendar(false);
  };

  // ---- Confirm ----

  const startStkFlow = async () => {
    if (!from) return;
    if (!hostId) {
      Alert.alert(
        'Host unavailable',
        "This listing doesn't have a host configured yet.",
      );
      return;
    }

    // Same normalisation rules as the web checkout
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
      const { data, error } = await supabase.functions.invoke(
        'initiate-paystack-stk',
        {
          body: {
            phone,
            amount: total,
            experience_id: exp!.id,
            trip_title: title,
            guests,
            check_in: from.toISOString(),
            check_out: (to ?? addDays(from, 1)).toISOString(),
          },
        },
      );
      if (error || data?.error) {
        throw new Error(
          (data?.error as string) ?? error?.message ?? 'Failed to initiate payment',
        );
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
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          setSuccessKind('paid');
          setPhase('success');
        } else if (b?.status === 'failed') {
          stopPolling();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPhase('idle');
      Alert.alert(
        'Payment failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
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
        amount: price != null ? total : null,
        guests,
        checkIn: from.toISOString(),
        checkOut: (to ?? addDays(from, 1)).toISOString(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccessKind('requested');
      setPhase('success');
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPhase('idle');
      Alert.alert(
        'Booking failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
    }
  };

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <View style={styles.sheet} testID="booking-sheet">
            {/* Dismiss */}
            <Pressable
              testID="booking-close"
              onPress={handleClose}
              style={styles.dismiss}
              hitSlop={8}
            >
              <Feather name="chevron-down" size={22} color="#ffffff" />
            </Pressable>

            {phase === 'success' ? (
              <View style={[styles.successWrap, { paddingBottom: insets.bottom + 24 }]}>
                <View style={styles.successCircle}>
                  <Feather name="check" size={40} color="#10b981" />
                </View>
                <Text style={styles.successTitle}>
                  {successKind === 'paid' ? 'Booking Confirmed!' : 'Request Sent!'}
                </Text>
                <Text style={styles.successBody}>
                  {successKind === 'paid'
                    ? `Payment received — you're all set for ${title}. Find your receipt in Transactions & Receipts.`
                    : `Your request for ${title} is with the host. Track it anytime in Transactions & Receipts.`}
                </Text>
                <Pressable
                  testID="booking-done"
                  onPress={handleDone}
                  style={({ pressed }) => [
                    styles.confirmButton,
                    { alignSelf: 'stretch', opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={styles.confirmText}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                keyboardShouldPersistTaps="handled"
              >
                {/* Hero */}
                {reel.thumbnail_url ? (
                  <View style={styles.hero}>
                    <Image
                      source={{ uri: reel.thumbnail_url }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.75)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.heroContent}>
                      {reel.category ? (
                        <View style={[styles.categoryPill, { backgroundColor: categoryColor }]}>
                          <Text style={styles.categoryText}>
                            {reel.category.replace(/_/g, ' ')}
                          </Text>
                        </View>
                      ) : null}
                      <Text style={styles.heroTitle} numberOfLines={2}>
                        {title}
                      </Text>
                      <View style={styles.heroMetaRow}>
                        {exp?.location ? (
                          <View style={styles.heroMeta}>
                            <Feather name="map-pin" size={11} color="rgba(255,255,255,0.85)" />
                            <Text style={styles.heroMetaText} numberOfLines={1}>
                              {exp.location}
                            </Text>
                          </View>
                        ) : null}
                        <View style={styles.heroMeta}>
                          <MaterialCommunityIcons name="star" size={12} color="#facc15" />
                          <Text style={styles.heroMetaText}>{rating.toFixed(1)}</Text>
                        </View>
                        {price != null ? (
                          <View style={styles.heroMeta}>
                            <Text style={styles.heroMetaText}>
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
                    <View style={styles.heroMetaRow}>
                      {exp?.location ? (
                        <View style={styles.heroMeta}>
                          <Feather name="map-pin" size={11} color="#a3998f" />
                          <Text style={styles.plainMetaText}>{exp.location}</Text>
                        </View>
                      ) : null}
                      <View style={styles.heroMeta}>
                        <MaterialCommunityIcons name="star" size={12} color="#facc15" />
                        <Text style={styles.plainMetaText}>{rating.toFixed(1)}</Text>
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.body}>
                  {/* Dates */}
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Select Dates</Text>
                    <Pressable
                      testID="booking-dates"
                      onPress={() => {
                        Haptics.selectionAsync();
                        setShowCalendar(!showCalendar);
                      }}
                      style={({ pressed }) => [
                        styles.fieldRow,
                        pressed ? { backgroundColor: 'rgba(255,255,255,0.05)' } : null,
                      ]}
                    >
                      <View style={styles.fieldLeft}>
                        <Feather name="calendar" size={16} color={ORANGE} />
                        {from ? (
                          <Text style={styles.fieldText}>
                            {fmtShort(from)}
                            {to ? ` → ${fmtFull(to)}` : ' → End date?'}
                          </Text>
                        ) : (
                          <Text style={styles.fieldPlaceholder}>Choose your dates</Text>
                        )}
                      </View>
                      <Feather
                        name={showCalendar ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color="#a3998f"
                      />
                    </Pressable>

                    {showCalendar ? (
                      <View style={styles.calendar}>
                        <View style={styles.calHeader}>
                          <Pressable
                            onPress={() => {
                              if (!canPrev) return;
                              Haptics.selectionAsync();
                              setViewMonth(
                                new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
                              );
                            }}
                            hitSlop={8}
                            style={[styles.calNav, !canPrev ? { opacity: 0.3 } : null]}
                          >
                            <Feather name="chevron-left" size={18} color="#f4f2f1" />
                          </Pressable>
                          <Text style={styles.calMonth}>
                            {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                          </Text>
                          <Pressable
                            onPress={() => {
                              if (!canNext) return;
                              Haptics.selectionAsync();
                              setViewMonth(
                                new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
                              );
                            }}
                            hitSlop={8}
                            style={[styles.calNav, !canNext ? { opacity: 0.3 } : null]}
                          >
                            <Feather name="chevron-right" size={18} color="#f4f2f1" />
                          </Pressable>
                        </View>

                        <View style={styles.calWeekRow}>
                          {WEEKDAYS.map((w, i) => (
                            <Text key={`${w}-${i}`} style={styles.calWeekday}>
                              {w}
                            </Text>
                          ))}
                        </View>

                        <View style={styles.calGrid}>
                          {monthCells.map((day, i) => {
                            if (!day) {
                              return <View key={i} style={styles.calCell} />;
                            }
                            const t = day.getTime();
                            const disabled = t < today.getTime() || t > maxDate.getTime();
                            const isStart = from ? t === from.getTime() : false;
                            const isEnd = to ? t === to.getTime() : false;
                            const inRange =
                              from && to ? t > from.getTime() && t < to.getTime() : false;
                            return (
                              <View key={i} style={styles.calCell}>
                                {inRange ? <View style={styles.calRangeBand} /> : null}
                                <Pressable
                                  disabled={disabled}
                                  onPress={() => onDayPress(day)}
                                  style={[
                                    styles.calDay,
                                    isStart || isEnd
                                      ? { backgroundColor: ORANGE }
                                      : null,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.calDayText,
                                      disabled ? { color: 'rgba(244,242,241,0.25)' } : null,
                                      isStart || isEnd
                                        ? { color: '#ffffff', fontFamily: 'DMSans_700Bold' }
                                        : null,
                                      inRange ? { color: '#ffd9bd' } : null,
                                    ]}
                                  >
                                    {day.getDate()}
                                  </Text>
                                </Pressable>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {/* Guests */}
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Guests</Text>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldLeft}>
                        <Feather name="users" size={16} color={ORANGE} />
                        <Text style={styles.fieldText}>
                          {guests} Guest{guests > 1 ? 's' : ''}
                        </Text>
                      </View>
                      <View style={styles.stepper}>
                        <Pressable
                          testID="guest-minus"
                          disabled={guests <= 1}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setGuests(Math.max(1, guests - 1));
                          }}
                          style={[styles.stepBtn, guests <= 1 ? { opacity: 0.35 } : null]}
                        >
                          <Feather name="minus" size={15} color="#f4f2f1" />
                        </Pressable>
                        <Text style={styles.stepCount}>{guests}</Text>
                        <Pressable
                          testID="guest-plus"
                          disabled={guests >= 20}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setGuests(Math.min(20, guests + 1));
                          }}
                          style={[styles.stepBtn, guests >= 20 ? { opacity: 0.35 } : null]}
                        >
                          <Feather name="plus" size={15} color="#f4f2f1" />
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {from ? (
                    <>
                      {/* Payment method */}
                      <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Payment Method</Text>
                        <View style={styles.methodRow}>
                          {price != null ? (
                            <Pressable
                              testID="method-mpesa"
                              onPress={() => {
                                Haptics.selectionAsync();
                                setMethod('mpesa');
                              }}
                              style={[
                                styles.methodCard,
                                method === 'mpesa' ? styles.methodActive : null,
                              ]}
                            >
                              <Feather
                                name="smartphone"
                                size={17}
                                color={method === 'mpesa' ? ORANGE : '#a3998f'}
                              />
                              <Text
                                style={[
                                  styles.methodTitle,
                                  method === 'mpesa' ? { color: ORANGE } : null,
                                ]}
                              >
                                M-Pesa
                              </Text>
                              <Text style={styles.methodSub}>STK push to your phone</Text>
                            </Pressable>
                          ) : null}
                          <Pressable
                            testID="method-reserve"
                            onPress={() => {
                              Haptics.selectionAsync();
                              setMethod('reserve');
                            }}
                            style={[
                              styles.methodCard,
                              method === 'reserve' ? styles.methodActive : null,
                            ]}
                          >
                            <Feather
                              name="clock"
                              size={17}
                              color={method === 'reserve' ? ORANGE : '#a3998f'}
                            />
                            <Text
                              style={[
                                styles.methodTitle,
                                method === 'reserve' ? { color: ORANGE } : null,
                              ]}
                            >
                              Reserve
                            </Text>
                            <Text style={styles.methodSub}>Request now, pay later</Text>
                          </Pressable>
                        </View>
                      </View>

                      {method === 'mpesa' ? (
                        <View style={styles.mpesaCard}>
                          <Text style={styles.mpesaLabel}>M-PESA PHONE NUMBER</Text>
                          <TextInput
                            testID="mpesa-phone"
                            value={mpesaPhone}
                            onChangeText={setMpesaPhone}
                            placeholder="e.g. 0712345678"
                            placeholderTextColor="#7e7367"
                            keyboardType="phone-pad"
                            style={styles.mpesaInput}
                            editable={!busy}
                          />
                          <Text style={styles.mpesaHint}>
                            An STK PIN prompt will be sent directly to your phone.
                          </Text>
                        </View>
                      ) : null}

                      {/* Price breakdown */}
                      {price != null ? (
                        <View style={styles.summaryCard}>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryMuted}>
                              KES {price.toLocaleString()} ×{' '}
                              {isNightBased
                                ? `${nights} night${nights > 1 ? 's' : ''}`
                                : `${guests} guest${guests > 1 ? 's' : ''}`}
                            </Text>
                            <Text style={styles.summaryMuted}>
                              KES {total.toLocaleString()}
                            </Text>
                          </View>
                          <View style={styles.divider} />
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryTotal}>Total</Text>
                            <Text style={[styles.summaryTotal, { color: ORANGE }]}>
                              KES {total.toLocaleString()}
                            </Text>
                          </View>
                        </View>
                      ) : null}
                    </>
                  ) : null}

                  {/* Escrow trust notice */}
                  <View style={styles.escrow}>
                    <MaterialCommunityIcons name="shield-check" size={19} color="#10b981" />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.escrowTitle}>ZURU SECURE ESCROW</Text>
                      <Text style={styles.escrowBody}>
                        Your payment is held by ZuruSasa and only released to the host
                        after you confirm receipt of the service. Book here to stay fully
                        protected.
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    testID="booking-confirm"
                    onPress={handleConfirm}
                    disabled={!from || busy}
                    style={({ pressed }) => [
                      styles.confirmButton,
                      { opacity: !from ? 0.5 : pressed ? 0.85 : 1 },
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Feather name="check-circle" size={17} color="#ffffff" />
                    )}
                    <Text style={styles.confirmText}>{confirmLabel}</Text>
                  </Pressable>

                  {phase === 'pin' ? (
                    <Text style={styles.footNote}>
                      Enter your M-Pesa PIN on your phone — keep this open while we
                      confirm your payment.
                    </Text>
                  ) : !user ? (
                    <Text style={styles.footNote}>
                      You'll be asked to sign in to confirm your booking.
                    </Text>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#17140f',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    maxHeight: '100%',
  },
  dismiss: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 40,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    height: 180,
    justifyContent: 'flex-end',
  },
  heroContent: {
    padding: 16,
    paddingBottom: 12,
    gap: 4,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 2,
  },
  categoryText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontFamily: 'DMSans_700Bold',
    textTransform: 'capitalize',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 26,
    lineHeight: 30,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11.5,
    fontFamily: 'DMSans_500Medium',
  },
  plainHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 6,
  },
  plainTitle: {
    color: '#f4f2f1',
    fontSize: 26,
    lineHeight: 30,
    fontFamily: 'InstrumentSerif_400Regular',
    paddingRight: 48,
  },
  plainMetaText: {
    color: '#a3998f',
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
  },
  body: {
    padding: 20,
    gap: 18,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    color: '#f4f2f1',
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  fieldLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  fieldText: {
    color: '#f4f2f1',
    fontSize: 13.5,
    fontFamily: 'DMSans_500Medium',
  },
  fieldPlaceholder: {
    color: '#a3998f',
    fontSize: 13.5,
    fontFamily: 'DMSans_400Regular',
  },
  calendar: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  calNav: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  calMonth: {
    color: '#f4f2f1',
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
  },
  calWeekRow: {
    flexDirection: 'row',
  },
  calWeekday: {
    flex: 1,
    textAlign: 'center',
    color: '#a3998f',
    fontSize: 10.5,
    fontFamily: 'DMSans_700Bold',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1.15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calRangeBand: {
    ...StyleSheet.absoluteFillObject,
    marginVertical: 5,
    backgroundColor: 'rgba(238,125,48,0.16)',
  },
  calDay: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayText: {
    color: '#e8e5e3',
    fontSize: 12.5,
    fontFamily: 'DMSans_500Medium',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCount: {
    color: '#f4f2f1',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    minWidth: 16,
    textAlign: 'center',
  },
  methodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  methodCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 3,
  },
  methodActive: {
    borderColor: ORANGE,
    backgroundColor: 'rgba(238,125,48,0.10)',
  },
  methodTitle: {
    color: '#e8e5e3',
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
  },
  methodSub: {
    color: '#a3998f',
    fontSize: 10,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
  mpesaCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  mpesaLabel: {
    color: '#a3998f',
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 1.2,
  },
  mpesaInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: '#17140f',
    color: '#f4f2f1',
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
  },
  mpesaHint: {
    color: '#7e7367',
    fontSize: 10,
    fontFamily: 'DMSans_400Regular',
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryMuted: {
    color: '#a3998f',
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  summaryTotal: {
    color: '#f4f2f1',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  escrow: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(16,185,129,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.18)',
    borderRadius: 16,
    padding: 14,
  },
  escrowTitle: {
    color: '#10b981',
    fontSize: 10.5,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 1,
  },
  escrowBody: {
    color: 'rgba(16,185,129,0.85)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'DMSans_400Regular',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  footNote: {
    color: '#a3998f',
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
  successWrap: {
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: 'center',
    gap: 14,
  },
  successCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(16,185,129,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    color: '#f4f2f1',
    fontSize: 30,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  successBody: {
    color: '#a3998f',
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    marginBottom: 10,
  },
});
