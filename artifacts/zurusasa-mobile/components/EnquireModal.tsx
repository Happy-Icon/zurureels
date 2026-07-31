import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useEnquire } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { notificationService } from '@/services/notificationService';
import { GrowingInput } from '@/components/keyboard';

const ORANGE = '#F26522';

// Pre-written quick message suggestions
const QUICK_MESSAGES = [
  `Hi! I'm interested in this experience. Is it available?`,
  `What's included in the price?`,
  'Can you accommodate a group?',
  'Do you offer private bookings?',
  `What's the best time to visit?`,
  'Is transport included?',
];

interface EnquireModalProps {
  visible: boolean;
  onClose: () => void;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string | null;
  experienceTitle?: string | null;
  experienceLocation?: string | null;
  experiencePrice?: number | null;
  experiencePriceUnit?: string | null;
  reelThumbnailUrl?: string | null;
}

export function EnquireModal({
  visible,
  onClose,
  hostId,
  hostName,
  hostAvatarUrl,
  experienceTitle,
  experienceLocation,
  experiencePrice,
  experiencePriceUnit,
  reelThumbnailUrl,
}: EnquireModalProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const enquire = useEnquire();
  const queryClient = useQueryClient();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Animations
  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 9, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      // Reset on close
      setTimeout(() => {
        setText('');
        setSent(false);
        setConversationId(null);
        slideAnim.setValue(40);
        fadeAnim.setValue(0);
        successScale.setValue(0);
      }, 350);
    }
  }, [visible]);

  const handleSelectQuick = (msg: string) => {
    setText(msg);
  };

  const handleSend = async () => {
    if (!user) {
      onClose();
      router.push('/auth');
      return;
    }
    if (!text.trim() || sending) return;

    setSending(true);
    try {
      // 1. Find or create conversation
      const convId = await enquire.mutateAsync({ userId: user.id, hostId });
      setConversationId(convId);
      const now = new Date().toISOString();

      // 2. Send the first message
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: convId,
          sender_id: user.id,
          content: text.trim(),
        });

      if (msgError) throw new Error(msgError.message);

      // 3. Update conversation last_message_at & invalidate cache
      await supabase
        .from('conversations')
        .update({ last_message_at: now })
        .eq('id', convId);

      queryClient.invalidateQueries({ queryKey: ['conversations'] });

      // 4. Notify the host
      notificationService.createNotification({
        userId: hostId,
        type: 'message',
        title: `New message from ${user.user_metadata?.full_name || 'a guest'}`,
        message: text.trim(),
        actionType: 'chat',
        actionId: convId,
      });

      // 4. Show success state
      setSent(true);
      setSending(false);
      Animated.spring(successScale, {
        toValue: 1,
        tension: 70,
        friction: 6,
        useNativeDriver: true,
      }).start();
    } catch (err) {
      setSending(false);
      Alert.alert(
        'Message failed',
        err instanceof Error ? err.message : 'Could not send your message. Please try again.',
      );
    }
  };

  const handleOpenChat = () => {
    if (!conversationId) return;
    onClose();
    router.push({
      pathname: `/chat/${conversationId}` as any,
      params: {
        name: hostName,
        avatar: hostAvatarUrl ?? '',
        otherId: hostId,
      },
    });
  };

  const initials = hostName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Dimmed backdrop */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.sheet,
              {
                transform: [{ translateY: slideAnim }],
                opacity: fadeAnim,
              },
            ]}
          >
            {/* Drag handle */}
            <View style={styles.handle} />

            {/* Close button */}
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Feather name="x" size={18} color="#374151" />
            </Pressable>

            {/* ── SUCCESS STATE ──────────────────────────────────── */}
            {sent ? (
              <View style={[styles.successWrap, { paddingBottom: insets.bottom + 24 }]}>
                <Animated.View
                  style={[styles.successCircle, { transform: [{ scale: successScale }] }]}
                >
                  <Feather name="check" size={32} color="#10B981" />
                </Animated.View>
                <Text style={styles.successTitle}>Message Sent! 🎉</Text>
                <Text style={styles.successBody}>
                  Your message has been delivered to{' '}
                  <Text style={{ fontFamily: 'DMSans_700Bold' }}>{hostName}</Text>.
                  {'\n'}They usually reply within a few hours.
                </Text>

                <View style={styles.successActions}>
                  <Pressable
                    onPress={handleOpenChat}
                    style={({ pressed }) => [
                      styles.openChatBtn,
                      { opacity: pressed ? 0.88 : 1 },
                    ]}
                  >
                    <Feather name="message-circle" size={16} color="#FFFFFF" />
                    <Text style={styles.openChatBtnText}>Open Conversation</Text>
                  </Pressable>
                  <Pressable
                    onPress={onClose}
                    style={({ pressed }) => [
                      styles.dismissBtn,
                      { opacity: pressed ? 0.88 : 1 },
                    ]}
                  >
                    <Text style={styles.dismissBtnText}>Done</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              /* ── COMPOSE STATE ───────────────────────────────── */
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
              >
                {/* Header title */}
                <View style={styles.headerRow}>
                  <Text style={styles.headerTitle}>Message Host</Text>
                </View>

                {/* Host card */}
                <View style={styles.hostCard}>
                  {/* Thumbnail on left */}
                  {reelThumbnailUrl ? (
                    <Image
                      source={{ uri: reelThumbnailUrl }}
                      style={styles.thumbnail}
                      contentFit="cover"
                    />
                  ) : null}

                  <View style={styles.hostInfo}>
                    {/* Avatar */}
                    <View style={styles.avatarWrap}>
                      {hostAvatarUrl ? (
                        <Image
                          source={{ uri: hostAvatarUrl }}
                          style={styles.avatar}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.avatarFallback}>
                          <Text style={styles.avatarInitials}>{initials}</Text>
                        </View>
                      )}
                      <View style={styles.onlineDot} />
                    </View>

                    <View style={styles.hostText}>
                      <Text style={styles.hostLabel}>Hosted by</Text>
                      <Text style={styles.hostName}>{hostName}</Text>
                      {experienceTitle ? (
                        <Text style={styles.expTitle} numberOfLines={1}>
                          {experienceTitle}
                        </Text>
                      ) : null}
                      {experienceLocation ? (
                        <View style={styles.locationRow}>
                          <Feather name="map-pin" size={10} color="#9CA3AF" />
                          <Text style={styles.locationText}>{experienceLocation}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Price tag */}
                    {experiencePrice != null ? (
                      <View style={styles.priceBadge}>
                        <Text style={styles.priceAmount}>
                          KES {Number(experiencePrice).toLocaleString()}
                        </Text>
                        {experiencePriceUnit ? (
                          <Text style={styles.priceUnit}>/{experiencePriceUnit}</Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Trust bar */}
                <View style={styles.trustBar}>
                  <Feather name="shield" size={12} color="#10B981" />
                  <Text style={styles.trustText}>
                    Messages are end-to-end encrypted and protected by ZuruSasa.
                  </Text>
                </View>

                {/* Quick message chips */}
                <View style={styles.quickSection}>
                  <Text style={styles.quickLabel}>Quick messages</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.quickChips}
                  >
                    {QUICK_MESSAGES.map((msg) => (
                      <Pressable
                        key={msg}
                        onPress={() => handleSelectQuick(msg)}
                        style={({ pressed }) => [
                          styles.quickChip,
                          text === msg && styles.quickChipActive,
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.quickChipText,
                            text === msg && styles.quickChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {msg}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* Message input */}
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Your message</Text>
                  <View style={styles.inputWrap}>
                    <GrowingInput
                      value={text}
                      onChangeText={setText}
                      placeholder={`Hi ${hostName.split(' ')[0]}, I'm interested in...`}
                      placeholderTextColor="#9CA3AF"
                      minHeight={72}
                      maxHeight={150}
                      style={styles.input}
                      editable={!sending}
                      autoFocus
                    />
                    <Text style={styles.charCount}>{text.length}/500</Text>
                  </View>
                </View>

                {/* Response time note */}
                <View style={styles.responseNote}>
                  <Ionicons name="time-outline" size={14} color="#6B7280" />
                  <Text style={styles.responseNoteText}>
                    {hostName.split(' ')[0]} typically replies within 2 hours.
                  </Text>
                </View>

                {/* Send button */}
                <Pressable
                  onPress={handleSend}
                  disabled={!text.trim() || sending}
                  style={({ pressed }) => [
                    styles.sendBtn,
                    !text.trim() && styles.sendBtnDisabled,
                    pressed && text.trim() && { opacity: 0.88 },
                  ]}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Feather name="send" size={17} color="#FFFFFF" />
                  )}
                  <Text style={styles.sendBtnText}>
                    {sending ? 'Sending…' : 'Send Message'}
                  </Text>
                </Pressable>

                {!user ? (
                  <Text style={styles.footNote}>
                    You'll be asked to sign in before sending.
                  </Text>
                ) : null}
              </ScrollView>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginTop: 10,
    marginBottom: 6,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 50,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  headerRow: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    paddingTop: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },

  // Host card
  hostCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    overflow: 'hidden',
    backgroundColor: '#FAFAFA',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  thumbnail: {
    width: '100%',
    height: 110,
  },
  hostInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  avatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: ORANGE,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  hostText: {
    flex: 1,
    gap: 2,
  },
  hostLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  hostName: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  expTitle: {
    fontSize: 12.5,
    fontFamily: 'DMSans_500Medium',
    color: '#374151',
    marginTop: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  locationText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },
  priceBadge: {
    alignItems: 'flex-end',
    gap: 1,
    flexShrink: 0,
  },
  priceAmount: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },
  priceUnit: {
    fontSize: 10,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
  },

  // Trust bar
  trustBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trustText: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
    color: '#065F46',
    lineHeight: 16,
  },

  // Quick messages
  quickSection: {
    marginTop: 18,
    gap: 8,
  },
  quickLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
  },
  quickChips: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickChip: {
    maxWidth: 220,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  quickChipActive: {
    backgroundColor: '#FFF5EF',
    borderColor: ORANGE,
  },
  quickChipText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_500Medium',
    color: '#374151',
  },
  quickChipTextActive: {
    color: ORANGE,
    fontFamily: 'DMSans_600SemiBold',
  },

  // Input
  inputSection: {
    marginTop: 18,
    paddingHorizontal: 16,
    gap: 8,
  },
  inputLabel: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  inputWrap: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    minHeight: 110,
    gap: 4,
  },
  input: {
    fontSize: 14.5,
    fontFamily: 'DMSans_400Regular',
    color: '#111111',
    lineHeight: 22,
    flex: 1,
    textAlignVertical: 'top',
  },
  charCount: {
    alignSelf: 'flex-end',
    fontSize: 10.5,
    fontFamily: 'DMSans_400Regular',
    color: '#D1D5DB',
  },

  // Response note
  responseNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  responseNoteText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },

  // Send button
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: ORANGE,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: ORANGE,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sendBtnDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendBtnText: {
    fontSize: 15.5,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  footNote: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },

  // Success state
  successWrap: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 48,
    gap: 14,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B98115',
    borderWidth: 1.5,
    borderColor: '#10B98140',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 26,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
    textAlign: 'center',
  },
  successBody: {
    fontSize: 14.5,
    fontFamily: 'DMSans_400Regular',
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  successActions: {
    width: '100%',
    gap: 10,
  },
  openChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  openChatBtnText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  dismissBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    fontSize: 14.5,
    fontFamily: 'DMSans_600SemiBold',
    color: '#374151',
  },
});
