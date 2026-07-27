import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

interface HostActionBarProps {
  onMessage: () => void;
  onShare: () => void;
}

export function HostActionBar({ onMessage, onShare }: HostActionBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom > 0 ? insets.bottom + 8 : 16;

  return (
    <View style={[styles.container, { paddingBottom: bottomPad }]}>
      <Pressable
        onPress={onShare}
        style={({ pressed }) => [
          styles.shareBtn,
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Feather name="share-2" size={18} color="#222222" />
      </Pressable>

      <Pressable
        onPress={onMessage}
        style={({ pressed }) => [
          styles.messageBtn,
          { opacity: pressed ? 0.88 : 1 },
        ]}
      >
        <Feather name="message-square" size={18} color="#FFFFFF" />
        <Text style={styles.messageBtnText}>Message Host</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  shareBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F26522',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F26522',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  messageBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
