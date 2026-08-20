import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { supabase, type MessageRow } from '@/lib/supabase';
import { useMessages, useSendMessage, useMarkMessagesRead } from '@/lib/queries';
import { uploadToCloudinaryMobile } from '@/lib/cloudinaryUpload';
import { Skeleton } from '@/components/Skeleton';
import { GrowingInput } from '@/components/keyboard';

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
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { id, name, avatar, otherId } = useLocalSearchParams<{
    id: string;
    name?: string;
    avatar?: string;
    otherId?: string;
  }>();

  const { data: serverMessages, isLoading: loading } = useMessages(id);
  const sendMessageMutation = useSendMessage();
  const markReadMutation = useMarkMessagesRead();

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<FlatList<MessageRow>>(null);

  const topPad = Platform.OS === 'web' ? 12 : insets.top + 4;
  const bottomPad = Platform.OS === 'web' ? 14 : Math.max(insets.bottom, 12);

  // Sync server messages into local state
  useEffect(() => {
    if (serverMessages) {
      setMessages((prev) => {
        const optimistic = prev.filter((m) => m.id.startsWith('temp-'));
        const merged = [...serverMessages];
        for (const opt of optimistic) {
          if (!merged.some((m) => m.content === opt.content && m.sender_id === opt.sender_id)) {
            merged.push(opt);
          }
        }
        return merged;
      });
    }
  }, [serverMessages]);

  // Mark incoming messages as read when opening conversation
  useEffect(() => {
    if (!id || !user) return;
    markReadMutation.mutate({ conversationId: id, userId: user.id });
  }, [id, user?.id]);

  // Realtime subscription for INSERT and UPDATE (read receipts)
  useEffect(() => {
    if (!id || !user) return;

    const channel = supabase
      .channel(`conv_${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as MessageRow;
            setMessages((prev) => {
              const withoutTemp = prev.filter((m) => !m.id.startsWith('temp-'));
              return withoutTemp.some((m) => m.id === newMsg.id) ? withoutTemp : [...withoutTemp, newMsg];
            });

            // If incoming message is from the other user, mark as read immediately
            if (newMsg.sender_id !== user.id) {
              markReadMutation.mutate({ conversationId: id, userId: user.id });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as MessageRow;
            setMessages((prev) =>
              prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m)),
            );
          }
        },
      )
      .subscribe();

    return () => {
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

    const tempId = `temp-${Date.now()}`;
    const temp: MessageRow = {
      id: tempId,
      conversation_id: id,
      sender_id: user.id,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, temp]);

    try {
      await sendMessageMutation.mutateAsync({
        conversationId: id,
        senderId: user.id,
        content,
        recipientId: otherId,
        senderName: user.user_metadata?.full_name || 'Someone',
      });
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setSendError('Message failed to send. Please try again.');
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const handlePickAttachment = async () => {
    if (uploadingPhoto || !user || !id) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setUploadingPhoto(true);
      setSendError(null);

      // Upload to Cloudinary
      const cRes = await uploadToCloudinaryMobile(asset.uri, {
        resourceType: 'image',
        folder: 'chat_attachments',
      });

      // Send photo message
      await sendMessageMutation.mutateAsync({
        conversationId: id,
        senderId: user.id,
        content: '📷 Photo attachment',
        imageUrl: cRes.secure_url,
        recipientId: otherId,
        senderName: user.user_metadata?.full_name || 'Someone',
      });
    } catch (err: any) {
      console.warn('Attachment upload error:', err);
      Alert.alert('Upload Failed', 'Could not upload the selected photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
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
            mine
              ? styles.mineBubble
              : [styles.theirBubble, { backgroundColor: isDark ? '#27272A' : '#F2F2F7', borderColor: colors.border }],
          ]}
        >
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              style={styles.attachmentImage}
              contentFit="cover"
              transition={200}
            />
          ) : null}
          {item.content && item.content !== '📷 Photo attachment' ? (
            <Text
              style={[
                styles.bubbleText,
                mine ? styles.mineText : [styles.theirText, { color: colors.text }],
              ]}
            >
              {item.content}
            </Text>
          ) : null}
        </View>
        <View style={styles.bubbleFooterRow}>
          <Text style={[styles.timestampText, { color: colors.mutedForeground }]}>{formatTime(item.created_at)}</Text>
          {mine ? (
            item.is_read ? (
              <Feather name="check-circle" size={11} color="#10B981" />
            ) : (
              <Feather name="check" size={11} color={colors.mutedForeground} />
            )
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      {/* 1. Native Navigation Header Bar */}
      <View style={[styles.headerBar, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: topPad }]}>
        <Pressable
          testID="chat-back"
          onPress={goBack}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="chevron-left" size={26} color={colors.text} />
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
              <View style={[styles.avatarFallback, { backgroundColor: isDark ? '#27272A' : '#E5E7EB' }]}>
                <Text style={[styles.avatarInitial, { color: colors.text }]}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.onlineDot} />
          </View>

          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerNameText, { color: colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.headerStatusText, { color: colors.mutedForeground }]}>Typically replies within 1 hour</Text>
          </View>
        </Pressable>

        {/* Right Info Action */}
        <Pressable
          onPress={() => {
            Alert.alert(displayName, 'Conversation details and direct host messaging.');
          }}
          hitSlop={10}
          style={({ pressed }) => [styles.infoBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="info" size={20} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.threadContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            messages.length > 0 ? (
              <View style={[styles.contextBadgeCard, { backgroundColor: isDark ? '#27272A' : '#F7F7F7', borderColor: colors.border }]}>
                <Feather name="shield" size={13} color={colors.mutedForeground} />
                <Text style={[styles.contextBadgeText, { color: colors.mutedForeground }]}>
                  Support & Host Inquiry · Verified Conversation
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
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? '#27272A' : '#F7F7F7' }]}>
                  <Feather name="message-square" size={28} color={colors.mutedForeground} />
                </View>
                <Text style={[styles.emptyHeadline, { color: colors.text }]}>Start a conversation</Text>
                <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                  Plan the details of your stay or experience directly with the host.
                </Text>
              </View>
            )
          }
        />

        {uploadingPhoto ? (
          <View style={styles.uploadingBar}>
            <ActivityIndicator size="small" color="#EE7D30" />
            <Text style={styles.uploadingText}>Uploading photo...</Text>
          </View>
        ) : null}

        {sendError ? <Text style={styles.sendErrorText}>{sendError}</Text> : null}

        {/* 4. Message Composer Bar */}
        <View style={[styles.composerBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomPad }]}>
          <Pressable
            onPress={handlePickAttachment}
            disabled={uploadingPhoto || sending}
            style={({ pressed }) => [styles.attachmentBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={8}
          >
            <Feather name="image" size={20} color={uploadingPhoto ? '#EE7D30' : colors.mutedForeground} />
          </Pressable>

          <View style={[styles.inputPillBox, { backgroundColor: isDark ? '#27272A' : '#F3F4F6', borderColor: colors.border }]}>
            <GrowingInput
              testID="message-input"
              value={text}
              onChangeText={setText}
              onFocus={() => {
                setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
              }}
              placeholder="Type a message..."
              placeholderTextColor={colors.mutedForeground}
              minHeight={36}
              maxHeight={120}
              style={[styles.composerInputText, { color: colors.text }]}
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
  attachmentImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
    marginBottom: 4,
  },
  bubbleFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  timestampText: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
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
  uploadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    backgroundColor: '#FFF7ED',
  },
  uploadingText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#EE7D30',
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
