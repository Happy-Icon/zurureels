import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { supabase, type MessageRow } from '@/lib/supabase';
import { useColors } from '@/hooks/useColors';

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m} ${ampm}`;
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { id, name, avatar } = useLocalSearchParams<{
    id: string;
    name?: string;
    avatar?: string;
  }>();

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<FlatList<MessageRow>>(null);

  // Load history + subscribe to new messages (mirrors web MessagingSystem).
  useEffect(() => {
    if (!id || !user) return;
    let active = true;

    (async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });
      if (active && !error && data) {
        setMessages(data as unknown as MessageRow[]);
      }
      if (active) setLoading(false);

      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', id)
        .neq('sender_id', user.id);
    })();

    const channel = supabase
      .channel(`conv_${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const msg = payload.new as MessageRow;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
          );
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [id, user?.id]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/inbox');
  };

  const send = async () => {
    const content = text.trim();
    if (!content || !user || !id || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    setSendError(null);
    setText('');

    const temp: MessageRow = {
      id: `temp-${Date.now()}`,
      conversation_id: id,
      sender_id: user.id,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, temp]);

    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: id, sender_id: user.id, content })
      .select('*')
      .single();

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setSendError('Message failed to send. Try again.');
      setText(content);
    } else if (data) {
      const real = data as unknown as MessageRow;
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== temp.id);
        return withoutTemp.some((m) => m.id === real.id)
          ? withoutTemp
          : [...withoutTemp, real];
      });
    }
    setSending(false);
  };

  const displayName = (name as string) || 'Conversation';
  const avatarUrl = (avatar as string) || '';

  const renderMessage = ({ item }: { item: MessageRow }) => {
    const mine = item.sender_id === user?.id;
    return (
      <View
        style={[
          styles.bubbleWrap,
          mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs,
        ]}
      >
        <View
          style={[
            styles.bubble,
            mine
              ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
              : {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderBottomLeftRadius: 4,
                },
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              { color: mine ? '#ffffff' : colors.foreground },
            ]}
          >
            {item.content}
          </Text>
          <Text
            style={[
              styles.bubbleTime,
              {
                color: mine ? 'rgba(255,255,255,0.75)' : colors.mutedForeground,
              },
            ]}
          >
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: (Platform.OS === 'web' ? 12 : insets.top) + 6,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          testID="chat-back"
          onPress={goBack}
          hitSlop={10}
          style={styles.backBtn}
        >
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </Pressable>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={[styles.headerAvatar, { backgroundColor: colors.muted }]}
          />
        ) : (
          <View
            style={[styles.headerAvatar, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.headerAvatarText}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text
            style={[styles.headerName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.empty}>
                <Feather
                  name="message-circle"
                  size={36}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[styles.emptyText, { color: colors.mutedForeground }]}
                >
                  Say hello and start planning your trip.
                </Text>
              </View>
            )
          }
        />

        {sendError ? (
          <Text style={[styles.sendError, { color: colors.destructive }]}>
            {sendError}
          </Text>
        ) : null}

        <View
          style={[
            styles.inputRow,
            {
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 10),
              backgroundColor: colors.background,
            },
          ]}
        >
          <TextInput
            testID="message-input"
            value={text}
            onChangeText={setText}
            placeholder="Write a message…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[
              styles.input,
              {
                backgroundColor: colors.muted,
                color: colors.foreground,
              },
            ]}
          />
          <Pressable
            testID="send-button"
            onPress={send}
            disabled={!text.trim() || sending}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: colors.primary,
                opacity: !text.trim() || sending ? 0.4 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather name="send" size={17} color="#ffffff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 32,
    alignItems: 'center',
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  headerInfo: { flex: 1 },
  headerName: {
    fontSize: 20,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  listContent: {
    padding: 16,
    gap: 8,
    flexGrow: 1,
  },
  bubbleWrap: {
    flexDirection: 'row',
  },
  bubbleWrapMine: {
    justifyContent: 'flex-end',
  },
  bubbleWrapTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
    gap: 3,
  },
  bubbleText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 19,
  },
  bubbleTime: {
    fontSize: 10,
    fontFamily: 'DMSans_400Regular',
    alignSelf: 'flex-end',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
  sendError: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingTop: 10,
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    maxHeight: 110,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
