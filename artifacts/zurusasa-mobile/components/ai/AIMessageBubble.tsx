import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AI_COLORS, AI_FONTS, AI_RADIUS, AI_SHADOW, type AIMessage } from './tokens';
import { AICardRow } from './AICards';

interface AIMessageBubbleProps {
  message: AIMessage;
  isLatest?: boolean;
}

export function AIMessageBubble({ message, isLatest }: AIMessageBubbleProps) {
  const isUser = message.role === 'user';
  const scale = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        isUser ? styles.wrapperUser : styles.wrapperAI,
        { transform: [{ scale }], opacity },
      ]}
    >
      {/* AI avatar */}
      {!isUser ? (
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarEmoji}>✦</Text>
        </View>
      ) : null}

      <View style={[styles.bubbleArea, isUser && { alignItems: 'flex-end' }]}>
        {/* Message text bubble */}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          <Text style={[styles.text, isUser ? styles.textUser : styles.textAI]}>
            {message.text}
          </Text>
        </View>

        {/* Cards below bubble */}
        {message.cards && message.cards.length > 0 ? (
          <View style={styles.cardsContainer}>
            <AICardRow
              cards={message.cards}
              type={message.cards[0].type}
            />
          </View>
        ) : null}

        {/* Timestamp */}
        <Text style={[styles.timestamp, isUser && { textAlign: 'right' }]}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    marginBottom: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  wrapperUser: {
    justifyContent: 'flex-end',
  },
  wrapperAI: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },

  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: AI_COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 20,
    ...AI_SHADOW.orange,
  },
  aiAvatarEmoji: {
    fontSize: 14,
    color: '#FFFFFF',
  },

  bubbleArea: {
    maxWidth: '78%',
    gap: 6,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: AI_COLORS.userBubble,
    borderBottomRightRadius: 4,
    ...AI_SHADOW.subtle,
  },
  bubbleAI: {
    backgroundColor: AI_COLORS.aiBubble,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: AI_COLORS.border,
    ...AI_SHADOW.subtle,
  },
  text: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  textUser: {
    fontFamily: AI_FONTS.medium,
    color: AI_COLORS.userText,
  },
  textAI: {
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.aiText,
  },

  cardsContainer: {
    marginTop: 4,
  },

  timestamp: {
    fontSize: 10,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textTertiary,
  },
});
