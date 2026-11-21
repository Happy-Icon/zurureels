import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useConversations } from '@/lib/queries';
import { OfflineState } from '@/components/OfflineState';
import {
  ConversationListRow,
  ConversationListSkeleton,
  ConversationSeparator,
} from '@/components/inbox/ConversationListRow';
import { useNetworkStatus } from '@/lib/networkManager';
import { useColors } from '@/hooks/useColors';
import { realtimeManager } from '@/lib/realtimeManager';
import type { ConversationRow } from '@/lib/supabase';

export default function InboxScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { data: conversations, isLoading, refetch } = useConversations(user?.id);
  const [refreshing, setRefreshing] = useState(false);

  // Realtime subscription for instant inbox updates when conversations receive messages
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    const invalidateInbox = () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      queryClient.invalidateQueries({ queryKey: ['unread-messages-count', userId] });
    };

    const unsubscribe = realtimeManager.subscribe(
      {
        key: `inbox:${userId}`,
        topicPrefix: `inbox_${userId}`,
        bindings: [
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
          },
        ],
      },
      () => {
        invalidateInbox();
      },
      {
        onReconnect: invalidateInbox,
      },
    );

    return unsubscribe;
  }, [user?.id, queryClient]);

  // Refresh on tab focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        refetch();
      }
    }, [user?.id, refetch]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (err) {
      console.warn('[Inbox] Refresh error (offline):', err);
    } finally {
      setRefreshing(false);
    }
  };

  const openConversation = useCallback(
    (c: ConversationRow) => {
      router.push({
        pathname: '/chat/[id]',
        params: {
          id: c.id,
          name: c.other.full_name,
          avatar: c.other.avatar_url ?? '',
        },
      });
    },
    [router],
  );

  const renderRow = useCallback(
    ({ item }: { item: ConversationRow }) => (
      <ConversationListRow
        item={item}
        currentUserId={user?.id}
        onPress={openConversation}
      />
    ),
    [user?.id, openConversation],
  );

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 90;

  if (!loading && !user) {
    return (
      <View
        testID="inbox-guest-hero"
        style={[
          styles.centered,
          styles.fill,
          { backgroundColor: colors.background, paddingTop: topPad + 40 },
        ]}
      >
        <View style={[styles.heroIcon, { backgroundColor: isDark ? '#27272A' : '#FFF7ED' }]}>
          <Feather name="message-square" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Talk to your hosts</Text>
        <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
          Sign in to message hosts and plan the details of your trip across the Kenyan coast.
        </Text>
        <Pressable
          testID="inbox-signin"
          onPress={() => {
            router.push('/auth');
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Text style={styles.primaryButtonText}>Sign in or Sign up</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      testID="inbox-screen"
      style={[styles.fill, { backgroundColor: colors.background }]}
    >
      <FlatList
        data={conversations ?? []}
        keyExtractor={(c) => c.id}
        renderItem={renderRow}
        ItemSeparatorComponent={ConversationSeparator}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{
          paddingTop: topPad,
          paddingBottom: bottomPad,
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Inbox</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Your conversations
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ConversationListSkeleton />
          ) : !isOnline && (!conversations || conversations.length === 0) ? (
            <OfflineState
              fullScreen={false}
              onRetry={refetch}
              message="Check your internet connection to view your conversations."
            />
          ) : (
            <View style={styles.empty}>
              <Feather name="message-circle" size={44} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No conversations yet</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                Enquire on any stay or experience and your chat with the host will appear here.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 32,
  },
  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EE7D3014',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: 'DMSans_700Bold',
    textAlign: 'center',
    color: '#111827',
  },
  heroSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    color: '#4B5563',
  },
  primaryButton: {
    backgroundColor: '#EE7D30',
    borderRadius: 999,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.4,
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 56,
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_600SemiBold',
    color: '#111827',
  },
  emptySub: {
    fontSize: 13.5,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
