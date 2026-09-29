import { useCallback, useRef, useState } from 'react';
import { zuruAIService, type ZuruAIDiscoverResponse } from '@/services/zuruAIService';
import type { AICard, AIMessage, AIStageStatus } from '@/components/ai/tokens';

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
}

export function useZuruAI() {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stageStatus, setStageStatus] = useState<AIStageStatus>({
    stage: 'idle',
    text: '',
  });
  const [error, setError] = useState<string | null>(null);
  const lastPromptRef = useRef<string>('');
  const lastOptionsRef = useRef<SendMessageOptions | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (promptText: string, options?: SendMessageOptions) => {
    const text = promptText.trim();
    if (!text || isLoading) return;

    lastPromptRef.current = text;
    lastOptionsRef.current = options;
    setError(null);

    const userMsg: AIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setStageStatus({ stage: 'understanding', text: 'Understanding your request…' });

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Build conversation history for context
      const history = messages.slice(-4).map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));

      const res: ZuruAIDiscoverResponse = await zuruAIService.discover(text, {
        history,
        stream: true,
        userLocation: options?.userLocation,
        signal: controller.signal,
        onStatusChange: (status) => {
          setStageStatus(status);
        },
      });

      const aiMsg: AIMessage = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        text: res.text,
        timestamp: new Date(),
        cards: res.cards,
        followUps: res.followUps,
        criteria: res.criteria,
      };

      setMessages((prev) => [...prev, aiMsg]);
      setStageStatus({ stage: 'done', text: '' });
    } catch (err: any) {
      const errMsg = err?.message || 'Unable to connect to Zuru AI. Please try again.';
      setError(errMsg);
      setStageStatus({ stage: 'error', text: errMsg });

      const errorMsg: AIMessage = {
        id: `err-${Date.now()}`,
        role: 'ai',
        text: `Sorry, I ran into an issue: ${errMsg}`,
        timestamp: new Date(),
        followUps: ['Try again', 'Show Mombasa stays', 'Beach villas in Diani'],
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [messages, isLoading]);

  const retryLastMessage = useCallback(() => {
    if (lastPromptRef.current) {
      sendMessage(lastPromptRef.current, lastOptionsRef.current);
    }
  }, [sendMessage]);

  const clearMessages = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setError(null);
    setStageStatus({ stage: 'idle', text: '' });
  }, []);

  return {
    messages,
    isLoading,
    stageStatus,
    error,
    sendMessage,
    clearMessages,
    retryLastMessage,
  };
}

