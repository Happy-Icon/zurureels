import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationCard } from '@/components/NotificationCard';
import { Skeleton } from '@/components/Skeleton';
import type { NotificationRow } from '@/lib/supabase';

function isSameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

const GUEST_NOTIFICATION_TYPES = new Set([
  'booking_created',
  'booking_confirmed',
  'booking_cancelled',
  'booking_declined',
  'payment_success',
  'refund_processed',
  'message',
  'review_reminder',
  'promotion',
  'wishlist_available',
]);

const HOST_NOTIFICATION_TYPES = new Set([
  'booking_request',
  'booking_cancelled',
  'booking_declined',
  'payout_completed',
  'verification',
  'listing_approved',
  'listing_rejected',
  'performance',
  'message',
]);

export default function NotificationCenterScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { viewMode } = useAuth();
  const {
    notifications: rawNotifications,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
  } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);

  // Strictly filter notifications by active view mode (Guest vs Host)
  const notifications = useMemo(() => {
    const isHostMode = viewMode === 'host';
    const allowedTypes = isHostMode ? HOST_NOTIFICATION_TYPES : GUEST_NOTIFICATION_TYPES;
    return rawNotifications.filter((n) => allowedTypes.has(n.type));
  }, [rawNotifications, viewMode]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 12;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 24;

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleNotificationPress = async (item: NotificationRow) => {
    if (!item.is_read) {
      await markAsRead(item.id);
    }

    if (item.action_type) {
      switch (item.action_type) {
        case 'booking':
          router.push('/reservations');
          break;
        case 'chat':
          if (item.action_id) {
            router.push(`/chat/${item.action_id}`);
          } else {
            router.push('/inbox');
          }
          break;
        case 'payout':
          router.push('/profile/payments');
          break;
        case 'listing':
          router.push('/become-host');
          break;
        case 'discover':
          router.push('/discover');
          break;
        case 'profile':
          router.push('/(tabs)/profile');
          break;
        case 'support':
          router.push('/profile/support');
          break;
        default:
          break;
      }
    }
  };

  // Group notifications into Today, Yesterday, Earlier
  const groupedSections = useMemo(() => {
    const today: NotificationRow[] = [];
    const yesterday: NotificationRow[] = [];
    const earlier: NotificationRow[] = [];

    const now = new Date();
    const yestDate = new Date();
    yestDate.setDate(now.getDate() - 1);

    for (const notif of notifications) {
      const d = new Date(notif.created_at);
      if (isSameDay(d, now)) {
        today.push(notif);
      } else if (isSameDay(d, yestDate)) {
        yesterday.push(notif);
      } else {
        earlier.push(notif);
      }
    }

    const sections: { title: string; data: NotificationRow[] }[] = [];
    if (today.length > 0) sections.push({ title: 'Today', data: today });
    if (yesterday.length > 0) sections.push({ title: 'Yesterday', data: yesterday });
    if (earlier.length > 0) sections.push({ title: 'Earlier', data: earlier });

    return sections;
  }, [notifications]);

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable
          testID="notifications-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/(tabs)/profile');
          }}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={24} color={colors.text} />
        </Pressable>

        {unreadCount > 0 && (
          <Pressable
            onPress={markAllAsRead}
            style={({ pressed }) => [styles.markAllBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.markAllText, { color: colors.text }]}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {/* ── PAGE TITLE (MATCHING SCREENSHOT) ─────────────────────────────────── */}
      <View style={styles.titleContainer}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Notifications</Text>
      </View>

      {/* ── NOTIFICATIONS LIST OR EMPTY STATE (MATCHING SCREENSHOT) ─────────── */}
      <SectionList
        sections={groupedSections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section: { title } }) => (
          <View style={[styles.sectionHeaderWrap, { backgroundColor: colors.background }]}>
            <Text style={[styles.sectionHeaderTitle, { color: colors.text }]}>{title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.itemWrap}>
            <NotificationCard
              notification={item}
              onPress={handleNotificationPress}
              onDelete={deleteNotification}
            />
          </View>
        )}
        contentContainerStyle={[
          styles.listContent,
          notifications.length === 0 && styles.emptyListContent,
          { paddingBottom: bottomPad },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F26522" />
        }
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 14, paddingTop: 24, paddingHorizontal: 24 }}>
              <Skeleton style={{ height: 80, borderRadius: 16 }} />
              <Skeleton style={{ height: 80, borderRadius: 16 }} />
              <Skeleton style={{ height: 80, borderRadius: 16 }} />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#27272A' : '#F7F7F7' }]}>
                <Feather name="bell-off" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications yet</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                We'll notify you here about booking updates, host messages, and payment activity.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  markAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  markAllText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#F26522',
  },
  titleContainer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.8,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111111',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  emptySub: {
    fontSize: 15,
    color: '#717171',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_400Regular',
      default: 'sans-serif',
    }),
  },
  sectionHeaderWrap: {
    paddingTop: 16,
    paddingBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    letterSpacing: -0.2,
  },
  itemWrap: {
    marginBottom: 12,
  },
});
