/**
 * ZuruSasa AI Conversation Persistence & Memory Service
 * Hybrid Local-First Architecture: AsyncStorage + Isolated Supabase Sync
 * Completely isolated from human host-guest messaging (public.conversations & public.messages).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import type { AICard, AIMessage } from '@/components/ai/tokens';
import type { AIMetadata } from '@/services/zuruAIService';

// ── Database Row Contracts (Mirrors PostgreSQL Schema in public.ai_*) ──────────

export interface AIConversationRow {
  id: string;
  user_id: string;
  title: string;
  destination: string | null;
  context_summary: string | null;
  extracted_preferences: Record<string, any>;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export type AIMessageRole = 'user' | 'assistant' | 'system';

export interface AIMessageRow {
  id: string;
  conversation_id: string;
  role: AIMessageRole;
  content: string;
  cards: AICard[];
  follow_ups: string[];
  tool_calls?: Record<string, any> | null;
  tool_results?: Record<string, any> | null;
  execution_metadata: AIMetadata;
  client_message_id?: string | null;
  created_at: string;
}

export type AIUserMemoryCategory =
  | 'dietary'
  | 'accessibility'
  | 'pace'
  | 'budget'
  | 'interests'
  | 'exclusions';

export interface AIUserMemoryRow {
  id: string;
  user_id: string;
  category: AIUserMemoryCategory;
  preference_key: string;
  preference_value: any;
  confidence: number;
  user_approved: boolean;
  created_at: string;
  updated_at: string;
}

// ── Client Domain Models ─────────────────────────────────────────────────────

export interface AIConversationSession {
  id: string; // UUID
  userId: string; // Auth UUID or 'guest'
  title: string;
  destination?: string | null;
  messages: AIMessage[];
  contextSummary?: string | null;
  extractedPreferences?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
}

export interface ConversationSessionSummary {
  id: string;
  title: string;
  destination?: string | null;
  lastMessageSnippet: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

// Storage key prefixes (Strictly partitioned by userId to prevent cross-account leaks)
const ACTIVE_SESSION_PREFIX = '@zuru_ai_active_session_';
const SESSIONS_INDEX_PREFIX = '@zuru_ai_sessions_index_';
const SESSION_PAYLOAD_PREFIX = '@zuru_ai_session_';

/**
 * Robust RFC4122 v4 UUID generator (Hermes, JSC, V8, Node compliant)
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Distills listing cards into dense reference tokens.
 * Achieves ~93.75% token reduction (400 tokens/card -> ~25 tokens/card).
 * Format: [#1 Stay: "Title" (ID: exp-123, Loc: Diani, Price: KES 15,000/night, Rating: 4.9★)]
 */
export function distillCardsForHistory(cards?: any[]): string {
  if (!cards || !Array.isArray(cards) || cards.length === 0) return '';
  const lines = cards
    .filter((c): c is Record<string, any> => Boolean(c) && typeof c === 'object')
    .map((c, idx) => {
      const isStay =
        c.property_type ||
        c.bedrooms ||
        c.category === 'stay' ||
        (typeof c.priceUnit === 'string' && c.priceUnit.toLowerCase().includes('night'));
      const kind = isStay ? 'Stay' : 'Experience';

      const rawPrice = c.price_per_night ?? c.price ?? c.current_price;
      const unitStr = c.price_unit || c.priceUnit;
      const unit = unitStr
        ? `/${unitStr}`
        : c.price_per_night != null || isStay
        ? '/night'
        : rawPrice != null && !isNaN(Number(rawPrice))
        ? '/person'
        : '';
      const price =
        rawPrice != null && !isNaN(Number(rawPrice))
          ? `KES ${Number(rawPrice).toLocaleString()}${unit}`
          : 'Price on request';

      const rating = c.rating != null ? `${c.rating}★` : 'New';
      const loc = c.location_name || c.destination || c.location || 'Kenyan Coast';
      const id = c.id || c.experienceId || `item-${idx + 1}`;
      return `[#${idx + 1} ${kind}: "${c.title}" (ID: ${id}, Loc: ${loc}, Price: ${price}, Rating: ${rating})]`;
    });
  if (lines.length === 0) return '';
  return `\n[Previously Recommended Listings:\n${lines.join('\n')}]`;
}

