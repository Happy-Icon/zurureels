import React from 'react';
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { useConversations } from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';
import { useColors } from '@/hooks/useColors';
import type { ConversationRow } from '@/lib/supabase';

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
  const { user, loading } = useAuth();
  const { data: conversations, isLoading } = useConversations(user?.id);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 110 : 100;

  if (!loading && !user) {
    return (
      <View
        style={[
          styles.fill,
          styles.centered,
          { backgroundColor: colors.background, paddingTop: topPad },
        ]}
      >
        <View style={[styles.heroIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="message-square" size={30} color={colors.primary} />
        </View>
        <Text style={[styles.heroTitle, { color: colors.foreground }]}>
          Talk to your hosts
        </Text>
        <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
          Sign in to message hosts and plan the details of your trip.
        </Text>
        <Pressable
          testID="inbox-signin"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/auth');
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.primaryButtonText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  const openConversation = (c: ConversationRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
          backgroundColor: pressed ? colors.muted : 'transparent',
          borderBottomColor: colors.border,
        },
      ]}
    >
      {item.other.avatar_url ? (
        <Image
          source={{ uri: item.other.avatar_url }}
          style={[styles.avatar, { backgroundColor: colors.muted }]}
        />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>
            {item.other.full_name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text
          style={[styles.rowName, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {item.other.full_name}
        </Text>
        <Text
          style={[styles.rowUsername, { color: colors.mutedForeground }]}
          numberOfLines={1}
        >
          @{item.other.username}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowTime, { color: colors.mutedForeground }]}>
          {timeAgo(item.last_message_at)}
        </Text>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );

  return (
    <View
      testID="inbox-screen"
      style={[styles.fill, { backgroundColor: colors.background }]}
    >
      <FlatList
        data={conversations ?? []}
        keyExtractor={(c) => c.id}
        renderItem={renderRow}
        contentContainerStyle={{
          paddingTop: topPad + 8,
          paddingBottom: bottomPad,
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Inbox
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {conversations?.length
                ? `${conversations.length} conversation${conversations.length === 1 ? '' : 's'}`
                : 'Chats with hosts and travelers'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              <Skeleton style={styles.skeletonRow} />
              <Skeleton style={styles.skeletonRow} />
              <Skeleton style={styles.skeletonRow} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Feather
                name="message-circle"
                size={40}
                color={colors.mutedForeground}
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No conversations yet
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                Enquire on any experience and the chat will show up here.
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
    gap: 12,
    paddingHorizontal: 32,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 26,
    fontFamily: 'InstrumentSerif_400Regular',
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
  primaryButton: {
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 4,
  },
  title: {
    fontSize: 30,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 19,
    fontFamily: 'DMSans_700Bold',
  },
  rowInfo: { flex: 1, gap: 2 },
  rowName: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
  },
  rowUsername: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowTime: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  skeletonRow: {
    height: 64,
    borderRadius: 12,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
});
