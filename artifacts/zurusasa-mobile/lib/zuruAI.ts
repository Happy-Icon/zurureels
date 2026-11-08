import { useCallback, useEffect, useRef, useState } from 'react';
import {
  zuruAIService,
  type ZuruAIDiscoverResponse,
  type AIMetadata,
} from '@/services/zuruAIService';
import {
  aiConversationService,
  buildSlidingWindowContext,
  generateUUID,
  type AIConversationSession,
} from '@/services/aiConversationService';
import type { AICard, AIMessage, AIStageStatus } from '@/components/ai/tokens';
import { useAuth } from '@/context/AuthContext';

declare module '@/components/ai/tokens' {
  interface AIMessage {
    meta?: AIMetadata;
    interrupted?: boolean;
    clientMessageId?: string;
  }
}

export type ZuruMessage = {
  role: 'user' | 'assistant';
  content: string;
  cards?: AICard[];
  followUps?: string[];
};

export interface SendMessageOptions {
  userLocation?: {
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  clientMessageId?: string;
  resumeFromOffset?: number;
}

export function useZuruAI(initialConversationId?: string) {
  const { user } = useAuth();
  const userId = user?.id || 'guest';

  const [conversationId, setConversationId] = useState<string>(
    initialConversationId || generateUUID()
  );
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [lastMeta, setLastMeta] = useState<AIMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [stageStatus, setStageStatus] = useState<AIStageStatus>({
    stage: 'idle',
    text: '',
  });
  const [error, setError] = useState<string | null>(null);

  const lastPromptRef = useRef<string>('');
  const lastOptionsRef = useRef<SendMessageOptions | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeSessionRef = useRef<AIConversationSession | null>(null);

  // ── 50ms Progressive Rendering Buffer ──────────────────────────────────────
  const deltaBufferRef = useRef<string>('');
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushDeltaBuffer = useCallback((messageId?: string) => {
    if (!deltaBufferRef.current) return;
    const chunk = deltaBufferRef.current;
    deltaBufferRef.current = '';

    setMessages((prev) =>
      prev.map((m) =>
        (messageId ? m.id === messageId : m.isStreaming)
          ? { ...m, text: m.text + chunk, isStreaming: true }
          : m
      )
    );
  }, []);

  // ── Session Hydration on Mount or ID Change ────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    (async () => {
      let session: AIConversationSession | null = null;
      if (initialConversationId) {
        session = await aiConversationService.loadSession(userId, initialConversationId);
      } else {
        session = await aiConversationService.getActiveSession(userId);
      }

      if (isMounted && session) {
        setConversationId(session.id);
        setMessages(session.messages || []);
        activeSessionRef.current = session;
        if (session.messages.length > 0) {
          const lastAi = [...session.messages].reverse().find((m) => m.role === 'ai');
          if (lastAi?.meta) {
            setLastMeta(lastAi.meta);
          }
        }
      }
    })();

    return () => {
      isMounted = false;
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, [userId, initialConversationId]);

  // ── Auto-save Session on Message Updates ───────────────────────────────────
  useEffect(() => {
    if (messages.length === 0 && !activeSessionRef.current) return;

    const currentSession: AIConversationSession = {
      id: conversationId,
      userId,
      title:
        activeSessionRef.current?.title ||
        (messages[0]?.text ? messages[0].text.slice(0, 32) : 'Travel Planning'),
      destination: activeSessionRef.current?.destination || null,
      contextSummary: activeSessionRef.current?.contextSummary || null,
      extractedPreferences: activeSessionRef.current?.extractedPreferences || {},
      messages,
      createdAt: activeSessionRef.current?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    activeSessionRef.current = currentSession;
    aiConversationService.saveActiveSession(userId, currentSession);
  }, [messages, conversationId, userId]);

  // ── Stop Generation (Cancellation Support) ─────────────────────────────────
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
    flushDeltaBuffer();
    deltaBufferRef.current = '';
    setIsLoading(false);
    setIsStreaming(false);
    setStageStatus({ stage: 'idle', text: '' });

    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    );
  }, [flushDeltaBuffer]);

  // ── Send Message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (promptText: string, options?: SendMessageOptions) => {
      const text = promptText.trim();
      if (!text || isLoading) return;

      lastPromptRef.current = text;
      lastOptionsRef.current = options;
      setError(null);

      const clientMsgId = options?.clientMessageId || generateUUID();
      const userMsg: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text,
        timestamp: new Date(),
        clientMessageId: clientMsgId,
      };

      const aiMsgId = `ai-${Date.now()}`;
      const placeholderAiMsg: AIMessage = {
        id: aiMsgId,
        role: 'ai',
        text: '',
        timestamp: new Date(),
        isStreaming: true,
        clientMessageId: clientMsgId,
      };

      setMessages((prev) => [...prev, userMsg, placeholderAiMsg]);
      setIsLoading(true);
      setIsStreaming(true);
      setStageStatus({ stage: 'understanding', text: 'Understanding request…' });

      // Cancel prior in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      let accumulatedStreamText = '';
      try {
        // 12-turn sliding window with distilled listing cards & 3,500-char ceiling
        const history = buildSlidingWindowContext(
          messages,
          activeSessionRef.current?.contextSummary
        );

        const res: ZuruAIDiscoverResponse = await zuruAIService.discover(text, {
          history,
          stream: true,
          userLocation: options?.userLocation,
          signal: controller.signal,
          clientMessageId: clientMsgId,
          resumeFromOffset: options?.resumeFromOffset,
          conversationId,
          onStatusChange: (status) => {
            setStageStatus(status);
          },
          onTextDelta: (delta) => {
            accumulatedStreamText += delta;
            deltaBufferRef.current += delta;
            if (!throttleTimerRef.current) {
              throttleTimerRef.current = setTimeout(() => {
                throttleTimerRef.current = null;
                flushDeltaBuffer(aiMsgId);
              }, 50); // 50ms accumulation throttle
            }
          },
        });

        // Flush remaining tokens in buffer
        if (throttleTimerRef.current) {
          clearTimeout(throttleTimerRef.current);
          throttleTimerRef.current = null;
        }
        flushDeltaBuffer(aiMsgId);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  text: res.text || accumulatedStreamText || m.text,
                  cards: res.cards,
                  followUps: res.followUps,
                  criteria: res.criteria,
                  meta: res.meta,
                  isStreaming: false,
                  interrupted: false,
                }
              : m
          )
        );

        if (res.meta) {
          setLastMeta(res.meta);
        }
        setStageStatus({ stage: 'done', text: '' });
      } catch (err: any) {
        const isAbort = err?.name === 'AbortError' || controller.signal.aborted;

        if (isAbort) {
          // User requested stop: preserve accumulated partial text
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, isStreaming: false } : m))
          );
        } else {
          // Check for mid-stream disconnection
          const hasPartialText = Boolean(deltaBufferRef.current || accumulatedStreamText);

          if (hasPartialText) {
            flushDeltaBuffer(aiMsgId);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? {
                      ...m,
                      isStreaming: false,
                      interrupted: true,
                    }
                  : m
              )
            );
          } else {
            // Full failure without any tokens
            const errMsg = err?.message || 'Unable to connect to Zuru AI. Please try again.';
            setError(errMsg);
            setStageStatus({ stage: 'error', text: errMsg });
            setLastMeta({
              engine: 'client-fallback',
              model: 'none',
              degraded: true,
              is_fallback: true,
              fallbackReason: errMsg,
              latencyMs: 0,
            });

            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? {
                      ...m,
                      text: `Sorry, I ran into an issue: ${errMsg}`,
                      isStreaming: false,
                      followUps: ['Try again', 'Show Mombasa stays', 'Beach villas in Diani'],
                      meta: {
                        engine: 'error',
                        model: 'none',
                        degraded: true,
                        is_fallback: true,
                        fallbackReason: errMsg,
                        latencyMs: 0,
                      },
                    }
                  : m
              )
            );
          }
        }
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [messages, isLoading, conversationId, flushDeltaBuffer]
  );

  // ── Mid-stream Interruption Recovery ───────────────────────────────────────
  const resumeInterruptedMessage = useCallback(
    async (clientMessageId: string) => {
      const interruptedMsg = messages.find(
        (m) => m.clientMessageId === clientMessageId && m.interrupted
      );
      if (!interruptedMsg) return;

      const userMsg = [...messages]
        .reverse()
        .find((m) => m.role === 'user' && m.clientMessageId === clientMessageId);

      if (userMsg) {
        await sendMessage(userMsg.text, {
          clientMessageId,
          resumeFromOffset: interruptedMsg.text.length,
        });
      }
    },
    [messages, sendMessage]
  );

  const retryLastMessage = useCallback(() => {
    if (lastPromptRef.current) {
      sendMessage(lastPromptRef.current, lastOptionsRef.current);
    }
  }, [sendMessage]);

  const clearMessages = useCallback(() => {
    stopGeneration();
    setMessages([]);
    setLastMeta(null);
    setError(null);
    setStageStatus({ stage: 'idle', text: '' });
    aiConversationService.clearActiveSession(userId);
  }, [stopGeneration, userId]);

  const loadSession = useCallback(
    async (newConversationId: string) => {
      const session = await aiConversationService.loadSession(userId, newConversationId);
      if (session) {
        setConversationId(session.id);
        setMessages(session.messages || []);
        activeSessionRef.current = session;
        const lastAi = [...session.messages].reverse().find((m) => m.role === 'ai');
        setLastMeta(lastAi?.meta || null);
      }
    },
    [userId]
  );

  return {
    conversationId,
    messages,
    isLoading,
    isStreaming,
    stageStatus,
    error,
    lastMeta,
    sendMessage,
    stopGeneration,
    clearMessages,
    retryLastMessage,
    resumeInterruptedMessage,
    loadSession,
  };
}
