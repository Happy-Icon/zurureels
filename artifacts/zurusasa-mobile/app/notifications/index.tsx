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
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationCard } from '@/components/NotificationCard';
import { EmptyNotifications } from '@/components/EmptyNotifications';
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
  'payout_completed',
  'verification',
  'listing_approved',
  'listing_rejected',
  'performance',
  'message',
]);

export default function NotificationCenterScreen() {
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

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
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
          router.push('/host/payouts');
          break;
        case 'listing':
          router.push('/listings');
          break;
        case 'discover':
          router.push('/discover');
          break;
        case 'profile':
          router.push('/profile');
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
    <View style={[styles.fill, { backgroundColor: '#FFFFFF' }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header Bar */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color="#222222" />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>

        {unreadCount > 0 ? (
          <Pressable
            onPress={markAllAsRead}
            style={({ pressed }) => [
              styles.markAllBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      <SectionList
        sections={groupedSections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeaderWrap}>
            <Text style={styles.sectionHeaderTitle}>{title}</Text>
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
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: bottomPad,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F26522" />
        }
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 14, paddingTop: 16 }}>
              <Skeleton style={{ height: 90, borderRadius: 16 }} />
              <Skeleton style={{ height: 90, borderRadius: 16 }} />
              <Skeleton style={{ height: 90, borderRadius: 16 }} />
            </View>
          ) : (
            <EmptyNotifications />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    marginBottom: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  unreadBadge: {
    backgroundColor: '#F26522',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
  },
  markAllBtn: {
    paddingVertical: 6,
  },
  markAllText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#F26522',
  },
  sectionHeaderWrap: {
    paddingTop: 16,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
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
