import type { ConversationLastMessage } from '@/lib/supabase';

export function formatConversationTime(iso: string | null, nowMs = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, nowMs - t);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function formatConversationPreview(
  lastMessage: ConversationLastMessage | null | undefined,
  currentUserId: string | undefined,
): string {
  if (!lastMessage) {
    return 'No messages yet';
  }
  const isOwn = !!currentUserId && lastMessage.sender_id === currentUserId;
  const body = lastMessage.is_image
    ? 'Photo'
    : lastMessage.content.replace(/\s+/g, ' ').trim() || 'Message';
  return isOwn ? `You: ${body}` : body;
}
