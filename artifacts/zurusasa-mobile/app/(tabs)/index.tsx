import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
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
import { useReels, useBatchReelInteractions } from '@/lib/queries';
import type { ReelRow } from '@/lib/supabase';

export default function HomeScreen() {
  const { viewMode } = useAuth();

  useEffect(() => {
    if (viewMode === 'host') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [viewMode]);

  if (viewMode === 'host') {
    return <HostDashboard />;
  }
  return <ZuruFlowFeed />;
}

function ZuruFlowFeed() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { height } = useWindowDimensions();
  const isFocused = useIsFocused();
  const { data: reels, isLoading, isError, refetch } = useReels();
  const [feedStream, setFeedStream] = useState<'around' | 'zuruflow'>('around');
  const [activeIndex, setActiveIndex] = useState<number>(0);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  const reelIds = React.useMemo(() => (reels ?? []).map((r) => r.id), [reels]);
  const { data: interactionsMap } = useBatchReelInteractions(
    reelIds,
    user?.id,
    isFocused
  );

  const pageHeight = height;
  const topInset = Platform.OS === 'web' ? 14 : insets.top;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first && typeof first.index === 'number') {
        setActiveIndex(first.index);
      }
    },
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ReelRow; index: number }) => (
      <ReelCard
        reel={item}
        isActive={isFocused && index === activeIndex}
        height={pageHeight}
        prefetchInteractions={interactionsMap?.[item.id]}
      />
    ),
    [activeIndex, pageHeight, isFocused, interactionsMap],
  );

  // 1. Top Navigation Bar with Gradient Scrim Protection
  const topOverlay = (
    <View pointerEvents="box-none" style={[styles.topBarWrap, { paddingTop: topInset + 4 }]}>
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        style={styles.topGradientScrim}
        pointerEvents="none"
      />

      <View style={styles.topBarContent}>
        {/* Top Switcher: Around You / ZuruFlow */}
        <View style={styles.tabsRow}>
          <Pressable
            testID="top-tab-around"
            onPress={() => setFeedStream('around')}
            hitSlop={10}
            style={({ pressed }) => [styles.tabItem, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
          >
            <Text style={feedStream === 'around' ? styles.tabActive : styles.tabInactive}>Around You</Text>
            {feedStream === 'around' && <View style={styles.tabIndicator} />}
          </Pressable>
          <Pressable
            testID="top-tab-zuruflow"
            onPress={() => setFeedStream('zuruflow')}
            hitSlop={10}
            style={({ pressed }) => [styles.tabItem, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
          >
            <Text style={feedStream === 'zuruflow' ? styles.tabActive : styles.tabInactive}>ZuruFlow</Text>
            {feedStream === 'zuruflow' && <View style={styles.tabIndicator} />}
          </Pressable>
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

  if (isLoading) {
    return <FeedLoadingState topOverlay={topOverlay} />;
  }

  if (isError) {
    return (
      <View style={[styles.fill, { backgroundColor: '#000000' }]}>
        <CenteredState>
          <Feather name="wifi-off" size={32} color="rgba(255,255,255,0.7)" />
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
    <View style={[styles.fill, { backgroundColor: '#000000' }]}>
      <FlatList
        testID="reels-feed"
        data={reels}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={pageHeight}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        getItemLayout={(_, index) => ({
          length: pageHeight,
          offset: pageHeight * index,
          index,
        })}
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={1}
      />
      {topOverlay}
    </View>
  );
}

function FeedLoadingState({ topOverlay }: { topOverlay: React.ReactNode }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <View style={[styles.fill, styles.loadingContainer]}>
      <Animated.View style={[styles.loadingContent, { transform: [{ scale: pulseAnim }] }]}>
        <Image
          source={require('@/assets/images/splash-icon.png')}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <PremiumLoader color="#EE7D30" size={8} style={styles.loadingLoader} />
      </Animated.View>
      {topOverlay}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
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
  loadingLogo: {
    width: 200,
    height: 200,
  },
  loadingLoader: {
    marginTop: 12,
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
    height: 100,
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
    gap: 24,
  },
  tabItem: {
    alignItems: 'center',
    position: 'relative',
  },
  tabActive: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tabIndicator: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#F26522',
    marginTop: 4,
  },
  tabInactive: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
});
