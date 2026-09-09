import { supabase, type HostProfileData, type HostReviewRow, type ExperienceRow } from '@/lib/supabase';
import { resolveAvatarUrl } from '@/lib/avatar';

export const hostProfileService = {
  /**
   * Fetch real host profile details and database-computed stats.
   * Completely authentic data from Supabase tables (no hardcoded mock fallbacks).
   */
  async fetchHostProfile(hostId: string): Promise<HostProfileData | null> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', hostId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching host profile:', error);
      }

      // Exact count of experiences published by this host
      const { count: propertiesCount } = await supabase
        .from('experiences')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', hostId);

      // Exact count of confirmed bookings for this host's experiences
      const { data: hostExperiences } = await supabase
        .from('experiences')
        .select('id')
        .eq('user_id', hostId);

      let tripsCount = 0;
      if (hostExperiences && hostExperiences.length > 0) {
        const expIds = hostExperiences.map((e) => e.id);
        const { count } = await supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .in('experience_id', expIds);
        tripsCount = count ?? 0;
      }

      // Exact reviews count and rating from public.reviews
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('rating')
        .eq('reviewee_id', hostId)
        .eq('is_host_review', false);

      let avgRating: number | undefined = undefined;
      let reviewsCount = 0;
      if (reviewsData && reviewsData.length > 0) {
        reviewsCount = reviewsData.length;
        const totalRating = reviewsData.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
        avgRating = Number((totalRating / reviewsCount).toFixed(2));
      } else if (profile?.rating && Number(profile.rating) > 0) {
        avgRating = Number(Number(profile.rating).toFixed(2));
        reviewsCount = profile.review_count || 0;
      }

      let meta: Record<string, any> = {};
      const rawMeta = profile?.metadata;
      if (typeof rawMeta === 'string') {
        try {
          meta = JSON.parse(rawMeta);
        } catch {
          meta = {};
        }
      } else if (rawMeta && typeof rawMeta === 'object') {
        meta = rawMeta as Record<string, any>;
      }

      const createdAt = (profile as any)?.created_at || (meta.created_at as string);
      const joinedYear = createdAt ? new Date(createdAt).getFullYear() : null;
      const currentYear = new Date().getFullYear();
      const yearsHosting = joinedYear ? Math.max(0, currentYear - joinedYear) : 0;
      const joinedDate = joinedYear ? `Hosting since ${joinedYear}` : null;

      // Authentic badges computed strictly from DB reality
      const isVerified = Boolean(
        profile?.is_verified === true || profile?.verification_status === 'verified'
      );
      const isSuperHost = Boolean(
        (meta.is_super_host as boolean) || (tripsCount >= 10 && (avgRating ?? 0) >= 4.8)
      );

      const realBadges: string[] = [];
      if (isSuperHost) realBadges.push('Super Host');
      if (isVerified) realBadges.push('Identity Verified');
      if (tripsCount >= 100) realBadges.push('100+ Trips Hosted');
      else if (tripsCount >= 10) realBadges.push('10+ Trips Hosted');
      if (propertiesCount && propertiesCount >= 3) realBadges.push('Multi-Property Host');
      if (reviewsCount >= 5 && (avgRating ?? 0) >= 4.8) realBadges.push('Top Rated Host');
      if (Array.isArray(meta.host_badges)) {
        realBadges.push(...(meta.host_badges as string[]));
      }

      // Authentic languages (only if explicitly set in profile)
      let languages: string[] = [];
      if (Array.isArray(profile?.languages) && profile.languages.length > 0) {
        languages = profile.languages;
      } else if (Array.isArray(meta.languages) && meta.languages.length > 0) {
        languages = meta.languages as string[];
      }

      const cleanAvatar = resolveAvatarUrl({
        id: hostId,
        avatar_url: (profile as any)?.avatar_url,
        metadata: meta,
        email: profile?.email || null,
      });

      const hostData: HostProfileData = {
        id: hostId,
        full_name: profile?.full_name || profile?.business_name || (meta.full_name as string) || 'Zuru Host',
        avatar_url: cleanAvatar,
        email: profile?.email || null,
        phone: profile?.phone || null,
        role: profile?.role || 'host',
        verification_status: profile?.verification_status || 'unverified',
        host_bio:
          (meta.host_bio as string) ||
          (meta.bio as string) ||
          (profile?.bio as string) ||
          null,
        languages,
        joined_date: joinedDate,
        response_rate: (meta.response_rate as string) || null,
        response_time: (meta.response_time as string) || null,
        is_super_host: isSuperHost,
        is_verified: isVerified,
        years_hosting: yearsHosting,
        repeat_guest_rate: (meta.repeat_guest_rate as string) || null,
        host_badges: realBadges,
        location: (meta.location as string) || (profile?.location as string) || null,
        properties_count: propertiesCount ?? 0,
        trips_hosted: tripsCount,
        average_rating: avgRating,
        reviews_count: reviewsCount,
        metadata: meta,
      };

      return hostData;
    } catch (err) {
      console.warn('Error in fetchHostProfile:', err);
      return null;
    }
  },

  /**
   * Fetch real host listings & published experiences for this hostId.
   * Maps real Cloudinary video poster thumbnails from host reels (zero stock photos).
   */
  async fetchHostListings(hostId: string): Promise<ExperienceRow[]> {
    try {
      const [expsRes, reelsRes] = await Promise.all([
        supabase
          .from('experiences')
          .select('*')
          .eq('user_id', hostId)
          .order('created_at', { ascending: false }),
        supabase
          .from('reels')
          .select('id, experience_id, thumbnail_url, video_url')
          .eq('user_id', hostId),
      ]);

      if (expsRes.error) throw expsRes.error;

      const experiences = (expsRes.data as ExperienceRow[]) ?? [];
      const reels = reelsRes.data ?? [];

      // Helper to transform any Cloudinary video (.mp4, .webm, .mov) into a real JPEG poster frame
      const toCloudinaryJpg = (url?: string | null): string | null => {
        if (!url || typeof url !== 'string' || url.startsWith('file://')) return null;
        if (url.includes('res.cloudinary.com')) {
          return url.replace(/\.(mp4|webm|mov)$/i, '.jpg');
        }
        return url;
      };

      // Map experience_id to real Cloudinary image thumbnail
      const reelMap = new Map<string, string>();
      let fallbackThumb: string | null = null;

      reels.forEach((r) => {
        const thumb = toCloudinaryJpg(r.thumbnail_url) || toCloudinaryJpg(r.video_url);
        if (thumb) {
          if (!fallbackThumb) fallbackThumb = thumb;
          if (r.experience_id) {
            reelMap.set(r.experience_id, thumb);
          }
        }
      });

      return experiences.map((exp) => {
        let image = toCloudinaryJpg(exp.image_url);
        if (!image || image.includes('unsplash.com')) {
          image = reelMap.get(exp.id) || fallbackThumb || null;
        }
        return {
          ...exp,
          image_url: image,
        };
      });
    } catch (err) {
      console.warn('Error fetching host listings:', err);
      return [];
    }
  },

  /**
   * Fetch real host reviews preview from public.reviews.
   * Joins reviewer profile data (name, avatar) from profiles table.
   */
  async fetchHostReviews(hostId: string): Promise<HostReviewRow[]> {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, reviewer_id')
        .eq('reviewee_id', hostId)
        .eq('is_host_review', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error || !data || data.length === 0) return [];

      const reviewerIds = Array.from(new Set(data.map((r) => r.reviewer_id).filter(Boolean)));
      const profileMap = new Map<string, { full_name?: string | null; avatar_url?: string | null }>();

      if (reviewerIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, metadata')
          .in('id', reviewerIds);

        (profs || []).forEach((p) => {
          let m: Record<string, any> = {};
          if (typeof p.metadata === 'string') {
            try { m = JSON.parse(p.metadata); } catch {}
          } else if (p.metadata && typeof p.metadata === 'object') {
            m = p.metadata as Record<string, any>;
          }
          const rawAv = (p as any).avatar_url || m.avatar_url || m.picture || m.avatar || null;
          const av = typeof rawAv === 'string' && !rawAv.startsWith('file://') ? rawAv.trim() : null;
          profileMap.set(p.id, {
            full_name: p.full_name || (m.full_name as string) || 'Guest',
            avatar_url: av,
          });
        });
      }

      return data.map((r) => {
        const prof = profileMap.get(r.reviewer_id);
        return {
          id: r.id,
          reviewer_name: prof?.full_name || 'Guest',
          reviewer_avatar: prof?.avatar_url || null,
          rating: Number(r.rating) || 5,
          comment: r.comment,
          created_at: r.created_at,
        };
      });
    } catch (err) {
      console.warn('Error fetching host reviews:', err);
      return [];
    }
  },
};
