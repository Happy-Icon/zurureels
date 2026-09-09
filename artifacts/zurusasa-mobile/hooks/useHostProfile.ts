import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { hostProfileService } from '@/services/hostProfileService';
import type { HostProfileData, HostReviewRow, ExperienceRow } from '@/lib/supabase';

export function useHostProfile(hostId: string) {
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['host-profile', hostId],
    queryFn: async () => {
      if (!hostId) {
        return {
          host: null as HostProfileData | null,
          listings: [] as ExperienceRow[],
          reviews: [] as HostReviewRow[],
        };
      }
      const [hostData, listingsData, reviewsData] = await Promise.all([
        hostProfileService.fetchHostProfile(hostId),
        hostProfileService.fetchHostListings(hostId),
        hostProfileService.fetchHostReviews(hostId),
      ]);
      return {
        host: hostData,
        listings: listingsData,
        reviews: reviewsData,
      };
    },
    enabled: Boolean(hostId),
    staleTime: 30_000,
  });

  const toggleFollow = () => {
    setIsFollowing((prev) => !prev);
  };

  const toggleSaveHost = () => {
    setIsSaved((prev) => !prev);
  };

  return {
    host: data?.host ?? null,
    listings: data?.listings ?? [],
    reviews: data?.reviews ?? [],
    isLoading,
    isFollowing,
    isSaved,
    toggleFollow,
    toggleSaveHost,
    refresh: refetch,
  };
}
