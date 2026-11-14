import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  AI_COLORS,
  AI_FONTS,
  AI_RADIUS,
  AI_SHADOW,
} from '@/components/ai/tokens';
import {
  aiConversationService,
  type ConversationSessionSummary,
} from '@/services/aiConversationService';
import { useAuth } from '@/context/AuthContext';
import { useCustomAlert } from '@/context/CustomAlertContext';

export default function AIHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useCustomAlert();
  const userId = user?.id || 'guest';

  const [sessions, setSessions] = useState<ConversationSessionSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadSessions = useCallback(async () => {
    try {
      const list = await aiConversationService.listSessions(userId);
      setSessions(list);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSessions();
  }, [loadSessions]);

  const handleSelectSession = (item: ConversationSessionSummary) => {
    router.push({
      pathname: '/ai/chat',
      params: { conversationId: item.id },
    } as any);
  };

  const handleDeleteSession = (item: ConversationSessionSummary) => {
    showAlert({
      title: 'Delete Conversation',
      message: `Are you sure you want to delete "${item.title}"?`,
      variant: 'destructive',
      icon: 'trash-2',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await aiConversationService.deleteSession(userId, item.id);
            setSessions((prev) => prev.filter((s) => s.id !== item.id));
          },
        },
      ],
    });
  };

  const handleClearAll = () => {
    if (sessions.length === 0) return;
    showAlert({
      title: 'Clear All History',
      message: 'This will permanently delete all saved AI conversations on this device.',
      variant: 'destructive',
      icon: 'trash-2',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await aiConversationService.clearAllSessions(userId);
            setSessions([]);
          },
        },
      ],
    });
  };

  const handleStartNewChat = () => {
    const newSession = aiConversationService.createNewSession(userId);
    router.push({
      pathname: '/ai/chat',
      params: { conversationId: newSession.id },
    } as any);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays}d ago`;
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header ────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={20} color={AI_COLORS.textPrimary} />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Chat History</Text>
          <Text style={styles.headerSub}>Saved travel concierge sessions</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            onPress={handleStartNewChat}
            style={styles.iconBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Start new conversation"
          >
            <Feather name="plus" size={18} color={AI_COLORS.orange} />
          </Pressable>

          <Pressable
            onPress={handleClearAll}
            style={[styles.iconBtn, sessions.length === 0 && { opacity: 0.3 }]}
            disabled={sessions.length === 0}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear all history"
          >
            <Feather name="trash-2" size={18} color={AI_COLORS.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* ── Content ───────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color={AI_COLORS.orange} />
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.centerBox}>
          <View style={styles.emptyIconCircle}>
            <Feather name="clock" size={28} color={AI_COLORS.orange} />
          </View>
          <Text style={styles.emptyTitle}>No Conversations Yet</Text>
          <Text style={styles.emptyDesc}>
            Your past travel chats and itineraries with Zuru Agent will appear here.
          </Text>
          <Pressable
            onPress={handleStartNewChat}
            style={styles.newChatBtn}
            accessibilityRole="button"
            accessibilityLabel="Start new chat"
          >
            <Feather name="plus" size={16} color="#FFFFFF" />
            <Text style={styles.newChatText}>Start New Chat</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={AI_COLORS.orange}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSelectSession(item)}
              style={({ pressed }) => [
                styles.sessionCard,
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Conversation: ${item.title}`}
            >
              <View style={styles.cardHeader}>
                <View style={styles.titleRow}>
                  <Text style={styles.sessionTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.destination ? (
                    <View style={styles.destBadge}>
                      <Text style={styles.destBadgeText}>{item.destination}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.dateText}>{formatDate(item.updatedAt)}</Text>
              </View>

              <Text style={styles.snippetText} numberOfLines={2}>
                {item.lastMessageSnippet || 'No messages'}
              </Text>

              <View style={styles.cardFooter}>
                <View style={styles.countBadge}>
                  <Feather name="message-square" size={12} color={AI_COLORS.textTertiary} />
                  <Text style={styles.countText}>{item.messageCount} messages</Text>
                </View>

                <Pressable
                  onPress={() => handleDeleteSession(item)}
                  style={styles.deleteBtn}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Delete this conversation"
                >
                  <Feather name="trash" size={14} color={AI_COLORS.textTertiary} />
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AI_COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: AI_COLORS.border,
    backgroundColor: AI_COLORS.bgCard,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AI_COLORS.bgCardAlt,
    borderWidth: 1,
    borderColor: AI_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.textPrimary,
  },
  headerSub: {
    fontSize: 11,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: AI_COLORS.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.textPrimary,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: AI_COLORS.orange,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: AI_RADIUS.full,
    marginTop: 8,
    ...AI_SHADOW.orange,
  },
  newChatText: {
    fontSize: 14,
    fontFamily: AI_FONTS.bold,
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  sessionCard: {
    backgroundColor: AI_COLORS.bgCard,
    borderRadius: AI_RADIUS.lg,
    borderWidth: 1,
    borderColor: AI_COLORS.border,
    padding: 14,
    gap: 8,
    ...AI_SHADOW.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  sessionTitle: {
    fontSize: 15,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.textPrimary,
    flexShrink: 1,
  },
  destBadge: {
    backgroundColor: AI_COLORS.orangeSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: AI_RADIUS.xs,
  },
  destBadgeText: {
    fontSize: 10,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.orange,
  },
  dateText: {
    fontSize: 11,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textTertiary,
  },
  snippetText: {
    fontSize: 13,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textSecondary,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AI_COLORS.border,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  countText: {
    fontSize: 11,
    fontFamily: AI_FONTS.medium,
    color: AI_COLORS.textTertiary,
  },
  deleteBtn: {
    padding: 4,
  },
});
