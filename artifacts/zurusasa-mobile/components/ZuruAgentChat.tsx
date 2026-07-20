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

const ORANGE = '#EE7D30';

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
}

export function ZuruAgentChat({
  visible,
  onClose,
  reelSummary,
  reels,
  city: cityOverride,
  placeholder,
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={handleClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 10) + 6 },
            ]}
          >
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIcon}>
                  <MaterialCommunityIcons name="creation" size={16} color="#fff" />
                </View>
                <Text style={styles.headerTitle}>Zuru Agent</Text>
              </View>
              <Pressable
                testID="zuru-chat-close"
                onPress={handleClose}
                hitSlop={10}
                style={styles.closeButton}
              >
                <Feather name="x" size={18} color="rgba(255,255,255,0.8)" />
              </Pressable>
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.messages}
              contentContainerStyle={styles.messagesContent}
              onContentSizeChange={() =>
                scrollRef.current?.scrollToEnd({ animated: true })
              }
              keyboardShouldPersistTaps="handled"
            >
              {messages.length === 0 ? (
                <Text style={styles.intro}>
                  {city === 'Discover'
                    ? 'Ask me anything about these listings — stays, boats, food, events and plans.'
                    : `Ask me anything about the coast — boats, food, stays, plans for today in ${city}.`}
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
                  <Text style={styles.thinkingText}>Zuru is thinking…</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.inputRow}>
              <TextInput
                testID="zuru-chat-input"
                value={input}
                onChangeText={setInput}
                placeholder={placeholder ?? `What should I do in ${city} today?`}
                placeholderTextColor="rgba(255,255,255,0.4)"
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
                      !input.trim() || isLoading ? 0.4 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Feather name="arrow-up" size={19} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#17130f',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingTop: 14,
    paddingHorizontal: 16,
    maxHeight: 560,
    minHeight: 420,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messages: {
    flexGrow: 0,
    minHeight: 240,
  },
  messagesContent: {
    paddingVertical: 14,
    gap: 10,
  },
  intro: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: 'DMSans_400Regular',
    paddingHorizontal: 4,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: ORANGE,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'DMSans_400Regular',
  },
  userText: {
    color: '#ffffff',
  },
  aiText: {
    color: 'rgba(255,255,255,0.92)',
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thinkingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