/**
 * Builds an optimized 12-turn sliding window (6 user + 6 assistant turns)
 * with a strict 3,500-character ceiling and context summary injection.
 */
export function buildSlidingWindowContext(
  messages: AIMessage[],
  contextSummary?: string | null,
  maxTurns: number = 12,
  maxChars: number = 3500
): HistoryTurn[] {
  const validMessages = messages.filter((m) => m.text && m.text.trim().length > 0);
  const recentMessages = validMessages.slice(-maxTurns);

  const formattedTurns: HistoryTurn[] = recentMessages.map((m) => {
    let content = m.text.trim();
    if (m.role === 'ai' && m.cards && m.cards.length > 0) {
      content += distillCardsForHistory(m.cards);
    }
    return {
      role: m.role === 'user' ? 'user' : 'assistant',
      content,
    };
  });

  // Enforce character ceiling from oldest to newest while preserving at least the freshest turn
  let totalChars = formattedTurns.reduce((acc, t) => acc + t.content.length, 0);
  while (formattedTurns.length > 1 && totalChars > maxChars) {
    const dropped = formattedTurns.shift();
    if (dropped) {
      totalChars -= dropped.content.length;
    }
  }

  // Inject context summary as briefing turn if available
  if (contextSummary && contextSummary.trim().length > 0) {
    return [
      {
        role: 'assistant',
        content: `[Previous Conversation Context Brief:\n${contextSummary.trim()}]`,
      },
      ...formattedTurns,
    ];
  }

  return formattedTurns;
}

