import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
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
import { useConversations } from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';
import { useColors } from '@/hooks/useColors';
import { supabase, type ConversationRow } from '@/lib/supabase';

function timeAgo(iso: string | null) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
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

export default function InboxScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const { data: conversations, isLoading, refetch } = useConversations(user?.id);
  const [refreshing, setRefreshing] = useState(false);

  // Realtime subscription for instant inbox updates when conversations receive messages
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`inbox_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
          queryClient.invalidateQueries({ queryKey: ['unread-messages-count', user.id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
      }
    }, [user?.id, refetch, queryClient]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 10;
  const bottomPad = Platform.OS === 'web' ? 110 : 100;

  if (!loading && !user) {
    return (
      <View
        style={[
          styles.fill,
          styles.centered,
          { backgroundColor: '#FAFAFA', paddingTop: topPad },
        ]}
      >
        <View style={styles.heroIcon}>
          <Feather name="message-square" size={32} color="#EE7D30" />
        </View>
        <Text style={styles.heroTitle}>Talk to your hosts</Text>
        <Text style={styles.heroSub}>
          Sign in to message hosts and plan the details of your trip across the Kenyan coast.
        </Text>
        <Pressable
          testID="inbox-signin"
          onPress={() => {
            router.push('/auth');
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            { opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Text style={styles.primaryButtonText}>Sign in or Sign up</Text>
        </Pressable>
      </View>
    );
  }

  const openConversation = (c: ConversationRow) => {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: c.id,
        name: c.other.full_name,
        avatar: c.other.avatar_url ?? '',
      },
    });
  };

  const renderRow = ({ item }: { item: ConversationRow }) => (
    <Pressable
      testID={`conversation-${item.id}`}
      onPress={() => openConversation(item)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? '#F9FAFB' : '#FFFFFF',
        },
      ]}
    >
      {item.other.avatar_url ? (
        <Image
          source={{ uri: item.other.avatar_url }}
          style={styles.avatar}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>
            {item.other.full_name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>
          {item.other.full_name}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowTime}>
          {timeAgo(item.last_message_at)}
        </Text>
        <Feather name="chevron-right" size={16} color="#9CA3AF" />
      </View>
    </Pressable>
  );

  return (
    <View
      testID="inbox-screen"
      style={[styles.fill, { backgroundColor: '#FAFAFA' }]}
    >
      <FlatList
        data={conversations ?? []}
        keyExtractor={(c) => c.id}
        renderItem={renderRow}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#EE7D30"
          />
        }
        contentContainerStyle={{
          paddingTop: topPad,
          paddingBottom: bottomPad,
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Inbox</Text>
            <Text style={styles.subtitle}>
              {conversations?.length
                ? `${conversations.length} active conversation${conversations.length === 1 ? '' : 's'}`
                : 'Direct messaging with hosts & guests'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingHorizontal: 20, gap: 12 }}>
              <Skeleton style={styles.skeletonRow} />
              <Skeleton style={styles.skeletonRow} />
              <Skeleton style={styles.skeletonRow} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Feather name="message-circle" size={44} color="#9CA3AF" style={{ opacity: 0.5 }} />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySub}>
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
    marginBottom: 16,
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13.5,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
  },
  avatarFallback: {
    backgroundColor: '#EE7D30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
  },
  rowInfo: { flex: 1, gap: 2 },
  rowName: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: '#111827',
  },
  rowUsername: {
    fontSize: 12.5,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowTime: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },
  skeletonRow: {
    height: 72,
    borderRadius: 20,
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
