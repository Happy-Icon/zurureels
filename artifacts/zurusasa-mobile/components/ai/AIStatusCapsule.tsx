import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AI_COLORS, AI_FONTS, AI_RADIUS, AI_SHADOW } from './tokens';
import { TextShimmerWave } from './TextShimmerWave';

interface AIStatusCapsuleProps {
  stage: 'understanding' | 'searching' | 'preparing' | 'idle' | 'done' | 'error';
  text?: string;
  onStop?: () => void;
}

export function AIStatusCapsule({ stage, text, onStop }: AIStatusCapsuleProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [pulseAnim]);

  // Map stage to friendly descriptive status text
  const stageLabel =
    text ||
    (stage === 'understanding'
      ? 'Understanding request…'
      : stage === 'searching'
      ? 'Searching real listings…'
      : stage === 'preparing'
      ? 'Preparing recommendations…'
      : 'Thinking…');

  return (
    <View style={styles.wrapper}>
      <View style={styles.capsule}>
        <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
        <TextShimmerWave
          duration={1.2}
          baseColor="#666666"
          shimmerColor={AI_COLORS.orange}
          style={styles.stageText}
        >
          {stageLabel}
        </TextShimmerWave>

        {onStop ? (
          <Pressable
            onPress={onStop}
            style={styles.stopButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Stop generating"
          >
            <Feather name="square" size={10} color="#EF4444" />
            <Text style={styles.stopText}>Stop</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 8,
    ...AI_SHADOW.subtle,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: AI_COLORS.orange,
  },
  stageText: {
    fontFamily: AI_FONTS.medium,
    fontSize: 13,
    letterSpacing: -0.1,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 4,
    gap: 4,
  },
  stopText: {
    fontFamily: AI_FONTS.medium,
    fontSize: 11,
    color: '#DC2626',
  },
});
