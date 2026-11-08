import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AI_COLORS, AI_FONTS, AI_RADIUS, AI_SHADOW, type AIMessage, type AICard } from './tokens';
import { AICardRow } from './AICards';

interface AIMessageBubbleProps {
  message: AIMessage;
  isLatest?: boolean;
  onSave?: (id: string, card: AICard) => void;
  onOpen?: (id: string, card: AICard) => void;
  onBook?: (id: string, card: AICard) => void;
}

export function AIMessageBubble({
  message,
  isLatest,
  onSave,
  onOpen,
  onBook,
}: AIMessageBubbleProps) {
  const isUser = message.role === 'user';
  const scale = useRef(new Animated.Value(0.95)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 100,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale]);

  const timestampStr = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <Animated.View style={[styles.container, { transform: [{ scale }], opacity }]}>
      <View style={[styles.row, isUser ? styles.rowUser : styles.rowAI]}>
        {/* Assistant Orange Identity Avatar */}
        {!isUser ? (
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="compass-outline" size={15} color="#FFFFFF" />
          </View>
        ) : null}

        {/* Message Bubble Container */}
        <View style={[styles.bubbleWrapper, isUser && styles.bubbleWrapperUser]}>
          <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
            <Text style={[styles.text, isUser ? styles.textUser : styles.textAI]}>
              {message.text}
            </Text>
          </View>

          {/* Timestamp */}
          {timestampStr ? (
            <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampAI]}>
              {timestampStr}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Horizontally Scrollable Recommendation Cards (Spans full screen width) */}
      {!isUser && message.cards && message.cards.length > 0 ? (
        <View style={styles.cardsSection}>
          <AICardRow
            cards={message.cards}
            onSave={onSave}
            onOpen={onOpen}
            onBook={onBook}
          />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAI: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: AI_COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...AI_SHADOW.subtle,
  },
  bubbleWrapper: {
    maxWidth: '82%',
    gap: 3,
  },
  bubbleWrapperUser: {
    alignItems: 'flex-end',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: '#1E1E1E',
    borderBottomRightRadius: 4,
    ...AI_SHADOW.subtle,
  },
  bubbleAI: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    ...AI_SHADOW.subtle,
  },
  text: {
    fontSize: 14.5,
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  textUser: {
    fontFamily: AI_FONTS.regular,
    color: '#FFFFFF',
  },
  textAI: {
    fontFamily: AI_FONTS.regular,
    color: '#1A1A1A',
  },
  timestamp: {
    fontSize: 10.5,
    fontFamily: AI_FONTS.regular,
    color: '#9CA3AF',
    marginTop: 1,
  },
  timestampUser: {
    textAlign: 'right',
    paddingRight: 4,
  },
  timestampAI: {
    textAlign: 'left',
    paddingLeft: 4,
  },
  cardsSection: {
    marginTop: 8,
  },
});
