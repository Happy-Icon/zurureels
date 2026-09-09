import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useIsFocused } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { HostDashboard } from '@/components/host/HostDashboard';
import { ReelCard } from '@/components/ReelCard';
import { CenteredState } from '@/components/Skeleton';
import { PremiumLoader } from '@/components/PremiumLoader';
import { OfflineState } from '@/components/OfflineState';
import { useNetworkStatus } from '@/lib/networkManager';
import { useReels, useRefreshReels, useBatchReelInteractions } from '@/lib/queries';
import type { ReelRow } from '@/lib/supabase';
import { useObserve } from '@/lib/observe';

export default function HomeScreen() {
  const { viewMode } = useAuth();
  const { markInteractive } = useObserve();

  useEffect(() => {
    if (viewMode === 'host') {
      SplashScreen.hideAsync().catch(() => {});
      markInteractive();
    }
  }, [viewMode, markInteractive]);

  if (viewMode === 'host') {
    return <HostDashboard />;
  }
  return <ZuruFlowFeed />;
}

function ZuruFlowFeed() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const isFocused = useIsFocused();
  const { isOnline } = useNetworkStatus();
  const { data: reels, isLoading, isError, refetch } = useReels();
  const refreshReels = useRefreshReels();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // TikTok-Style Floating Premium Refresh Indicator Animation
  const pillAnimY = useRef(new Animated.Value(-80)).current;
  const pillOpacity = useRef(new Animated.Value(0)).current;

  const flatListZuruRef = useRef<FlatList<ReelRow>>(null);
  const flatListAroundRef = useRef<FlatList<ReelRow>>(null);

  // Active Stream: 'zuruflow' (left, 0) <--> 'around' (right, -width)
  const [feedStream, setFeedStream] = useState<'zuruflow' | 'around'>('zuruflow');
  const [activeIndexZuru, setActiveIndexZuru] = useState<number>(0);
  const [activeIndexAround, setActiveIndexAround] = useState<number>(0);
  const { markInteractive } = useObserve();

  // Tab Center Positions for Sliding Indicator
  const [tabX, setTabX] = useState({ zuruflow: 24, around: 124 });

  // Animated Horizontal Position (0 = ZuruFlow, -width = Around You) & Pull-to-Refresh Y
  const animX = useRef(new Animated.Value(0)).current;
  const pullY = useRef(new Animated.Value(0)).current;
  const currentStreamRef = useRef<'zuruflow' | 'around'>('zuruflow');
  currentStreamRef.current = feedStream;

  const isRefreshingRef = useRef<boolean>(false);
  isRefreshingRef.current = isRefreshing;

  const scrollOffsetZuruRef = useRef<number>(0);
  const scrollOffsetAroundRef = useRef<number>(0);
  const gestureMode = useRef<'none' | 'horizontal' | 'pulldown'>('none');

  // Curate streams: ZuruFlow has all trending reels; Around You highlights coastal/localized stays & activities
  const zuruReels = useMemo(() => reels ?? [], [reels]);
  const aroundReels = useMemo(() => {
    if (!reels || reels.length === 0) return [];
    const localized = reels.filter((r) => Boolean(r.experience?.location));
    const withoutLocation = reels.filter((r) => !r.experience?.location);
    return [...localized.slice().reverse(), ...withoutLocation];
  }, [reels]);

  // Clean, Wordless Premium Refresh: Shows ONLY the bouncing wave dots, rotates feed, scrolls to top
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    // Smooth spring entrance for the floating premium refresh badge
    pillAnimY.setValue(-80);
    pillOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(pillAnimY, {
        toValue: 0,
        friction: 8,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(pillOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      const activeReelId =
        currentStreamRef.current === 'zuruflow'
          ? (zuruReels[activeIndexZuru]?.id ?? zuruReels[0]?.id)
          : (aroundReels[activeIndexAround]?.id ?? aroundReels[0]?.id);

      await refreshReels(activeReelId);

      // Smooth scroll back to top so the new active reel is immediately displayed and played
      if (currentStreamRef.current === 'zuruflow') {
        flatListZuruRef.current?.scrollToOffset({ offset: 0, animated: false });
        scrollOffsetZuruRef.current = 0;
        setActiveIndexZuru(0);
      } else {
        flatListAroundRef.current?.scrollToOffset({ offset: 0, animated: false });
        scrollOffsetAroundRef.current = 0;
        setActiveIndexAround(0);
      }
    } catch (err) {
      console.warn('Error refreshing reels:', err);
    } finally {
      // Brief pause so the smooth wave animation completes nicely before sliding up
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(pillAnimY, {
            toValue: -80,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.timing(pillOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsRefreshing(false);
        });
      }, 400);
    }
  }, [isRefreshing, refreshReels, pillAnimY, pillOpacity, activeIndexZuru, activeIndexAround, zuruReels, aroundReels]);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
      markInteractive();
    }
  }, [isLoading, markInteractive]);

  const reelIds = useMemo(() => (reels ?? []).map((r) => r.id), [reels]);
  const { data: interactionsMap } = useBatchReelInteractions(
    reelIds,
    user?.id,
    isFocused
  );

  const pageHeight = height;
  const topInset = Platform.OS === 'web' ? 14 : insets.top;

  // Smooth programmatic switch between ZuruFlow and Around You (tapping active tab triggers refresh)
  const switchStream = useCallback(
    (stream: 'zuruflow' | 'around') => {
      // Tap active tab to refresh & scroll to top (TikTok-style)
      if (stream === currentStreamRef.current) {
        handleRefresh();
        return;
      }
      const toValue = stream === 'zuruflow' ? 0 : -width;
      Animated.spring(animX, {
        toValue,
        friction: 12,
        tension: 100,
        useNativeDriver: true,
      }).start();
      setFeedStream(stream);
    },
    [width, animX, handleRefresh]
  );

  // Silky Smooth PanResponder for horizontal swipe navigation & vertical pull-to-refresh
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isHorizontal =
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.4;

        const currentOffset =
          currentStreamRef.current === 'zuruflow'
            ? scrollOffsetZuruRef.current
            : scrollOffsetAroundRef.current;
        const isAtTop =
          (currentStreamRef.current === 'zuruflow'
            ? activeIndexZuru === 0
            : activeIndexAround === 0) && currentOffset <= 8;

        const isPullDown =
          isAtTop &&
          gestureState.dy > 12 &&
          gestureState.dy > Math.abs(gestureState.dx) * 1.4 &&
          !isRefreshingRef.current;

        if (isHorizontal) {
          gestureMode.current = 'horizontal';
          return true;
        }
        if (isPullDown) {
          gestureMode.current = 'pulldown';
          return true;
        }
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        const isHorizontal =
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.4;

        const currentOffset =
          currentStreamRef.current === 'zuruflow'
            ? scrollOffsetZuruRef.current
            : scrollOffsetAroundRef.current;
        const isAtTop =
          (currentStreamRef.current === 'zuruflow'
            ? activeIndexZuru === 0
            : activeIndexAround === 0) && currentOffset <= 8;

        const isPullDown =
          isAtTop &&
          gestureState.dy > 12 &&
          gestureState.dy > Math.abs(gestureState.dx) * 1.4 &&
          !isRefreshingRef.current;

        if (isHorizontal) {
          gestureMode.current = 'horizontal';
          return true;
        }
        if (isPullDown) {
          gestureMode.current = 'pulldown';
          return true;
        }
        return false;
      },
      onPanResponderGrant: () => {
        animX.stopAnimation();
        pullY.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureMode.current === 'horizontal') {
          const base = currentStreamRef.current === 'zuruflow' ? 0 : -width;
          let nextVal = base + gestureState.dx;
          // Natural rubber-band resistance at outer boundaries
          if (nextVal > 0) {
            nextVal = gestureState.dx * 0.25;
          } else if (nextVal < -width) {
            nextVal = -width + gestureState.dx * 0.25;
          }
          animX.setValue(nextVal);
        } else if (gestureMode.current === 'pulldown') {
          const clampedY = Math.max(0, Math.min(gestureState.dy * 0.4, 75));
          pullY.setValue(clampedY);
          if (!isRefreshingRef.current) {
            pillOpacity.setValue(Math.min(gestureState.dy / 40, 1));
            pillAnimY.setValue(Math.min(0, -35 + gestureState.dy * 0.45));
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureMode.current === 'horizontal') {
          const isZuru = currentStreamRef.current === 'zuruflow';
          // Swipe Left from ZuruFlow -> go to Around You
          if (isZuru && (gestureState.dx < -32 || gestureState.vx < -0.22)) {
            switchStream('around');
          }
          // Swipe Right from Around You -> go to ZuruFlow
          else if (!isZuru && (gestureState.dx > 32 || gestureState.vx > 0.22)) {
            switchStream('zuruflow');
          }
          // Snap back to current stream
          else {
            switchStream(currentStreamRef.current);
          }
        } else if (gestureMode.current === 'pulldown') {
          Animated.spring(pullY, {
            toValue: 0,
            friction: 9,
            tension: 90,
            useNativeDriver: true,
          }).start();

          if (gestureState.dy > 38 || gestureState.vy > 0.25) {
            handleRefresh();
          } else {
            Animated.parallel([
              Animated.timing(pillAnimY, {
                toValue: -80,
                duration: 180,
                useNativeDriver: true,
              }),
              Animated.timing(pillOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
              }),
            ]).start();
          }
        }
        gestureMode.current = 'none';
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        if (gestureMode.current === 'horizontal') {
          switchStream(currentStreamRef.current);
        } else if (gestureMode.current === 'pulldown') {
          Animated.spring(pullY, {
            toValue: 0,
            friction: 9,
            tension: 90,
            useNativeDriver: true,
          }).start();
        }
        gestureMode.current = 'none';
      },
    })
  ).current;

  // Viewable item trackers for both vertical streams
  const onViewableItemsChangedZuru = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first && typeof first.index === 'number') {
        setActiveIndexZuru(first.index);
      }
    }
  );

  const onViewableItemsChangedAround = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first && typeof first.index === 'number') {
        setActiveIndexAround(first.index);
      }
    }
  );

  const renderItemZuru = useCallback(
    ({ item, index }: { item: ReelRow; index: number }) => (
      <ReelCard
        reel={item}
        isActive={isFocused && feedStream === 'zuruflow' && index === activeIndexZuru}
        height={pageHeight}
        prefetchInteractions={interactionsMap?.[item.id]}
      />
    ),
    [activeIndexZuru, pageHeight, isFocused, interactionsMap, feedStream]
  );

  const renderItemAround = useCallback(
    ({ item, index }: { item: ReelRow; index: number }) => (
      <ReelCard
        reel={item}
        isActive={isFocused && feedStream === 'around' && index === activeIndexAround}
        height={pageHeight}
        prefetchInteractions={interactionsMap?.[item.id]}
      />
    ),
    [activeIndexAround, pageHeight, isFocused, interactionsMap, feedStream]
  );

  // Tab Indicator translation smoothly tracks animX
  const indicatorTranslateX = animX.interpolate({
    inputRange: [-width, 0],
    outputRange: [tabX.around, tabX.zuruflow],
    extrapolate: 'clamp',
  });

  // Top Navigation Bar with Gradient Scrim Protection and Smooth Sliding Tabs
  const topOverlay = (
    <View pointerEvents="box-none" style={[styles.topBarWrap, { paddingTop: topInset + 4 }]}>
      <LinearGradient
        colors={['rgba(0,0,0,0.65)', 'transparent']}
        style={styles.topGradientScrim}
        pointerEvents="none"
      />

      <View style={styles.topBarContent}>
        {/* Top Switcher: ZuruFlow / Around You */}
        <View style={styles.tabsRow}>
          <Pressable
            testID="top-tab-zuruflow"
            onPress={() => switchStream('zuruflow')}
            hitSlop={12}
            onLayout={(e) => {
              const { x, width: w } = e.nativeEvent.layout;
              setTabX((prev) => ({ ...prev, zuruflow: x + (w - 28) / 2 }));
            }}
            style={({ pressed }) => [
              styles.tabItem,
              { transform: [{ scale: pressed ? 0.95 : 1 }] },
            ]}
          >
            <Text style={feedStream === 'zuruflow' ? styles.tabActive : styles.tabInactive}>
              ZuruFlow
            </Text>
          </Pressable>

          <Pressable
            testID="top-tab-around"
            onPress={() => switchStream('around')}
            hitSlop={12}
            onLayout={(e) => {
              const { x, width: w } = e.nativeEvent.layout;
              setTabX((prev) => ({ ...prev, around: x + (w - 28) / 2 }));
            }}
            style={({ pressed }) => [
              styles.tabItem,
              { transform: [{ scale: pressed ? 0.95 : 1 }] },
            ]}
          >
            <Text style={feedStream === 'around' ? styles.tabActive : styles.tabInactive}>
              Around You
            </Text>
          </Pressable>

          {/* Smooth Native-Animated Indicator */}
          <Animated.View
            style={[
              styles.slidingTabIndicator,
              {
                transform: [{ translateX: indicatorTranslateX }],
              },
            ]}
          />
        </View>

        {/* Right Frosted-Glass Search Button */}
        <Pressable
          testID="top-search"
          onPress={() => {
            router.navigate('/discover');
          }}
          hitSlop={8}
          style={({ pressed }) => [
            styles.frostedSearchBtn,
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Feather name="search" size={17} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );

  // 1. Offline State (No cached data & offline, or request failed while offline)
  if ((!isOnline && (!reels || reels.length === 0)) || (isError && !isOnline)) {
    return (
      <View style={[styles.fill, { backgroundColor: '#000000' }]}>
        <OfflineState
          onRetry={refetch}
          message="Check your internet connection. We'll automatically reload your feed as soon as you're back online."
        />
        {topOverlay}
      </View>
    );
  }

  // 2. Loading State (Online & fetching initial data)
  if (isLoading) {
    return <FeedLoadingState topOverlay={topOverlay} />;
  }

  // 3. Server Error State (Online, but request returned error)
  if (isError) {
    return (
      <View style={[styles.fill, { backgroundColor: '#000000' }]}>
        <CenteredState>
          <Feather name="alert-circle" size={32} color="rgba(255,255,255,0.7)" />
          <Text style={styles.stateText}>Couldn't load the feed</Text>
          <Pressable
            testID="retry-reels"
            onPress={() => refetch()}
            style={({ pressed }) => [
              styles.retryButton,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </CenteredState>
        {topOverlay}
      </View>
    );
  }

  if (!reels || reels.length === 0) {
    return (
      <View style={[styles.fill, { backgroundColor: '#000000' }]}>
        <CenteredState>
          <Feather name="film" size={32} color="rgba(255,255,255,0.7)" />
          <Text style={styles.stateText}>No reels yet — check back soon</Text>
        </CenteredState>
        {topOverlay}
      </View>
    );
  }

  return (
    <View
      style={[styles.fill, { backgroundColor: '#000000' }]}
      {...panResponder.panHandlers}
    >
      {/* 2-Stream Horizontal Animated Pager with Elastic Pull-to-Refresh */}
      <Animated.View
        style={[
          styles.horizontalContainer,
          {
            width: width * 2,
            transform: [{ translateX: animX }, { translateY: pullY }],
          },
        ]}
      >
        {/* Stream 0: ZuruFlow Vertical Reel Feed */}
        <View style={{ width, height: pageHeight }}>
          <FlatList
            ref={flatListZuruRef}
            testID="reels-feed-zuruflow"
            data={zuruReels}
            keyExtractor={(item) => `zuru-${item.id}`}
            renderItem={renderItemZuru}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={pageHeight}
            decelerationRate="fast"
            onViewableItemsChanged={onViewableItemsChangedZuru.current}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            getItemLayout={(_, index) => ({
              length: pageHeight,
              offset: pageHeight * index,
              index,
            })}
            windowSize={3}
            maxToRenderPerBatch={2}
            initialNumToRender={1}
            scrollEventThrottle={16}
            onScroll={(e) => {
              scrollOffsetZuruRef.current = e.nativeEvent.contentOffset.y;
            }}
            onScrollEndDrag={(e) => {
              if (e.nativeEvent.contentOffset.y < -35 && activeIndexZuru === 0) {
                handleRefresh();
              }
            }}
          />
        </View>

        {/* Stream 1: Around You Vertical Reel Feed */}
        <View style={{ width, height: pageHeight }}>
          <FlatList
            ref={flatListAroundRef}
            testID="reels-feed-around"
            data={aroundReels}
            keyExtractor={(item) => `around-${item.id}`}
            renderItem={renderItemAround}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={pageHeight}
            decelerationRate="fast"
            onViewableItemsChanged={onViewableItemsChangedAround.current}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            getItemLayout={(_, index) => ({
              length: pageHeight,
              offset: pageHeight * index,
              index,
            })}
            windowSize={3}
            maxToRenderPerBatch={2}
            initialNumToRender={1}
            scrollEventThrottle={16}
            onScroll={(e) => {
              scrollOffsetAroundRef.current = e.nativeEvent.contentOffset.y;
            }}
            onScrollEndDrag={(e) => {
              if (e.nativeEvent.contentOffset.y < -35 && activeIndexAround === 0) {
                handleRefresh();
              }
            }}
          />
        </View>
      </Animated.View>

      {/* Floating Top Navigation Overlay */}
      {topOverlay}

      {/* Floating Premium Refresh Indicator - PremiumLoader ONLY, zero words */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.refreshPillWrap,
          {
            top: topInset + 48,
            opacity: pillOpacity,
            transform: [{ translateY: pillAnimY }],
          },
        ]}
      >
        <View style={styles.refreshPill}>
          <PremiumLoader color="#EE7D30" size={8} />
        </View>
      </Animated.View>
    </View>
  );
}

function FeedLoadingState({ topOverlay }: { topOverlay: React.ReactNode }) {
  return (
    <View style={[styles.fill, styles.loadingContainer]}>
      <View style={styles.loadingContent}>
        <PremiumLoader color="#EE7D30" size={9} />
      </View>
      {topOverlay}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  horizontalContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  loadingContainer: {
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 30,
  },
  topGradientScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 110,
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    height: 44,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    gap: 24,
    paddingBottom: 6,
  },
  tabItem: {
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  tabActive: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tabInactive: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  slidingTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#F26522',
  },
  frostedSearchBtn: {
    position: 'absolute',
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: 12,
    backgroundColor: '#EE7D30',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  refreshPillWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  refreshPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
});
