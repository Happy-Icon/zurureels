import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { Skeleton } from '@/components/Skeleton';
import {
  formatConversationPreview,
  formatConversationTime,
} from '@/components/inbox/inboxFormatters';
import type { ConversationRow } from '@/lib/supabase';

const UNREAD_ORANGE = '#F26522';
export const CONVERSATION_AVATAR_SIZE = 50;
export const CONVERSATION_ROW_HORIZONTAL_PADDING = 20;
export const CONVERSATION_ROW_GAP = 14;
export const CONVERSATION_SEPARATOR_INSET =
  CONVERSATION_ROW_HORIZONTAL_PADDING + CONVERSATION_AVATAR_SIZE + CONVERSATION_ROW_GAP;

interface ConversationListRowProps {
  item: ConversationRow;
  currentUserId?: string;
  onPress: (conversation: ConversationRow) => void;
}

export function ConversationListRow({
  item,
  currentUserId,
  onPress,
}: ConversationListRowProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);

  const hasUnread = (item.unread_count ?? 0) > 0;
  const timeLabel = formatConversationTime(item.last_message_at);
  const previewText = formatConversationPreview(item.last_message, currentUserId);
  const avatarUrl = item.other.avatar_url;
  const showAvatarImage = !!avatarUrl && failedAvatarUrl !== avatarUrl;
  const initial = (item.other.full_name?.trim().charAt(0) || '?').toUpperCase();

  const pressedBg = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(17, 24, 39, 0.045)';
  const fallbackBg = isDark ? '#27272A' : '#EFEFEF';

  const accessibilityLabel = [
    item.other.full_name,
    previewText,
    timeLabel,
    hasUnread ? 'Unread' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      testID={`conversation-${item.id}`}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? pressedBg : 'transparent' },
      ]}
    >
      {showAvatarImage ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.avatar, { backgroundColor: fallbackBg }]}
          contentFit="cover"
          transition={150}
          onError={() => setFailedAvatarUrl(avatarUrl)}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: fallbackBg }]}>
          <Text style={[styles.avatarInitial, { color: colors.mutedForeground }]}>
            {initial}
          </Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.topLine}>
          <Text
            style={[
              styles.name,
              hasUnread ? styles.nameUnread : styles.nameRead,
              { color: colors.text },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.other.full_name}
          </Text>
          {timeLabel ? (
            <Text
              style={[
                styles.timestamp,
                hasUnread ? styles.timestampUnread : styles.timestampRead,
                { color: hasUnread ? UNREAD_ORANGE : colors.mutedForeground },
              ]}
              numberOfLines={1}
            >
              {timeLabel}
            </Text>
          ) : null}
        </View>

        <View style={styles.bottomLine}>
          <Text
            style={[
              styles.preview,
              hasUnread ? styles.previewUnread : styles.previewRead,
              { color: hasUnread ? colors.text : colors.mutedForeground },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {previewText}
          </Text>
          {hasUnread ? (
            <View
              testID={`conversation-unread-${item.id}`}
              style={styles.unreadDot}
            />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function ConversationSeparator() {
  const { isDark } = useTheme();
  return (
    <View
      style={[
        styles.separator,
        {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.09)'
            : 'rgba(17, 24, 39, 0.08)',
        },
      ]}
    />
  );
}

export function ConversationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <React.Fragment key={index}>
          <View style={styles.row}>
            <Skeleton style={styles.skeletonAvatar} />
            <View style={styles.content}>
              <View style={styles.topLine}>
                <Skeleton style={styles.skeletonName} />
                <Skeleton style={styles.skeletonTime} />
              </View>
              <Skeleton style={styles.skeletonPreview} />
            </View>
          </View>
          {index < count - 1 ? <ConversationSeparator /> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: CONVERSATION_ROW_HORIZONTAL_PADDING,
    paddingVertical: 14,
    gap: CONVERSATION_ROW_GAP,
  },
  avatar: {
    width: CONVERSATION_AVATAR_SIZE,
    height: CONVERSATION_AVATAR_SIZE,
    borderRadius: CONVERSATION_AVATAR_SIZE / 2,
    flexShrink: 0,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontFamily: 'DMSans_600SemiBold',
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  name: {
    flex: 1,
    fontSize: 15.5,
    lineHeight: 21,
  },
  nameRead: {
    fontFamily: 'DMSans_600SemiBold',
  },
  nameUnread: {
    fontFamily: 'DMSans_700Bold',
  },
  timestamp: {
    fontSize: 12.5,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  timestampRead: {
    fontFamily: 'DMSans_400Regular',
  },
  timestampUnread: {
    fontFamily: 'DMSans_600SemiBold',
  },
  preview: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  previewRead: {
    fontFamily: 'DMSans_400Regular',
  },
  previewUnread: {
    fontFamily: 'DMSans_600SemiBold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: UNREAD_ORANGE,
    flexShrink: 0,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: CONVERSATION_SEPARATOR_INSET,
  },
  skeletonAvatar: {
    width: CONVERSATION_AVATAR_SIZE,
    height: CONVERSATION_AVATAR_SIZE,
    borderRadius: CONVERSATION_AVATAR_SIZE / 2,
  },
  skeletonName: {
    width: '48%',
    height: 15,
    borderRadius: 6,
  },
  skeletonTime: {
    width: 30,
    height: 12,
    borderRadius: 6,
  },
  skeletonPreview: {
    width: '74%',
    height: 13,
    borderRadius: 6,
    marginTop: 4,
  },
});
