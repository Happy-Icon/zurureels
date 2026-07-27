import { useState, useEffect, useCallback } from 'react';
import { reviewService, type ReviewSummaryData, type CreateReviewParams } from '@/services/reviewService';
import type { FullReviewRow } from '@/lib/supabase';

export function useReviews(listingId: string) {
  const [reviews, setReviews] = useState<FullReviewRow[]>([]);
  const [summary, setSummary] = useState<ReviewSummaryData>({
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
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'recent' | 'highest' | 'lowest' | 'helpful'>('recent');

  const loadReviews = useCallback(async () => {
    if (!listingId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await reviewService.fetchReviewsForListing(listingId, sortBy);
      setReviews(res.reviews);
      setSummary(res.summary);
    } catch (err) {
      console.warn('useReviews fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [listingId, sortBy]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const toggleHelpful = async (reviewId: string) => {
    // Optimistic UI update
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId ? { ...r, helpful_count: (r.helpful_count || 0) + 1 } : r,
      ),
    );
    await reviewService.toggleHelpful(reviewId);
  };

  const createReview = async (params: CreateReviewParams) => {
    const newRev = await reviewService.createReview(params);
    if (newRev) {
      await loadReviews();
    }
    return newRev;
  };

  return {
    reviews,
    summary,
    isLoading,
    sortBy,
    setSortBy,
    toggleHelpful,
    createReview,
    refresh: loadReviews,
  };
}
