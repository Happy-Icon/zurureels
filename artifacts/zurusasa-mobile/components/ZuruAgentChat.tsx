import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useZuruAI } from '@/lib/zuruAI';

const ORANGE = '#F26522';

export interface ReelSummary {
  title: string | null;
  category: string | null;
  location: string | null;
  price: number | null;
}

interface ZuruAgentChatProps {
  visible: boolean;
  onClose: () => void;
  reelSummary?: ReelSummary | null;
  /** Multi-listing context (Discover grid). Takes precedence over reelSummary. */
  reels?: ReelSummary[];
  /** Override the city sent to the agent (defaults to the reel's location). */
  city?: string;
  placeholder?: string;
  isEmbedded?: boolean;
}

export function ZuruAgentChat({
  visible,
  onClose,
  reelSummary,
  reels,
  city: cityOverride,
  placeholder,
  isEmbedded = false,
}: ZuruAgentChatProps) {
  const insets = useSafeAreaInsets();
  const { messages, isLoading, sendMessage, clearMessages } = useZuruAI();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const city = cityOverride ?? (reelSummary?.location?.trim() || 'Mombasa');
  const contextReels = reels ?? (reelSummary ? [reelSummary] : []);

  const handleClose = () => {
    clearMessages();
    onClose();
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage(text, city, { reels: contextReels });
  };

  const waiting =
    isLoading && messages[messages.length - 1]?.role !== 'assistant';

  const contentUI = (
    <KeyboardAvoidingView
      style={styles.keyboardAvoid}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? (isEmbedded ? 100 : 0) : 20}
    >
      <View
        style={[
          isEmbedded ? styles.embeddedCard : styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 12) + 8 },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons name="creation" size={18} color="#ffffff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Zuru AI Concierge</Text>
              <Text style={styles.headerSub}>Ask about stays, events & experiences</Text>
            </View>
          </View>
          {!isEmbedded && (
            <Pressable
              testID="zuru-chat-close"
              onPress={handleClose}
              hitSlop={12}
              style={styles.closeButton}
            >
              <Feather name="x" size={18} color="rgba(255,255,255,0.8)" />
            </Pressable>
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          nestedScrollEnabled
        >
          {messages.length === 0 ? (
            <Text style={styles.intro}>
              {city === 'Discover'
                ? 'Ask me anything about these coastal stays, events, water sports, and dining.'
                : `Ask me anything about ${city} — stays, events, boat trips & hidden gems.`}
            </Text>
          ) : null}
          {messages.map((m, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                m.role === 'user' ? styles.userBubble : styles.aiBubble,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  m.role === 'user' ? styles.userText : styles.aiText,
                ]}
              >
                {m.content}
              </Text>
            </View>
          ))}
          {waiting ? (
            <View style={[styles.bubble, styles.aiBubble, styles.thinkingRow]}>
              <ActivityIndicator size="small" color={ORANGE} />
              <Text style={styles.thinkingText}>Zuru AI is thinking…</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            testID="zuru-chat-input"
            value={input}
            onChangeText={setInput}
            onFocus={() => {
              setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
            }}
            placeholder={placeholder ?? `Ask Zuru AI about ${city}...`}
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={styles.input}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <Pressable
            testID="zuru-chat-send"
            onPress={handleSend}
            disabled={!input.trim() || isLoading}
            style={({ pressed }) => [
              styles.sendButton,
              {
                opacity:
                  !input.trim() || isLoading ? 0.45 : pressed ? 0.82 : 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            <Feather name="send" size={19} color="#ffffff" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  if (isEmbedded) {
    return contentUI;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={handleClose} />
        {contentUI}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    width: '100%',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#161310',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingTop: 16,
    paddingHorizontal: 20,
    maxHeight: 560,
    minHeight: 420,
  },
  embeddedCard: {
    backgroundColor: '#161310',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingTop: 18,
    paddingHorizontal: 20,
    minHeight: 280,
    marginTop: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messages: {
    flexGrow: 0,
    maxHeight: 280,
    minHeight: 140,
  },
  messagesContent: {
    paddingVertical: 14,
    gap: 12,
  },
  intro: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: 'DMSans_400Regular',
    paddingHorizontal: 4,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: ORANGE,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'DMSans_400Regular',
  },
  userText: {
    color: '#ffffff',
    fontFamily: 'DMSans_500Medium',
  },
  aiText: {
    color: 'rgba(255,255,255,0.95)',
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thinkingText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 20,
    color: '#ffffff',
    fontSize: 14.5,
    fontFamily: 'DMSans_400Regular',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
