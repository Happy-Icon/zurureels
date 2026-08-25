import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';

import { useAuth } from '@/context/AuthContext';
import { useExperienceBlockedDates } from '@/lib/queries';
import { supabase, type ReelRow } from '@/lib/supabase';
import { reviewService, type ReviewSummaryData } from '@/services/reviewService';
import { CardPaymentModal, type CardDetails } from '@/components/CardPaymentModal';
import { PremiumLoader } from '@/components/PremiumLoader';

const BRAND_ORANGE = '#F26522';
const DAY_MS = 86_400_000;

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface GuestCounts {
  adults: number;
  children: number;
  infants: number;
  pets: number;
}

function startOfDay(d: Date | string): Date {
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

function fmtRange(from: Date, to?: Date): string {
  if (!to) return fmtFull(from);
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    return `${MONTHS_SHORT[from.getMonth()]} ${from.getDate()} – ${to.getDate()}, ${to.getFullYear()}`;
  }
  if (from.getFullYear() === to.getFullYear()) {
    return `${MONTHS_SHORT[from.getMonth()]} ${from.getDate()} – ${MONTHS_SHORT[to.getMonth()]} ${to.getDate()}, ${to.getFullYear()}`;
  }
  return `${fmtFull(from)} – ${fmtFull(to)}`;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatHostTenure(createdAt?: string | null): { num: string; label: string } {
  if (!createdAt) {
    return { num: '1', label: 'Mo hosting' };
  }
  const created = new Date(createdAt);
  const now = new Date();

  const diffYears = now.getFullYear() - created.getFullYear();
  const diffMonths = (now.getMonth() - created.getMonth()) + (diffYears * 12);
  const diffDays = Math.max(1, Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));

  if (diffMonths >= 24) {
    const yrs = Math.floor(diffMonths / 12);
    return { num: `${yrs}`, label: `Yrs hosting` };
  } else if (diffMonths >= 12) {
    return { num: '1', label: 'Yr hosting' };
  } else if (diffMonths >= 1) {
    return { num: `${diffMonths}`, label: `Mo${diffMonths !== 1 ? 's' : ''} hosting` };
  } else {
    return { num: `${diffDays}`, label: `Day${diffDays !== 1 ? 's' : ''} hosting` };
  }
}

export type Step = 'details' | 'dates' | 'review' | 'payment_method' | 'confirm_pay';
export type PaymentMethod = 'mpesa' | 'card';
export type Phase = 'idle' | 'submitting' | 'pin' | 'settling' | 'success';

function formatPhoneForPrompt(rawPhone?: string | null): string {
  if (!rawPhone) return 'your phone';
  const clean = rawPhone.trim().replace(/[\s+-]/g, '');
  if (clean.length === 9 && clean.startsWith('7')) return `0${clean}`;
  if (clean.length === 12 && clean.startsWith('254')) return `0${clean.slice(3)}`;
  return clean;
}

interface BookingSheetProps {
  reel: ReelRow;
  visible: boolean;
  onClose: () => void;
  initialStep?: Step;
  onSuccess?: () => void;
}

