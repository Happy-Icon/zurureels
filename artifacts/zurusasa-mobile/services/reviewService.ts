import { supabase, type FullReviewRow } from '@/lib/supabase';
import { notificationService } from '@/services/notificationService';

export interface CreateReviewParams {
  bookingId: string;
  reviewerId: string;
  revieweeId?: string;
  listingId?: string | null;
  rating: number;
  cleanliness?: number;
  communication?: number;
  accuracy?: number;
  location?: number;
  value?: number;
  checkIn?: number;
  comment: string;
  photos?: string[];
  isHostReview?: boolean;
}

export interface ReviewSummaryData {
  averageRating: number;
  totalCount: number;
  ratingBreakdown: { 5: number; 4: number; 3: number; 2: number; 1: number };
  categoryAverages: {
    cleanliness: number;
    communication: number;
    accuracy: number;
    location: number;
    value: number;
    checkIn: number;
  };
}

export const reviewService = {
  /**
   * Fetch real reviews and summary from Supabase for a specific listing or experience
   */
  async fetchReviewsForListing(
    listingId: string,
    sortBy: 'recent' | 'highest' | 'lowest' | 'helpful' = 'recent',
  ): Promise<{ reviews: FullReviewRow[]; summary: ReviewSummaryData }> {
    try {
      if (!listingId) {
        return {
          reviews: [],
          summary: this.computeReviewSummary([]),
        };
      }

      // 1. Fetch real summary from authoritative RPC
      let summaryData: ReviewSummaryData | null = null;
      try {
        const { data: rpcSummary, error: summaryErr } = await supabase.rpc('get_listing_reviews_summary', {
          p_listing_id: listingId,
        });
        if (!summaryErr && rpcSummary) {
          summaryData = rpcSummary as ReviewSummaryData;
        }
      } catch (err) {
        console.warn('Could not fetch review summary RPC, computing locally:', err);
      }

      // 2. Query reviews table
      let query = supabase
        .from('reviews')
        .select('*')
        .eq('listing_id', listingId)
        .eq('is_host_review', false);

      if (sortBy === 'highest') {
        query = query.order('rating', { ascending: false }).order('created_at', { ascending: false });
      } else if (sortBy === 'lowest') {
        query = query.order('rating', { ascending: true }).order('created_at', { ascending: false });
      } else if (sortBy === 'helpful') {
        query = query.order('helpful_count', { ascending: false }).order('created_at', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Error querying reviews:', error);
        return {
          reviews: [],
          summary: summaryData || this.computeReviewSummary([]),
        };
      }

      const rawReviews = (data as FullReviewRow[]) ?? [];
      if (rawReviews.length === 0) {
        return {
          reviews: [],
          summary: summaryData || this.computeReviewSummary([]),
        };
      }

      // 3. Fetch reviewer profiles to populate avatar, name, verification
      const reviewerIds = Array.from(new Set(rawReviews.map((r) => r.reviewer_id).filter(Boolean)));
      const reviewerMap = new Map<string, { full_name: string; avatar_url: string | null; verification_status: string | null }>();

      if (reviewerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, verification_status')
          .in('id', reviewerIds);

        (profiles ?? []).forEach((p) => {
          reviewerMap.set(p.id, {
            full_name: p.full_name || 'Guest Traveler',
            avatar_url: p.avatar_url || null,
            verification_status: p.verification_status || null,
          });
        });
      }

      const reviewsList: FullReviewRow[] = rawReviews.map((r) => ({
        ...r,
        reviewer: reviewerMap.get(r.reviewer_id) || {
          full_name: 'Guest Traveler',
          avatar_url: null,
          verification_status: null,
        },
      }));

      const finalSummary = summaryData || this.computeReviewSummary(reviewsList);
      return { reviews: reviewsList, summary: finalSummary };
    } catch (err) {
      console.warn('Error in fetchReviewsForListing:', err);
      return {
        reviews: [],
        summary: this.computeReviewSummary([]),
      };
    }
  },

  /**
   * Calculate rating breakdown & category averages locally
   */
  computeReviewSummary(reviews: FullReviewRow[]): ReviewSummaryData {
    if (!reviews || reviews.length === 0) {
      return {
        averageRating: 5.0,
        totalCount: 0,
        ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        categoryAverages: {
          cleanliness: 5.0,
          communication: 5.0,
          accuracy: 5.0,
          location: 5.0,
          value: 5.0,
          checkIn: 5.0,
        },
      };
    }

    const totalCount = reviews.length;
    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sumRating = 0;
    let sumCleanliness = 0;
    let sumCommunication = 0;
    let sumAccuracy = 0;
    let sumLocation = 0;
    let sumValue = 0;
    let sumCheckIn = 0;

    for (const r of reviews) {
      const star = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
      breakdown[star as 1 | 2 | 3 | 4 | 5] = (breakdown[star as 1 | 2 | 3 | 4 | 5] || 0) + 1;
      sumRating += Number(r.rating || 5);
      sumCleanliness += Number(r.cleanliness || r.rating || 5);
      sumCommunication += Number(r.communication || r.rating || 5);
      sumAccuracy += Number(r.accuracy || r.rating || 5);
      sumLocation += Number(r.location || r.rating || 5);
      sumValue += Number(r.value || r.rating || 5);
      sumCheckIn += Number(r.check_in || r.rating || 5);
    }

    return {
      averageRating: Number((sumRating / totalCount).toFixed(2)),
      totalCount,
      ratingBreakdown: breakdown,
      categoryAverages: {
        cleanliness: Number((sumCleanliness / totalCount).toFixed(1)),
        communication: Number((sumCommunication / totalCount).toFixed(1)),
        accuracy: Number((sumAccuracy / totalCount).toFixed(1)),
        location: Number((sumLocation / totalCount).toFixed(1)),
        value: Number((sumValue / totalCount).toFixed(1)),
        checkIn: Number((sumCheckIn / totalCount).toFixed(1)),
      },
    };
  },

  /**
   * Check if a user is eligible to review a booking
   */
  async checkReviewEligibility(bookingId: string, userId: string): Promise<{ eligible: boolean; reason?: string }> {
    try {
      if (!bookingId || !userId) {
        return { eligible: false, reason: 'Missing booking or user ID' };
      }

      // 1. Booking must exist and belong to user
      const { data: booking, error: bErr } = await supabase
        .from('bookings')
        .select('id, user_id, status, check_out')
        .eq('id', bookingId)
        .single();

      if (bErr || !booking) {
        return { eligible: false, reason: 'Reservation not found' };
      }

      if (booking.user_id !== userId) {
        return { eligible: false, reason: 'You can only review your own trips' };
      }

      const s = (booking.status || '').toLowerCase();
      const checkoutPassed = booking.check_out ? new Date(booking.check_out).getTime() <= Date.now() : false;

      if (s === 'cancelled' || s === 'refunded') {
        return { eligible: false, reason: 'Cancelled trips cannot be reviewed' };
      }

      if (s !== 'completed' && !(s === 'confirmed' && checkoutPassed)) {
        return { eligible: false, reason: 'Reviews are available after your stay is completed' };
      }

      // 2. Check if review already exists
      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('is_host_review', false)
        .maybeSingle();

      if (existing) {
        return { eligible: false, reason: 'You have already submitted a review for this trip' };
      }

      return { eligible: true };
    } catch (err: any) {
      console.warn('Error checking review eligibility:', err);
      return { eligible: false, reason: err?.message || 'Could not verify eligibility' };
    }
  },

  /**
   * Submit a new review via the authoritative Security Definer RPC
   */
  async createReview(params: CreateReviewParams): Promise<FullReviewRow> {
    const { data, error } = await supabase.rpc('submit_booking_review', {
      p_booking_id: params.bookingId,
      p_rating: params.rating,
      p_cleanliness: params.cleanliness ?? params.rating,
      p_accuracy: params.accuracy ?? params.rating,
      p_communication: params.communication ?? params.rating,
      p_location: params.location ?? params.rating,
      p_value: params.value ?? params.rating,
      p_check_in: params.checkIn ?? params.rating,
      p_comment: params.comment.trim(),
      p_photos: params.photos ?? [],
    });

    if (error) {
      throw new Error(error.message);
    }

    return data as FullReviewRow;
  },

  /**
   * Upvote helpful count on a review
   */
  async toggleHelpful(reviewId: string): Promise<boolean> {
    try {
      const { data: rev } = await supabase
        .from('reviews')
        .select('helpful_count')
        .eq('id', reviewId)
        .single();

      const current = (rev?.helpful_count as number) || 0;

      const { error } = await supabase
        .from('reviews')
        .update({ helpful_count: current + 1 })
        .eq('id', reviewId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('Error toggling helpful:', err);
      return false;
    }
  },
};