export const aiConversationService = {
  /**
   * Creates a new blank conversation session.
   */
  createNewSession(userId: string = 'guest', initialTitle: string = 'New Conversation'): AIConversationSession {
    const now = new Date().toISOString();
    return {
      id: generateUUID(),
      userId,
      title: initialTitle,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  },

  /**
   * Retrieves active conversation session from AsyncStorage.
   */
  async getActiveSession(userId: string = 'guest'): Promise<AIConversationSession> {
    try {
      const raw = await AsyncStorage.getItem(`${ACTIVE_SESSION_PREFIX}${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.messages = (parsed.messages || []).map((m: any) => ({
          ...m,
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
        }));
        return parsed;
      }
    } catch (e) {
      console.warn('[aiConversationService] Failed to load active session:', e);
    }
    return this.createNewSession(userId);
  },

  /**
   * Saves active session to AsyncStorage and triggers background remote sync for authenticated users.
   */
  async saveActiveSession(userId: string = 'guest', session: AIConversationSession): Promise<void> {
    try {
      const updatedSession: AIConversationSession = {
        ...session,
        userId,
        updatedAt: new Date().toISOString(),
      };

      // 1. Save active session locally
      await AsyncStorage.setItem(
        `${ACTIVE_SESSION_PREFIX}${userId}`,
        JSON.stringify(updatedSession)
      );

      // 2. Persist full session payload by ID
      await AsyncStorage.setItem(
        `${SESSION_PAYLOAD_PREFIX}${updatedSession.id}`,
        JSON.stringify(updatedSession)
      );

      // 3. Update sessions index
      await this.updateSessionIndex(userId, updatedSession);

      // 4. Background cloud sync for authenticated users
      if (userId && userId !== 'guest') {
        this.syncToRemote(updatedSession).catch((err) => {
          console.warn('[aiConversationService] Background sync error:', err);
        });
      }
    } catch (e) {
      console.warn('[aiConversationService] Failed to save active session:', e);
    }
  },

  /**
   * Clears the active session for the given user.
   */
  async clearActiveSession(userId: string = 'guest'): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${ACTIVE_SESSION_PREFIX}${userId}`);
    } catch (e) {
      console.warn('[aiConversationService] Failed to clear active session:', e);
    }
  },

  /**
   * Updates sessions index array in AsyncStorage for fast list rendering.
   */
  async updateSessionIndex(userId: string, session: AIConversationSession): Promise<void> {
    try {
      const indexKey = `${SESSIONS_INDEX_PREFIX}${userId}`;
      const raw = await AsyncStorage.getItem(indexKey);
      let list: ConversationSessionSummary[] = raw ? JSON.parse(raw) : [];

      const lastMsg = session.messages[session.messages.length - 1];
      const summary: ConversationSessionSummary = {
        id: session.id,
        title: session.title || 'Travel Planning',
        destination: session.destination || null,
        lastMessageSnippet: lastMsg?.text?.slice(0, 100) || 'Started conversation',
        messageCount: session.messages.length,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      };

      list = list.filter((item) => item.id !== session.id);
      list.unshift(summary);

      await AsyncStorage.setItem(indexKey, JSON.stringify(list));
    } catch (e) {
      console.warn('[aiConversationService] Failed to update session index:', e);
    }
  },

  /**
   * Lists all saved session summaries for the user (merging local + remote).
   */
  async listSessions(userId: string = 'guest'): Promise<ConversationSessionSummary[]> {
    try {
      const indexKey = `${SESSIONS_INDEX_PREFIX}${userId}`;
      const raw = await AsyncStorage.getItem(indexKey);
      let localList: ConversationSessionSummary[] = raw ? JSON.parse(raw) : [];

      // If authenticated and online, reconcile with remote sessions
      if (userId && userId !== 'guest') {
        const { data: remoteConvs, error } = await supabase
          .from('ai_conversations')
          .select('id, title, destination, created_at, updated_at')
          .eq('user_id', userId)
          .eq('is_archived', false)
          .order('updated_at', { ascending: false });

        if (!error && remoteConvs && remoteConvs.length > 0) {
          const remoteSummaries: ConversationSessionSummary[] = remoteConvs.map((rc: any) => ({
            id: rc.id,
            title: rc.title,
            destination: rc.destination,
            lastMessageSnippet: '',
            messageCount: 0,
            createdAt: rc.created_at,
            updatedAt: rc.updated_at,
          }));

          // Merge without duplicates, preferring local data for message snippets and counts
          const map = new Map<string, ConversationSessionSummary>();
          remoteSummaries.forEach((r) => map.set(r.id, r));
          localList.forEach((l) => map.set(l.id, l));
          localList = Array.from(map.values()).sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        }
      }

      return localList;
    } catch (e) {
      console.warn('[aiConversationService] Failed to list sessions:', e);
      return [];
    }
  },

  /**
   * Loads a specific conversation session by ID.
   */
  async loadSession(userId: string = 'guest', conversationId: string): Promise<AIConversationSession | null> {
    try {
      // 1. Check local storage first
      const raw = await AsyncStorage.getItem(`${SESSION_PAYLOAD_PREFIX}${conversationId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Verify ownership: prevent cross-account message snooping on shared devices
        if (parsed.userId && parsed.userId !== userId) {
          return null;
        }
        parsed.messages = (parsed.messages || []).map((m: any) => ({
          ...m,
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
        }));
        return parsed;
      }

      // 2. Fallback to Supabase for authenticated users
      if (userId && userId !== 'guest') {
        const { data: conv, error: convErr } = await supabase
          .from('ai_conversations')
          .select('*')
          .eq('id', conversationId)
          .eq('user_id', userId)
          .single();

        if (!convErr && conv) {
          const { data: msgs } = await supabase
            .from('ai_messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

          const session: AIConversationSession = {
            id: conv.id,
            userId: conv.user_id,
            title: conv.title,
            destination: conv.destination,
            contextSummary: conv.context_summary,
            extractedPreferences: conv.extracted_preferences,
            createdAt: conv.created_at,
            updatedAt: conv.updated_at,
            messages: (msgs || []).map((m: any) => ({
              id: m.id,
              role: m.role === 'assistant' ? 'ai' : 'user',
              text: m.content,
              timestamp: new Date(m.created_at),
              cards: m.cards || [],
              followUps: m.follow_ups || [],
              meta: m.execution_metadata,
              clientMessageId: m.client_message_id,
            })),
          };

          // Cache locally
          await AsyncStorage.setItem(
            `${SESSION_PAYLOAD_PREFIX}${session.id}`,
            JSON.stringify(session)
          );

          return session;
        }
      }
    } catch (e) {
      console.warn('[aiConversationService] Failed to load session:', e);
    }
    return null;
  },

  /**
   * Deletes a session locally and remotely.
   */
  async deleteSession(userId: string = 'guest', conversationId: string): Promise<void> {
    try {
      // 1. Check local ownership before removing payload
      const payloadRaw = await AsyncStorage.getItem(`${SESSION_PAYLOAD_PREFIX}${conversationId}`);
      if (payloadRaw) {
        try {
          const parsed = JSON.parse(payloadRaw);
          if (parsed.userId && parsed.userId !== userId) {
            return; // Deny deleting another user's session
          }
        } catch {
          // If JSON parse fails, allow removal
        }
      }

      // 2. Remove payload
      await AsyncStorage.removeItem(`${SESSION_PAYLOAD_PREFIX}${conversationId}`);

      // 3. Update index
      const indexKey = `${SESSIONS_INDEX_PREFIX}${userId}`;
      const indexRaw = await AsyncStorage.getItem(indexKey);
      if (indexRaw) {
        const list: ConversationSessionSummary[] = JSON.parse(indexRaw);
        const filtered = list.filter((s) => s.id !== conversationId);
        await AsyncStorage.setItem(indexKey, JSON.stringify(filtered));
      }

      // 3. Clear active session if it matches
      const activeRaw = await AsyncStorage.getItem(`${ACTIVE_SESSION_PREFIX}${userId}`);
      if (activeRaw) {
        const active: AIConversationSession = JSON.parse(activeRaw);
        if (active.id === conversationId) {
          await AsyncStorage.removeItem(`${ACTIVE_SESSION_PREFIX}${userId}`);
        }
      }

      // 4. Delete remotely if authenticated
      if (userId && userId !== 'guest') {
        await supabase.from('ai_conversations').delete().eq('id', conversationId);
      }
    } catch (e) {
      console.warn('[aiConversationService] Failed to delete session:', e);
    }
  },

  /**
   * Clears all saved sessions for the user.
   */
  async clearAllSessions(userId: string = 'guest'): Promise<void> {
    try {
      const indexKey = `${SESSIONS_INDEX_PREFIX}${userId}`;
      const raw = await AsyncStorage.getItem(indexKey);
      if (raw) {
        const list: ConversationSessionSummary[] = JSON.parse(raw);
        for (const item of list) {
          await AsyncStorage.removeItem(`${SESSION_PAYLOAD_PREFIX}${item.id}`);
        }
      }
      await AsyncStorage.removeItem(indexKey);
      await AsyncStorage.removeItem(`${ACTIVE_SESSION_PREFIX}${userId}`);

      if (userId && userId !== 'guest') {
        await supabase.from('ai_conversations').delete().eq('user_id', userId);
      }
    } catch (e) {
      console.warn('[aiConversationService] Failed to clear all sessions:', e);
    }
  },

  /**
   * Saves a user message with strict RLS compliance (role = 'user').
   */
  async saveUserMessage(
    params: { conversationId: string; text: string; clientMessageId?: string },
    userId?: string
  ): Promise<AIMessage> {
    const { conversationId, text, clientMessageId = generateUUID() } = params;
    const item: AIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date(),
      clientMessageId,
    };

    // If authenticated, sync message to Supabase
    if (userId && userId !== 'guest') {
      const { data, error } = await supabase
        .from('ai_messages')
        .insert({
          conversation_id: conversationId,
          role: 'user', // STRICT: Complies with RLS policy
          content: text,
          client_message_id: clientMessageId,
        })
        .select('id, created_at')
        .single();

      if (error) {
        console.warn('[aiConversationService] Supabase user message sync error:', error.message);
      } else if (data) {
        item.id = data.id;
        item.timestamp = new Date(data.created_at);
      }
    }

    return item;
  },

  /**
   * Saves an assistant message to the local session.
   * (In Supabase, assistant messages are inserted by the server-side Edge Function via service_role).
   */
  async saveAssistantMessage(
    params: {
      conversationId: string;
      text: string;
      cards?: any[];
      followUps?: string[];
      meta?: any;
    },
    userId: string = 'guest'
  ): Promise<AIMessage> {
    const item: AIMessage = {
      id: `ai-${Date.now()}`,
      role: 'ai',
      text: params.text,
      timestamp: new Date(),
      cards: params.cards || [],
      followUps: params.followUps || [],
      meta: params.meta,
    };

    const session = await this.getActiveSession(userId);
    if (session.id === params.conversationId) {
      session.messages.push(item);
      await this.saveActiveSession(userId, session);
    }

    return item;
  },

  /**
   * Cloud sync helper for authenticated sessions.
   */
  async syncToRemote(session: AIConversationSession): Promise<void> {
    if (!session.userId || session.userId === 'guest') return;

    // 1. Upsert conversation row
    await supabase.from('ai_conversations').upsert({
      id: session.id,
      user_id: session.userId,
      title: session.title || 'Travel Planning',
      destination: session.destination || null,
      context_summary: session.contextSummary || null,
      extracted_preferences: session.extractedPreferences || {},
      updated_at: new Date().toISOString(),
    });

    // 2. Sync user messages (Assistant messages are inserted exclusively by Edge Function)
    const userMessages = session.messages.filter((m) => m.role === 'user');
    for (const msg of userMessages) {
      await supabase.from('ai_messages').upsert(
        {
          id: msg.id.startsWith('user-') ? undefined : msg.id,
          conversation_id: session.id,
          role: 'user',
          content: msg.text,
          client_message_id: msg.clientMessageId || null,
          created_at: (msg.timestamp || new Date()).toISOString(),
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );
    }
  },

  // ── Travel Memories (Tier 4) ───────────────────────────────────────────────

  /**
   * Retrieves persistent travel memories for the user.
   */
  async getUserMemories(userId: string, category?: AIUserMemoryCategory): Promise<AIUserMemoryRow[]> {
    if (!userId || userId === 'guest') return [];
    try {
      let query = supabase.from('ai_user_memories').select('*').eq('user_id', userId);
      if (category) {
        query = query.eq('category', category);
      }
      const { data, error } = await query;
      if (error) {
        console.warn('[aiConversationService] getUserMemories error:', error.message);
        return [];
      }
      return (data as AIUserMemoryRow[]) || [];
    } catch (e) {
      console.warn('[aiConversationService] getUserMemories exception:', e);
      return [];
    }
  },

  /**
   * Saves or updates a persistent travel memory.
   */
  async saveUserMemory(
    userId: string,
    memory: {
      category: AIUserMemoryCategory;
      preferenceKey: string;
      preferenceValue: any;
      confidence?: number;
      userApproved?: boolean;
    }
  ): Promise<void> {
    if (!userId || userId === 'guest') return;
    try {
      const { error } = await supabase.from('ai_user_memories').upsert(
        {
          user_id: userId,
          category: memory.category,
          preference_key: memory.preferenceKey,
          preference_value: memory.preferenceValue,
          confidence: memory.confidence ?? 1.0,
          user_approved: memory.userApproved ?? false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,category,preference_key' }
      );
      if (error) {
        console.warn('[aiConversationService] saveUserMemory error:', error.message);
      }
    } catch (e) {
      console.warn('[aiConversationService] saveUserMemory exception:', e);
    }
  },

  /**
   * Deletes a specific travel memory by ID.
   */
  async deleteUserMemory(memoryId: string): Promise<void> {
    try {
      const { error } = await supabase.from('ai_user_memories').delete().eq('id', memoryId);
      if (error) {
        console.warn('[aiConversationService] deleteUserMemory error:', error.message);
      }
    } catch (e) {
      console.warn('[aiConversationService] deleteUserMemory exception:', e);
    }
  },
};
