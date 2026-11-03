import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resolveAvatarUrl } from '@/lib/avatar';
import { notificationService } from '@/services/notificationService';
import {
  supabase,
  type ConversationRow,
  type MessageRow,
} from '@/lib/supabase';

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

      const otherIds = Array.from(
        new Set(
          rows.map((c) =>
            c.participant_one === userId ? c.participant_two : c.participant_one,
          ),
        ),
      );
      const profs = await supabase
        .from('profiles')
        .select('id, full_name, username, role, metadata')
        .in('id', otherIds);
      if (profs.error) throw new Error(profs.error.message);
      const profById = new Map(
        (profs.data ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      return rows.map((c) => {
        const otherId =
          c.participant_one === userId ? c.participant_two : c.participant_one;
        const p = profById.get(otherId);
        const metadata = (p?.metadata ?? null) as { avatar_url?: string } | null;
        return {
          ...c,
          last_message_at: c.last_message_at || c.created_at || new Date().toISOString(),
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
    const channelName = `unread_messages_${userId}_${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unread-messages-count', userId] });
          queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

      // 4. Trigger In-App + Push notification (non-blocking)
      if (recipientId && recipientId !== input.senderId) {
        const senderName = input.senderName || 'Someone';
        notificationService
          .createNotification({
            userId: recipientId,
            type: 'message',
            title: `New message from ${senderName}`,
            message: input.imageUrl ? '📷 Sent a photo' : input.content,
            actionType: 'chat',
            actionId: input.conversationId,
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
      queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
    },
  });
}
