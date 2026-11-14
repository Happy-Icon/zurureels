import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { useAuth } from '@/context/AuthContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { useActiveSpecialOffers, useExperienceBlockedDates } from '@/lib/queries';
import { supabase, resolveAvatarUrl, type ReelRow } from '@/lib/supabase';
import {
  getPrimaryCategoryMeta,
  getSubcategoryLabel,
  normalizePrimaryCategory,
  resolveReelContentType,
} from '@/constants/taxonomy';
import { reviewService, type ReviewSummaryData } from '@/services/reviewService';
import {
  DAY_MS,
  addDays,
  formatHostTenure,
  generateUUID,
  startOfDay,
  type GuestCounts,
  type PaymentMethod,
  type Phase,
  type Step,
} from '@/components/booking/bookingHelpers';

export interface UseBookingCheckoutArgs {
  reel: ReelRow;
  visible: boolean;
  onClose: () => void;
  initialStep: Step;
  onSuccess?: () => void;
}

export function useBookingCheckout({
  reel,
  visible,
  onClose,
  initialStep,
  onSuccess,
}: UseBookingCheckoutArgs) {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useCustomAlert();
  const queryClient = useQueryClient();

  const exp = reel.experience;
  const meta = (exp?.metadata ?? {}) as Record<string, unknown>;
  const hostMeta = (reel.host?.metadata ?? {}) as Record<string, unknown>;
  const title = exp?.title ?? (reel as any).caption ?? 'Coastal Experience';
  const price = exp?.current_price != null ? Number(exp.current_price) : 0;
  const priceUnit = exp?.price_unit ?? 'night';
  const category = (reel.category ?? exp?.category ?? '').toLowerCase();
  const contentType = resolveReelContentType(reel);
  const primaryCategory = normalizePrimaryCategory(reel.category || exp?.category);
  const primaryCategoryMeta = getPrimaryCategoryMeta(primaryCategory);
  const expExt = exp as
    | (typeof exp & { subcategory?: string | null; operating_hours?: string | null })
    | null
    | undefined;
  const subcategoryLabel = getSubcategoryLabel(
    reel.subcategory || expExt?.subcategory || (meta.subcategory as string | undefined) || null,
  );
  const durationInfo = (meta.duration_info as string | undefined) || null;
  const operatingHours =
    expExt?.operating_hours || (meta.operating_hours as string | undefined) || null;
  const whatsIncluded = (meta.whats_included as string | undefined) || null;
  const meetingPoint =
    (meta.meeting_point as string | undefined) || exp?.arrival_instructions?.directions || null;
  const isNightBased =
    (contentType === 'experience' && primaryCategory === 'accommodation') ||
    ['accommodation', 'hotel', 'villa', 'apartment', 'stay', 'stays'].includes(category) ||
    priceUnit === 'night';
  const { data: activeOffers = [] } = useActiveSpecialOffers({
    experienceId: exp?.id ?? null,
    fallbackReels: [reel],
  });
  const maxCapacity = exp?.max_guests || (meta.max_guests as number) || 2;
  const cancellationPolicy = (exp?.cancellation_policy || meta.cancellation_policy || 'flexible') as string;
  const checkInTime = exp?.check_in_time || (meta.check_in_time as string) || '14:00';
  const checkOutTime = exp?.check_out_time || (meta.check_out_time as string) || '10:00';

  const hostName = reel.host?.full_name ?? 'Zuru Host';
  const verified = Boolean(reel.host?.is_verified || reel.host?.verification_status === 'verified');
  const hostAvatar = resolveAvatarUrl(reel.host, user);

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

  const thumbnail =
    exp?.image_url ||
    reel.thumbnail_url ||
    (meta.image_urls as string[])?.[0] ||
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&q=80';

  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = useMemo(() => addDays(today, 365), [today]);

  const eventDateIso =
    reel.event?.event_date ||
    ((reel as any)?.event_details?.event_date as string | undefined) ||
    ((meta.event_details as Record<string, unknown> | undefined)?.event_date as string | undefined) ||
    null;

  const { defaultFrom, defaultTo } = useMemo(() => {
    if (contentType === 'event' && eventDateIso) {
      const parsed = new Date(eventDateIso);
      if (!Number.isNaN(parsed.getTime())) {
        const eventDay = startOfDay(parsed);
        if (eventDay.getTime() >= today.getTime()) {
          return {
            defaultFrom: eventDay,
            defaultTo: addDays(eventDay, 1),
          };
        }
      }
    }
    return {
      defaultFrom: addDays(today, 1),
      defaultTo: addDays(today, 2),
    };
  }, [contentType, eventDateIso, today]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(initialStep);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mpesa');
  const [from, setFrom] = useState<Date | undefined>(defaultFrom);
  const [to, setTo] = useState<Date | undefined>(defaultTo);
  const [activeDateTab, setActiveDateTab] = useState<'checkin' | 'checkout'>('checkin');
  const [viewMonth, setViewMonth] = useState<Date>(
    () => new Date(defaultFrom.getFullYear(), defaultFrom.getMonth(), 1),
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
  const [cardMethodConfirmed, setCardMethodConfirmed] = useState<boolean>(false);

  const [reviewsSummary, setReviewsSummary] = useState<ReviewSummaryData | null>(null);
  const [reviewsList, setReviewsList] = useState<any[]>([]);

  const activeQuoteRef = useRef<{
    quote: any;
    experienceId: string;
    checkInStr: string;
    checkOutStr: string;
    guestCount: number;
    expiresAtMs: number;
  } | null>(null);

  // Synchronize initial step when modal opens
  useEffect(() => {
    if (visible) {
      setStep(initialStep);
    }
  }, [visible, initialStep]);

  // Synchronize default dates and clear stale cached quote when listing/reel changes
  useEffect(() => {
    activeQuoteRef.current = null;
    setFrom(defaultFrom);
    setTo(defaultTo);
    setViewMonth(new Date(defaultFrom.getFullYear(), defaultFrom.getMonth(), 1));
  }, [reel.id, defaultFrom, defaultTo]);

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

  const isMountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeChannelRef = useRef<any>(null);

  const cleanupPaymentListeners = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanupPaymentListeners();
    };
  }, [cleanupPaymentListeners]);

  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [successModalVisible, setSuccessModalVisible] = useState<boolean>(false);
  const hasHandledSuccessRef = useRef(false);

  const resetState = useCallback(() => {
    activeQuoteRef.current = null;
    setStep(initialStep);
    setPaymentMethod('mpesa');
    setFrom(defaultFrom);
    setTo(defaultTo);
    setViewMonth(new Date(defaultFrom.getFullYear(), defaultFrom.getMonth(), 1));
    setGuests({ adults: 1, children: 0, infants: 0, pets: 0 });
    setMpesaPhone('');
    setCardMethodConfirmed(false);
    setPhase('idle');
    setCreatedBookingId(null);
    setSuccessModalVisible(false);
    hasHandledSuccessRef.current = false;
  }, [initialStep, defaultFrom, defaultTo]);

  const handleClose = useCallback(() => {
    cleanupPaymentListeners();
    onClose();
    setTimeout(resetState, 350);
  }, [cleanupPaymentListeners, onClose, resetState]);

  const handleSettlementSuccess = useCallback(
    (bookingId?: string | null) => {
      if (hasHandledSuccessRef.current) return;
      hasHandledSuccessRef.current = true;
      activeQuoteRef.current = null;
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
    [user?.id, queryClient, cleanupPaymentListeners],
  );

  const handleViewItinerary = useCallback(() => {
    setSuccessModalVisible(false);
    onSuccess?.();
    handleClose();
    setTimeout(() => {
      router.push({
        pathname: '/reservations' as any,
        params: createdBookingId ? { bookingId: createdBookingId } : undefined,
      });
    }, 120);
  }, [onSuccess, handleClose, router, createdBookingId]);

  const handleSuccessClose = useCallback(() => {
    setSuccessModalVisible(false);
    onSuccess?.();
    handleClose();
  }, [onSuccess, handleClose]);

  const isDateBlocked = useCallback(
    (d: Date) => {
      const time = d.getTime();
      return blockedRanges.some(
        (range: { from: Date; to: Date }) => time >= range.from.getTime() && time <= range.to.getTime(),
      );
    },
    [blockedRanges],
  );

  const handleDayPress = useCallback(
    (dayDate: Date) => {
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
    },
    [today, maxDate, isDateBlocked, from, to],
  );

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

  const executePayment = async (method: PaymentMethod) => {
    if (!user) {
      handleClose();
      router.push('/auth');
      return;
    }

    if (!from) {
      showAlert({
        title: 'Select Dates',
        message: 'Please select your check-in dates to continue.',
        icon: 'calendar',
        variant: 'warning',
      });
      return;
    }

    let phone = mpesaPhone.trim().replace(/[\s+-]/g, '');
    if (method === 'mpesa' && totalAmount > 0) {
      if (!phone) {
        const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
        phone = String(userMeta.phone ?? user.phone ?? '');
      }

      if (!phone || phone.length < 9) {
        showAlert({
          title: 'M-Pesa Phone Required',
          message: 'Please enter a valid Safaricom M-Pesa phone number.',
          icon: 'smartphone',
          variant: 'warning',
        });
        return;
      }
    }

    const checkInStr = from.toISOString();
    const checkOutStr = (to ?? addDays(from, 1)).toISOString();

    try {
      setPhase('submitting');

      const targetExperienceId = exp?.id || reel.experience_id;
      if (!targetExperienceId) {
        throw new Error('This listing is not linked to an active experience.');
      }

      // 1. Reuse active unconsumed quote on retry, or create an authoritative quote in DB
      const cached = activeQuoteRef.current;
      const nowMs = Date.now();
      let quote: any = null;

      if (
        cached &&
        cached.experienceId === targetExperienceId &&
        cached.checkInStr === checkInStr &&
        cached.checkOutStr === checkOutStr &&
        cached.guestCount === totalGuests &&
        cached.expiresAtMs > nowMs + 30_000
      ) {
        quote = cached.quote;
      } else {
        const quoteIdempotencyKey = generateUUID();
        const { data: createdQuote, error: quoteErr } = await supabase.rpc('create_booking_quote', {
          p_experience_id: targetExperienceId,
          p_check_in: checkInStr,
          p_check_out: checkOutStr,
          p_guest_count: totalGuests,
          p_idempotency_key: quoteIdempotencyKey,
        });

        if (quoteErr || !createdQuote) {
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

        quote = createdQuote;
        const parsedExpiry = createdQuote.expires_at
          ? new Date(createdQuote.expires_at).getTime()
          : NaN;
        activeQuoteRef.current = {
          quote: createdQuote,
          experienceId: targetExperienceId,
          checkInStr,
          checkOutStr,
          guestCount: totalGuests,
          expiresAtMs: Number.isFinite(parsedExpiry) ? parsedExpiry : nowMs + 14 * 60_000,
        };
      }

      // 2. Invoke Paystack Payment Edge Function (M-Pesa STK, Hosted Card, or Free Entry settlement)
      const paymentIdempotencyKey = generateUUID();
      const appCallbackUrl = Linking.createURL('payment-callback');

      const { data: payData, error: payErr } = await supabase.functions.invoke(
        'create-booking-payment',
        {
          body: {
            quoteId: quote.id,
            phone: method === 'mpesa' && totalAmount > 0 ? phone : undefined,
            channel: method === 'card' ? 'card' : 'mobile_money',
            callbackUrl: method === 'card' ? appCallbackUrl : undefined,
            idempotencyKey: paymentIdempotencyKey,
          },
        },
      );

      if (payErr || !payData || payData?.error) {
        let edgeErrorMessage = payData?.error;
        if (!edgeErrorMessage && payErr) {
          try {
            const errBody = await (payErr as any).context?.json?.();
            if (errBody?.error) edgeErrorMessage = String(errBody.error);
          } catch {
            // Ignore non-JSON error responses
          }
        }
        throw new Error(edgeErrorMessage || payErr?.message || 'Payment gateway connection failed.');
      }

      if (method === 'card' && payData?.status !== 'succeeded' && !payData?.authorization_url) {
        throw new Error('Could not initialize secure Paystack card checkout.');
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

      // 4. Realtime Listener for Instant Responsiveness (subscribed BEFORE opening Hosted Checkout)
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
              showAlert({
                title: 'Payment Failed',
                message: check.reason || 'Payment was declined.',
                icon: 'alert-circle',
                variant: 'error',
              });
            }
          },
        )
        .subscribe();

      realtimeChannelRef.current = channel;

      // 5. Bounded Polling Loop (Authoritative Source of Truth)
      let pollCount = 0;
      const MAX_POLLS = method === 'card' ? 100 : 40; // ~2 min for 3DS card checkout, ~48s for M-Pesa

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
            showAlert({
              title: 'Payment Failed',
              message: check.reason || 'Payment could not be completed.',
              icon: 'alert-circle',
              variant: 'error',
            });
            return;
          }

          if (pollCount >= MAX_POLLS) {
            cleanupPaymentListeners();

            const finalCheck = await checkAuthoritativeSettlement(quote.id, attemptId);
            if (finalCheck.settled) {
              handleSettlementSuccess(finalCheck.booking?.id);
              return;
            }

            setPhase('idle');

            showAlert({
              title: 'Payment is taking longer than expected',
              message:
                'Your payment may still be processing. You can check your Trips and return here later.',
              icon: 'clock',
              variant: 'warning',
              buttons: [
                { text: 'View Trips', onPress: handleViewItinerary },
                { text: 'Done', style: 'cancel' },
              ],
            });
          }
        } catch (pollErr) {
          console.warn('Poll iteration error (safe):', pollErr);
        }
      }, 1200);

      // 6. Launch Paystack Hosted 3D-Secure Card Checkout in Secure Auth Session
      if (method === 'card' && payData?.authorization_url) {
        try {
          await WebBrowser.openAuthSessionAsync(payData.authorization_url, appCallbackUrl);
        } catch {
          await WebBrowser.openBrowserAsync(payData.authorization_url);
        }

        const postBrowserCheck = await checkAuthoritativeSettlement(quote.id, attemptId);
        if (postBrowserCheck.settled) {
          handleSettlementSuccess(postBrowserCheck.booking?.id);
          return;
        }
        if (postBrowserCheck.failed) {
          cleanupPaymentListeners();
          setPhase('idle');
          showAlert({
            title: 'Payment Failed',
            message: postBrowserCheck.reason || 'Card payment could not be completed.',
            icon: 'alert-circle',
            variant: 'error',
          });
          return;
        }
      }
    } catch (err: any) {
      cleanupPaymentListeners();
      setPhase('idle');
      showAlert({
        title: 'Booking Error',
        message: err.message || 'An unexpected error occurred. Please try again.',
        icon: 'alert-circle',
        variant: 'error',
      });
    }
  };

  const startPaymentFlow = async () => {
    if (paymentMethod === 'card') {
      await executePayment('card');
    } else {
      await executePayment('mpesa');
    }
  };

  const handleCardConfirmed = useCallback(() => {
    setCardMethodConfirmed(true);
    setPaymentMethod('card');
    setCardModalVisible(false);
  }, []);

  const handleSeeAllReviews = useCallback(() => {
    handleClose();
    router.push({
      pathname: '/reviews' as any,
      params: {
        listingId: exp?.id || 'exp-default',
        title: exp?.title || 'Experience',
      },
    });
  }, [handleClose, router, exp?.id, exp?.title]);

  return {
    user,
    exp,
    contentType,
    primaryCategory,
    primaryCategoryMeta,
    subcategoryLabel,
    durationInfo,
    operatingHours,
    whatsIncluded,
    meetingPoint,
    activeOffers,
    title,
    price,
    priceUnit,
    maxCapacity,
    cancellationPolicy,
    checkInTime,
    checkOutTime,
    hostName,
    verified,
    hostAvatar,
    maxGuests,
    bedrooms,
    beds,
    baths,
    rawAmenities,
    amenities,
    showAllAmenities,
    setShowAllAmenities,
    heroImage,
    imageUrls,
    thumbnail,
    today,
    maxDate,
    step,
    setStep,
    paymentMethod,
    setPaymentMethod,
    from,
    setFrom,
    to,
    setTo,
    activeDateTab,
    setActiveDateTab,
    viewMonth,
    setViewMonth,
    guests,
    setGuests,
    mpesaPhone,
    setMpesaPhone,
    phase,
    busy,
    cardModalVisible,
    setCardModalVisible,
    cardMethodConfirmed,
    ratingVal,
    reviewCount,
    reviewsList,
    hostTenure,
    hostWork,
    hostLanguages,
    hostBio,
    hostResponseRate,
    hostResponseTime,
    totalGuests,
    guestSummary,
    nights,
    units,
    totalAmount,
    successModalVisible,
    isDateBlocked,
    handleDayPress,
    handleClose,
    handleViewItinerary,
    handleSuccessClose,
    handleCardConfirmed,
    handleSeeAllReviews,
    startPaymentFlow,
  };
}

export type BookingCheckoutState = ReturnType<typeof useBookingCheckout>;
