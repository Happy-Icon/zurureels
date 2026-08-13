import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { HostDashboard } from '@/components/host/HostDashboard';
import { ReelCard } from '@/components/ReelCard';
import { useIsFocused } from '@react-navigation/native';
import { CenteredState, Skeleton } from '@/components/Skeleton';
import { useReels, useBatchReelInteractions } from '@/lib/queries';
import type { ReelRow } from '@/lib/supabase';

export default function ZuruFlowScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, viewMode } = useAuth();
  const { height } = useWindowDimensions();
  const isFocused = useIsFocused();
  const { data: reels, isLoading, isError, refetch } = useReels();
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const reelIds = React.useMemo(() => (reels ?? []).map((r) => r.id), [reels]);
  const { data: interactionsMap } = useBatchReelInteractions(
    reelIds,
    user?.id,
    isFocused && viewMode === 'guest'
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
        isActive={isFocused && viewMode === 'guest' && index === activeIndex}
        height={pageHeight}
        prefetchInteractions={interactionsMap?.[item.id]}
      />
    ),
    [activeIndex, pageHeight, isFocused, viewMode, interactionsMap],
  );

  if (viewMode === 'host') {
    return <HostDashboard />;
  }

  // 1. Top Navigation Bar with Gradient Scrim Protection
  const topOverlay = (
    <View pointerEvents="box-none" style={[styles.topBarWrap, { paddingTop: topInset + 4 }]}>
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        style={styles.topGradientScrim}
        pointerEvents="none"
      />

      <View style={styles.topBarContent}>
        {/* Top Switcher: ZuruFlow / Discover */}
        <View style={styles.tabsRow}>
          <Pressable style={styles.tabItem}>
            <Text style={styles.tabActive}>ZuruFlow</Text>
            <View style={styles.tabIndicator} />
          </Pressable>
          <Pressable
            testID="top-tab-discover"
            onPress={() => {
              router.navigate('/discover');
            }}
            hitSlop={10}
            style={styles.tabItem}
          >
            <Text style={styles.tabInactive}>Discover</Text>
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
    return (
      <View style={[styles.fill, { backgroundColor: '#000000', paddingTop: topInset + 60, paddingHorizontal: 20 }]}>
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 100, gap: 14 }}>
          <Skeleton style={{ height: 28, width: 220, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)' }} />
          <Skeleton style={{ height: 18, width: 140, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.12)' }} />
          <Skeleton style={{ height: 22, width: 160, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.15)' }} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Skeleton style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)' }} />
            <Skeleton style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)' }} />
          </View>
        </View>
        {topOverlay}
      </View>
    );
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

const styles = StyleSheet.create({
  fill: {
    flex: 1,
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
  },
  tabIndicator: {
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#EE7D30',
    marginTop: 3,
  },
  tabInactive: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
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
