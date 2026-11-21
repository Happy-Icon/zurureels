import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resolveAvatarUrl } from '@/lib/avatar';
import { realtimeManager } from '@/lib/realtimeManager';
import { notificationService } from '@/services/notificationService';
import {
  supabase,
  type ConversationLastMessage,
  type ConversationRow,
  type MessageRow,
} from '@/lib/supabase';

function isImageMessageContent(content: unknown): boolean {
  return (
    typeof content === 'string' &&
    (content.startsWith('https://res.cloudinary.com') ||
      (content.startsWith('http') &&
        (content.includes('/image/') ||
          content.includes('/upload/') ||
          /\.(jpg|jpeg|png|webp|gif)/i.test(content))))
  );
}

// ---- Enquire: find or create the buyer<->host conversation (mirrors web handleEnquire) ----

export function useEnquire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      hostId,
    }: {
      userId: string;
      hostId: string;
    }) => {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(userId) || !UUID_REGEX.test(hostId)) {
        throw new Error('Invalid conversation participant identifier.');
      }
      const [participantOne, participantTwo] = [userId, hostId].sort();
      const found = await supabase
        .from('conversations')
        .select('id')
        .eq('participant_one', participantOne)
        .eq('participant_two', participantTwo)
        .maybeSingle();
      if (found.error) throw new Error(found.error.message);
      if (found.data?.id) {
        await supabase
          .from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', found.data.id);
        return found.data.id as string;
      }

      const created = await supabase
        .from('conversations')
        .insert({
          participant_one: participantOne,
          participant_two: participantTwo,
          last_message_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (created.error) throw new Error(created.error.message);
      return created.data.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

// ---- Inbox (mirrors web MessagingSystem conversation list) ----

export function useConversations(userId: string | undefined) {
  return useQuery<ConversationRow[]>({
    queryKey: ['conversations', userId],
    enabled: !!userId,
    staleTime: 0,
    queryFn: async () => {
      const convs = await supabase
        .from('conversations')
        .select('id, participant_one, participant_two, last_message_at, created_at')
        .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(50);
      if (convs.error) throw new Error(convs.error.message);
      const rows = (convs.data ?? []) as {
        id: string;
        participant_one: string;
        participant_two: string;
        last_message_at: string | null;
        created_at?: string | null;
      }[];
      if (rows.length === 0) return [];

      const convIds = rows.map((c) => c.id);
      const otherIds = Array.from(
        new Set(
          rows.map((c) =>
            c.participant_one === userId ? c.participant_two : c.participant_one,
          ),
        ),
      );

      const latestBatchLimit = Math.min(Math.max(convIds.length * 15, 100), 500);

      const [profs, latestMsgsRes, unreadMsgsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, username, role, metadata')
          .in('id', otherIds),
        supabase
          .from('messages')
          .select('conversation_id, sender_id, content, created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
          .limit(latestBatchLimit),
        supabase
          .from('messages')
          .select('conversation_id')
          .in('conversation_id', convIds)
          .neq('sender_id', userId!)
          .eq('is_read', false),
      ]);

      if (profs.error) throw new Error(profs.error.message);
      const profById = new Map(
        (profs.data ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      const latestByConv = new Map<string, ConversationLastMessage>();
      if (!latestMsgsRes.error && latestMsgsRes.data) {
        for (const m of latestMsgsRes.data as {
          conversation_id: string;
          sender_id: string;
          content: string | null;
          created_at: string;
        }[]) {
          if (!latestByConv.has(m.conversation_id)) {
            const rawContent = typeof m.content === 'string' ? m.content : '';
            latestByConv.set(m.conversation_id, {
              content: rawContent,
              sender_id: m.sender_id,
              created_at: m.created_at,
              is_image: isImageMessageContent(rawContent),
            });
          }
        }

        // If the batch hit the cap and some conversations weren't covered, fetch their latest message individually
        if (latestMsgsRes.data.length >= latestBatchLimit) {
          const missingConvIds = convIds.filter((id) => !latestByConv.has(id));
          if (missingConvIds.length > 0) {
            const fallbackResults = await Promise.all(
              missingConvIds.map((convId) =>
                supabase
                  .from('messages')
                  .select('conversation_id, sender_id, content, created_at')
                  .eq('conversation_id', convId)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle(),
              ),
            );
            for (const res of fallbackResults) {
              const m = res.data as {
                conversation_id: string;
                sender_id: string;
                content: string | null;
                created_at: string;
              } | null;
              if (!res.error && m && !latestByConv.has(m.conversation_id)) {
                const rawContent = typeof m.content === 'string' ? m.content : '';
                latestByConv.set(m.conversation_id, {
                  content: rawContent,
                  sender_id: m.sender_id,
                  created_at: m.created_at,
                  is_image: isImageMessageContent(rawContent),
                });
              }
            }
          }
        }
      }

      const unreadByConv = new Map<string, number>();
      if (!unreadMsgsRes.error && unreadMsgsRes.data) {
        for (const row of unreadMsgsRes.data as { conversation_id: string }[]) {
          unreadByConv.set(
            row.conversation_id,
            (unreadByConv.get(row.conversation_id) ?? 0) + 1,
          );
        }
      }

      return rows.map((c) => {
        const otherId =
          c.participant_one === userId ? c.participant_two : c.participant_one;
        const p = profById.get(otherId);
        const metadata = (p?.metadata ?? null) as { avatar_url?: string } | null;
        const lastMessage = latestByConv.get(c.id) ?? null;
        return {
          ...c,
          last_message_at:
            lastMessage?.created_at ||
            c.last_message_at ||
            c.created_at ||
            new Date().toISOString(),
          last_message: lastMessage,
          unread_count: unreadByConv.get(c.id) ?? 0,
          other: {
            id: otherId,
            full_name: (p?.full_name as string) || 'Zuru User',
            username: (p?.username as string) || 'user',
            role: (p?.role as string) || 'guest',
            avatar_url: resolveAvatarUrl(p as any) ?? metadata?.avatar_url ?? null,
          },
        };
      });
    },
  });
}

export function useUnreadMessageCount(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const invalidateUnread = () => {
      queryClient.invalidateQueries({ queryKey: ['unread-messages-count', userId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
    };

    return realtimeManager.subscribe(
      {
        key: `unread_messages:${userId}`,
        topicPrefix: `unread_messages_${userId}`,
        bindings: [{ event: '*', schema: 'public', table: 'messages' }],
      },
      () => {
        invalidateUnread();
      },
      {
        onReconnect: invalidateUnread,
      },
    );
  }, [userId, queryClient]);

  return useQuery<number>({
    queryKey: ['unread-messages-count', userId],
    enabled: !!userId,
    staleTime: 15_000,
    queryFn: async () => {
      const { data: convs, error: convErr } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_one.eq.${userId},participant_two.eq.${userId}`);

      if (convErr || !convs || convs.length === 0) return 0;
      const convIds = convs.map((c) => c.id);

      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .neq('sender_id', userId!)
        .eq('is_read', false);

      if (error) return 0;
      return count ?? 0;
    },
  });
}

// ---- Direct Chat Room Queries & Mutations ----

export function useMessages(conversationId: string | undefined) {
  return useQuery<MessageRow[]>({
    queryKey: ['messages', conversationId],
    enabled: !!conversationId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true });

      if (error) throw new Error(error.message);
      const rows = ((data as unknown as MessageRow[]) ?? []).map((m) => {
        const isImg =
          typeof m.content === 'string' &&
          (m.content.startsWith('https://res.cloudinary.com') ||
            (m.content.startsWith('http') &&
              (m.content.includes('/image/') ||
                m.content.includes('/upload/') ||
                /\.(jpg|jpeg|png|webp|gif)/i.test(m.content))));
        return {
          ...m,
          image_url: m.image_url || (isImg ? m.content : null),
        };
      });
      return rows;
    },
  });
}

export interface SendMessageInput {
  conversationId: string;
  senderId: string;
  content: string;
  imageUrl?: string | null;
  recipientId?: string;
  senderName?: string;
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      const now = new Date().toISOString();

      // If imageUrl is sent, store the image URL directly in content
      const messageContent = input.imageUrl ? input.imageUrl : input.content;

      // 1. Insert message (messages table schema: id, conversation_id, sender_id, content, is_read, created_at)
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: input.conversationId,
          sender_id: input.senderId,
          content: messageContent,
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);

      // 2. Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: now })
        .eq('id', input.conversationId);

      // 3. Resolve recipient if not provided
      let recipientId = input.recipientId;
      if (!recipientId) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('participant_one, participant_two')
          .eq('id', input.conversationId)
          .maybeSingle();

        if (conv) {
          recipientId = conv.participant_one === input.senderId ? conv.participant_two : conv.participant_one;
        }
      }

      // 4. Trigger In-App + Push notification (deduplicated against server AFTER INSERT trigger via dedupeKey)
      if (recipientId && recipientId !== input.senderId) {
        const senderName = input.senderName || 'Someone';
        const messageId = (data as any)?.id;
        notificationService
          .createNotification({
            userId: recipientId,
            type: 'message',
            title: `New message from ${senderName}`,
            message: input.imageUrl ? 'Sent a photo' : input.content,
            actionType: 'chat',
            actionId: input.conversationId,
            dedupeKey: messageId ? `message:${messageId}:${recipientId}` : null,
            metadata: {
              conversation_id: input.conversationId,
              sender_id: input.senderId,
              sender_name: senderName,
            },
          })
          .catch((e) => console.warn('Message notification warning:', e));
      }

      const row = data as unknown as MessageRow;
      const isImg =
        typeof row.content === 'string' &&
        (row.content.startsWith('https://res.cloudinary.com') ||
          (row.content.startsWith('http') &&
            (row.content.includes('/image/') ||
              row.content.includes('/upload/') ||
              /\.(jpg|jpeg|png|webp|gif)/i.test(row.content))));
      return {
        ...row,
        image_url: isImg ? row.content : null,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['messages', data.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
    },
  });
}

export function useMarkMessagesRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, userId }: { conversationId: string; userId: string }) => {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
        .eq('is_read', false);

      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['messages', vars.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
    },
  });
}
