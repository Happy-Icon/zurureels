import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { AI_COLORS, AI_FONTS, AI_SHADOW } from './tokens';

interface AIInputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onVoice?: () => void;
  onImageSelected?: (uri: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function AIInputBar({
  value,
  onChangeText,
  onSend,
  onVoice,
  onImageSelected,
  placeholder = 'Ask me anything about your trip...',
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
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [focused, borderColor]);

  const borderAnim = borderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['#EBEBEB', AI_COLORS.orange],
  });

  const handleSend = () => {
    if (!canSend || disabled) return;
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.88, duration: 60, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, tension: 180, friction: 6, useNativeDriver: true }),
    ]).start();
    onSend();
  };

  const handleAttachImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Photo Permission Needed',
          'Please allow access to your photos so Zuru Agent can see your travel inspiration.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        onImageSelected?.(uri);
        Alert.alert(
          'Inspiration Photo Attached',
          'Zuru Agent has received your photo. What would you like to find matching this style?'
        );
      }
    } catch {
      Alert.alert('Notice', 'Unable to open photo library at this time.');
    }
  };

  const handleVoice = () => {
    if (onVoice) {
      onVoice();
    } else {
      Alert.alert(
        'Voice Assistant',
        'Voice dictation is active via your keyboard microphone icon for seamless input.'
      );
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <Animated.View style={[styles.inputRow, { borderColor: borderAnim }]}>
        {/* Attachment action button */}
        <Pressable
          onPress={handleAttachImage}
          hitSlop={8}
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel="Attach photo for travel inspiration"
        >
          <Feather name="paperclip" size={19} color={AI_COLORS.textTertiary} />
        </Pressable>

        {/* Expanding multiline text input */}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={600}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={!disabled}
          returnKeyType={Platform.OS === 'ios' ? 'default' : 'send'}
          onSubmitEditing={Platform.OS === 'ios' ? undefined : handleSend}
        />

        {/* Right actions: Voice / Circular Orange Send */}
        <View style={styles.rightActions}>
          {!canSend ? (
            <Pressable
              onPress={handleVoice}
              hitSlop={8}
              style={styles.actionBtn}
              accessibilityRole="button"
              accessibilityLabel="Dictate message with voice"
            >
              <Feather name="mic" size={19} color={AI_COLORS.textTertiary} />
            </Pressable>
          ) : (
            <Animated.View style={{ transform: [{ scale: sendScale }] }}>
              <Pressable
                onPress={handleSend}
                disabled={!canSend || disabled}
                style={styles.circularSendBtn}
                accessibilityRole="button"
                accessibilityLabel="Send message"
              >
                <Feather name="arrow-up" size={18} color="#FFFFFF" />
              </Pressable>
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F8F9FA',
    borderRadius: 24,
    borderWidth: 1.5,
    paddingHorizontal: 6,
    paddingVertical: 5,
    minHeight: 48,
  },
  actionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    marginBottom: 1,
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textPrimary,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    maxHeight: 110,
    lineHeight: 20,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 2,
    marginBottom: 1,
  },
  circularSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AI_COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    ...AI_SHADOW.orange,
  },
});
