/**
 * Zuru AI Centralized Client Service
 * Connects the React Native mobile app to the server-side zuru-ai Edge Function
 * (which communicates with production LLM providers and Supabase).
 */

import { supabase } from '@/lib/supabase';
import { networkManager } from '@/lib/networkManager';
import type { AICard, AIStageStatus } from '@/components/ai/tokens';
import type {
  DestinationId,
  BudgetTier,
  ItineraryItem,
  TripPreferences,
} from '@/types/zuruPlan';

// React Native 0.86+ ships a global fetch with streaming support.
// Using standard fetch avoids the expo/fetch sub-path import
// which can cause Metro module resolution failures in some build configs.
const expoFetch = fetch;

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
const ZURU_AI_ENDPOINT = `${SUPABASE_URL}/functions/v1/zuru-ai`;

export interface AIMetadata {
  engine: string;
  model: string;
  degraded: boolean;
  is_fallback?: boolean;
  fallbackReason?: string;
  latencyMs: number;
  tokens?: {
    prompt?: number;
    completion?: number;
  };
}

export function parseAIMetadata(rawMeta: any): AIMetadata {
  if (!rawMeta || typeof rawMeta !== 'object') {
    return {
      engine: 'unknown',
      model: 'unknown',
      degraded: false,
      latencyMs: 0,
    };
  }
  return {
    engine: String(rawMeta.engine || rawMeta.provider || 'unknown'),
    model: String(rawMeta.model || 'unknown'),
    degraded: Boolean(rawMeta.degraded ?? rawMeta.is_fallback ?? false),
    is_fallback: Boolean(rawMeta.is_fallback ?? rawMeta.degraded ?? false),
    fallbackReason: rawMeta.fallbackReason || rawMeta.fallback_reason || undefined,
    latencyMs: Number(rawMeta.latencyMs ?? rawMeta.latency_ms ?? 0),
    tokens: rawMeta.tokens || rawMeta.tokens_used,
  };
}

export interface ZuruAIDiscoverResponse {
  text: string;
  cards: AICard[];
  followUps: string[];
  criteria?: {
    location?: string | null;
    category?: string | null;
    budget_max?: number | null;
    budget_min?: number | null;
    guests?: number | null;
    amenities?: string[] | null;
  };
  meta?: AIMetadata;
}

export interface DiscoverOptions {
  history?: Array<{ role: 'user' | 'assistant' | 'ai'; content: string }>;
  stream?: boolean;
  userLocation?: {
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  onStatusChange?: (status: AIStageStatus) => void;
  onTextDelta?: (delta: string) => void;
  signal?: AbortSignal;
  clientMessageId?: string;
  resumeFromOffset?: number;
  conversationId?: string;
}

export interface UserAffinities {
  categoryAffinities: Record<string, number>;
  locationAffinities: Record<string, number>;
  persona?: string;
  source?: string;
}

// In-memory cache for personalization affinities (1-hour TTL)
let cachedAffinities: { data: UserAffinities; timestamp: number } | null = null;
const AFFINITY_CACHE_TTL_MS = 60 * 60 * 1000;

export interface ZuruAIPlanResponse {
  itinerary?: {
    tripTitle: string;
    destination: string;
    destinationId: string;
    summary: string;
    days: Array<{
      dayNumber: number;
      dateLabel: string;
      theme: string;
      notes: string;
      items: Array<{
        id: string;
        timeSlot: 'morning' | 'afternoon' | 'evening';
        startTime: string;
        title: string;
        description: string;
        location?: string;
        type: 'stay' | 'activity' | 'dining';
        experienceId?: string | null;
        experienceTitle?: string | null;
        experienceImageUrl?: string | null;
        rating?: number | null;
        reviewCount?: number;
        estimatedPriceKes?: number;
        isBookable?: boolean;
        notes?: string;
        userModified?: boolean;
      }>;
    }>;
    budgetBreakdown: {
      accommodationTotal: number;
      activitiesTotal: number;
      diningEstimate: number;
      totalEstimatedKes: number;
    };
  };
  degradedNotice?: string;
  radiusExpanded?: boolean;
  adjacentRegionUsed?: string;
  meta: AIMetadata;
}

export interface ZuruAIRegenerateDayResponse {
  dayNumber: number;
  dayTheme: string;
  items: Array<{
    id: string;
    timeSlot: 'morning' | 'afternoon' | 'evening';
    startTime: string;
    title: string;
    description: string;
    location?: string;
    type: 'stay' | 'activity' | 'dining';
    experienceId?: string | null;
    experienceTitle?: string | null;
    experienceImageUrl?: string | null;
    rating?: number | null;
    reviewCount?: number;
    estimatedPriceKes?: number;
    isBookable?: boolean;
    notes?: string;
    userModified?: boolean;
  }>;
  notes?: string;
  radiusExpanded?: boolean;
  expandedRegionNotice?: string;
  meta: AIMetadata;
}

export const zuruAIService = {
  /**
   * Natural-language travel discovery querying server-side Zuru AI + real Supabase listings
   */
  async discover(
    prompt: string,
    options: DiscoverOptions = {},
  ): Promise<ZuruAIDiscoverResponse> {
    const trimmed = prompt.trim();
    if (!trimmed) {
      throw new Error('Please enter a travel request or question.');
    }

    // 1. Check network connectivity
    if (!networkManager.isOnline()) {
      throw new Error('You are currently offline. Please check your internet connection to use Zuru AI.');
    }

    const {
      history = [],
      stream = true,
      onStatusChange,
      onTextDelta,
      signal: externalSignal,
      clientMessageId,
      resumeFromOffset,
      conversationId,
    } = options;

    onStatusChange?.({ stage: 'understanding', text: 'Understanding request…' });

    // Setup 25-second timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error('Zuru AI request timed out. Please try again.'));
    }, 25000);

