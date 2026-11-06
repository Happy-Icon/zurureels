import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, type ExperienceRow } from '@/lib/supabase';
import { zuruAIService } from '@/services/zuruAIService';
import {
  DESTINATIONS,
  COASTAL_DESTINATIONS,
  type DestinationId,
  type CoastalDestinationId,
  type DestinationConfig,
  type ItineraryItem,
  type TimeSlot,
  type TripDay,
  type TripPlan,
  type TripPreferences,
  type BudgetTier,
  type InterestTag,
} from '@/types/zuruPlan';

const STORAGE_KEY_PREFIX = '@zurusasa_trips_';

function getStorageKey(userId: string | undefined): string {
  return `${STORAGE_KEY_PREFIX}${userId || 'guest'}`;
}

function formatCloudinaryThumbnail(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (!url.includes('cloudinary.com')) return url;
  return url.replace(/\.(mp4|webm|mov)(\?.*)?$/i, '.jpg$2');
}

/**
 * Extracts authentic rating from database row or metadata (REM-09)
 * Returns null if unrated, eliminating hardcoded 4.8 / 4.9.
 */
export function extractRating(exp: any): number | null {
  if (!exp) return null;
  if (typeof exp.rating === 'number' && exp.rating > 0) {
    return Number(exp.rating.toFixed(1));
  }
  const meta = (exp.metadata || {}) as Record<string, any>;
  if (typeof meta.rating === 'number' && meta.rating > 0) {
    return Number(meta.rating.toFixed(1));
  }
  if (typeof meta.average_rating === 'number' && meta.average_rating > 0) {
    return Number(meta.average_rating.toFixed(1));
  }
  return null;
}

/**
 * Extracts authentic review count from database row or metadata (REM-09)
 * Returns 0 if none, eliminating fabricated counts (e.g. 18, 42).
 */
export function extractReviewsCount(exp: any): number {
  if (!exp) return 0;
  if (typeof exp.reviews_count === 'number') return exp.reviews_count;
  if (typeof exp.review_count === 'number') return exp.review_count;
  const meta = (exp.metadata || {}) as Record<string, any>;
  if (typeof meta.reviews_count === 'number') return meta.reviews_count;
  if (typeof meta.review_count === 'number') return meta.review_count;
  return 0;
}

/**
 * Resolves destination keywords including inland & Rift Valley hubs
 */
export function getDestinationKeyword(dest: string): string {
  const lower = (dest || '').toLowerCase();
  if (lower.includes('diani')) return 'diani';
  if (lower.includes('lamu')) return 'lamu';
  if (lower.includes('watamu')) return 'watamu';
  if (lower.includes('malindi')) return 'malindi';
  if (lower.includes('kilifi')) return 'kilifi';
  if (lower.includes('mombasa') || lower.includes('nyali')) return 'mombasa';
  if (lower.includes('naivasha')) return 'naivasha';
  if (lower.includes('mara') || lower.includes('maasai')) return 'mara';
  if (lower.includes('nairobi')) return 'nairobi';
  return lower.split(' ')[0] || '';
}

/**
 * Maps destination to adjacent geographic fallback towns (Tier 1 expansion)
 */
export function getAdjacentDestinationKeyword(keyword: string): string | null {
  switch (keyword) {
    case 'watamu':
      return 'malindi';
    case 'malindi':
      return 'watamu';
    case 'diani':
      return 'tiwi';
    case 'kilifi':
      return 'mombasa';
    case 'naivasha':
      return 'nakuru';
    default:
      return null;
  }
}

/**
 * Context-appropriate time slots based on category and pace (REM-09)
 * Eliminates unconditionally assigning 'afternoon' and '02:30 PM'.
 */
export function determineTimeSlotAndStart(
  category: string | undefined,
  slotIndex: number,
  preferredSlot?: 'morning' | 'afternoon' | 'evening'
): { timeSlot: TimeSlot; timeLabel: string; startTime: string } {
  if (preferredSlot === 'morning') return { timeSlot: 'morning', timeLabel: '09:00 AM', startTime: '09:00 AM' };
  if (preferredSlot === 'afternoon') return { timeSlot: 'afternoon', timeLabel: '02:00 PM', startTime: '02:00 PM' };
  if (preferredSlot === 'evening') return { timeSlot: 'evening', timeLabel: '06:30 PM', startTime: '06:30 PM' };

  const cat = (category || '').toLowerCase();
  if (
    cat.includes('stay') ||
    cat.includes('villa') ||
    cat.includes('hotel') ||
    cat.includes('cottage') ||
    cat.includes('resort') ||
    cat.includes('apartment') ||
    cat.includes('lodge')
  ) {
    return { timeSlot: 'morning', timeLabel: '11:00 AM', startTime: '11:00 AM' };
  }
  if (
    cat.includes('sunset') ||
    cat.includes('food') ||
    cat.includes('dining') ||
    cat.includes('dinner') ||
    cat.includes('drinks') ||
    cat.includes('events') ||
    cat.includes('night')
  ) {
    return { timeSlot: 'evening', timeLabel: '06:30 PM', startTime: '06:30 PM' };
  }
  if (
    cat.includes('water') ||
    cat.includes('boat') ||
    cat.includes('snorkel') ||
    cat.includes('dive') ||
    cat.includes('safari') ||
    cat.includes('marine') ||
    cat.includes('kayak') ||
    cat.includes('dolphin')
  ) {
    return { timeSlot: 'morning', timeLabel: '09:00 AM', startTime: '09:00 AM' };
  }
  if (slotIndex === 0) return { timeSlot: 'morning', timeLabel: '09:00 AM', startTime: '09:00 AM' };
  if (slotIndex === 1) return { timeSlot: 'afternoon', timeLabel: '02:00 PM', startTime: '02:00 PM' };
  return { timeSlot: 'evening', timeLabel: '06:30 PM', startTime: '06:30 PM' };
}

