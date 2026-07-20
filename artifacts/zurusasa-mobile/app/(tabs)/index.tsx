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
import { Feather } from '@expo/vector-icons';
import { ReelCard } from '@/components/ReelCard';
import { CenteredState } from '@/components/Skeleton';
import { useColors } from '@/hooks/useColors';
import { useReels } from '@/lib/queries';
import type { ReelRow } from '@/lib/supabase';

const TAB_BAR_HEIGHT = Platform.OS === 'web' ? 84 : 50;

export default function PulseScreen() {
  const colors = useColors();
  const { height } = useWindowDimensions();
  const { data: reels, isLoading, isError, refetch } = useReels();
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const pageHeight = height;

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
        tabBarHeight={TAB_BAR_HEIGHT}
      />
    ),
    [activeIndex, pageHeight],
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
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
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
