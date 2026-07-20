import { useCallback, useState } from 'react';
import { fetch as expoFetch } from 'expo/fetch';

// Port of the web app's useCityPulseAI hook — same Supabase edge function,
// same SSE stream format (OpenAI-style deltas).

export type ZuruMessage = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/city-pulse-ai`;
const API_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

function parseDelta(line: string): string | null {
  let l = line;
  if (l.endsWith('\r')) l = l.slice(0, -1);
  if (!l.startsWith('data: ')) return null;
  const jsonStr = l.slice(6).trim();
  if (jsonStr === '[DONE]') return null;
  try {
    const parsed = JSON.parse(jsonStr);
    const content = parsed.choices?.[0]?.delta?.content as string | undefined;
    return content ?? null;
  } catch {
    return null;
  }
}

export function useZuruAI() {
  const [messages, setMessages] = useState<ZuruMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (message: string, city: string, context: unknown) => {
      setMessages((prev) => [...prev, { role: 'user', content: message }]);
      setIsLoading(true);

      const updateAssistant = (content: string) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content } : m,
            );
          }
          return [...prev, { role: 'assistant', content }];
        });
      };

      let assistant = '';
      try {
        const resp = await expoFetch(CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_KEY}`,
          },
          body: JSON.stringify({ message, city, context }),
        });

        if (!resp.ok) {
          if (resp.status === 429) {
            throw new Error('Rate limit exceeded. Please try again later.');
          }
          if (resp.status === 402) {
            throw new Error('AI credits exhausted. Please try again later.');
          }
          throw new Error(`Zuru Agent is unavailable right now (${resp.status}).`);
        }

        const canStream =
          !!resp.body && typeof TextDecoder !== 'undefined';

        if (canStream) {
          const reader = resp.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let done = false;
          while (!done) {
            const chunk = await reader.read();
            done = chunk.done;
            if (chunk.value) {
              buffer += decoder.decode(chunk.value, { stream: true });
            }
            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
              const line = buffer.slice(0, newlineIndex);
              buffer = buffer.slice(newlineIndex + 1);
              const delta = parseDelta(line);
              if (delta) {
                assistant += delta;
                updateAssistant(assistant);
              }
            }
          }
        } else {
          const text = await resp.text();
          for (const line of text.split('\n')) {
            const delta = parseDelta(line);
            if (delta) assistant += delta;
          }
        }

        if (!assistant) {
          updateAssistant("Sorry, I couldn't answer that right now — please try again.");
        } else {
          updateAssistant(assistant);
        }
      } catch (err) {
        updateAssistant(
          err instanceof Error
            ? err.message
            : 'Something went wrong. Please try again.',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, isLoading, sendMessage, clearMessages };
}