export const zuruPlanService = {
  /**
   * Load saved trips for a user (local cache + remote Supabase profile metadata sync)
   */
  async getSavedTrips(userId: string | undefined): Promise<TripPlan[]> {
    try {
      const key = getStorageKey(userId);
      const cached = await AsyncStorage.getItem(key);
      let localTrips: TripPlan[] = cached ? JSON.parse(cached) : [];

      if (!userId) return localTrips;

      // Cloud sync from profiles.metadata.saved_trips
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('id', userId)
          .maybeSingle();

        const remoteTrips = (profile?.metadata as any)?.saved_trips as TripPlan[] | undefined;
        if (remoteTrips && Array.isArray(remoteTrips)) {
          const map = new Map<string, TripPlan>();
          for (const t of localTrips) map.set(t.id, t);
          for (const t of remoteTrips) {
            const existing = map.get(t.id);
            if (!existing || new Date(t.updatedAt) > new Date(existing.updatedAt)) {
              map.set(t.id, t);
            }
          }
          localTrips = Array.from(map.values()).sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          await AsyncStorage.setItem(key, JSON.stringify(localTrips));
        }
      } catch (err) {
        console.warn('Remote profile trips fetch error:', err);
      }

      return localTrips;
    } catch (e) {
      console.warn('Failed to load trips from storage:', e);
      return [];
    }
  },

  /**
   * Save or update a trip plan (persists locally and syncs to Supabase profiles.metadata)
   */
  async saveTrip(userId: string | undefined, trip: TripPlan): Promise<void> {
    const key = getStorageKey(userId);
    const trips = await this.getSavedTrips(userId);
    const index = trips.findIndex((t) => t.id === trip.id);

    const nextRevision = trip.revision ?? (index >= 0 ? (trips[index].revision ?? 1) + 1 : 1);
    const updatedTrip: TripPlan = {
      ...trip,
      revision: nextRevision,
      updatedAt: new Date().toISOString(),
    };

    if (index >= 0) {
      trips[index] = updatedTrip;
    } else {
      trips.unshift(updatedTrip);
    }

    // 1. Save to local AsyncStorage
    await AsyncStorage.setItem(key, JSON.stringify(trips));

    // 2. Sync to Supabase profile metadata if user is signed in
    if (userId) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('id', userId)
          .maybeSingle();

        const currentMetadata = (profile?.metadata as Record<string, unknown>) || {};
        const updatedMetadata = {
          ...currentMetadata,
          saved_trips: trips,
        };

        await supabase
          .from('profiles')
          .update({ metadata: updatedMetadata })
          .eq('id', userId);
      } catch (err) {
        console.warn('Failed to sync trip to Supabase metadata:', err);
      }
    }
  },

  /**
   * Delete a saved trip plan
   */
  async deleteTrip(userId: string | undefined, tripId: string): Promise<void> {
    const key = getStorageKey(userId);
    const trips = (await this.getSavedTrips(userId)).filter((t) => t.id !== tripId);
    await AsyncStorage.setItem(key, JSON.stringify(trips));

    if (userId) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('id', userId)
          .maybeSingle();

        const currentMetadata = (profile?.metadata as Record<string, unknown>) || {};
        await supabase
          .from('profiles')
          .update({
            metadata: {
              ...currentMetadata,
              saved_trips: trips,
            },
          })
          .eq('id', userId);
      } catch (err) {
        console.warn('Failed to sync trip deletion:', err);
      }
    }
  },

  /**
   * Fetch authentic candidate experiences from Supabase matching destination and category
   */
  async fetchCandidateExperiences(
    destinationName: string,
    category?: string
  ): Promise<ExperienceRow[]> {
    try {
      const keyword = getDestinationKeyword(destinationName);

      let query = supabase
        .from('experiences')
        .select(`
          *,
          reels:reels(id, thumbnail_url, video_url)
        `)
        .eq('availability_status', 'available')
        .order('current_price', { ascending: false });

      if (keyword) {
        query = query.ilike('location', `%${keyword}%`);
      }

      if (category) {
        query = query.ilike('category', `%${category}%`);
      }

      const { data, error } = await query.limit(50);
      let results: any[] = !error && data ? data : [];

      // Graceful fallback to regional inventory if fewer than 2 results for that town
      if (results.length < 2) {
        const adjacent = getAdjacentDestinationKeyword(keyword);
        if (adjacent) {
          const { data: adjacentData } = await supabase
            .from('experiences')
            .select(`
              *,
              reels:reels(id, thumbnail_url, video_url)
            `)
            .eq('availability_status', 'available')
            .ilike('location', `%${adjacent}%`)
            .limit(30);

          if (adjacentData && adjacentData.length > 0) {
            results = [...results, ...adjacentData];
          }
        }
      }

      if (results.length < 2) {
        const { data: coastalFallback } = await supabase
          .from('experiences')
          .select(`
            *,
            reels:reels(id, thumbnail_url, video_url)
          `)
          .eq('availability_status', 'available')
          .order('current_price', { ascending: false })
          .limit(50);

        if (coastalFallback && coastalFallback.length > 0) {
          const existingIds = new Set(results.map((r) => r.id));
          for (const item of coastalFallback) {
            if (!existingIds.has(item.id)) {
              results.push(item);
            }
          }
        }
      }

      const formatted = results.map((exp) => {
        let resolvedImage = exp.image_url;
        if (!resolvedImage && exp.reels && exp.reels.length > 0) {
          const r = exp.reels.find((x: any) => Boolean(x.thumbnail_url));
          if (r && r.thumbnail_url) {
            resolvedImage = formatCloudinaryThumbnail(r.thumbnail_url);
          }
        }
        return {
          ...exp,
          image_url: resolvedImage || null,
        };
      });

      return formatted.sort((a, b) => {
        const aLocMatch = keyword && (a.location || '').toLowerCase().includes(keyword) ? 1 : 0;
        const bLocMatch = keyword && (b.location || '').toLowerCase().includes(keyword) ? 1 : 0;
        if (aLocMatch !== bLocMatch) return bLocMatch - aLocMatch;

        const aHasImg = a.image_url ? 1 : 0;
        const bHasImg = b.image_url ? 1 : 0;
        if (aHasImg !== bHasImg) return bHasImg - aHasImg;

        const aPrice = Number(a.current_price || a.base_price || 0);
        const bPrice = Number(b.current_price || b.base_price || 0);
        return bPrice - aPrice;
      }) as ExperienceRow[];
    } catch {
      return [];
    }
  },

  /**
   * Generate an itinerary from structured user preferences using real listings
   * AI-First dual path with grounded validation and transparent degraded fallback (REM-03, REM-10).
   */
  async generateItineraryFromPreferences(prefs: TripPreferences): Promise<TripPlan> {
    const destinationConfig =
      DESTINATIONS.find((d) => d.id === prefs.destinationId) ||
      DESTINATIONS[0];

    // 1. Attempt AI-First planning via zuruAIService
    let serverFallbackReason: string | undefined;
    try {
      const aiResponse = await zuruAIService.planItinerary(prefs);
      serverFallbackReason = aiResponse.meta.fallbackReason;
      const hasGroundedItems = aiResponse.itinerary?.days?.some((d) =>
        d.items?.some((item) => Boolean(item.experienceId) || (item.estimatedPriceKes ?? 0) > 0)
      );
      if (
        aiResponse.itinerary &&
        Array.isArray(aiResponse.itinerary.days) &&
        aiResponse.itinerary.days.length > 0 &&
        (!aiResponse.meta.degraded || hasGroundedItems)
      ) {
        const rawDays = aiResponse.itinerary.days;
        const days: TripDay[] = rawDays.map((d) => ({
          dayNumber: d.dayNumber,
          dateLabel: d.dateLabel || `Day ${d.dayNumber}`,
          theme: d.theme,
          notes: d.notes,
          revision: 1,
          updatedAt: new Date().toISOString(),
          items: d.items.map((item) => ({
            id: item.id || `act-${item.experienceId || Math.random().toString(36).substring(2, 7)}`,
            timeSlot: item.timeSlot,
            slot: item.timeSlot,
            timeLabel: item.startTime,
            startTime: item.startTime,
            title: item.title,
            description: item.description,
            location: item.location || destinationConfig.name,
            type: item.type,
            experienceId: item.experienceId,
            experienceTitle: item.experienceTitle || item.title,
            experienceImageUrl: item.experienceImageUrl || null,
            rating: item.rating ?? null,
            reviewsCount: item.reviewCount ?? 0,
            estimatedPriceKes: item.estimatedPriceKes ?? 0,
            isBookable: item.isBookable ?? true,
            notes: item.notes,
            userModified: false,
          })),
        }));

        const newTrip: TripPlan = {
          id: `trip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          title: aiResponse.itinerary.tripTitle || `${prefs.durationDays}-Day Escape to ${destinationConfig.name}`,
          destination: destinationConfig.name,
          destinationId: destinationConfig.id,
          coverImage: destinationConfig.image,
          startDate: prefs.startDate || null,
          endDate: prefs.endDate || null,
          durationDays: prefs.durationDays,
          guestCount: prefs.adultsCount + prefs.childrenCount,
          budgetTier: prefs.budgetTier,
          days,
          budgetBreakdown: aiResponse.itinerary.budgetBreakdown || {
            accommodationTotal: 0,
            activitiesTotal: 0,
            diningEstimate: 0,
            totalEstimatedKes: 0,
          },
          status: 'planned',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          revision: 1,
          generationEngine: aiResponse.meta.engine,
          degraded: Boolean(aiResponse.meta.degraded),
          fallbackReason: aiResponse.meta.fallbackReason,
          preferences: prefs,
        };

        return newTrip;
      }
    } catch (err: any) {
      console.warn('zuruAIService.planItinerary failed or offline, falling back to grounded local solver:', err?.message);
    }

    // 2. Grounded local fallback solver (REM-10: transparent degradation with active destination fidelity)
    return this.buildGroundedLocalItinerary(prefs, destinationConfig, serverFallbackReason);
  },

  /**
   * Deterministic local solver grounded in authentic Supabase database inventory
   */
  async buildGroundedLocalItinerary(
    prefs: TripPreferences,
    destinationConfig: DestinationConfig,
    fallbackReason = 'AI Gateway unavailable, using verified local inventory'
  ): Promise<TripPlan> {
    const candidateExperiences = await this.fetchCandidateExperiences(destinationConfig.name);

    // Partition candidates into stays, activities, dining
    const stays = candidateExperiences.filter((e) => {
      const cat = (e.category || '').toLowerCase();
      return (
        cat.includes('stay') ||
        cat.includes('villa') ||
        cat.includes('resort') ||
        cat.includes('hotel') ||
        cat.includes('cottage') ||
        cat.includes('apartment') ||
        cat.includes('rentals')
      );
    });

    const diningAndEvents = candidateExperiences.filter((e) => {
      const cat = (e.category || '').toLowerCase();
      return (
        cat.includes('events') ||
        cat.includes('drinks') ||
        cat.includes('food') ||
        cat.includes('dining')
      );
    });

    const activities = candidateExperiences.filter(
      (e) => !stays.includes(e) && !diningAndEvents.includes(e)
    );

    const primaryStay = stays[0] || candidateExperiences[0] || null;
    const stayCostPerNight = primaryStay?.current_price
      ? Number(primaryStay.current_price)
      : 0;

    const days: TripDay[] = [];
    let activitiesTotal = 0;
    let diningTotal = 0;
    let activityIndex = 0;
    let diningIndex = 0;

    for (let day = 1; day <= prefs.durationDays; day++) {
      const items: ItineraryItem[] = [];

      let dayTheme = `Day ${day} in ${destinationConfig.name}`;
      if (day === 1) dayTheme = 'Arrival, Check-in & Sunset Coast';
      else if (day === prefs.durationDays) dayTheme = 'Morning Relaxation & Departure';
      else if (day === 2) dayTheme = 'Ocean Adventures & Marine Excursions';
      else if (day === 3) dayTheme = 'Swahili Heritage, Cuisine & Local Life';
      else dayTheme = `Coastal Discovery & Hidden Gems — Day ${day}`;

      // Morning slot
      if (day === 1 && primaryStay) {
        items.push({
          id: `stay-${primaryStay.id}-d${day}`,
          timeSlot: 'morning',
          slot: 'morning',
          timeLabel: '11:00 AM',
          startTime: '11:00 AM',
          title: `Check-in at ${primaryStay.title || 'Coastal Stay'}`,
          description: primaryStay.description || `Settle into your stay at ${primaryStay.location || destinationConfig.name}.`,
          location: primaryStay.location || destinationConfig.name,
          type: 'stay',
          experienceId: primaryStay.id,
          experienceTitle: primaryStay.title,
          experienceImageUrl: primaryStay.image_url,
          rating: extractRating(primaryStay),
          reviewsCount: extractReviewsCount(primaryStay),
          estimatedPriceKes: stayCostPerNight,
          isBookable: true,
          userModified: false,
        });
      } else {
        const morningExp =
          activities[activityIndex % Math.max(1, activities.length)] ||
          candidateExperiences[activityIndex % Math.max(1, candidateExperiences.length)];
        activityIndex++;
        if (morningExp) {
          const cost = Number(morningExp.current_price || 0);
          activitiesTotal += cost;
          items.push({
            id: `act-${morningExp.id}-d${day}-m`,
            timeSlot: 'morning',
            slot: 'morning',
            timeLabel: '09:00 AM',
            startTime: '09:00 AM',
            title: morningExp.title || 'Morning Coastal Excursion',
            description: morningExp.description || `Morning adventure in ${morningExp.location || destinationConfig.name}.`,
            location: morningExp.location || destinationConfig.name,
            type: 'activity',
            experienceId: morningExp.id,
            experienceTitle: morningExp.title,
            experienceImageUrl: morningExp.image_url,
            rating: extractRating(morningExp),
            reviewsCount: extractReviewsCount(morningExp),
            estimatedPriceKes: cost,
            isBookable: true,
            userModified: false,
          });
        }
      }

      // Afternoon slot
      const afternoonExp =
        activities[activityIndex % Math.max(1, activities.length)] ||
        candidateExperiences[(activityIndex + 1) % Math.max(1, candidateExperiences.length)];
      activityIndex++;
      if (afternoonExp) {
        const cost = Number(afternoonExp.current_price || 0);
        activitiesTotal += cost;
        items.push({
          id: `act-${afternoonExp.id}-d${day}-a`,
          timeSlot: 'afternoon',
          slot: 'afternoon',
          timeLabel: '02:00 PM',
          startTime: '02:00 PM',
          title: afternoonExp.title || 'Afternoon Coastal Discovery',
          description: afternoonExp.description || `Afternoon experience in ${afternoonExp.location || destinationConfig.name}.`,
          location: afternoonExp.location || destinationConfig.name,
          type: 'activity',
          experienceId: afternoonExp.id,
          experienceTitle: afternoonExp.title,
          experienceImageUrl: afternoonExp.image_url,
          rating: extractRating(afternoonExp),
          reviewsCount: extractReviewsCount(afternoonExp),
          estimatedPriceKes: cost,
          isBookable: true,
          userModified: false,
        });
      }

      // Evening slot
      const eveningExp =
        diningAndEvents[diningIndex % Math.max(1, diningAndEvents.length)] ||
        activities[(activityIndex + 2) % Math.max(1, activities.length)] ||
        candidateExperiences[0];
      diningIndex++;
      if (eveningExp) {
        const cost = Number(eveningExp.current_price || 0);
        diningTotal += cost;
        items.push({
          id: `dining-${eveningExp.id}-d${day}`,
          timeSlot: 'evening',
          slot: 'evening',
          timeLabel: '06:30 PM',
          startTime: '06:30 PM',
          title: eveningExp.title || 'Evening Coastal Gathering',
          description: eveningExp.description || `Authentic coastal evening in ${eveningExp.location || destinationConfig.name}.`,
          location: eveningExp.location || destinationConfig.name,
          type: 'dining',
          experienceId: eveningExp.id,
          experienceTitle: eveningExp.title,
          experienceImageUrl: eveningExp.image_url || destinationConfig.image,
          rating: extractRating(eveningExp),
          reviewsCount: extractReviewsCount(eveningExp),
          estimatedPriceKes: cost,
          isBookable: true,
          userModified: false,
        });
      }

      days.push({
        dayNumber: day,
        dateLabel: `Day ${day}`,
        theme: dayTheme,
        items,
        notes: `Enjoy your ${dayTheme.toLowerCase()}. Remember sunblock and local shillings for tips.`,
        revision: 1,
        updatedAt: new Date().toISOString(),
      });
    }

    const accommodationTotal = stayCostPerNight * prefs.durationDays;
    const totalEstimatedKes = accommodationTotal + activitiesTotal + diningTotal;

    const fallbackTrip: TripPlan = {
      id: `trip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: `${prefs.durationDays}-Day Escape to ${destinationConfig.name}`,
      destination: destinationConfig.name,
      destinationId: destinationConfig.id,
      coverImage: destinationConfig.image,
      startDate: prefs.startDate || null,
      endDate: prefs.endDate || null,
      durationDays: prefs.durationDays,
      guestCount: prefs.adultsCount + prefs.childrenCount,
      budgetTier: prefs.budgetTier,
      days,
      budgetBreakdown: {
        accommodationTotal,
        activitiesTotal,
        diningEstimate: diningTotal,
        totalEstimatedKes,
      },
      status: 'planned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: 1,
      generationEngine: 'grounded_local_planner',
      degraded: true,
      fallbackReason,
      preferences: prefs,
    };

    return fallbackTrip;
  },

  /**
   * Regenerate a single day with context, neighbor deduplication, and userModified protection (REM-08)
   */
  async regenerateDay(
    trip: TripPlan,
    dayNumber: number,
    options: { signal?: AbortSignal } = {}
  ): Promise<TripPlan> {
    const dayIndex = trip.days.findIndex((d) => d.dayNumber === dayNumber);
    if (dayIndex < 0) return trip;

    const currentDay = trip.days[dayIndex];

    // Collect experience IDs scheduled on other days to prevent duplicate activities across the trip
    const excludedExperienceIds: string[] = trip.days
      .filter((d) => d.dayNumber !== dayNumber)
      .flatMap((d) => d.items.map((i) => i.experienceId).filter((id): id is string => Boolean(id)));

    // Try server-side AI day regeneration first
    try {
      const aiResponse = await zuruAIService.regenerateDay(
        {
          tripId: trip.id,
          dayNumber,
          destinationId: trip.destinationId,
          destinationName: trip.destination,
          dayTheme: currentDay.theme,
          existingItems: currentDay.items,
          excludedExperienceIds,
          budgetTier: trip.budgetTier,
          dietaryRestrictions: trip.preferences?.dietaryRestrictions,
          pace: trip.preferences?.pace,
          exclusions: trip.preferences?.exclusions,
        },
        options
      );

      if (aiResponse.items && aiResponse.items.length > 0) {
        const nextRevision = (trip.revision ?? 1) + 1;
        const updatedDays = [...trip.days];
        updatedDays[dayIndex] = {
          ...currentDay,
          theme: aiResponse.dayTheme || currentDay.theme,
          notes: aiResponse.notes || currentDay.notes,
          revision: nextRevision,
          updatedAt: new Date().toISOString(),
          items: aiResponse.items.map((item) => ({
            id: item.id || `act-${item.experienceId || Math.random().toString(36).substring(2, 7)}`,
            timeSlot: item.timeSlot,
            slot: item.timeSlot,
            timeLabel: item.startTime,
            startTime: item.startTime,
            title: item.title,
            description: item.description,
            location: item.location || trip.destination,
            type: item.type,
            experienceId: item.experienceId,
            experienceTitle: item.experienceTitle || item.title,
            experienceImageUrl: item.experienceImageUrl || null,
            rating: item.rating ?? null,
            reviewsCount: item.reviewCount ?? 0,
            estimatedPriceKes: item.estimatedPriceKes ?? 0,
            isBookable: item.isBookable ?? true,
            notes: item.notes,
            userModified: item.userModified ?? false,
          })),
        };

        return this.recalculateTripBudget(trip, updatedDays, nextRevision);
      }
    } catch (err: any) {
      console.warn('zuruAIService.regenerateDay failed or offline, using grounded local solver:', err?.message);
    }

    // Grounded local day regeneration fallback
    return this.buildGroundedLocalDayRegeneration(trip, dayNumber, excludedExperienceIds);
  },

  /**
   * Grounded local single-day regenerator that strictly preserves userModified items
   * and excludes items scheduled on neighboring days of the trip.
   */
  async buildGroundedLocalDayRegeneration(
    trip: TripPlan,
    dayNumber: number,
    excludedExperienceIds: string[],
    candidateInventory?: ExperienceRow[]
  ): Promise<TripPlan> {
    const dayIndex = trip.days.findIndex((d) => d.dayNumber === dayNumber);
    if (dayIndex < 0) return trip;
    const currentDay = trip.days[dayIndex];

    const keyword = getDestinationKeyword(trip.destination);
    let candidates = candidateInventory && candidateInventory.length > 0
      ? candidateInventory
      : await this.fetchCandidateExperiences(trip.destination);

    // Filter out items used on other days
    const excludedSet = new Set(excludedExperienceIds);
    let available = candidates.filter((c) => !excludedSet.has(c.id));

    // Two-tier radius expansion if pool is sparse
    if (available.length < 2 && (!candidateInventory || candidateInventory.length === 0)) {
      const adjacentKey = getAdjacentDestinationKeyword(keyword);
      if (adjacentKey) {
        const adjacentCandidates = await this.fetchCandidateExperiences(adjacentKey);
        const adjacentAvailable = adjacentCandidates.filter((c) => !excludedSet.has(c.id));
        if (adjacentAvailable.length > 0) {
          available = [...available, ...adjacentAvailable];
        }
      }
    }

    // If still empty, fall back to all candidates to ensure we don't return an empty day
    if (available.length === 0) {
      available = candidates;
    }

    let candIdx = 0;
    const updatedItems: ItineraryItem[] = currentDay.items.map((item, idx) => {
      // 1. Preserve user-modified items in their designated time slots (REM-08)
      if (item.userModified) {
        return item;
      }

      // 2. Preserve stay on Day 1
      if (item.type === 'stay' && dayNumber === 1) {
        return item;
      }

      // 3. Replace activity or dining item with available candidate
      const replacement = available[candIdx % Math.max(1, available.length)];
      candIdx++;

      if (replacement) {
        const cat = replacement.category || '';
        const timing = determineTimeSlotAndStart(
          replacement.category || undefined,
          idx,
          item.timeSlot as 'morning' | 'afternoon' | 'evening'
        );
        const cost = Number(replacement.current_price || 0);

        return {
          id: `item-${replacement.id}-regen-${Date.now()}-${idx}`,
          timeSlot: timing.timeSlot,
          slot: timing.timeSlot as 'morning' | 'afternoon' | 'evening',
          timeLabel: timing.timeLabel,
          startTime: timing.startTime,
          title: replacement.title || item.title,
          description: replacement.description || item.description,
          location: replacement.location || item.location,
          type: (cat.includes('food') || cat.includes('dining') ? 'dining' : 'activity') as 'stay' | 'activity' | 'dining',
          experienceId: replacement.id,
          experienceTitle: replacement.title,
          experienceImageUrl: replacement.image_url || item.experienceImageUrl,
          rating: extractRating(replacement),
          reviewsCount: extractReviewsCount(replacement),
          estimatedPriceKes: cost,
          isBookable: true,
          userModified: false,
        };
      }

      return item;
    });

    const nextRevision = (trip.revision ?? 1) + 1;
    const updatedDays = [...trip.days];
    updatedDays[dayIndex] = {
      ...currentDay,
      items: updatedItems,
      theme: `${currentDay.theme} (Refreshed)`,
      notes: 'Day updated with fresh authentic experiences from verified local inventory.',
      revision: nextRevision,
      updatedAt: new Date().toISOString(),
    };

    return this.recalculateTripBudget(
      trip,
      updatedDays,
      nextRevision,
      true,
      'AI Gateway offline, used grounded local regeneration'
    );
  },

  /**
   * Recalculates trip budget totals after day modifications
   */
  recalculateTripBudget(
    trip: TripPlan,
    updatedDays: TripDay[],
    nextRevision: number,
    degraded?: boolean,
    fallbackReason?: string
  ): TripPlan {
    let newActivitiesTotal = 0;
    let newDiningTotal = 0;
    for (const d of updatedDays) {
      for (const item of d.items) {
        if (item.type === 'activity' && item.estimatedPriceKes) {
          newActivitiesTotal += item.estimatedPriceKes;
        } else if (item.type === 'dining' && item.estimatedPriceKes) {
          newDiningTotal += item.estimatedPriceKes;
        }
      }
    }

    const updatedTrip: TripPlan = {
      ...trip,
      revision: nextRevision,
      days: updatedDays,
      budgetBreakdown: {
        ...trip.budgetBreakdown,
        activitiesTotal: newActivitiesTotal,
        diningEstimate: newDiningTotal,
        totalEstimatedKes:
          trip.budgetBreakdown.accommodationTotal +
          newActivitiesTotal +
          newDiningTotal,
      },
      degraded: degraded !== undefined ? degraded : trip.degraded,
      fallbackReason: fallbackReason || trip.fallbackReason,
      updatedAt: new Date().toISOString(),
    };

    return updatedTrip;
  },
};

export interface ExtractedTripConstraints {
  destinationId: DestinationId;
  destinationName: string;
  durationDays: number;
  adultsCount: number;
  childrenCount: number;
  budgetTier: BudgetTier;
  budgetMaxKes?: number;
  dietaryRestrictions: string[];
  pace: 'relaxed' | 'moderate' | 'packed';
  interests: InterestTag[];
  exclusions: string[];
  startDate?: string | null;
  endDate?: string | null;
}

export function parseConstraintsFromConversation(
  text: string,
  current: ExtractedTripConstraints,
  aiCriteria?: any
): ExtractedTripConstraints {
  const updated: ExtractedTripConstraints = {
    ...current,
    dietaryRestrictions: [...current.dietaryRestrictions],
    interests: [...current.interests],
    exclusions: [...current.exclusions],
  };
  const lower = text.toLowerCase();

  // 1. Destination
  const destMatch = (aiCriteria?.location || lower).toLowerCase();
  if (destMatch.includes('lamu')) {
    updated.destinationId = 'lamu';
    updated.destinationName = 'Lamu Island';
  } else if (destMatch.includes('watamu')) {
    updated.destinationId = 'watamu';
    updated.destinationName = 'Watamu & Malindi';
  } else if (destMatch.includes('malindi')) {
    updated.destinationId = 'malindi';
    updated.destinationName = 'Malindi';
  } else if (destMatch.includes('kilifi')) {
    updated.destinationId = 'kilifi';
    updated.destinationName = 'Kilifi Creek';
  } else if (destMatch.includes('mombasa') || destMatch.includes('nyali')) {
    updated.destinationId = 'mombasa';
    updated.destinationName = 'Mombasa Old Town';
  } else if (destMatch.includes('naivasha')) {
    updated.destinationId = 'naivasha';
    updated.destinationName = 'Lake Naivasha';
  } else if (destMatch.includes('mara')) {
    updated.destinationId = 'mara';
    updated.destinationName = 'Maasai Mara';
  } else if (destMatch.includes('nairobi')) {
    updated.destinationId = 'nairobi';
    updated.destinationName = 'Nairobi Safari Hub';
  } else if (destMatch.includes('diani')) {
    updated.destinationId = 'diani';
    updated.destinationName = 'Diani Beach';
  }

  // 2. Duration
  const durMatch = lower.match(/(\d+)[\s-]*(?:day|days|night|nights)/i);
  if (durMatch) {
    const days = parseInt(durMatch[1], 10);
    if (days >= 1 && days <= 14) updated.durationDays = days;
  }

  // 3. Guests (Adults & Children)
  if (aiCriteria?.guests && aiCriteria.guests > 0) {
    updated.adultsCount = aiCriteria.guests;
  }
  const adultsMatch = lower.match(/(\d+)\s*(?:adult|adults|grown-ups)/i);
  if (adultsMatch) {
    updated.adultsCount = parseInt(adultsMatch[1], 10);
  }
  const kidsMatch = lower.match(/(\d+)\s*(?:kid|kids|child|children|toddler|toddlers)/i);
  if (kidsMatch) {
    updated.childrenCount = parseInt(kidsMatch[1], 10);
  }
  const familyMatch = lower.match(/family\s+of\s+(\d+)/i);
  if (familyMatch) {
    const total = parseInt(familyMatch[1], 10);
    updated.adultsCount = Math.max(1, Math.min(2, total));
    updated.childrenCount = Math.max(0, total - updated.adultsCount);
  } else if (lower.includes('couple')) {
    updated.adultsCount = 2;
    updated.childrenCount = 0;
  } else if (lower.includes('solo') || lower.includes('by myself')) {
    updated.adultsCount = 1;
    updated.childrenCount = 0;
  }

  // 4. Budget Tier & Max KES (Bounded regex per REM-07)
  const budgetMatch = lower.match(/(?:under|below|less than|max|<)\s*(?:kes|ksh)?\s*(\d+[\d,]*)\s*(?:(k)\b|(?:kes|ksh)\b)?/i);
  if (budgetMatch) {
    let amount = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
    if (budgetMatch[2]?.toLowerCase() === 'k') amount *= 1000;
    updated.budgetMaxKes = amount;
    if (/\b(luxury|exclusive|5-star|high-end)\b/i.test(lower) || amount >= 20000 * updated.durationDays) {
      updated.budgetTier = 'luxury';
    } else if (/\b(budget|backpacker|hostel|cheap|affordable)\b/i.test(lower) || amount < 8000 * updated.durationDays) {
      updated.budgetTier = 'budget';
    } else {
      updated.budgetTier = 'comfort';
    }
  } else if (/\b(luxury|exclusive|5-star|high-end)\b/i.test(lower)) {
    updated.budgetTier = 'luxury';
  } else if (/\b(budget|backpacker|hostel|cheap|affordable)\b/i.test(lower)) {
    updated.budgetTier = 'budget';
  }

  // 5. Dietary Constraints
  const dietaryMatches = lower.match(/\b(halal|vegetarian|vegan|kosher|gluten-free|pescatarian)\b/gi);
  if (dietaryMatches) {
    const set = new Set([...updated.dietaryRestrictions, ...dietaryMatches.map((m) => m.toLowerCase())]);
    updated.dietaryRestrictions = Array.from(set);
  }

  // 6. Pace
  if (/\b(relaxed|slow|easy-going|chill|leisurely|laid-back)\b/i.test(lower)) {
    updated.pace = 'relaxed';
  } else if (/\b(packed|fast-paced|active|action-packed|intense|see everything)\b/i.test(lower)) {
    updated.pace = 'packed';
  }

  // 7. Interests
  const interestKeywords: Record<InterestTag, RegExp> = {
    beaches: /\b(beach|beaches|swim|sand|ocean view)\b/i,
    watersports: /\b(kitesurf|kitesurfing|diving|scuba|snorkelling|water sports)\b/i,
    dhow_cruises: /\b(dhow|sunset sail|boat trip|sandbar cruise|marine safari)\b/i,
    seafood_dining: /\b(seafood|swahili food|local dining|coastal cuisine|dinner)\b/i,
    culture_heritage: /\b(heritage|ruins|gedi|fort jesus|old town|swahili culture)\b/i,
    nightlife: /\b(nightlife|party|beach club|cocktails|bars)\b/i,
    wellness: /\b(wellness|spa|yoga|massage|retreat)\b/i,
    safari_nature: /\b(safari|game drive|marine park|wildlife|turtle|snakes)\b/i,
  };
  for (const [tag, regex] of Object.entries(interestKeywords)) {
    if (regex.test(lower) && !updated.interests.includes(tag as InterestTag)) {
      updated.interests = [...updated.interests, tag as InterestTag];
    }
  }

  // 8. Exclusions
  const exclMatch = lower.match(/\b(?:no|avoid|without|skip|don't want)\s+([a-z\s]+?)(?:,|\.|$)/i);
  if (exclMatch) {
    const term = exclMatch[1].trim();
    if (term.length > 2 && !updated.exclusions.includes(term)) {
      updated.exclusions = [...updated.exclusions, term];
    }
  }

  return updated;
}
