import { useState, useEffect, useCallback } from 'react';
import { hostProfileService } from '@/services/hostProfileService';
import type { HostProfileData, HostReviewRow, ExperienceRow } from '@/lib/supabase';

export function useHostProfile(hostId: string) {
  const [host, setHost] = useState<HostProfileData | null>(null);
  const [listings, setListings] = useState<ExperienceRow[]>([]);
  const [reviews, setReviews] = useState<HostReviewRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const loadHostData = useCallback(async () => {
    if (!hostId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [hostData, listingsData, reviewsData] = await Promise.all([
        hostProfileService.fetchHostProfile(hostId),
        hostProfileService.fetchHostListings(hostId),
        hostProfileService.fetchHostReviews(hostId),
      ]);

      setHost(hostData);
      setListings(listingsData);
      setReviews(reviewsData);
    } catch (err) {
      console.warn('useHostProfile load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [hostId]);

  useEffect(() => {
    loadHostData();
  }, [loadHostData]);

  const toggleFollow = () => {
    setIsFollowing((prev) => !prev);
  };

  const toggleSaveHost = () => {
    setIsSaved((prev) => !prev);
  };

  return {
    host,
    listings,
    reviews,
    isLoading,
    isFollowing,
    isSaved,
    toggleFollow,
    toggleSaveHost,
    refresh: loadHostData,
  };
}