export function BookingSheet({
  reel,
  visible,
  onClose,
  initialStep = 'details',
  onSuccess,
}: BookingSheetProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const exp = reel.experience;
  const meta = (exp?.metadata ?? {}) as Record<string, unknown>;
  const hostMeta = ((reel.host?.metadata ?? {}) as Record<string, unknown>);
  const title = exp?.title ?? (reel as any).caption ?? 'Coastal Experience';
  const price = exp?.current_price != null ? Number(exp.current_price) : 0;
  const priceUnit = exp?.price_unit ?? 'night';
  const category = (reel.category ?? '').toLowerCase();
  const isNightBased = ['hotel', 'villa', 'apartment', 'stay'].includes(category) || priceUnit === 'night';
  const maxCapacity = exp?.max_guests || (meta.max_guests as number) || 2;
  const cancellationPolicy = (exp?.cancellation_policy || meta.cancellation_policy || 'flexible') as string;
  const checkInTime = exp?.check_in_time || (meta.check_in_time as string) || '14:00';
  const checkOutTime = exp?.check_out_time || (meta.check_out_time as string) || '10:00';

  const hostName = reel.host?.full_name ?? 'Zuru Host';
  const verified = Boolean(reel.host?.is_verified || reel.host?.verification_status === 'verified');
  const hostAvatar = (hostMeta.avatar_url as string) || null;

  const maxGuests = exp?.max_guests || (meta.max_guests as number) || 2;
  const bedrooms = (meta.bedrooms as number) || 1;
  const beds = (meta.beds as number) || 1;
  const baths = (meta.baths as number) || 1;

  const rawAmenities: string[] =
    Array.isArray(exp?.amenities) && exp.amenities.length > 0
      ? exp.amenities
      : Array.isArray(meta.amenities) && meta.amenities.length > 0
      ? (meta.amenities as string[])
      : ['Fast Wifi', 'Free parking on premises', 'Air Conditioning', 'Swimming Pool', 'Ocean View', 'Kitchen'];

  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const amenities = showAllAmenities ? rawAmenities : rawAmenities.slice(0, 6);

  const heroImage =
    exp?.image_url ||
    reel.thumbnail_url ||
    (meta.image_urls as string[])?.[0] ||
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80';

  const imageUrls: string[] =
    Array.isArray(meta.image_urls) && meta.image_urls.length > 0
      ? (meta.image_urls as string[])
      : [heroImage];

  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = useMemo(() => addDays(today, 365), [today]);

  const defaultFrom = useMemo(() => addDays(today, 1), [today]);
  const defaultTo = useMemo(() => addDays(today, 2), [today]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(initialStep);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mpesa');
  const [from, setFrom] = useState<Date | undefined>(defaultFrom);
  const [to, setTo] = useState<Date | undefined>(defaultTo);
  const [activeDateTab, setActiveDateTab] = useState<'checkin' | 'checkout'>('checkin');
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
  const [cardModalVisible, setCardModalVisible] = useState<boolean>(false);
  const [savedCard, setSavedCard] = useState<CardDetails | null>(null);

  const [reviewsSummary, setReviewsSummary] = useState<ReviewSummaryData | null>(null);
  const [reviewsList, setReviewsList] = useState<any[]>([]);

  // Synchronize initial step when modal opens
  useEffect(() => {
    if (visible) {
      setStep(initialStep);
    }
  }, [visible, initialStep]);

  // ── Load Real Reviews & Rating From Database ───────────────────────────────
  useEffect(() => {
    if (!visible || !exp?.id) return;
    let isMounted = true;

    reviewService
      .fetchReviewsForListing(exp.id)
      .then((res) => {
        if (isMounted) {
          setReviewsSummary(res.summary);
          setReviewsList(res.reviews || []);
        }
      })
      .catch((e) => console.warn('Error loading listing review data:', e));

    return () => {
      isMounted = false;
    };
  }, [visible, exp?.id]);

  const ratingVal = reviewsSummary?.totalCount
    ? reviewsSummary.averageRating
    : Number((meta.rating as number | string | undefined) ?? 5.0);

  const reviewCount = reviewsSummary?.totalCount ?? 0;

  const hostCreatedAt = (reel.host as any)?.created_at || (hostMeta.created_at as string);
  const hostTenure = useMemo(() => formatHostTenure(hostCreatedAt), [hostCreatedAt]);

  const hostWork = (hostMeta.work as string) || 'Host & Local Guide';
  const hostLanguages = (hostMeta.languages as string) || 'English, Swahili';
  const hostBio =
    (reel.host as any)?.bio ||
    (hostMeta.bio as string) ||
    `Welcome! I am passionate about hosting travelers and providing an authentic coastal stay in ${exp?.location || 'Kenya'}.`;
  const hostResponseRate = (hostMeta.response_rate as string) || '100%';
  const hostResponseTime = (hostMeta.response_time as string) || 'within an hour';

  // ── Derived Calculations ───────────────────────────────────────────────────
  const totalGuests = guests.adults + guests.children;
  const guestSummary = useMemo(() => {
    const parts = [];
    if (guests.adults > 0) parts.push(`${guests.adults} adult${guests.adults !== 1 ? 's' : ''}`);
    if (guests.children > 0) parts.push(`${guests.children} child${guests.children !== 1 ? 'ren' : ''}`);
    if (guests.infants > 0) parts.push(`${guests.infants} infant${guests.infants !== 1 ? 's' : ''}`);
    if (guests.pets > 0) parts.push(`${guests.pets} pet${guests.pets !== 1 ? 's' : ''}`);
    return parts.join(', ') || '1 adult';
  }, [guests]);

  const nights =
    from && to ? Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS)) : 1;

  const units = isNightBased ? nights : totalGuests;
  const totalAmount = price * units;

  const busy = phase === 'submitting' || phase === 'pin' || phase === 'settling';
  const { data: blockedDateRows = [] } = useExperienceBlockedDates(exp?.id);
  const blockedRanges = useMemo(
    () =>
      (blockedDateRows as any[]).map((block: any) => ({
        from: new Date(`${block.start_date}T00:00:00`),
        to: new Date(`${block.end_date}T00:00:00`),
      })),
    [blockedDateRows],
  );

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

  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [successModalVisible, setSuccessModalVisible] = useState<boolean>(false);
  const hasHandledSuccessRef = useRef(false);

  const resetState = () => {
    setStep(initialStep);
    setPaymentMethod('mpesa');
    setFrom(defaultFrom);
    setTo(defaultTo);
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setGuests({ adults: 1, children: 0, infants: 0, pets: 0 });
    setMpesaPhone('');
    setPhase('idle');
    setCreatedBookingId(null);
    setSuccessModalVisible(false);
    hasHandledSuccessRef.current = false;
  };

  const handleClose = () => {
    cleanupPaymentListeners();
    onClose();
    setTimeout(resetState, 350);
  };

  const handleSettlementSuccess = useCallback(
    (bookingId?: string | null) => {
      if (hasHandledSuccessRef.current) return;
      hasHandledSuccessRef.current = true;
      cleanupPaymentListeners();
      if (bookingId) {
        setCreatedBookingId(bookingId);
      }
      setPhase('success');
      setSuccessModalVisible(true);
      queryClient.invalidateQueries({ queryKey: ['bookings', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      if (user?.id) {
        queryClient.refetchQueries({ queryKey: ['bookings', user.id] });
      }
    },
    [user?.id, queryClient],
  );

  const handleViewItinerary = () => {
    setSuccessModalVisible(false);
    onSuccess?.();
    handleClose();
    router.push({
      pathname: '/(tabs)/reservations',
      params: createdBookingId ? { bookingId: createdBookingId } : undefined,
    });
  };

  const handleSuccessClose = () => {
    setSuccessModalVisible(false);
    onSuccess?.();
    handleClose();
  };

  const isDateBlocked = useCallback(
    (d: Date) => {
      const time = d.getTime();
      return blockedRanges.some((range: { from: Date; to: Date }) => time >= range.from.getTime() && time <= range.to.getTime());
    },
    [blockedRanges],
  );

  const handleDayPress = (dayDate: Date) => {
    if (dayDate < today || dayDate > maxDate) return;
    if (isDateBlocked(dayDate)) return;

    if (!from || (from && to)) {
      setFrom(dayDate);
      setTo(undefined);
      setActiveDateTab('checkout');
    } else {
      if (dayDate < from) {
        setFrom(dayDate);
        setTo(undefined);
        setActiveDateTab('checkout');
      } else if (dayDate.getTime() === from.getTime()) {
        setTo(addDays(dayDate, 1));
        setActiveDateTab('checkout');
      } else {
        setTo(dayDate);
        setActiveDateTab('checkout');
      }
    }
  };

  // ── Authoritative Booking & Settlement Checker ──────────────────────────────
  const checkAuthoritativeSettlement = useCallback(
    async (quoteId: string, attemptId?: string | null) => {
      try {
        // 1. Check bookings table by quote_id (primary relationship)
        const { data: bByQuote } = await supabase
          .from('bookings')
          .select('id, status, quote_id, payment_attempt_id, user_id, experience_id, created_at')
          .eq('quote_id', quoteId)
          .maybeSingle();

        if (bByQuote && ['paid', 'confirmed', 'completed', 'pending'].includes(bByQuote.status)) {
          if (__DEV__) {
            console.log('[BOOKING_DB]', {
              bookingId: bByQuote.id,
              quoteId: bByQuote.quote_id,
              userId: bByQuote.user_id,
              status: bByQuote.status,
            });
            console.log('[SETTLEMENT]', {
              bookingId: bByQuote.id,
              bookingStatus: bByQuote.status,
              guestId: bByQuote.user_id,
            });
          }
          return { settled: true, booking: bByQuote };
        }

        // 2. Check payment_attempts table
        if (attemptId || quoteId) {
          let paQuery = supabase
            .from('payment_attempts')
            .select('id, status, quote_id, failure_message, failure_code');

          if (attemptId) {
            paQuery = paQuery.eq('id', attemptId);
          } else {
            paQuery = paQuery.eq('quote_id', quoteId);
          }

          const { data: paRows } = await paQuery.limit(1);
          const pa = paRows?.[0];

          if (pa) {
            if (__DEV__) {
              console.log('[PAYMENT_DB]', {
                attemptId: pa.id,
                status: pa.status,
              });
            }

            if (pa.status === 'succeeded' || pa.status === 'paid') {
              // Succeeded - check if booking exists by payment_attempt_id or quote_id
              const { data: bByAttempt } = await supabase
                .from('bookings')
                .select('id, status, quote_id, payment_attempt_id, user_id, experience_id, created_at')
                .or(`payment_attempt_id.eq.${pa.id},quote_id.eq.${quoteId}`)
                .maybeSingle();

              if (__DEV__) {
                console.log('[BOOKING_DB]', {
                  bookingId: bByAttempt?.id,
                  quoteId,
                  userId: bByAttempt?.user_id,
                  status: bByAttempt?.status,
                });
                console.log('[SETTLEMENT]', {
                  bookingId: bByAttempt?.id,
                  bookingStatus: bByAttempt?.status || 'settled_via_payment_attempt',
                  guestId: bByAttempt?.user_id,
                });
              }
              return { settled: true, booking: bByAttempt ?? null, attempt: pa };
            }

            if (pa.status === 'failed') {
              return {
                failed: true,
                reason: pa.failure_message || 'Payment transaction failed or was cancelled by user.',
              };
            }
          }
        }

        // 3. Check booking_quotes status
        const { data: qRow } = await supabase
          .from('booking_quotes')
          .select('id, status')
          .eq('id', quoteId)
          .maybeSingle();

        if (qRow && (qRow.status === 'consumed' || qRow.status === 'payment_succeeded')) {
          const { data: bByQuoteId } = await supabase
            .from('bookings')
            .select('id, status, quote_id, user_id, experience_id, created_at')
            .eq('quote_id', quoteId)
            .maybeSingle();

          if (__DEV__) {
            console.log('[BOOKING_DB]', {
              bookingId: bByQuoteId?.id,
              quoteId,
              userId: bByQuoteId?.user_id,
              status: bByQuoteId?.status,
            });
            console.log('[SETTLEMENT]', {
              bookingId: bByQuoteId?.id,
              bookingStatus: bByQuoteId?.status || 'settled_via_consumed_quote',
              guestId: bByQuoteId?.user_id,
            });
          }
          return { settled: true, booking: bByQuoteId ?? null, quote: qRow };
        }
        if (qRow && (qRow.status === 'expired' || qRow.status === 'cancelled')) {
          return { failed: true, reason: 'Booking quote expired or was cancelled.' };
        }

        return { settled: false };
      } catch (err) {
        console.warn('Error checking authoritative settlement:', err);
        return { settled: false };
      }
    },
    [],
  );

  const executePayment = async (method: PaymentMethod, cardDetails?: any) => {
    if (!user) {
      handleClose();
      router.push('/auth');
      return;
    }

    if (!from) {
      Alert.alert('Select Dates', 'Please select your check-in dates to continue.');
      return;
    }

    let phone = mpesaPhone.trim().replace(/[\s+-]/g, '');
    if (method === 'mpesa') {
      if (!phone) {
        const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
        phone = String(userMeta.phone ?? user.phone ?? '');
      }

      if (!phone || phone.length < 9) {
        Alert.alert('M-Pesa Phone Required', 'Please enter a valid Safaricom M-Pesa phone number.');
        return;
      }
    }

    const checkInStr = from.toISOString();
    const checkOutStr = (to ?? addDays(from, 1)).toISOString();
    const quoteIdempotencyKey = generateUUID();

    try {
      setPhase('submitting');

      const targetExperienceId = exp?.id || reel.experience_id;
      if (!targetExperienceId) {
        throw new Error('This listing is not linked to an active experience.');
      }

      // 1. Create Authoritative Booking Quote with Snapshot Terms from Database
      const { data: quote, error: quoteErr } = await supabase.rpc('create_booking_quote', {
        p_experience_id: targetExperienceId,
        p_check_in: checkInStr,
        p_check_out: checkOutStr,
        p_guest_count: totalGuests,
        p_idempotency_key: quoteIdempotencyKey,
      });

      if (quoteErr || !quote) {
        console.error('[BOOKING_QUOTE_ERROR]', quoteErr);
        if (
          quoteErr?.code === '23P01' ||
          quoteErr?.message?.includes('booking_quotes_active_dates_excl') ||
          quoteErr?.message?.includes('exclusion')
        ) {
          throw new Error('These dates are no longer available. Please choose different dates.');
        }
        throw new Error(quoteErr?.message || 'Unable to generate booking quote. Please try again.');
      }

      // 2. Invoke Paystack Payment Edge Function
      const paymentIdempotencyKey = generateUUID();
      const customerEmail =
        user.email && user.email.includes('@')
          ? user.email
          : `${phone || user.id}@zurusasa.com`;

      const { data: payData, error: payErr } = await supabase.functions.invoke(
        'create-booking-payment',
        {
          body: {
            quoteId: quote.id,
            bookingId: quote.id,
            amount: totalAmount,
            email: customerEmail,
            phone: phone || user.phone || '0700000000',
            channel: method === 'card' ? 'card' : 'mobile_money',
            idempotencyKey: paymentIdempotencyKey,
            card: cardDetails,
          },
        },
      );

      if (payErr || !payData) {
        if (method === 'card' && payData?.authorization_url) {
          await WebBrowser.openBrowserAsync(payData.authorization_url);
        } else {
          throw new Error(payErr?.message || payData?.error || 'Payment gateway connection failed.');
        }
      }

      if (method === 'card' && payData?.authorization_url) {
        await WebBrowser.openBrowserAsync(payData.authorization_url);
      }

      const attemptId = payData?.attemptId || payData?.data?.attemptId;
      const paymentReference = payData?.reference || payData?.data?.reference;

      if (__DEV__) {
        console.log('[BOOKING_START]', {
          quoteId: quote.id,
          userId: user.id,
          listingId: exp?.id || reel.id,
        });
        console.log('[PAYMENT_CREATED]', {
          attemptId,
          reference: paymentReference,
          status: payData?.status || 'pending',
        });
      }

      // 3. Fast-path: Check Authoritative State immediately
      const immediateCheck = await checkAuthoritativeSettlement(quote.id, attemptId);
      if (immediateCheck.settled) {
        handleSettlementSuccess(immediateCheck.booking?.id);
        return;
      }

      // Update Phase to active user prompt
      setPhase(method === 'mpesa' ? 'pin' : 'settling');

      // 4. Realtime Listener for Instant Responsiveness
      const channelName = `booking_settle_${quote.id}_${Date.now()}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bookings',
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            const check = await checkAuthoritativeSettlement(quote.id, attemptId);
            if (check.settled) {
              handleSettlementSuccess(check.booking?.id);
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payment_attempts',
            filter: `guest_id=eq.${user.id}`,
          },
          async () => {
            const check = await checkAuthoritativeSettlement(quote.id, attemptId);
            if (check.settled) {
              handleSettlementSuccess(check.booking?.id);
            } else if (check.failed) {
              cleanupPaymentListeners();
              setPhase('idle');
              Alert.alert('Payment Failed', check.reason || 'Payment was declined.');
            }
          },
        )
        .subscribe();

      realtimeChannelRef.current = channel;

      // 5. Bounded Polling Loop (Authoritative Source of Truth)
      let pollCount = 0;
      const MAX_POLLS = 40; // ~48 seconds

      pollRef.current = setInterval(async () => {
        try {
          pollCount++;
          const check = await checkAuthoritativeSettlement(quote.id, attemptId);

          if (check.settled) {
            handleSettlementSuccess(check.booking?.id);
            return;
          }

          if (check.failed) {
            cleanupPaymentListeners();
            setPhase('idle');
            Alert.alert('Payment Failed', check.reason || 'Payment could not be completed.');
            return;
          }

          if (pollCount >= MAX_POLLS) {
            cleanupPaymentListeners();

            // Perform one final authoritative check before showing timeout
            const finalCheck = await checkAuthoritativeSettlement(quote.id, attemptId);
            if (finalCheck.settled) {
              handleSettlementSuccess(finalCheck.booking?.id);
              return;
            }

            setPhase('idle');

            // Truthful timeout handling (Does NOT mark as failed if verification is in flight)
            Alert.alert(
              'Payment is taking longer than expected',
              'Your payment may still be processing. You can check your Trips and return here later.',
              [
                { text: 'View Trips', onPress: handleViewItinerary },
                { text: 'Done', style: 'cancel' },
              ],
            );
          }
        } catch (pollErr) {
          console.warn('Poll iteration error (safe):', pollErr);
        }
      }, 1200);
    } catch (err: any) {
      cleanupPaymentListeners();
      setPhase('idle');
      Alert.alert('Booking Error', err.message || 'An unexpected error occurred. Please try again.');
    }
  };

  const startPaymentFlow = async () => {
    if (paymentMethod === 'card') {
      if (!savedCard) {
        setCardModalVisible(true);
        return;
      }
      await executePayment('card', savedCard);
    } else {
      await executePayment('mpesa');
    }
  };

  const handleCardSaved = (cardDetails: CardDetails) => {
    setSavedCard(cardDetails);
    setPaymentMethod('card');
    setCardModalVisible(false);
  };

  const handleSeeAllReviews = () => {
    handleClose();
    router.push({
      pathname: '/reviews' as any,
      params: {
        listingId: exp?.id || 'exp-default',
        title: exp?.title || 'Experience',
      },
    });
  };

  const thumbnail =
    exp?.image_url ||
    reel.thumbnail_url ||
    (meta.image_urls as string[])?.[0] ||
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&q=80';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={[styles.root, { backgroundColor: '#FFFFFF' }]}>
        {/* ── TOP HEADER NAV (Visible on Steps: dates, review, payment_method, confirm_pay) ── */}
        {step !== 'details' ? (
          <View style={[styles.headerNav, { paddingTop: Platform.OS === 'ios' ? insets.top + 6 : 16 }]}>
            <Pressable
              onPress={() => {
                if (step === 'confirm_pay') setStep('payment_method');
                else if (step === 'payment_method') setStep('review');
                else if (step === 'review') setStep('dates');
                else if (step === 'dates') setStep('details');
              }}
              style={styles.headerBackBtn}
              hitSlop={12}
            >
              <Feather name="arrow-left" size={22} color="#111111" />
            </Pressable>

            {step === 'payment_method' ? (
              <View style={{ flex: 1 }} />
            ) : (
              <Text style={styles.headerTitle}>
                {step === 'dates'
                  ? 'Select dates & guests'
                  : step === 'review'
                  ? 'Review and continue'
                  : 'Confirm and pay'}
              </Text>
            )}

            {step === 'dates' ? (
              <Pressable
                onPress={() => {
                  setFrom(undefined);
                  setTo(undefined);
                }}
                hitSlop={12}
              >
                <Text style={styles.clearDatesText}>Clear</Text>
              </Pressable>
            ) : (
              <Pressable onPress={handleClose} style={styles.headerCloseBtn} hitSlop={12}>
                <Feather name="x" size={22} color="#111111" />
              </Pressable>
            )}
          </View>
        ) : null}

        {/* ── SCROLLABLE CONTENT ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            step === 'details' && { paddingHorizontal: 0, paddingTop: 0 },
            { paddingBottom: insets.bottom + 120 },
          ]}
        >
            {/* ══════════════════════════════════════════════════════════════
                STEP 0: LISTING DETAILS DISCOVERY VIEW (Photos 1–6)
            ══════════════════════════════════════════════════════════════ */}
            {step === 'details' ? (
              <View>
                {/* 1. HERO IMAGE WITH ACTIONS */}
                <View style={styles.heroWrap}>
                  <Image source={{ uri: heroImage }} style={styles.heroImage} contentFit="cover" />
                  {/* Top Navigation Row */}
                  <View style={[styles.heroNavRow, { top: Platform.OS === 'ios' ? insets.top + 6 : 20 }]}>
                    <Pressable onPress={handleClose} style={styles.navCircleBtn} hitSlop={10}>
                      <Feather name="arrow-left" size={20} color="#111111" />
                    </Pressable>
                    <View style={styles.navRightGroup}>
                      <Pressable style={styles.navCircleBtn} hitSlop={10}>
                        <Feather name="share" size={18} color="#111111" />
                      </Pressable>
                      <Pressable style={styles.navCircleBtn} hitSlop={10}>
                        <Feather name="heart" size={18} color="#111111" />
                      </Pressable>
                    </View>
                  </View>
                  {/* Photo Counter Pill */}
                  <View style={styles.photoCountPill}>
                    <Text style={styles.photoCountText}>1 / {imageUrls.length}</Text>
                  </View>
                </View>

                <View style={styles.detailsBody}>
                  {/* 2. TITLE & CAPACITY SPECS */}
                  <View style={styles.titleSection}>
                    <Text style={styles.listingTitle}>{title}</Text>
                    <Text style={styles.unitSubtitle}>
                      Entire place in {exp?.location || 'Kenyan Coast'}
                    </Text>
                    <Text style={styles.capacitySpecs}>
                      {maxGuests} guest{maxGuests !== 1 ? 's' : ''} · {bedrooms} bedroom{bedrooms !== 1 ? 's' : ''} · {beds} bed{beds !== 1 ? 's' : ''} · {baths} bath{baths !== 1 ? 's' : ''}
                    </Text>
                  </View>

                  {/* 3. GUEST FAVOURITE & RATING RIBBON */}
                  <View style={styles.guestFavRibbon}>
                    <View style={styles.ribbonCol}>
                      <Text style={styles.ribbonRatingNumber}>
                        {reviewCount > 0 ? ratingVal.toFixed(1).replace('.', ',') : '★ New'}
                      </Text>
                      {reviewCount > 0 ? (
                        <View style={styles.starsRow}>
                          {Array.from({ length: Math.min(5, Math.round(ratingVal)) }).map((_, s) => (
                            <MaterialCommunityIcons key={s} name="star" size={11} color="#111111" />
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.ribbonReviewsLabel}>New listing</Text>
                      )}
                    </View>

                    <View style={styles.ribbonDivider} />

                    <View style={styles.ribbonMiddleCol}>
                      {reviewCount >= 3 && ratingVal >= 4.7 ? (
                        <View style={styles.laurelRow}>
                          <MaterialCommunityIcons name="leaf" size={16} color="#111111" style={{ transform: [{ scaleX: -1 }] }} />
                          <View style={{ alignItems: 'center' }}>
                            <Text style={styles.guestFavTitle}>Guest</Text>
                            <Text style={styles.guestFavTitle}>favourite</Text>
                          </View>
                          <MaterialCommunityIcons name="leaf" size={16} color="#111111" />
                        </View>
                      ) : reviewCount > 0 ? (
                        <View style={{ alignItems: 'center' }}>
                          <Text style={styles.guestFavTitle}>Verified</Text>
                          <Text style={styles.ribbonReviewsLabel}>Guest Rating</Text>
                        </View>
                      ) : (
                        <View style={{ alignItems: 'center' }}>
                          <Text style={styles.guestFavTitle}>Be the first</Text>
                          <Text style={styles.ribbonReviewsLabel}>to review</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.ribbonDivider} />

                    <Pressable onPress={handleSeeAllReviews} style={styles.ribbonCol}>
                      <Text style={styles.ribbonReviewsNumber}>{reviewCount}</Text>
                      <Text style={styles.ribbonReviewsLabel}>{reviewCount === 1 ? 'Review' : 'Reviews'}</Text>
                    </Pressable>
                  </View>

                  <View style={styles.separator} />

                  {/* 4. KEY FEATURE HIGHLIGHTS */}
                  <View style={styles.highlightsBlock}>
                    <View style={styles.highlightItem}>
                      <Feather name="key" size={20} color="#111111" style={styles.highlightIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.highlightHeading}>Seamless check-in</Text>
                        <Text style={styles.highlightSub}>
                          Check-in at {checkInTime} · Hosted by verified host {hostName}.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.highlightItem}>
                      <Feather name="map-pin" size={20} color="#111111" style={styles.highlightIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.highlightHeading}>Prime coastal location</Text>
                        <Text style={styles.highlightSub}>Located in {exp?.location || 'Kenyan Coast'}.</Text>
                      </View>
                    </View>

                    <View style={styles.highlightItem}>
                      <Feather name="shield" size={20} color="#111111" style={styles.highlightIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.highlightHeading}>
                          {cancellationPolicy === 'strict'
                            ? 'Strict cancellation policy'
                            : cancellationPolicy === 'moderate'
                            ? 'Moderate cancellation policy'
                            : 'Free cancellation before check-in'}
                        </Text>
                        <Text style={styles.highlightSub}>
                          {cancellationPolicy === 'strict'
                            ? 'Full refund if cancelled 7+ days before check-in.'
                            : 'Review the full policy terms before booking.'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.separator} />

                  {/* 5. ABOUT DESCRIPTION */}
                  <View style={styles.descriptionSection}>
                    <Text style={styles.sectionHeading}>About this place</Text>
                    <Text style={styles.descriptionText}>
                      {exp?.description ||
                        (reel as any).caption ||
                        'Enjoy an authentic stay in the Kenyan coast with modern amenities, comfortable furnishings, and warm hospitality.'}
                    </Text>
                  </View>

                  <View style={styles.separator} />

                  {/* 6. REVIEWS SHOWCASE CAROUSEL */}
                  <View style={styles.reviewsShowcaseBlock}>
                    {reviewCount >= 3 && ratingVal >= 4.7 ? (
                      <>
                        <View style={styles.bigWreathHeader}>
                          <MaterialCommunityIcons name="leaf" size={28} color="#333333" style={{ transform: [{ scaleX: -1 }] }} />
                          <Text style={styles.bigRatingText}>{ratingVal.toFixed(1).replace('.', ',')}</Text>
                          <MaterialCommunityIcons name="leaf" size={28} color="#333333" />
                        </View>
                        <Text style={styles.bigGuestFavTitle}>Guest favourite</Text>
                        <Text style={styles.bigGuestFavSub}>
                          This home is a guest favourite based on ratings, reviews and reliability
                        </Text>
                      </>
                    ) : reviewCount > 0 ? (
                      <>
                        <View style={styles.bigWreathHeader}>
                          <MaterialCommunityIcons name="star" size={28} color="#F26522" />
                          <Text style={styles.bigRatingText}>{ratingVal.toFixed(1).replace('.', ',')}</Text>
                        </View>
                        <Text style={styles.bigGuestFavTitle}>Guest reviews</Text>
                        <Text style={styles.bigGuestFavSub}>
                          Based on {reviewCount} verified guest review{reviewCount !== 1 ? 's' : ''}
                        </Text>
                      </>
                    ) : (
                      <>
                        <MaterialCommunityIcons name="star-outline" size={32} color="#9CA3AF" />
                        <Text style={styles.bigGuestFavTitle}>No reviews yet</Text>
                        <Text style={styles.bigGuestFavSub}>
                          Reviews will appear here after guests complete their stay.
                        </Text>
                      </>
                    )}

                    {reviewsList.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.reviewsCarousel}
                      >
                        {reviewsList.map((rev) => (
                          <View key={rev.id} style={styles.reviewSnippetCard}>
                            <View style={styles.reviewerTopRow}>
                              <View style={styles.reviewerAvatar}>
                                <Text style={styles.reviewerAvatarInitial}>
                                  {(rev.reviewer?.full_name || 'G').charAt(0).toUpperCase()}
                                </Text>
                              </View>
                              <View>
                                <Text style={styles.reviewerName}>{rev.reviewer?.full_name || 'Verified Guest'}</Text>
                                <Text style={styles.reviewerLoc}>Verified stay</Text>
                              </View>
                            </View>

                            <View style={styles.reviewRatingRow}>
                              <View style={styles.starsRow}>
                                {Array.from({ length: Number(rev.rating || 5) }).map((_, s) => (
                                  <MaterialCommunityIcons key={s} name="star" size={12} color="#111111" />
                                ))}
                              </View>
                              <Text style={styles.reviewTimeAgo}>
                                · {rev.created_at ? new Date(rev.created_at).toLocaleDateString() : 'Recent'}
                              </Text>
                            </View>

                            <Text style={styles.reviewHeadline}>{rev.title || 'Wonderful Experience'}</Text>
                            <Text style={styles.reviewSnippetBody} numberOfLines={3}>
                              {rev.comment}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    ) : null}

                    {reviewCount > 0 ? (
                      <Pressable onPress={handleSeeAllReviews} style={styles.showAllReviewsBtn}>
                        <Text style={styles.showAllReviewsBtnText}>Show all {reviewCount} reviews</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.separator} />

                  {/* 7. WHAT THIS PLACE OFFERS */}
                  <View style={styles.amenitiesSection}>
                    <Text style={styles.sectionHeading}>What this place offers</Text>
                    <View style={styles.amenitiesList}>
                      {amenities.map((item, idx) => (
                        <View key={idx} style={styles.amenityRow}>
                          <Feather
                            name={
                              item.toLowerCase().includes('wifi')
                                ? 'wifi'
                                : item.toLowerCase().includes('park')
                                ? 'truck'
                                : item.toLowerCase().includes('tv')
                                ? 'tv'
                                : item.toLowerCase().includes('kitchen')
                                ? 'coffee'
                                : 'check'
                            }
                            size={18}
                            color="#222222"
                            style={styles.amenityIcon}
                          />
                          <Text style={styles.amenityName}>{item}</Text>
                        </View>
                      ))}
                    </View>

                    {rawAmenities.length > 6 ? (
                      <Pressable
                        onPress={() => setShowAllAmenities(!showAllAmenities)}
                        style={styles.showAllAmenitiesBtn}
                      >
                        <Text style={styles.showAllAmenitiesBtnText}>
                          {showAllAmenities ? 'Show less' : `Show all ${rawAmenities.length} amenities`}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.separator} />

                  {/* 8. WHERE YOU'LL BE */}
                  <View style={styles.locationSection}>
                    <Text style={styles.sectionHeading}>Where you’ll be</Text>
                    <Text style={styles.locationSub}>{exp?.location || 'Kenyan Coast'}</Text>

                    <View style={styles.mapCardMock}>
                      <Image source={{ uri: heroImage }} style={styles.mapCardImage} contentFit="cover" />
                      <View style={styles.mapPinCircle}>
                        <Feather name="map-pin" size={18} color="#FFFFFF" />
                      </View>
                    </View>
                  </View>

                  <View style={styles.separator} />

                  {/* 9. MEET YOUR HOST */}
                  <View style={styles.meetHostSection}>
                    <Text style={styles.sectionHeading}>Meet your host</Text>

                    <View style={styles.hostProfileCard}>
                      <View style={styles.hostCardLeft}>
                        <View style={styles.hostCardAvatarWrap}>
                          {hostAvatar ? (
                            <Image source={{ uri: hostAvatar }} style={styles.hostCardAvatar} />
                          ) : (
                            <View style={styles.hostCardAvatarFallback}>
                              <Text style={styles.hostCardAvatarInitial}>{hostName.charAt(0).toUpperCase()}</Text>
                            </View>
                          )}
                          {verified ? (
                            <View style={styles.hostCardShieldBadge}>
                              <Feather name="check" size={10} color="#FFFFFF" />
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.hostCardName}>{hostName}</Text>
                        {verified ? (
                          <View style={styles.superhostBadge}>
                            <MaterialCommunityIcons name="shield-check" size={14} color="#008A05" />
                            <Text style={[styles.superhostText, { color: '#008A05' }]}>Verified Host</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.hostCardStatsCol}>
                        <View style={styles.hostStatItem}>
                          <Text style={styles.hostStatNum}>{reviewCount}</Text>
                          <Text style={styles.hostStatLabel}>Reviews</Text>
                        </View>
                        <View style={styles.hostStatDivider} />
                        <View style={styles.hostStatItem}>
                          <Text style={styles.hostStatNum}>{ratingVal.toFixed(1)}</Text>
                          <Text style={styles.hostStatLabel}>Rating</Text>
                        </View>
                        <View style={styles.hostStatDivider} />
                        <View style={styles.hostStatItem}>
                          <Text style={styles.hostStatNum}>{hostTenure.num}</Text>
                          <Text style={styles.hostStatLabel}>{hostTenure.label}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.hostAttributesList}>
                      <View style={styles.hostAttrRow}>
                        <Feather name="briefcase" size={16} color="#222222" />
                        <Text style={styles.hostAttrText}>Work: {hostWork}</Text>
                      </View>
                      <View style={styles.hostAttrRow}>
                        <Feather name="globe" size={16} color="#222222" />
                        <Text style={styles.hostAttrText}>Speaks: {hostLanguages}</Text>
                      </View>
                    </View>

                    <Text style={styles.hostBioText}>{hostBio}</Text>

                    <View style={styles.hostDetailsBox}>
                      <Text style={styles.hostDetailsTitle}>Host details</Text>
                      <Text style={styles.hostDetailsText}>Response rate: {hostResponseRate}</Text>
                      <Text style={styles.hostDetailsText}>Responds: {hostResponseTime}</Text>
                    </View>
                  </View>

                  <View style={styles.separator} />

                  {/* 10. THINGS TO KNOW */}
                  <View style={styles.thingsToKnowSection}>
                    <Text style={styles.sectionHeading}>Things to know</Text>

                    <View style={styles.thingItemRow}>
                      <Feather name="calendar" size={18} color="#222222" style={styles.thingIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.thingItemTitle}>Cancellation policy</Text>
                        <Text style={styles.thingItemSub}>
                          {cancellationPolicy === 'strict'
                            ? 'Full refund if cancelled at least 7 days before check-in.'
                            : cancellationPolicy === 'moderate'
                            ? 'Full refund if cancelled at least 5 days before check-in.'
                            : 'Free cancellation up to 24 hours before check-in.'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.thingItemRow}>
                      <Feather name="clock" size={18} color="#222222" style={styles.thingIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.thingItemTitle}>Check-in & Check-out</Text>
                        <Text style={styles.thingItemSub}>
                          Check-in after {checkInTime} · Check-out before {checkOutTime}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.thingItemRow}>
                      <Feather name="users" size={18} color="#222222" style={styles.thingIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.thingItemTitle}>House rules</Text>
                        <Text style={styles.thingItemSub}>
                          Maximum {maxGuests} guests allowed · Respect quiet hours
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ) : null}

            {/* ══════════════════════════════════════════════════════════════
                STEP 1: CHOOSE DATES & GUESTS
            ══════════════════════════════════════════════════════════════ */}
            {step === 'dates' ? (
              <View style={{ gap: 20 }}>
                {/* 1. Trip Duration Header */}
                <View style={styles.tripHeadingBlock}>
                  <Text style={styles.tripH1}>
                    {from && to
                      ? `${nights} night${nights !== 1 ? 's' : ''} in ${exp?.location || 'Kenyan Coast'}`
                      : 'Select dates'}
                  </Text>
                  <Text style={styles.tripSub}>
                    {from && to
                      ? fmtRange(from, to)
                      : 'Add your travel dates for exact pricing'}
                  </Text>
                </View>

                {/* 2. Segmented Date Tabs (Check-in / Checkout) */}
                <View style={styles.dateTabsWrap}>
                  <Pressable
                    onPress={() => setActiveDateTab('checkin')}
                    style={[
                      styles.dateTab,
                      activeDateTab === 'checkin' && styles.dateTabActive,
                    ]}
                  >
                    <Text style={styles.dateTabLabel}>CHECK-IN</Text>
                    <Text style={styles.dateTabVal}>
                      {from ? fmtShort(from) : 'Add date'}
                    </Text>
                  </Pressable>

                  <View style={styles.dateTabDivider} />

                  <Pressable
                    onPress={() => setActiveDateTab('checkout')}
                    style={[
                      styles.dateTab,
                      activeDateTab === 'checkout' && styles.dateTabActive,
                    ]}
                  >
                    <Text style={styles.dateTabLabel}>CHECKOUT</Text>
                    <Text style={styles.dateTabVal}>
                      {to ? fmtShort(to) : 'Add date'}
                    </Text>
                  </Pressable>
                </View>

                {/* 3. Interactive Month-by-Month Calendar */}
                <View style={styles.calendarContainer}>
                  {/* Calendar Month Header & Navigation */}
                  <View style={styles.calendarMonthHeader}>
                    <Text style={styles.monthHeaderTitle}>
                      {MONTHS_LONG[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                    </Text>
                    <View style={styles.monthNavRow}>
                      <Pressable
                        onPress={() =>
                          setViewMonth(
                            new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
                          )
                        }
                        disabled={
                          viewMonth.getFullYear() === today.getFullYear() &&
                          viewMonth.getMonth() <= today.getMonth()
                        }
                        style={styles.monthNavBtn}
                      >
                        <Feather name="chevron-left" size={20} color="#111111" />
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          setViewMonth(
                            new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
                          )
                        }
                        style={styles.monthNavBtn}
                      >
                        <Feather name="chevron-right" size={20} color="#111111" />
                      </Pressable>
                    </View>
                  </View>

                  {/* Day of Week Labels */}
                  <View style={styles.weekDaysRow}>
                    {DAYS.map((d) => (
                      <Text key={d} style={styles.weekDayText}>
                        {d}
                      </Text>
                    ))}
                  </View>

                  {/* Days Grid */}
                  <View style={styles.daysGrid}>
                    {Array.from({
                      length: new Date(
                        viewMonth.getFullYear(),
                        viewMonth.getMonth(),
                        1,
                      ).getDay(),
                    }).map((_, i) => (
                      <View key={`empty-${i}`} style={styles.dayCellEmpty} />
                    ))}

                    {Array.from({
                      length: new Date(
                        viewMonth.getFullYear(),
                        viewMonth.getMonth() + 1,
                        0,
                      ).getDate(),
                    }).map((_, i) => {
                      const dayNum = i + 1;
                      const dayDate = new Date(
                        viewMonth.getFullYear(),
                        viewMonth.getMonth(),
                        dayNum,
                      );
                      const isPast = dayDate < today;
                      const isFutureMax = dayDate > maxDate;
                      const blocked = isDateBlocked(dayDate);
                      const disabled = isPast || isFutureMax || blocked;

                      const isFrom = from && dayDate.getTime() === from.getTime();
                      const isTo = to && dayDate.getTime() === to.getTime();
                      const inRange =
                        from && to && dayDate > from && dayDate < to;

                      return (
                        <Pressable
                          key={`day-${dayNum}`}
                          onPress={() => handleDayPress(dayDate)}
                          disabled={disabled}
                          style={[
                            styles.dayCell,
                            inRange && styles.dayCellInRange,
                            isFrom && styles.dayCellStart,
                            isTo && styles.dayCellEnd,
                          ]}
                        >
                          <View
                            style={[
                              styles.dayNumWrap,
                              (isFrom || isTo) && styles.dayNumWrapSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.dayNumText,
                                disabled && styles.dayNumTextDisabled,
                                inRange && styles.dayNumTextInRange,
                                (isFrom || isTo) && styles.dayNumTextSelected,
                              ]}
                            >
                              {dayNum}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* 4. Guest Steppers */}
                <View style={styles.guestsSection}>
                  <Text style={styles.guestsSectionHeading}>Guests</Text>

                  {/* Adults */}
                  <View style={styles.guestRow}>
                    <View>
                      <Text style={styles.guestTypeTitle}>Adults</Text>
                      <Text style={styles.guestTypeSub}>Age 13+</Text>
                    </View>
                    <View style={styles.guestCounter}>
                      <Pressable
                        onPress={() => setGuests((g) => ({ ...g, adults: Math.max(1, g.adults - 1) }))}
                        disabled={guests.adults <= 1}
                        style={[styles.counterBtn, guests.adults <= 1 && styles.counterBtnDisabled]}
                      >
                        <Feather name="minus" size={16} color={guests.adults <= 1 ? '#CCCCCC' : '#111111'} />
                      </Pressable>
                      <Text style={styles.counterNum}>{guests.adults}</Text>
                      <Pressable
                        onPress={() => {
                          if (totalGuests < maxCapacity) {
                            setGuests((g) => ({ ...g, adults: g.adults + 1 }));
                          }
                        }}
                        disabled={totalGuests >= maxCapacity}
                        style={[styles.counterBtn, totalGuests >= maxCapacity && styles.counterBtnDisabled]}
                      >
                        <Feather name="plus" size={16} color={totalGuests >= maxCapacity ? '#CCCCCC' : '#111111'} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Children */}
                  <View style={styles.guestRow}>
                    <View>
                      <Text style={styles.guestTypeTitle}>Children</Text>
                      <Text style={styles.guestTypeSub}>Ages 2–12</Text>
                    </View>
                    <View style={styles.guestCounter}>
                      <Pressable
                        onPress={() => setGuests((g) => ({ ...g, children: Math.max(0, g.children - 1) }))}
                        disabled={guests.children <= 0}
                        style={[styles.counterBtn, guests.children <= 0 && styles.counterBtnDisabled]}
                      >
                        <Feather name="minus" size={16} color={guests.children <= 0 ? '#CCCCCC' : '#111111'} />
                      </Pressable>
                      <Text style={styles.counterNum}>{guests.children}</Text>
                      <Pressable
                        onPress={() => {
                          if (totalGuests < maxCapacity) {
                            setGuests((g) => ({ ...g, children: g.children + 1 }));
                          }
                        }}
                        disabled={totalGuests >= maxCapacity}
                        style={[styles.counterBtn, totalGuests >= maxCapacity && styles.counterBtnDisabled]}
                      >
                        <Feather name="plus" size={16} color={totalGuests >= maxCapacity ? '#CCCCCC' : '#111111'} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Infants */}
                  <View style={styles.guestRow}>
                    <View>
                      <Text style={styles.guestTypeTitle}>Infants</Text>
                      <Text style={styles.guestTypeSub}>Under 2</Text>
                    </View>
                    <View style={styles.guestCounter}>
                      <Pressable
                        onPress={() => setGuests((g) => ({ ...g, infants: Math.max(0, g.infants - 1) }))}
                        disabled={guests.infants <= 0}
                        style={[styles.counterBtn, guests.infants <= 0 && styles.counterBtnDisabled]}
                      >
                        <Feather name="minus" size={16} color={guests.infants <= 0 ? '#CCCCCC' : '#111111'} />
                      </Pressable>
                      <Text style={styles.counterNum}>{guests.infants}</Text>
                      <Pressable
                        onPress={() => setGuests((g) => ({ ...g, infants: g.infants + 1 }))}
                        style={styles.counterBtn}
                      >
                        <Feather name="plus" size={16} color="#111111" />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            ) : null}

            {/* ══════════════════════════════════════════════════════════════
                STEP 2: REVIEW AND CONTINUE (Photo 7)
            ══════════════════════════════════════════════════════════════ */}
            {step === 'review' ? (
              <View style={{ gap: 16 }}>
                {/* ── CARD 1: LISTING & TRIP DETAILS SUMMARY ── */}
                <View style={styles.mainCard}>
                  {/* Top Listing Snippet */}
                  <View style={styles.listingSnippetRow}>
                    <Image source={{ uri: thumbnail }} style={styles.listingThumb} contentFit="cover" />
                    <View style={styles.listingSnippetMeta}>
                      <Text style={styles.snippetTitle} numberOfLines={2}>
                        {title}
                      </Text>
                      <View style={styles.snippetRatingRow}>
                        {reviewCount > 0 ? (
                          <>
                            <MaterialCommunityIcons name="star" size={13} color="#111111" />
                            <Text style={styles.snippetRatingText}>
                              {ratingVal.toFixed(1)} ({reviewCount})
                              {reviewCount >= 3 && ratingVal >= 4.7 ? (
                                <> · <MaterialCommunityIcons name="leaf" size={13} color="#111111" /> Guest favorite</>
                              ) : null}
                            </Text>
                          </>
                        ) : (
                          <Text style={styles.snippetRatingText}>★ New listing</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  <View style={styles.cardDivider} />

                  {/* Dates Row */}
                  <View style={styles.cardSectionRow}>
                    <View style={styles.cardSectionLeft}>
                      <Text style={styles.sectionLabel}>Dates</Text>
                      <Text style={styles.sectionVal}>{from ? fmtRange(from, to) : 'Select dates'}</Text>
                      <Text style={styles.sectionSub}>
                        {checkInTime} check-in · {checkOutTime} check-out
                      </Text>
                    </View>
                    <Pressable onPress={() => setStep('dates')} style={styles.changeBtn}>
                      <Text style={styles.changeBtnText}>Change</Text>
                    </Pressable>
                  </View>

                  <View style={styles.cardDivider} />

                  {/* Guests Row */}
                  <View style={styles.cardSectionRow}>
                    <View style={styles.cardSectionLeft}>
                      <Text style={styles.sectionLabel}>Guests</Text>
                      <Text style={styles.sectionVal}>{guestSummary}</Text>
                    </View>
                    <Pressable onPress={() => setStep('dates')} style={styles.changeBtn}>
                      <Text style={styles.changeBtnText}>Change</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Price Details Card */}
                <View style={styles.cardContainer}>
                  <Text style={styles.cardHeaderTitle}>Price details</Text>
                  <View style={styles.cardItemRow}>
                    <Text style={styles.cardItemLabel}>
                      {units} {priceUnit}{units !== 1 ? 's' : ''} x KSh {price.toLocaleString()}.00
                    </Text>
                    <Text style={styles.cardItemVal}>KSh {totalAmount.toLocaleString()}.00</Text>
                  </View>
                  <View style={styles.cardItemRow}>
                    <Text style={styles.cardItemLabel}>Service fee</Text>
                    <Text style={styles.cardItemVal}>KSh 0.00</Text>
                  </View>
                  <View style={styles.cardDivider} />
                  <View style={styles.cardTotalRow}>
                    <Text style={styles.cardTotalLabel}>Total (KES)</Text>
                    <Text style={styles.cardTotalVal}>KSh {totalAmount.toLocaleString()}.00</Text>
                  </View>
                </View>

                {/* Cancellation Policy Card */}
                <View style={styles.cardContainer}>
                  <Text style={styles.cardHeaderTitle}>Cancellation policy</Text>
                  <Text style={styles.cardBodyText}>
                    {cancellationPolicy === 'strict'
                      ? 'Full refund if cancelled at least 7 days before check-in.'
                      : cancellationPolicy === 'moderate'
                      ? 'Full refund if cancelled at least 5 days before check-in.'
                      : 'Free cancellation up to 24 hours before check-in.'}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* ══════════════════════════════════════════════════════════════
                STEP 3: ADD A PAYMENT METHOD (Matching User Screenshot 1)
            ══════════════════════════════════════════════════════════════ */}
            {step === 'payment_method' ? (
              <View style={{ gap: 24, paddingTop: 8 }}>
                {/* Page Title: "Add a payment method" */}
                <Text style={styles.paymentMethodPageTitle}>Add a payment method</Text>

                {/* Grouped Payment Box */}
                <View style={styles.paymentMethodsGroupedBox}>
                  {/* Option 1: M-PESA */}
                  <Pressable
                    onPress={() => setPaymentMethod('mpesa')}
                    style={[
                      styles.paymentMethodItem,
                      paymentMethod === 'mpesa' && styles.paymentMethodItemActive,
                    ]}
                  >
                    <View style={styles.paymentMethodLeft}>
                      <Image
                        source={require('@/assets/images/mpesa_logo.png')}
                        style={styles.mpesaLogoSquare}
                        contentFit="contain"
                      />
                      <Text style={styles.paymentMethodItemText}>M-PESA</Text>
                    </View>
                    <View style={[styles.airbnbRadioOuter, paymentMethod === 'mpesa' && styles.airbnbRadioOuterSelected]}>
                      {paymentMethod === 'mpesa' ? <View style={styles.airbnbRadioInner} /> : null}
                    </View>
                  </Pressable>

                  {/* Inline M-Pesa Phone Input if M-Pesa is selected */}
                  {paymentMethod === 'mpesa' ? (
                    <View style={styles.mpesaPhoneFieldWrapper}>
                      <Text style={styles.mpesaPhoneFieldLabel}>M-PESA PHONE NUMBER</Text>
                      <TextInput
                        value={mpesaPhone}
                        onChangeText={setMpesaPhone}
                        placeholder="e.g. 0712 345 678"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="phone-pad"
                        style={styles.mpesaPhoneFieldInput}
                      />
                      <Text style={styles.mpesaPhoneFieldHint}>
                        An STK PIN prompt will be sent to this number.
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.paymentMethodDivider} />

                  {/* Option 2: Credit or debit card */}
                  <Pressable
                    onPress={() => {
                      setPaymentMethod('card');
                      setCardModalVisible(true);
                    }}
                    style={[
                      styles.paymentMethodItem,
                      paymentMethod === 'card' && styles.paymentMethodItemActive,
                    ]}
                  >
                    <View style={styles.paymentMethodLeft}>
                      <Feather name="credit-card" size={24} color="#111111" style={{ marginRight: 6 }} />
                      <View style={{ gap: 4 }}>
                        <Text style={styles.paymentMethodItemText}>Credit or debit card</Text>
                        {/* Visa & Mastercard Logos */}
                        <View style={styles.cardBrandsRow}>
                          <Text style={styles.visaTextBadge}>VISA</Text>
                          <View style={styles.mastercardCircles}>
                            <View style={styles.mcRedCircle} />
                            <View style={styles.mcAmberCircle} />
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={[styles.airbnbRadioOuter, paymentMethod === 'card' && styles.airbnbRadioOuterSelected]}>
                      {paymentMethod === 'card' ? <View style={styles.airbnbRadioInner} /> : null}
                    </View>
                  </Pressable>

                  {/* Saved Card Details Preview Pill */}
                  {paymentMethod === 'card' && savedCard ? (
                    <Pressable
                      onPress={() => setCardModalVisible(true)}
                      style={styles.savedCardRowPill}
                    >
                      <View style={styles.savedCardRowLeft}>
                        <Feather name="check-circle" size={16} color="#059669" />
                        <Text style={styles.savedCardRowText}>
                          Card ending in •••• {savedCard.cardNumber.slice(-4)} ({savedCard.expiry})
                        </Text>
                      </View>
                      <Text style={styles.savedCardEditBtn}>Edit</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* ══════════════════════════════════════════════════════════════
                STEP 4: CONFIRM AND PAY (Photos 8–9)
            ══════════════════════════════════════════════════════════════ */}
            {step === 'confirm_pay' ? (
              <View style={{ gap: 16 }}>
                {/* CARD 1: TRIP SUMMARY */}
                <View style={styles.mainCard}>
                  <View style={styles.listingSnippetRow}>
                    <Image source={{ uri: thumbnail }} style={styles.listingThumb} contentFit="cover" />
                    <View style={styles.listingSnippetMeta}>
                      <Text style={styles.snippetTitle} numberOfLines={2}>
                        {title}
                      </Text>
                      <View style={styles.snippetRatingRow}>
                        {reviewCount > 0 ? (
                          <>
                            <MaterialCommunityIcons name="star" size={13} color="#111111" />
                            <Text style={styles.snippetRatingText}>
                              {ratingVal.toFixed(1)} ({reviewCount})
                            </Text>
                          </>
                        ) : (
                          <Text style={styles.snippetRatingText}>★ New listing</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.cardSectionRow}>
                    <View style={styles.cardSectionLeft}>
                      <Text style={styles.sectionLabel}>Dates</Text>
                      <Text style={styles.sectionVal}>{from ? fmtRange(from, to) : 'Select dates'}</Text>
                    </View>
                    <Pressable onPress={() => setStep('dates')} style={styles.changeBtn}>
                      <Text style={styles.changeBtnText}>Change</Text>
                    </Pressable>
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.cardSectionRow}>
                    <View style={styles.cardSectionLeft}>
                      <Text style={styles.sectionLabel}>Guests</Text>
                      <Text style={styles.sectionVal}>{guestSummary}</Text>
                    </View>
                    <Pressable onPress={() => setStep('dates')} style={styles.changeBtn}>
                      <Text style={styles.changeBtnText}>Change</Text>
                    </Pressable>
                  </View>
                </View>

                {/* CARD 2: PAYMENT METHOD SELECTED */}
                <View style={styles.cardContainer}>
                  <View style={styles.cardSectionRow}>
                    <View style={styles.cardSectionLeft}>
                      <Text style={styles.sectionLabel}>Payment method</Text>
                      <Text style={styles.sectionVal}>
                        {paymentMethod === 'mpesa'
                          ? `Safaricom M-Pesa (${mpesaPhone || 'Phone'})`
                          : savedCard
                          ? `Credit Card •••• ${savedCard.cardNumber.slice(-4)}`
                          : 'Credit / Debit Card'}
                      </Text>
                    </View>
                    <Pressable onPress={() => setStep('payment_method')} style={styles.changeBtn}>
                      <Text style={styles.changeBtnText}>Change</Text>
                    </Pressable>
                  </View>
                </View>

                {/* CARD 3: PRICE DETAILS */}
                <View style={styles.cardContainer}>
                  <Text style={styles.cardHeaderTitle}>Price details</Text>
                  <View style={styles.cardItemRow}>
                    <Text style={styles.cardItemLabel}>
                      {units} {priceUnit}{units !== 1 ? 's' : ''} x KSh {price.toLocaleString()}.00
                    </Text>
                    <Text style={styles.cardItemVal}>KSh {totalAmount.toLocaleString()}.00</Text>
                  </View>
                  <View style={styles.cardItemRow}>
                    <Text style={styles.cardItemLabel}>Service fee</Text>
                    <Text style={styles.cardItemVal}>KSh 0.00</Text>
                  </View>
                  <View style={styles.cardDivider} />
                  <View style={styles.cardTotalRow}>
                    <Text style={styles.cardTotalLabel}>Total KES</Text>
                    <Text style={styles.cardTotalVal}>KSh {totalAmount.toLocaleString()}.00</Text>
                  </View>

                  <View style={styles.escrowTrustBanner}>
                    <MaterialCommunityIcons name="shield-check" size={18} color="#10B981" />
                    <Text style={styles.escrowTrustText}>
                      Protected by ZuruSasa Secure Escrow. Payment is released to the host only after check-in.
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}
          </ScrollView>

        {/* ── STICKY BOTTOM ACTION BAR (Orange Buttons) ── */}
        <View style={[styles.bottomStickyBar, { paddingBottom: insets.bottom + 12 }]}>
          {step === 'details' ? (
            /* Step 0: Listing Details Bottom Bar */
            <View style={styles.detailsBottomRow}>
              <View style={styles.detailsBottomPriceCol}>
                {exp?.current_price != null ? (
                  <Text style={styles.detailsBottomPriceVal}>
                    KES {Number(exp.current_price).toLocaleString()}
                    <Text style={styles.detailsBottomPriceUnit}> / {exp.price_unit ?? 'night'}</Text>
                  </Text>
                ) : (
                  <Text style={styles.detailsBottomPriceVal}>Add dates for prices</Text>
                )}
                <View style={styles.bottomRatingRow}>
                  {reviewCount > 0 ? (
                    <>
                      <MaterialCommunityIcons name="star" size={12} color="#111111" />
                      <Text style={styles.bottomRatingText}>{ratingVal.toFixed(1)} ({reviewCount})</Text>
                    </>
                  ) : (
                    <Text style={styles.bottomRatingText}>★ New listing</Text>
                  )}
                </View>
              </View>

              <Pressable onPress={() => setStep('dates')} style={styles.checkAvailabilityBtn}>
                <Text style={styles.checkAvailabilityBtnText}>Check availability</Text>
              </Pressable>
            </View>
          ) : step === 'dates' ? (
            /* Step 1: Dates Bottom Bar */
            <View style={styles.datesStickyRow}>
              <View style={styles.datesPriceCol}>
                <Text style={styles.datesPriceMain}>
                  KES {Number(price).toLocaleString()}
                  <Text style={styles.datesPriceUnit}> / {priceUnit}</Text>
                </Text>
                <Text style={styles.datesTotalSub}>
                  {from && to ? `KES ${totalAmount.toLocaleString()} total` : 'Add dates for total'}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (!from) {
                    Alert.alert('Select Dates', 'Please pick your check-in and checkout dates.');
                    return;
                  }
                  if (!to) {
                    setTo(addDays(from, 1));
                  }
                  setStep('review');
                }}
                style={styles.orangeDatesReserveBtn}
              >
                <Text style={styles.orangeDatesReserveBtnText}>Reserve</Text>
              </Pressable>
            </View>
          ) : step === 'review' ? (
            /* Step 2: Progress Indicator + Orange Next Button */
            <>
              <View style={styles.stepProgressBar}>
                <View style={[styles.stepSegment, styles.stepSegmentActive]} />
                <View style={[styles.stepSegment, styles.stepSegmentActive]} />
                <View style={styles.stepSegment} />
              </View>
              <Pressable onPress={() => setStep('payment_method')} style={styles.orangePrimaryBtn}>
                <Text style={styles.orangePrimaryBtnText}>Next</Text>
              </Pressable>
            </>
          ) : step === 'payment_method' ? (
            /* Step 3: Add Payment Method Bottom Bar (Progress Indicator + Orange Next Button) */
            <>
              <View style={styles.stepProgressBar}>
                <View style={[styles.stepSegment, styles.stepSegmentActive]} />
                <View style={[styles.stepSegment, styles.stepSegmentActive]} />
                <View style={[styles.stepSegment, styles.stepSegmentActive]} />
              </View>
              <Pressable
                onPress={() => {
                  if (paymentMethod === 'card' && !savedCard) {
                    setCardModalVisible(true);
                    return;
                  }
                  setStep('confirm_pay');
                }}
                style={styles.orangePrimaryBtn}
              >
                <Text style={styles.orangePrimaryBtnText}>Next</Text>
              </Pressable>
            </>
          ) : (
            /* Step 4: Confirm and Pay Button */
            <>
              {phase === 'pin' || phase === 'settling' ? (
                <View style={styles.paymentProcessingBanner}>
                  <PremiumLoader color={BRAND_ORANGE} size={6} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.paymentProcessingHeader}>
                      {phase === 'pin' ? 'Check your phone' : 'Confirming your payment…'}
                    </Text>
                    <Text style={styles.paymentProcessingText}>
                      {phase === 'pin'
                        ? `Enter your M-Pesa PIN for ${formatPhoneForPrompt(mpesaPhone || (user?.user_metadata?.phone as string) || user?.phone)} to complete your payment.`
                        : 'Connecting to payment provider to verify settlement…'}
                    </Text>
                  </View>
                </View>
              ) : null}

              <Pressable
                onPress={startPaymentFlow}
                disabled={busy}
                style={({ pressed }) => [
                  styles.orangePrimaryBtn,
                  { opacity: pressed || busy ? 0.88 : 1 },
                ]}
              >
                {busy ? (
                  <PremiumLoader color="#FFFFFF" size={8} />
                ) : (
                  <Text style={styles.orangePrimaryBtnText}>Confirm and pay</Text>
                )}
              </Pressable>

              <Text style={styles.agreeTermsFooterText}>
                By selecting the button, I agree to the <Text style={styles.termsUnderline}>booking terms</Text>.
              </Text>
            </>
          )}
        </View>
      </View>

      {/* ── CARD PAYMENT MODAL (Matching Screenshot 2 exactly) ── */}
      <CardPaymentModal
        visible={cardModalVisible}
        onClose={() => setCardModalVisible(false)}
        amount={totalAmount}
        experienceTitle={title}
        onConfirmPay={handleCardSaved}
      />

      {/* ── SUCCESS CONFIRMATION MODAL / BOTTOM SHEET ── */}
      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleSuccessClose}
      >
        <View style={styles.successModalBackdrop}>
          <Pressable style={styles.successModalDismissArea} onPress={handleSuccessClose} />

          <View style={[styles.successModalCard, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
            {/* Green Circular Success Indicator */}
            <View style={styles.successBadgeWrap}>
              <View style={styles.successHalo}>
                <View style={styles.successCircle}>
                  <Feather name="check" size={32} color="#FFFFFF" />
                </View>
              </View>
            </View>

            {/* Title & Description */}
            <Text style={styles.successModalTitle}>Booking Confirmed!</Text>
            <Text style={styles.successModalSub}>
              Your stay at <Text style={styles.successModalListingName}>{title}</Text> is secured. Your payment is held safely in escrow.
            </Text>

            {/* Action Buttons */}
            <View style={styles.successActionsCol}>
              {/* Primary CTA: View Itinerary */}
              <Pressable
                onPress={handleViewItinerary}
                style={({ pressed }) => [
                  styles.successPrimaryBtn,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
                hitSlop={8}
              >
                <Text style={styles.successPrimaryBtnText}>View Itinerary</Text>
              </Pressable>

              {/* Secondary Action: Done */}
              <Pressable
                onPress={handleSuccessClose}
                style={({ pressed }) => [
                  styles.successSecondaryBtn,
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={8}
              >
                <Text style={styles.successSecondaryBtnText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── CARD PAYMENT MODAL (Matching Screenshot 2 exactly) ── */}
      <CardPaymentModal
        visible={cardModalVisible}
        onClose={() => setCardModalVisible(false)}
        amount={totalAmount}
        experienceTitle={title}
        onConfirmPay={handleCardSaved}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  headerBackBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  headerCloseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearDatesText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    textDecorationLine: 'underline',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  /* Step 3: Add Payment Method Styles (Screenshot 1) */
  paymentMethodPageTitle: {
    fontSize: 26,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    letterSpacing: -0.5,
  },
  paymentMethodsGroupedBox: {
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  paymentMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  paymentMethodItemActive: {
    backgroundColor: '#FFFFFF',
  },
  paymentMethodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  mpesaLogoSquare: {
    width: 36,
    height: 36,
  },
  paymentMethodItemText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  paymentMethodDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginHorizontal: 18,
  },
  cardBrandsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  visaTextBadge: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1F71',
    fontWeight: '900',
    fontStyle: 'italic',
  },
  mastercardCircles: {
    flexDirection: 'row',
    width: 20,
    height: 12,
    position: 'relative',
  },
  mcRedCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EB001B',
    position: 'absolute',
    left: 0,
  },
  mcAmberCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F79E1B',
    position: 'absolute',
    left: 6,
    opacity: 0.9,
  },
  airbnbRadioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#B0B0B0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  airbnbRadioOuterSelected: {
    borderColor: '#222222',
  },
  airbnbRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#222222',
  },
  mpesaPhoneFieldWrapper: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 6,
  },
  mpesaPhoneFieldLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#717171',
    letterSpacing: 0.5,
  },
  mpesaPhoneFieldInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
    backgroundColor: '#F9FAFB',
  },
  mpesaPhoneFieldHint: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  savedCardRowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
  },
  savedCardRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  savedCardRowText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#374151',
  },
  savedCardEditBtn: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: BRAND_ORANGE,
    textDecorationLine: 'underline',
  },

  /* Listing Details Specific Styles */
  heroWrap: {
    width: '100%',
    height: 300,
    position: 'relative',
    backgroundColor: '#000000',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroNavRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  navCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  navRightGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  photoCountPill: {
    position: 'absolute',
    bottom: 14,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.68)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  photoCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  detailsBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  titleSection: {
    gap: 6,
  },
  listingTitle: {
    fontSize: 24,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    lineHeight: 28,
  },
  unitSubtitle: {
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  capacitySpecs: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  guestFavRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginVertical: 20,
    backgroundColor: '#FFFFFF',
  },
  ribbonCol: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  ribbonRatingNumber: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    marginBottom: 2,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 1,
  },
  ribbonDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#EBEBEB',
  },
  ribbonMiddleCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  laurelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  guestFavTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    lineHeight: 16,
    textAlign: 'center',
  },
  ribbonReviewsNumber: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  ribbonReviewsLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
    textDecorationLine: 'underline',
  },
  separator: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginVertical: 20,
  },
  highlightsBlock: {
    gap: 18,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  highlightIcon: {
    marginTop: 2,
  },
  highlightHeading: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  highlightSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    marginTop: 2,
    lineHeight: 17,
  },
  descriptionSection: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    marginBottom: 6,
  },
  descriptionText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#333333',
    lineHeight: 22,
  },
  reviewsShowcaseBlock: {
    alignItems: 'center',
    gap: 10,
  },
  bigWreathHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bigRatingText: {
    fontSize: 48,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  bigGuestFavTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  bigGuestFavSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
    maxWidth: '85%',
    lineHeight: 18,
  },
  reviewsCarousel: {
    paddingVertical: 12,
    gap: 12,
  },
  reviewSnippetCard: {
    width: 250,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  reviewerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  reviewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerAvatarInitial: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#374151',
  },
  reviewerName: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  reviewerLoc: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  reviewRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  reviewTimeAgo: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  reviewHeadline: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    marginBottom: 3,
  },
  reviewSnippetBody: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#4B5563',
    lineHeight: 16,
  },
  showAllReviewsBtn: {
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 6,
  },
  showAllReviewsBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  amenitiesSection: {
    gap: 12,
  },
  amenitiesList: {
    gap: 12,
  },
  amenityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amenityIcon: {
    width: 22,
  },
  amenityName: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#222222',
  },
  showAllAmenitiesBtn: {
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  showAllAmenitiesBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  locationSection: {
    gap: 8,
  },
  locationSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  mapCardMock: {
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 6,
  },
  mapCardImage: {
    width: '100%',
    height: '100%',
  },
  mapPinCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -18,
    marginLeft: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND_ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  meetHostSection: {
    gap: 14,
  },
  hostProfileCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  hostCardLeft: {
    alignItems: 'center',
    flex: 1,
  },
  hostCardAvatarWrap: {
    position: 'relative',
    marginBottom: 6,
  },
  hostCardAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  hostCardAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostCardAvatarInitial: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#374151',
  },
  hostCardShieldBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BRAND_ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  hostCardName: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  superhostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  superhostText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
  },
  hostCardStatsCol: {
    flex: 1,
    gap: 8,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#EBEBEB',
  },
  hostStatItem: {
    alignItems: 'center',
  },
  hostStatNum: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  hostStatLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  hostStatDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
    width: '60%',
    alignSelf: 'center',
  },
  hostAttributesList: {
    gap: 8,
  },
  hostAttrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hostAttrText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#222222',
  },
  hostBioText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#4B5563',
    lineHeight: 20,
  },
  hostDetailsBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  hostDetailsTitle: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    marginBottom: 2,
  },
  hostDetailsText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#4B5563',
  },
  thingsToKnowSection: {
    gap: 14,
  },
  thingItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  thingIcon: {
    marginTop: 2,
  },
  thingItemTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  thingItemSub: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    marginTop: 1,
    lineHeight: 16,
  },
  detailsBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailsBottomPriceCol: {
    gap: 2,
  },
  detailsBottomPriceVal: {
    fontSize: 17,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  detailsBottomPriceUnit: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  bottomRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  bottomRatingText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  checkAvailabilityBtn: {
    backgroundColor: BRAND_ORANGE,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
    shadowColor: BRAND_ORANGE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  checkAvailabilityBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },

  /* Step 1: Dates Specific Styles */
  tripHeadingBlock: {
    gap: 4,
  },
  tripH1: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  tripSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  dateTabsWrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  dateTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dateTabActive: {
    backgroundColor: '#F7F7F7',
    borderBottomWidth: 2,
    borderBottomColor: '#222222',
  },
  dateTabLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: '#717171',
    letterSpacing: 0.5,
  },
  dateTabVal: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    marginTop: 2,
  },
  dateTabDivider: {
    width: 1,
    backgroundColor: '#DDDDDD',
  },
  calendarContainer: {
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  calendarMonthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthHeaderTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  monthNavRow: {
    flexDirection: 'row',
    gap: 8,
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellEmpty: {
    width: `${100 / 7}%`,
    height: 42,
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellInRange: {
    backgroundColor: '#FFF7ED',
  },
  dayCellStart: {
    backgroundColor: '#FFF7ED',
    borderTopLeftRadius: 21,
    borderBottomLeftRadius: 21,
  },
  dayCellEnd: {
    backgroundColor: '#FFF7ED',
    borderTopRightRadius: 21,
    borderBottomRightRadius: 21,
  },
  dayNumWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumWrapSelected: {
    backgroundColor: BRAND_ORANGE,
  },
  dayNumText: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  dayNumTextDisabled: {
    color: '#DDDDDD',
  },
  dayNumTextInRange: {
    color: '#C2410C',
    fontFamily: 'DMSans_700Bold',
  },
  dayNumTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'DMSans_700Bold',
  },
  guestsSection: {
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 16,
    padding: 16,
    gap: 16,
    backgroundColor: '#FFFFFF',
  },
  guestsSectionHeading: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guestTypeTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  guestTypeSub: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  guestCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#B0B0B0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnDisabled: {
    borderColor: '#EBEBEB',
  },
  counterNum: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    minWidth: 16,
    textAlign: 'center',
  },
  datesStickyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datesPriceCol: {
    gap: 2,
  },
  datesPriceMain: {
    fontSize: 17,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  datesPriceUnit: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  datesTotalSub: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textDecorationLine: 'underline',
  },
  orangeDatesReserveBtn: {
    backgroundColor: BRAND_ORANGE,
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 10,
    shadowColor: BRAND_ORANGE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  orangeDatesReserveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },

  /* Step 2 & 4: Summary Cards Styles */
  mainCard: {
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    gap: 14,
  },
  listingSnippetRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  listingThumb: {
    width: 76,
    height: 76,
    borderRadius: 12,
  },
  listingSnippetMeta: {
    flex: 1,
    gap: 4,
  },
  snippetTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    lineHeight: 19,
  },
  snippetRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  snippetRatingText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
  },
  cardSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSectionLeft: {
    flex: 1,
    gap: 2,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  sectionVal: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  sectionSub: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },
  changeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  changeBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: BRAND_ORANGE,
    textDecorationLine: 'underline',
  },
  cardContainer: {
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  cardItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardItemLabel: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#4B5563',
  },
  cardItemVal: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#111111',
  },
  cardTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  cardTotalLabel: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  cardTotalVal: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: BRAND_ORANGE,
  },
  cardBodyText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#4B5563',
    lineHeight: 18,
  },
  escrowTrustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  escrowTrustText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#065F46',
    flex: 1,
    lineHeight: 16,
  },
  paymentProcessingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 12,
    marginBottom: 6,
  },
  paymentProcessingHeader: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#9A3412',
  },
  paymentProcessingText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#C2410C',
    lineHeight: 16,
  },
  bottomStickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  stepProgressBar: {
    flexDirection: 'row',
    gap: 6,
  },
  stepSegment: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#EBEBEB',
  },
  stepSegmentActive: {
    backgroundColor: BRAND_ORANGE,
  },
  orangePrimaryBtn: {
    backgroundColor: BRAND_ORANGE,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND_ORANGE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  orangePrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  agreeTermsFooterText: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
  },
  termsUnderline: {
    textDecorationLine: 'underline',
  },
  /* Success Confirmation Modal Styles */
  successModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  successModalDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  successModalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  successBadgeWrap: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successHalo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  successModalTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  successModalSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 26,
    paddingHorizontal: 12,
  },
  successModalListingName: {
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  successActionsCol: {
    width: '100%',
    gap: 10,
  },
  successPrimaryBtn: {
    backgroundColor: BRAND_ORANGE,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND_ORANGE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  successPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  successSecondaryBtn: {
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  successSecondaryBtnText: {
    color: '#374151',
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
  },
});
