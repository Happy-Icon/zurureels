import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, type ExperienceRow } from '@/lib/supabase';
import {
  COASTAL_DESTINATIONS,
  type CoastalDestinationId,
  type ItineraryItem,
  type TripDay,
  type TripPlan,
  type TripPreferences,
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

function getDestinationKeyword(dest: string): string {
  const lower = (dest || '').toLowerCase();
  if (lower.includes('diani')) return 'diani';
  if (lower.includes('lamu')) return 'lamu';
  if (lower.includes('watamu')) return 'watamu';
  if (lower.includes('malindi')) return 'malindi';
  if (lower.includes('kilifi')) return 'kilifi';
  if (lower.includes('mombasa') || lower.includes('nyali')) return 'mombasa';
  if (lower.includes('nairobi')) return 'nairobi';
  return lower.split(' ')[0] || '';
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
          // Merge by ID, preferring newer updatedAt
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

    const updatedTrip: TripPlan = {
      ...trip,
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

      // Graceful fallback if fewer than 2 results for that town
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
   */
  async generateItineraryFromPreferences(prefs: TripPreferences): Promise<TripPlan> {
    const destinationConfig =
      COASTAL_DESTINATIONS.find((d) => d.id === prefs.destinationId) || COASTAL_DESTINATIONS[0];

    // Fetch real listings from Supabase for this destination
    const candidateExperiences = await this.fetchCandidateExperiences(destinationConfig.name);

    // Partition candidates into stays, activities, and dining/events
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

    // Select primary stay (or fallback to top listing)
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

      // Day theme
      let dayTheme = `Day ${day} in ${destinationConfig.name}`;
      if (day === 1) dayTheme = 'Arrival, Check-in & Sunset Coast';
      else if (day === prefs.durationDays) dayTheme = 'Morning Relaxation & Departure';
      else if (day === 2) dayTheme = 'Ocean Adventures & Marine Excursions';
      else if (day === 3) dayTheme = 'Swahili Heritage, Cuisine & Local Life';
      else dayTheme = `Coastal Discovery & Hidden Gems — Day ${day}`;

      // Morning slot
      if (day === 1) {
        if (primaryStay) {
          items.push({
            id: `stay-${primaryStay.id}-d${day}`,
            timeSlot: 'morning',
            timeLabel: '11:00 AM',
            title: `Check-in at ${primaryStay.title || 'Coastal Stay'}`,
            description: primaryStay.description || `Settle into your coastal stay at ${primaryStay.location || destinationConfig.name}.`,
            location: primaryStay.location || destinationConfig.name,
            type: 'stay',
            experienceId: primaryStay.id,
            experienceTitle: primaryStay.title,
            experienceImageUrl: primaryStay.image_url,
            rating: primaryStay.metadata && (primaryStay.metadata as any).rating ? Number((primaryStay.metadata as any).rating) : 4.9,
            estimatedPriceKes: stayCostPerNight,
            isBookable: true,
          });
        }
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
            timeLabel: '09:00 AM',
            title: morningExp.title || 'Morning Coastal Excursion',
            description: morningExp.description || `Morning coastal adventure in ${morningExp.location || destinationConfig.name}.`,
            location: morningExp.location || destinationConfig.name,
            type: 'activity',
            experienceId: morningExp.id,
            experienceTitle: morningExp.title,
            experienceImageUrl: morningExp.image_url,
            rating: 4.8,
            estimatedPriceKes: cost,
            isBookable: true,
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
          timeLabel: '02:00 PM',
          title: afternoonExp.title || 'Afternoon Coastal Discovery',
          description: afternoonExp.description || `Afternoon experience in ${afternoonExp.location || destinationConfig.name}.`,
          location: afternoonExp.location || destinationConfig.name,
          type: 'activity',
          experienceId: afternoonExp.id,
          experienceTitle: afternoonExp.title,
          experienceImageUrl: afternoonExp.image_url,
          rating: 4.9,
          estimatedPriceKes: cost,
          isBookable: true,
        });
      }

      // Evening slot (Real Dining or Events from database)
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
          timeLabel: '06:30 PM',
          title: eveningExp.title || 'Evening Coastal Gathering',
          description: eveningExp.description || `Authentic coastal evening in ${eveningExp.location || destinationConfig.name}.`,
          location: eveningExp.location || destinationConfig.name,
          type: 'dining',
          experienceId: eveningExp.id,
          experienceTitle: eveningExp.title,
          experienceImageUrl: eveningExp.image_url || destinationConfig.image,
          estimatedPriceKes: cost,
          isBookable: true,
        });
      }

      days.push({
        dayNumber: day,
        dateLabel: `Day ${day}`,
        theme: dayTheme,
        items,
        notes: `Enjoy your ${dayTheme.toLowerCase()}. Remember sunblock and local shillings for tips.`,
      });
    }

    const accommodationTotal = stayCostPerNight * prefs.durationDays;
    const totalEstimatedKes = accommodationTotal + activitiesTotal + diningTotal;

    const newTrip: TripPlan = {
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
    };

    return newTrip;
  },

  /**
   * Regenerate a single day with alternative real experiences
   */
  async regenerateDay(trip: TripPlan, dayNumber: number): Promise<TripPlan> {
    const candidateExperiences = await this.fetchCandidateExperiences(trip.destination);
    if (candidateExperiences.length === 0) return trip;

    const dayIndex = trip.days.findIndex((d) => d.dayNumber === dayNumber);
    if (dayIndex < 0) return trip;

    const currentDay = trip.days[dayIndex];
    // Shuffle candidates to pick fresh ones
    const shuffled = [...candidateExperiences].sort(() => 0.5 - Math.random());
    const replacement1 = shuffled[0];
    const replacement2 = shuffled[1] || shuffled[0];

    const updatedItems: ItineraryItem[] = currentDay.items.map((item, idx) => {
      if (item.type === 'activity' || item.type === 'dining') {
        const replacement = idx % 2 === 0 ? replacement1 : replacement2;
        if (replacement) {
          const cost = Number(replacement.current_price || 0);
          return {
            ...item,
            id: `item-${replacement.id}-regen-${Date.now()}`,
            title: replacement.title || item.title,
            description: replacement.description || item.description,
            location: (replacement.location ?? item.location) || undefined,
            experienceId: replacement.id,
            experienceTitle: replacement.title,
            experienceImageUrl: replacement.image_url || item.experienceImageUrl,
            estimatedPriceKes: cost,
          };
        }
      }
      return item;
    });

    const updatedDays = [...trip.days];
    updatedDays[dayIndex] = {
      ...currentDay,
      items: updatedItems,
      notes: 'Day updated with fresh authentic coastal experiences.',
    };

    // Recalculate totals
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
      updatedAt: new Date().toISOString(),
    };

    return updatedTrip;
  },
};
