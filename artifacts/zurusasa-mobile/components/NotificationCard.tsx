import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors, useTheme } from '@/hooks/useColors';
import type { NotificationRow, NotificationType } from '@/lib/supabase';

interface NotificationCardProps {
  notification: NotificationRow;
  onPress: (notification: NotificationRow) => void;
  onDelete?: (id: string) => void;
}

function getNotificationTypeConfig(type: NotificationType): {
  icon: keyof typeof Feather.glyphMap;
  color: string;
  bgColor: string;
} {
  switch (type) {
    case 'booking_created':
      return { icon: 'calendar', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.1)' };
    case 'booking_confirmed':
    case 'listing_approved':
      return { icon: 'check-circle', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.1)' };
    case 'booking_cancelled':
    case 'booking_declined':
    case 'listing_rejected':
      return { icon: 'x-circle', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.1)' };
    case 'payment_success':
    case 'promotion':
      return { icon: 'credit-card', color: '#F26522', bgColor: 'rgba(242, 101, 34, 0.1)' };
    case 'payout_completed':
      return { icon: 'dollar-sign', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.1)' };
    case 'message':
      return { icon: 'message-square', color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.1)' };
    case 'review_reminder':
      return { icon: 'star', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.1)' };
    case 'wishlist_available':
      return { icon: 'heart', color: '#EC4899', bgColor: 'rgba(236, 72, 153, 0.1)' };
    case 'booking_request':
      return { icon: 'clock', color: '#F26522', bgColor: 'rgba(242, 101, 34, 0.1)' };
    case 'verification':
      return { icon: 'shield', color: '#14B8A6', bgColor: 'rgba(20, 184, 166, 0.1)' };
    default:
      return { icon: 'bell', color: '#F26522', bgColor: 'rgba(242, 101, 34, 0.1)' };
  }
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function NotificationCard({
  notification,
  onPress,
  onDelete,
}: NotificationCardProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const config = getNotificationTypeConfig(notification.type);
  const timeText = formatRelativeTime(notification.created_at);

  const getCtaLabel = (): string | null => {
    switch (notification.action_type) {
      case 'booking':
        return 'View Booking';
      case 'chat':
        return 'Open Chat';
      case 'payout':
        return 'View Earnings';
      case 'listing':
        return 'Manage Listing';
      case 'discover':
        return 'Explore';
      default:
        return null;
    }
  };

  const ctaLabel = getCtaLabel();

  return (
    <Pressable
      onPress={() => onPress(notification)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        !notification.is_read && [
          styles.cardUnread,
          { backgroundColor: isDark ? '#2A1810' : '#FFFBF8', borderColor: isDark ? '#5C2D16' : '#FCE3D6' },
        ],
        { opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.cardHeaderRow}>
        <View style={[styles.iconCircle, { backgroundColor: config.bgColor }]}>
          <Feather name={config.icon} size={18} color={config.color} />
        </View>

        <View style={styles.contentWrap}>
          <View style={styles.titleRow}>
            <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>
              {notification.title}
            </Text>
            <View style={styles.metaRow}>
              {!notification.is_read ? <View style={styles.unreadDot} /> : null}
              <Text style={[styles.timeText, { color: colors.mutedForeground }]}>{timeText}</Text>
            </View>
          </View>

          <Text style={[styles.messageText, { color: colors.mutedForeground }]} numberOfLines={2}>
            {notification.message}
          </Text>

          {ctaLabel ? (
            <View style={styles.ctaRow}>
              <Text style={styles.ctaText}>{ctaLabel}</Text>
              <Feather name="arrow-right" size={13} color="#F26522" />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardUnread: {
    backgroundColor: '#FFFBF8',
    borderColor: '#FCE3D6',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  contentWrap: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F26522',
  },
  timeText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  messageText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
    lineHeight: 18,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  ctaText: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
});