    // Link external abort signal if provided
    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutId);
        controller.abort(externalSignal.reason);
      } else {
        externalSignal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          controller.abort(externalSignal.reason);
        });
      }
    }

    try {
      // Get current auth session token if user is signed in
      const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      const authHeader = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${SUPABASE_ANON_KEY}`;

      const response = await expoFetch(ZURU_AI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'discover',
          message: trimmed,
          userLocation: options.userLocation,
          history: history.map((h) => ({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: h.content,
          })),
          stream,
          client_message_id: clientMessageId,
          resume_offset: resumeFromOffset,
          conversation_id: conversationId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
        }
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Zuru AI service unavailable (${response.status})`);
      }

      // ── Handle Server-Sent Events (SSE) stream ──
      const canStream = stream && !!response.body && typeof TextDecoder !== 'undefined';
      if (canStream) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let done = false;

        let finalResult: ZuruAIDiscoverResponse = {
          text: '',
          cards: [],
          followUps: ['Cheaper options', 'Near the beach', 'With a pool', 'Under KES 10,000'],
        };

        while (!done) {
          const chunk = await reader.read();
          done = chunk.done;
          if (chunk.value) {
            buffer += decoder.decode(chunk.value, { stream: true });
          }

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf('\n\n')) !== -1) {
            const rawEvent = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 2);

            if (!rawEvent) continue;

            const lines = rawEvent.split('\n');
            let eventType = 'message';
            let dataStr = '';

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                dataStr = line.slice(6).trim();
              }
            }

            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);

              if (eventType === 'status') {
                if (data.stage === 'searching') {
                  onStatusChange?.({ stage: 'searching', text: data.text || 'Searching real listings…' });
                } else if (data.stage === 'understanding') {
                  onStatusChange?.({ stage: 'understanding', text: data.text || 'Understanding request…' });
                } else if (data.stage === 'preparing') {
                  onStatusChange?.({ stage: 'preparing', text: data.text || 'Preparing recommendations…' });
                }
              } else if (eventType === 'delta') {
                if (data.delta) {
                  onStatusChange?.({ stage: 'preparing', text: 'Preparing recommendations…' });
                  onTextDelta?.(data.delta);
                  finalResult.text += data.delta;
                }
              } else if (eventType === 'result') {
                onStatusChange?.({ stage: 'preparing', text: 'Preparing recommendations…' });
                finalResult = {
                  text: data.text || finalResult.text || "Here are matching experiences on ZuruSasa:",
                  cards: data.cards || [],
                  followUps: data.followUps || finalResult.followUps,
                  criteria: data.criteria,
                  meta: data.meta ? parseAIMetadata(data.meta) : finalResult.meta,
                };
              } else if (eventType === 'done') {
                if (data.meta) {
                  finalResult.meta = parseAIMetadata(data.meta);
                }
              } else if (eventType === 'error') {
                throw new Error(data.message || 'Error from Zuru AI');
              }
            } catch (err: any) {
              if (err?.message && !err.message.includes('JSON')) {
                throw err;
              }
            }
          }
        }

        onStatusChange?.({ stage: 'done', text: 'Done' });
        return finalResult;
      }

      // ── Handle standard JSON response ──
      const data = await response.json();
      onStatusChange?.({ stage: 'done', text: 'Done' });

      return {
        text: data.text || "Here are matching experiences on ZuruSasa:",
        cards: data.cards || [],
        followUps: data.followUps || ['Cheaper options', 'Near the beach', 'With a pool'],
        criteria: data.criteria,
        meta: data.meta ? parseAIMetadata(data.meta) : undefined,
      };
    } catch (err: any) {
      onStatusChange?.({ stage: 'error', text: err?.message || 'Failed' });
      if (err?.name === 'AbortError' || controller.signal.aborted || externalSignal?.aborted) {
        const abortErr = new Error('Request cancelled or timed out. Please try again.');
        abortErr.name = 'AbortError';
        throw abortErr;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Retrieves AI-computed personalization affinities for the authenticated user.
   * Respects the traveler's `ai_improvement` privacy setting (REM-12).
   * Cached for 1 hour to prevent swiping lag and unnecessary server calls.
   */
  async getPersonalizationAffinities(
    userId?: string,
    options?: { aiImprovementOptOut?: boolean }
  ): Promise<UserAffinities> {
    if (!userId) {
      return { categoryAffinities: {}, locationAffinities: {}, source: 'default' };
    }

    if (options?.aiImprovementOptOut === true) {
      cachedAffinities = null;
      return { categoryAffinities: {}, locationAffinities: {}, source: 'opted_out' };
    }

    // Check user's profile privacy setting (REM-12)
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('privacy_settings')
        .eq('id', userId)
        .maybeSingle();

      const privacySettings = (profileData?.privacy_settings || {}) as Record<string, any>;
      if (privacySettings.ai_improvement === false) {
        cachedAffinities = null;
        return { categoryAffinities: {}, locationAffinities: {}, source: 'opted_out' };
      }
    } catch {
      // Proceed if profile check fails offline
    }

    // Check memory cache
    const now = Date.now();
    if (cachedAffinities && now - cachedAffinities.timestamp < AFFINITY_CACHE_TTL_MS) {
      return cachedAffinities.data;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      const authHeader = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${SUPABASE_ANON_KEY}`;

      const res = await expoFetch(ZURU_AI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'personalize_feed',
          userId,
          aiImprovementOptOut: Boolean(options?.aiImprovementOptOut),
        }),
      });

      if (!res.ok) {
        return { categoryAffinities: {}, locationAffinities: {} };
      }

      const data = await res.json();
      const result: UserAffinities = {
        categoryAffinities: data.categoryAffinities || {},
        locationAffinities: data.locationAffinities || {},
        persona: data.persona,
        source: data.source,
      };

      cachedAffinities = { data: result, timestamp: now };
      return result;
    } catch {
      return { categoryAffinities: {}, locationAffinities: {} };
    }
  },

  /**
   * Generates a grounded multi-day travel itinerary using the Zuru AI Gateway
   */
  async planItinerary(
    preferences: TripPreferences,
    options: {
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      userLocation?: { city?: string; latitude?: number; longitude?: number };
      signal?: AbortSignal;
      clientMessageId?: string;
      message?: string;
    } = {}
  ): Promise<ZuruAIPlanResponse> {
    if (!networkManager.isOnline()) {
      throw new Error('You are currently offline. Please check your internet connection to use Zuru AI.');
    }

    const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    const authHeader = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${SUPABASE_ANON_KEY}`;

    const payload = {
      action: 'plan_itinerary',
      preferences: {
        destinationId: preferences.destinationId,
        destinationName: preferences.destinationName,
        durationDays: preferences.durationDays,
        adultsCount: preferences.adultsCount,
        childrenCount: preferences.childrenCount,
        budgetTier: preferences.budgetTier,
        budgetMaxKes: preferences.budgetMaxKes,
        dietaryRestrictions: preferences.dietaryRestrictions,
        accessibilityNeeds: preferences.accessibility,
        pace: preferences.pace,
        interests: preferences.interests,
        exclusions: preferences.exclusions,
        specialRequests: preferences.specialRequests,
      },
      message: options.message,
      history: options.history,
      userLocation: options.userLocation,
      clientMessageId: options.clientMessageId,
    };

    const res = await expoFetch(ZURU_AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
      signal: options.signal,
    });

    if (!res.ok) {
      if (res.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `AI itinerary planning failed with HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      itinerary: data.itinerary,
      degradedNotice: data.degradedNotice,
      radiusExpanded: Boolean(data.radiusExpanded),
      adjacentRegionUsed: data.adjacentRegionUsed,
      meta: parseAIMetadata(data.meta),
    };
  },

  /**
   * Regenerates a single day with neighbor deduplication and preserved userModified items
   */
  async regenerateDay(
    params: {
      tripId: string;
      dayNumber: number;
      destinationId: DestinationId;
      destinationName: string;
      dayTheme?: string;
      userNotes?: string;
      existingItems: ItineraryItem[];
      excludedExperienceIds: string[];
      budgetTier?: BudgetTier;
      dietaryRestrictions?: string[];
      pace?: 'relaxed' | 'moderate' | 'packed';
      exclusions?: string[];
      clientMessageId?: string;
    },
    options: { signal?: AbortSignal } = {}
  ): Promise<ZuruAIRegenerateDayResponse> {
    if (!networkManager.isOnline()) {
      throw new Error('You are currently offline. Please check your internet connection to use Zuru AI.');
    }

    const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    const authHeader = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${SUPABASE_ANON_KEY}`;

    const payload = {
      action: 'regenerate_day',
      trip_id: params.tripId,
      day_number: params.dayNumber,
      destination_id: params.destinationId,
      destination_name: params.destinationName,
      day_theme: params.dayTheme,
      user_notes: params.userNotes,
      existing_items: params.existingItems.map((item) => ({
        id: item.id,
        experienceId: item.experienceId,
        timeSlot: item.timeSlot,
        startTime: item.startTime,
        title: item.title,
        description: item.description,
        type: item.type,
        rating: item.rating,
        reviewsCount: item.reviewsCount,
        estimatedPriceKes: item.estimatedPriceKes,
        userModified: item.userModified,
      })),
      excluded_experience_ids: params.excludedExperienceIds,
      budget_tier: params.budgetTier,
      dietary_restrictions: params.dietaryRestrictions,
      pace: params.pace,
      exclusions: params.exclusions,
      client_message_id: params.clientMessageId,
    };

    const res = await expoFetch(ZURU_AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
      signal: options.signal,
    });

    if (!res.ok) {
      if (res.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `AI day regeneration failed with HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      dayNumber: data.day_number ?? params.dayNumber,
      dayTheme: data.day_theme ?? params.dayTheme ?? `Day ${params.dayNumber} in ${params.destinationName}`,
      items: (data.items || []).map((item: any) => ({
        id: item.id,
        timeSlot: item.timeSlot,
        startTime: item.startTime,
        title: item.title,
        description: item.description,
        location: item.location,
        type: item.type,
        experienceId: item.experienceId,
        experienceTitle: item.experienceTitle || item.title,
        experienceImageUrl: item.experienceImageUrl,
        rating: item.rating ?? null,
        reviewCount: item.reviewCount ?? 0,
        estimatedPriceKes: item.estimatedPriceKes ?? 0,
        isBookable: item.isBookable ?? true,
        notes: item.notes,
        userModified: item.userModified,
      })),
      notes: data.notes,
      radiusExpanded: Boolean(data.radius_expanded),
      expandedRegionNotice: data.expanded_region_notice,
      meta: parseAIMetadata(data.meta),
    };
  },

  /**
   * Invalidate local personalization cache
   */
  clearPersonalizationCache() {
    cachedAffinities = null;
  },
};
