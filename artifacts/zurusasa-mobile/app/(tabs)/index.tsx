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
import { useRouter } from 'expo-router';
import { RAIL_WIDTH, ReelCard, ZURU_ORANGE } from '@/components/ReelCard';
import { CenteredState } from '@/components/Skeleton';
import { useColors } from '@/hooks/useColors';
import { useReels } from '@/lib/queries';
import type { ReelRow } from '@/lib/supabase';

const TAB_BAR_HEIGHT = Platform.OS === 'web' ? 84 : 50;

export default function ZuruFlowScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { data: reels, isLoading, isError, refetch } = useReels();
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const listRef = useRef<FlatList<ReelRow>>(null);

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

  const scrollToIndex = useCallback(
    (index: number) => {
      const total = reels?.length ?? 0;
      if (total === 0) return;
      const clamped = Math.max(0, Math.min(total - 1, index));
      listRef.current?.scrollToIndex({ index: clamped, animated: true });
    },
    [reels?.length],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ReelRow; index: number }) => (
      <ReelCard
        reel={item}
        isActive={index === activeIndex}
        height={pageHeight}
        tabBarHeight={TAB_BAR_HEIGHT}
        index={index}
        count={reels?.length ?? 0}
        onScrollToIndex={scrollToIndex}
      />
    ),
    [activeIndex, pageHeight, reels?.length, scrollToIndex],
  );

  const topTabs = (
    <View
      pointerEvents="box-none"
      style={[styles.topTabs, { top: topInset + 8, right: RAIL_WIDTH }]}
    >
      <View style={styles.tabsRow}>
        <View style={styles.tabItem}>
          <Text style={styles.tabActive}>ZuruFlow</Text>
          <View style={styles.tabDot} />
        </View>
        <Pressable
          testID="top-tab-discover"
          onPress={() => router.navigate('/discover')}
          hitSlop={10}
        >
          <Text style={styles.tabInactive}>Discover</Text>
        </Pressable>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.fill, { backgroundColor: '#000000' }]}>
        <CenteredState>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.stateText, { color: '#a3998f' }]}>
            Loading reels…
          </Text>
        </CenteredState>
        {topTabs}
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.fill, { backgroundColor: '#000000' }]}>
        <CenteredState>
          <Feather name="wifi-off" size={32} color="#a3998f" />
          <Text style={[styles.stateText, { color: '#a3998f' }]}>
            Couldn't load the feed
          </Text>
          <Pressable
            testID="retry-reels"
            onPress={() => refetch()}
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </CenteredState>
        {topTabs}
      </View>
    );
  }

  if (!reels || reels.length === 0) {
    return (
      <View style={[styles.fill, { backgroundColor: '#000000' }]}>
        <CenteredState>
          <Feather name="film" size={32} color="#a3998f" />
          <Text style={[styles.stateText, { color: '#a3998f' }]}>
            No reels yet — check back soon
          </Text>
        </CenteredState>
        {topTabs}
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: '#000000' }]}>
      <FlatList
        ref={listRef}
        testID="reels-feed"
        data={reels}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={pageHeight}
        decelerationRate="fast"
        scrollEnabled={reels.length > 0}
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
      {topTabs}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  topTabs: {
    position: 'absolute',
    left: 0,
    zIndex: 20,
    alignItems: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
  },
  tabItem: {
    alignItems: 'center',
  },
  tabActive: {
    color: ZURU_ORANGE,
    fontSize: 17,
    fontFamily: 'DMSans_700Bold',
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ZURU_ORANGE,
    marginTop: 3,
  },
  tabInactive: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 17,
    fontFamily: 'DMSans_500Medium',
  },
  stateText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
});
