/**
 * Zuru AI Centralized Client Service
 * Connects the React Native mobile app to the server-side zuru-ai Edge Function
 * (which communicates with Fable 5.1 and Supabase).
 */

import { supabase } from '@/lib/supabase';
import { networkManager } from '@/lib/networkManager';
import type { AICard, AIStageStatus } from '@/components/ai/tokens';

// React Native 0.86+ ships a global fetch with streaming support.
// Using standard fetch avoids the expo/fetch sub-path import
// which can cause Metro module resolution failures in some build configs.
const expoFetch = fetch;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://rjzgzxxdrltlteeshtuw.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const ZURU_AI_ENDPOINT = `${SUPABASE_URL}/functions/v1/zuru-ai`;

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

export const zuruAIService = {
  /**
   * Natural-language travel discovery querying Fable 5.1 + real Supabase listings
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
    } = options;

    onStatusChange?.({ stage: 'understanding', text: 'Understanding your request…' });

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
                  onStatusChange?.({ stage: 'searching', text: data.text || 'Finding matching experiences…' });
                } else if (data.stage === 'understanding') {
                  onStatusChange?.({ stage: 'understanding', text: data.text || 'Understanding your request…' });
                }
              } else if (eventType === 'delta') {
                if (data.delta) {
                  onTextDelta?.(data.delta);
                  finalResult.text += data.delta;
                }
              } else if (eventType === 'result') {
                finalResult = {
                  text: data.text || finalResult.text || "Here are matching experiences on ZuruSasa:",
                  cards: data.cards || [],
                  followUps: data.followUps || finalResult.followUps,
                  criteria: data.criteria,
                };
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
      };
    } catch (err: any) {
      onStatusChange?.({ stage: 'error', text: err?.message || 'Failed' });
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        throw new Error('Request cancelled or timed out. Please try again.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Retrieves AI-computed personalization affinities for the authenticated user.
   * Cached for 1 hour to prevent swiping lag and unnecessary server calls.
   */
  async getPersonalizationAffinities(userId?: string): Promise<UserAffinities> {
    if (!userId) {
      return { categoryAffinities: {}, locationAffinities: {} };
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
   * Invalidate local personalization cache
   */
  clearPersonalizationCache() {
    cachedAffinities = null;
  },
};
