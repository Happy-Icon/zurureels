import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
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
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { supabase, type MessageRow } from '@/lib/supabase';
import { Skeleton } from '@/components/Skeleton';
import { notificationService } from '@/services/notificationService';

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m} ${ampm}`;
}

export default function NativeChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { id, name, avatar, otherId } = useLocalSearchParams<{
    id: string;
    name?: string;
    avatar?: string;
    otherId?: string;
  }>();

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<FlatList<MessageRow>>(null);

  const topPad = Platform.OS === 'web' ? 12 : insets.top + 4;
  const bottomPad = Platform.OS === 'web' ? 14 : Math.max(insets.bottom, 12);

  // Load history + subscribe to new messages
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
      setSendError('Message failed to send. Please try again.');
      setText(content);
    } else if (data) {
      const real = data as unknown as MessageRow;
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== temp.id);
        return withoutTemp.some((m) => m.id === real.id)
          ? withoutTemp
          : [...withoutTemp, real];
      });

      const now = new Date().toISOString();
      await supabase
        .from('conversations')
        .update({ last_message_at: now })
        .eq('id', id);

      queryClient.invalidateQueries({ queryKey: ['conversations'] });

      // Find recipient ID from conversation
      const { data: conv } = await supabase
        .from('conversations')
        .select('participant_one, participant_two')
        .eq('id', id)
        .single();

      if (conv) {
        const recipientId =
          conv.participant_one === user.id ? conv.participant_two : conv.participant_one;
        if (recipientId) {
          notificationService.createNotification({
            userId: recipientId,
            type: 'message',
            title: `New message from ${user.user_metadata?.full_name || 'Host/Guest'}`,
            message: content,
            actionType: 'chat',
            actionId: id,
          });
        }
      }
    }
    setSending(false);
  };

  const handlePickAttachment = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      Alert.alert('Attachment Selected', 'Sharing photo in conversation.');
    }
  };

  const displayName = (name as string) || 'Support Team';
  const avatarUrl = (avatar as string) || '';

  // Render individual message bubble
  const renderMessage = ({ item }: { item: MessageRow }) => {
    const mine = item.sender_id === user?.id;
    return (
      <View style={[styles.bubbleWrapper, mine ? styles.bubbleRight : styles.bubbleLeft]}>
        <View
          style={[
            styles.bubbleContainer,
            mine ? styles.mineBubble : styles.theirBubble,
          ]}
        >
          <Text style={[styles.bubbleText, mine ? styles.mineText : styles.theirText]}>
            {item.content}
          </Text>
        </View>
        <Text style={styles.timestampText}>{formatTime(item.created_at)}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.fill, { backgroundColor: '#FFFFFF' }]}>
      {/* 1. Native Navigation Header Bar */}
      <View style={[styles.headerBar, { paddingTop: topPad }]}>
        <Pressable
          testID="chat-back"
          onPress={goBack}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="chevron-left" size={26} color="#222222" />
        </Pressable>

        {/* Avatar & Title Group -> Clickable Host Profile Link */}
        <Pressable
          onPress={() => {
            const targetId = otherId || id;
            if (targetId) {
              router.push(`/profile/${targetId}` as any);
            }
          }}
          style={({ pressed }) => [
            { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.onlineDot} />
          </View>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerNameText} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.headerStatusText}>Typically replies within 1 hour</Text>
          </View>
        </Pressable>

        {/* Right Info Action */}
        <Pressable
          onPress={() => {
            Alert.alert(displayName, 'Conversation details and support ticket context.');
          }}
          hitSlop={10}
          style={({ pressed }) => [styles.infoBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="info" size={20} color="#222222" />
        </Pressable>
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
          contentContainerStyle={styles.threadContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            messages.length > 0 ? (
              <View style={styles.contextBadgeCard}>
                <Feather name="shield" size={13} color="#717171" />
                <Text style={styles.contextBadgeText}>
                  Support Inquiry · Verified Conversation
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            loading ? (
              <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 14 }}>
                <Skeleton style={{ height: 44, width: '65%', borderRadius: 16, borderTopLeftRadius: 4 }} />
                <Skeleton style={{ height: 56, width: '75%', borderRadius: 16, borderTopRightRadius: 4, alignSelf: 'flex-end', backgroundColor: '#EE7D3025' }} />
                <Skeleton style={{ height: 44, width: '55%', borderRadius: 16, borderTopLeftRadius: 4 }} />
              </View>
            ) : (
              /* 2. Chat Body Empty State Refinement */
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Feather name="message-square" size={28} color="#717171" />
                </View>
                <Text style={styles.emptyHeadline}>Start a conversation</Text>
                <Text style={styles.emptyBody}>
                  Our team is here to assist with your bookings, payments, or general questions.
                </Text>
              </View>
            )
          }
        />

        {sendError ? <Text style={styles.sendErrorText}>{sendError}</Text> : null}

        {/* 4. Message Composer Bar (Sticky Bottom Input Dock) */}
        <View style={[styles.composerBar, { paddingBottom: bottomPad }]}>
          <Pressable
            onPress={handlePickAttachment}
            style={({ pressed }) => [styles.attachmentBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={8}
          >
            <Feather name="paperclip" size={20} color="#717171" />
          </Pressable>

          <View style={styles.inputPillBox}>
            <TextInput
              testID="message-input"
              value={text}
              onChangeText={setText}
              placeholder="Type a message..."
              placeholderTextColor="#717171"
              multiline
              style={styles.composerInputText}
            />
          </View>

          <Pressable
            testID="send-button"
            onPress={send}
            disabled={!text.trim() || sending}
            style={({ pressed }) => [
              styles.sendCircleBtn,
              text.trim() && !sending ? styles.sendCircleActive : styles.sendCircleDisabled,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather
              name="send"
              size={15}
              color={text.trim() && !sending ? '#FFFFFF' : '#9CA3AF'}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    gap: 10,
  },
  backBtn: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  avatarInitial: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#008A05',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerTitleWrap: {
    flex: 1,
    gap: 1,
  },
  headerNameText: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  headerStatusText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  infoBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    flexGrow: 1,
  },
  contextBadgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'center',
    marginBottom: 8,
  },
  contextBadgeText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  bubbleWrapper: {
    gap: 3,
    maxWidth: '80%',
  },
  bubbleRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubbleContainer: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  mineBubble: {
    backgroundColor: '#EE7D30',
    borderTopRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#F7F7F7',
    borderTopLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 20,
  },
  mineText: {
    color: '#FFFFFF',
  },
  theirText: {
    color: '#222222',
  },
  timestampText: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    paddingHorizontal: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 64,
    gap: 12,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyHeadline: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  sendErrorText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#EF4444',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  attachmentBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputPillBox: {
    flex: 1,
    backgroundColor: '#F7F7F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  composerInputText: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: '#222222',
    maxHeight: 100,
  },
  sendCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCircleActive: {
    backgroundColor: '#EE7D30',
  },
  sendCircleDisabled: {
    backgroundColor: '#EBEBEB',
  },
});
