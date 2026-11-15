import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useIsFetching } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { queryClient } from '@/lib/queryClient';

const MIN_REVEAL_MS = 680;
const MAX_HYBRID_WAIT_MS = 1100;
const EXIT_DURATION_MS = 320;
const ZURU_ORANGE = '#F26522';

interface AnimatedBootSplashProps {
  onAnimationComplete?: () => void;
}

export function AnimatedBootSplash({ onAnimationComplete }: AnimatedBootSplashProps) {
  const { isReady: themeReady } = useTheme();
  const { isBootReady, viewMode } = useAuth();
  const activeReelsFetches = useIsFetching({ queryKey: ['reels'] });

  const [minElapsed, setMinElapsed] = useState(false);
  const [maxElapsed, setMaxElapsed] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const hasHiddenNativeRef = useRef(false);
  const hasTriggeredExitRef = useRef(false);

  // Native-driven animation values for silky 60fps Bolt/Airbnb-style reveal
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const contentScale = useRef(new Animated.Value(0.96)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.82)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkTranslateY = useRef(new Animated.Value(12)).current;

  // Enforce minimum polished reveal duration & hard 1.1s ceiling for slow networks
  useEffect(() => {
    const minTimer = setTimeout(() => setMinElapsed(true), MIN_REVEAL_MS);
    const maxTimer = setTimeout(() => setMaxElapsed(true), MAX_HYBRID_WAIT_MS);
    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, []);

  // Run entry choreography once on mount
  useEffect(() => {
    Animated.parallel([
      Animated.spring(contentScale, {
        toValue: 1.02,
        friction: 7,
        tension: 65,
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(glowScale, {
        toValue: 1.08,
        duration: 620,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(140),
        Animated.parallel([
          Animated.timing(wordmarkOpacity, {
            toValue: 1,
            duration: 340,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(wordmarkTranslateY, {
            toValue: 0,
            duration: 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [contentScale, glowOpacity, glowScale, wordmarkOpacity, wordmarkTranslateY]);

  const handleLayoutHandoff = useCallback(() => {
    if (hasHiddenNativeRef.current) return;
    hasHiddenNativeRef.current = true;
    // Handoff on first drawn React frame so native splash dissolves seamlessly
    requestAnimationFrame(() => {
      SplashScreen.hideAsync().catch(() => {});
    });
  }, []);

  const hasSeenFetchRef = useRef(false);
  if (activeReelsFetches > 0) {
    hasSeenFetchRef.current = true;
  }

  const hasWarmReelsData = queryClient
    .getQueriesData({ queryKey: ['reels'] })
    .some(([, data]) => Boolean(data));

  const hasSettledReels =
    viewMode === 'host' ||
    hasWarmReelsData ||
    (hasSeenFetchRef.current && activeReelsFetches === 0);

  const shouldExit =
    minElapsed &&
    themeReady &&
    isBootReady &&
    (hasSettledReels || maxElapsed);

  useEffect(() => {
    if (!shouldExit || hasTriggeredExitRef.current) return;
    hasTriggeredExitRef.current = true;
    setIsExiting(true);

    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: EXIT_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentScale, {
        toValue: 1.13,
        duration: EXIT_DURATION_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: 0,
        duration: EXIT_DURATION_MS - 60,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsDone(true);
      onAnimationComplete?.();
    });
  }, [shouldExit, overlayOpacity, contentScale, glowOpacity, onAnimationComplete]);

  if (isDone) {
    return null;
  }

  return (
    <Animated.View
      onLayout={handleLayoutHandoff}
      pointerEvents={isExiting ? 'none' : 'auto'}
      style={[
        styles.overlay,
        { opacity: overlayOpacity },
      ]}
    >
      {/* Ambient Zuru Orange Halo centered behind the emblem */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glowOuter,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glowInner,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      {/* Pixel-aligned dead-center Z emblem matching OS splash geometry */}
      <Animated.View
        style={[
          styles.centerStage,
          { transform: [{ scale: contentScale }] },
        ]}
      >
        <Image
          source={require('@/assets/images/splash-icon.png')}
          style={styles.emblemImage}
          contentFit="contain"
          priority="high"
          cachePolicy="memory"
        />

        {/* Anchored below center so the 'Z' mark itself never shifts upward on handoff */}
        <Animated.View
          style={[
            styles.wordmarkBlock,
            {
              opacity: wordmarkOpacity,
              transform: [{ translateY: wordmarkTranslateY }],
            },
          ]}
        >
          <View style={styles.brandRow}>
            <Text style={styles.brandText}>ZuruSasa</Text>
            <View style={styles.brandDot} />
          </View>
          <Text style={styles.tagline}>CURATED STAYS & EXPERIENCES</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    elevation: 999,
  },
  glowOuter: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(242, 101, 34, 0.08)',
  },
  glowInner: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(242, 101, 34, 0.14)',
  },
  centerStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemImage: {
    width: 168,
    height: 168,
  },
  wordmarkBlock: {
    position: 'absolute',
    top: '100%',
    marginTop: -6,
    alignItems: 'center',
    width: 280,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brandText: {
    color: '#FFFFFF',
    fontSize: 27,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.6,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ZURU_ORANGE,
    marginLeft: 3,
    marginBottom: 2,
  },
  tagline: {
    marginTop: 5,
    color: 'rgba(255, 255, 255, 0.48)',
    fontSize: 10,
    fontFamily: 'DMSans_600SemiBold',
    letterSpacing: 2.1,
  },
});
