import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AI_COLORS, AI_FONTS, AI_RADIUS, AI_SHADOW } from './tokens';

interface AIInputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onVoice?: () => void;
  onImage?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export function AIInputBar({
  value,
  onChangeText,
  onSend,
  onVoice,
  onImage,
  placeholder = 'Ask Zuru AI anything…',
  disabled = false,
}: AIInputBarProps) {
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(false);
  const borderColor = useRef(new Animated.Value(0)).current;
  const sendScale = useRef(new Animated.Value(1)).current;

  const canSend = value.trim().length > 0;

  useEffect(() => {
    Animated.timing(borderColor, {
      toValue: focused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [focused]);

  const borderAnim = borderColor.interpolate({
    inputRange: [0, 1],
    outputRange: [AI_COLORS.border, AI_COLORS.orange],
  });

  const handleSend = () => {
    if (!canSend) return;
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, tension: 160, friction: 6, useNativeDriver: true }),
    ]).start();
    onSend();
  };

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <Animated.View style={[styles.inputRow, { borderColor: borderAnim }]}>
        {/* Left icons */}
        <View style={styles.leftIcons}>
          <Pressable onPress={onImage} hitSlop={8} style={styles.iconBtn}>
            <Feather name="image" size={18} color={focused ? AI_COLORS.orange : AI_COLORS.textTertiary} />
          </Pressable>
        </View>

        {/* Text input */}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={AI_COLORS.textTertiary}
          multiline
          maxLength={500}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={!disabled}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />

        {/* Right icons */}
        <View style={styles.rightIcons}>
          {!canSend ? (
            <Pressable onPress={onVoice} hitSlop={8} style={styles.iconBtn}>
              <Feather
                name="mic"
                size={18}
                color={focused ? AI_COLORS.orange : AI_COLORS.textTertiary}
              />
            </Pressable>
          ) : null}
          <Animated.View style={{ transform: [{ scale: sendScale }] }}>
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            >
              <Feather name="arrow-up" size={16} color="#FFFFFF" />
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>

      {/* Footer note */}
      <Text style={styles.footer}>
        Zuru AI · Powered by ZuruSasa Intelligence
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: AI_COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F7F7F7',
    borderRadius: AI_RADIUS.xl,
    borderWidth: 1.5,
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 2,
    minHeight: 48,
  },
  leftIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingBottom: 6,
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 2,
    paddingBottom: 2,
    gap: 2,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textPrimary,
    paddingHorizontal: 8,
    paddingVertical: 8,
    maxHeight: 100,
    lineHeight: 21,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AI_COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    ...AI_SHADOW.orange,
  },
  sendBtnDisabled: {
    backgroundColor: AI_COLORS.textTertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  footer: {
    fontSize: 10.5,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textTertiary,
    textAlign: 'center',
  },
});
