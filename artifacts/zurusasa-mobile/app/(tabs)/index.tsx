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
import { ReelCard, ZURU_ORANGE } from '@/components/ReelCard';
import { CenteredState } from '@/components/Skeleton';
import { useColors } from '@/hooks/useColors';
import { useReels } from '@/lib/queries';
import type { ReelRow } from '@/lib/supabase';

export default function ZuruFlowScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { data: reels, isLoading, isError, refetch } = useReels();
  const [activeIndex, setActiveIndex] = useState<number>(0);

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
        isActive={index === activeIndex}
        height={pageHeight}
      />
    ),
    [activeIndex, pageHeight],
  );

  const topOverlay = (
    <View pointerEvents="box-none" style={[styles.topBar, { top: topInset + 6 }]}>
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
      <Pressable
        testID="top-search"
        onPress={() => router.navigate('/discover')}
        hitSlop={8}
        style={({ pressed }) => [
          styles.searchButton,
          { opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <Feather name="search" size={19} color="rgba(255,255,255,0.92)" />
      </Pressable>
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
        {topOverlay}
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
        {topOverlay}
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
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 44,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 26,
  },
  tabItem: {
    alignItems: 'center',
  },
  tabActive: {
    color: ZURU_ORANGE,
    fontSize: 16,
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
    color: 'rgba(255,255,255,0.75)',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  searchButton: {
    position: 'absolute',
    right: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(58,53,48,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
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
