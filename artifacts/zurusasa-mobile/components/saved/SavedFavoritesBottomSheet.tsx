import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useToggleSave } from '@/lib/queries';
import { supabase, type EventRow, type ReelRow } from '@/lib/supabase';
import { Skeleton } from '@/components/Skeleton';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = Math.min(SCREEN_HEIGHT * 0.88, 760);

type SavedFilter = 'all' | 'stays' | 'events';

type FavoriteEntry =
  | { key: string; kind: 'reel'; data: ReelRow }
  | { key: string; kind: 'event'; data: EventRow };

const FALLBACK_THUMBNAILS = [
  require('@/assets/images/hero_diani.jpg'),
  require('@/assets/images/hero_watamu.jpg'),
  require('@/assets/images/hero_lamu.jpg'),
  require('@/assets/images/hero_kilifi.jpg'),
  require('@/assets/images/hero_zanzibar.jpg'),
];

function formatEventDate(rawDate?: string | null): string {
  if (!rawDate) return 'Upcoming Event';
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return 'Upcoming Event';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getSafeImageSource(uri: string | null | undefined, index: number) {
  if (typeof uri === 'string' && uri.trim().length > 10 && uri.startsWith('http')) {
    return { uri };
  }
  return FALLBACK_THUMBNAILS[index % FALLBACK_THUMBNAILS.length];
}

export interface SavedFavoritesBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  reels: ReelRow[] | undefined;
  events: EventRow[] | undefined;
  isLoading?: boolean;
  userId?: string;
  onRefresh?: () => void;
}

export function SavedFavoritesBottomSheet({
  visible,
  onClose,
  reels,
  events,
  isLoading = false,
  userId,
  onRefresh,
}: SavedFavoritesBottomSheetProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toggleSave = useToggleSave();

  const [filter, setFilter] = useState<SavedFilter>('all');
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(new Set());
  const [isRendered, setIsRendered] = useState(visible);
  const [isListScrollable, setIsListScrollable] = useState(false);

  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isClosing = useRef(false);
  const scrollOffsetRef = useRef(0);
  const bodyDraggingRef = useRef(false);
  const flatListRef = useRef<FlatList<FavoriteEntry>>(null);
  const listLayoutHeightRef = useRef(0);
  const listContentHeightRef = useRef(0);

  const updateScrollableState = useCallback(() => {
    const canScroll = listContentHeightRef.current > listLayoutHeightRef.current + 4;
    setIsListScrollable((prev) => (prev === canScroll ? prev : canScroll));
  }, []);

  const openSheet = useCallback(() => {
    isClosing.current = false;
    scrollOffsetRef.current = 0;
    bodyDraggingRef.current = false;
    translateY.setValue(SHEET_HEIGHT);
    backdropOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 24,
        mass: 0.9,
        stiffness: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, backdropOpacity]);

  const closeSheet = useCallback(() => {
    if (isClosing.current) return;
    isClosing.current = true;

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsRendered(false);
      onClose();
      isClosing.current = false;
    });
  }, [translateY, backdropOpacity, onClose]);

  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      requestAnimationFrame(() => {
        openSheet();
      });
    } else if (isRendered && !isClosing.current) {
      closeSheet();
    }
  }, [visible, openSheet, closeSheet, isRendered]);

  const snapBack = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 24,
        mass: 0.8,
        stiffness: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, backdropOpacity]);

  const handleDragGrant = useCallback(() => {
    translateY.stopAnimation();
    backdropOpacity.stopAnimation();
  }, [translateY, backdropOpacity]);

  const handleDragMove = useCallback(
    (dy: number) => {
      if (dy > 0) {
        translateY.setValue(dy);
        const progress = Math.max(0, 1 - dy / (SHEET_HEIGHT * 0.65));
        backdropOpacity.setValue(progress);
      } else {
        translateY.setValue(dy * 0.15);
      }
    },
    [translateY, backdropOpacity],
  );

  const handleDragRelease = useCallback(
    (dy: number, vy: number) => {
      if (dy > 75 || (dy > 18 && vy > 0.35)) {
        closeSheet();
      } else if (!isClosing.current) {
        snapBack();
      }
    },
    [closeSheet, snapBack],
  );

  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: handleDragGrant,
        onPanResponderMove: (_, g) => handleDragMove(g.dy),
        onPanResponderRelease: (_, g) => handleDragRelease(g.dy, g.vy),
        onPanResponderTerminate: () => {
          if (!isClosing.current) snapBack();
        },
      }),
    [handleDragGrant, handleDragMove, handleDragRelease, snapBack],
  );

  const headerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > 3 && Math.abs(g.dy) >= Math.abs(g.dx),
        onMoveShouldSetPanResponderCapture: (_, g) =>
          Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: handleDragGrant,
        onPanResponderMove: (_, g) => handleDragMove(g.dy),
        onPanResponderRelease: (_, g) => handleDragRelease(g.dy, g.vy),
        onPanResponderTerminate: () => {
          if (!isClosing.current) snapBack();
        },
      }),
    [handleDragGrant, handleDragMove, handleDragRelease, snapBack],
  );

  const bodyPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => scrollOffsetRef.current <= 2,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, g) => {
          const shouldGrab =
            scrollOffsetRef.current <= 2 && g.dy > 3 && g.dy > Math.abs(g.dx);
          if (shouldGrab) {
            flatListRef.current?.setNativeProps({ scrollEnabled: false });
          }
          return shouldGrab;
        },
        onMoveShouldSetPanResponderCapture: (_, g) => {
          const shouldGrab =
            scrollOffsetRef.current <= 2 && g.dy > 3 && g.dy > Math.abs(g.dx);
          if (shouldGrab) {
            flatListRef.current?.setNativeProps({ scrollEnabled: false });
          }
          return shouldGrab;
        },
        onPanResponderTerminationRequest: () => !bodyDraggingRef.current,
        onPanResponderGrant: () => {
          bodyDraggingRef.current = false;
          handleDragGrant();
        },
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) {
            if (!bodyDraggingRef.current && g.dy > 3 && g.dy > Math.abs(g.dx)) {
              flatListRef.current?.setNativeProps({ scrollEnabled: false });
            }
            bodyDraggingRef.current = true;
            handleDragMove(g.dy);
          } else if (bodyDraggingRef.current) {
            handleDragMove(g.dy);
          }
        },
        onPanResponderRelease: (_, g) => {
          const wasDragging = bodyDraggingRef.current;
          bodyDraggingRef.current = false;
          flatListRef.current?.setNativeProps({
            scrollEnabled: listContentHeightRef.current > listLayoutHeightRef.current + 4,
          });
          if (wasDragging) {
            handleDragRelease(g.dy, g.vy);
          }
        },
        onPanResponderTerminate: () => {
          bodyDraggingRef.current = false;
          flatListRef.current?.setNativeProps({
            scrollEnabled: listContentHeightRef.current > listLayoutHeightRef.current + 4,
          });
          if (!isClosing.current) snapBack();
        },
      }),
    [handleDragGrant, handleDragMove, handleDragRelease, snapBack],
  );

  const visibleReels = useMemo(
    () => (reels ?? []).filter((reel) => !removedKeys.has(`reel:${reel.id}`)),
    [reels, removedKeys],
  );

  const visibleEvents = useMemo(
    () => (events ?? []).filter((ev) => !removedKeys.has(`event:${ev.id}`)),
    [events, removedKeys],
  );

  const totalCount = visibleReels.length + visibleEvents.length;

  const filteredItems: FavoriteEntry[] = useMemo(() => {
    const reelEntries: FavoriteEntry[] = visibleReels.map((r) => ({
      key: `reel:${r.id}`,
      kind: 'reel',
      data: r,
    }));
    const eventEntries: FavoriteEntry[] = visibleEvents.map((e) => ({
      key: `event:${e.id}`,
      kind: 'event',
      data: e,
    }));

    if (filter === 'stays') return reelEntries;
    if (filter === 'events') return eventEntries;
    return [...reelEntries, ...eventEntries];
  }, [filter, visibleReels, visibleEvents]);

  const handleUnsaveReel = useCallback(
    (reelId: string) => {
      const key = `reel:${reelId}`;
      setRemovedKeys((prev) => new Set(prev).add(key));
      if (!userId) return;
      toggleSave.mutate(
        { reelId, userId, saved: true },
        {
          onSuccess: () => {
            onRefresh?.();
          },
          onError: () => {
            setRemovedKeys((prev) => {
              const next = new Set(prev);
              next.delete(key);
              return next;
            });
          },
        },
      );
    },
    [userId, toggleSave, onRefresh],
  );

  const handleUnsaveEvent = useCallback(
    async (eventId: string) => {
      const key = `event:${eventId}`;
      setRemovedKeys((prev) => new Set(prev).add(key));
      if (!userId) return;
      try {
        const { error } = await supabase
          .from('event_subscribers')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', userId);
        if (error) throw new Error(error.message);
        await queryClient.invalidateQueries({ queryKey: ['saved-events'] });
        onRefresh?.();
      } catch {
        setRemovedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [userId, queryClient, onRefresh],
  );

  const handleNavigateDiscover = useCallback(() => {
    closeSheet();
    router.push('/discover');
  }, [closeSheet, router]);

  const renderFavoriteCard = ({ item, index }: { item: FavoriteEntry; index: number }) => {
    if (item.kind === 'reel') {
      const reel = item.data;
      const title = reel.experience?.title || reel.experience?.entity_name || 'Coastal Stay';
      const location = reel.experience?.location || reel.experience?.city || 'Kenya Coast';
      const currentPrice = Number(reel.experience?.current_price ?? 0);
      const priceUnit = reel.experience?.price_unit || 'night';
      const imageSource = getSafeImageSource(reel.thumbnail_url || reel.experience?.image_url, index);

      return (
        <Pressable
          onPress={handleNavigateDiscover}
          style={({ pressed }) => [
            styles.favoriteCard,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && { opacity: 0.92 },
          ]}
        >
          <View style={[styles.thumbContainer, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
            <Image source={imageSource} style={styles.thumbImage} contentFit="cover" transition={150} />
          </View>

          <View style={styles.detailsContainer}>
            <View style={styles.topMetaRow}>
              <View style={[styles.typeBadge, { backgroundColor: isDark ? '#3B2314' : '#FFF4ED' }]}>
                <Ionicons name="sparkles-outline" size={11} color="#F26522" />
                <Text style={[styles.typeBadgeText, { color: '#F26522' }]}>Stay / Experience</Text>
              </View>

              <Pressable
                onPress={() => handleUnsaveReel(reel.id)}
                style={[styles.heartBtn, { backgroundColor: isDark ? '#27272A' : '#FFF4ED' }]}
                hitSlop={10}
              >
                <Ionicons name="heart" size={16} color="#F26522" />
              </Pressable>
            </View>

            <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>

            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
              <Text style={[styles.itemLocation, { color: colors.mutedForeground }]} numberOfLines={1}>
                {location}
              </Text>
            </View>

            <View style={styles.bottomFooterRow}>
              {currentPrice > 0 ? (
                <Text style={[styles.priceText, { color: colors.text }]}>
                  KES {currentPrice.toLocaleString()}{' '}
                  <Text style={[styles.priceUnitText, { color: colors.mutedForeground }]}>/ {priceUnit}</Text>
                </Text>
              ) : (
                <Text style={[styles.priceUnitText, { color: colors.mutedForeground }]}>
                  Saved reel
                </Text>
              )}
              <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
            </View>
          </View>
        </Pressable>
      );
    }

    const ev = item.data;
    const title = ev.title || 'Coastal Event';
    const location = ev.location || ev.experience?.location || 'Kenya Coast';
    const eventPrice = Number(ev.price ?? 0);
    const imageSource = getSafeImageSource(ev.image_url || ev.experience?.image_url, index);

    return (
      <Pressable
        onPress={handleNavigateDiscover}
        style={({ pressed }) => [
          styles.favoriteCard,
          { backgroundColor: colors.card, borderColor: colors.border },
          pressed && { opacity: 0.92 },
        ]}
      >
        <View style={[styles.thumbContainer, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
          <Image source={imageSource} style={styles.thumbImage} contentFit="cover" transition={150} />
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.topMetaRow}>
            <View style={[styles.typeBadge, { backgroundColor: isDark ? '#1E293B' : '#EFF6FF' }]}>
              <Ionicons name="calendar-outline" size={11} color="#2563EB" />
              <Text style={[styles.typeBadgeText, { color: '#2563EB' }]}>Event</Text>
            </View>

            <Pressable
              onPress={() => handleUnsaveEvent(ev.id)}
              style={[styles.heartBtn, { backgroundColor: isDark ? '#27272A' : '#FFF4ED' }]}
              hitSlop={10}
            >
              <Ionicons name="heart" size={16} color="#F26522" />
            </Pressable>
          </View>

          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>

          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
            <Text style={[styles.itemLocation, { color: colors.mutedForeground }]} numberOfLines={1}>
              {location}
            </Text>
          </View>

          <View style={styles.bottomFooterRow}>
            <Text style={styles.eventDateText} numberOfLines={1}>
              {formatEventDate(ev.event_date)}
              {eventPrice > 0 ? ` · KES ${eventPrice.toLocaleString()}` : ''}
            </Text>
            <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
          </View>
        </View>
      </Pressable>
    );
  };

  if (!isRendered && !visible) {
    return null;
  }

  return (
    <Modal
      visible={isRendered || visible}
      transparent
      animationType="none"
      onRequestClose={closeSheet}
    >
      <View style={styles.modalRoot}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.55],
              }),
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.background,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.headerSection}>
            <View {...handlePanResponder.panHandlers} collapsable={false} style={styles.handleArea}>
              <View style={[styles.dragHandle, { backgroundColor: isDark ? '#3F3F46' : '#D1D5DB' }]} />
            </View>

            <View {...headerPanResponder.panHandlers} collapsable={false}>
              <View style={styles.topRow}>
                <View style={styles.titleBlock}>
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>Saved favorites</Text>
                  <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>
                    {totalCount > 0
                      ? `${totalCount} saved ${totalCount === 1 ? 'place' : 'places'} & events`
                      : 'Your curated coastal wishlist'}
                  </Text>
                </View>
              </View>

              {totalCount > 0 && (
                <View style={styles.segmentRow}>
                  {(
                    [
                      { id: 'all', label: `All (${totalCount})` },
                      { id: 'stays', label: `Stays (${visibleReels.length})` },
                      { id: 'events', label: `Events (${visibleEvents.length})` },
                    ] as const
                  ).map((chip) => {
                    const isActive = filter === chip.id;
                    return (
                      <Pressable
                        key={chip.id}
                        onPress={() => setFilter(chip.id)}
                        style={[
                          styles.segmentPill,
                          {
                            backgroundColor: isActive
                              ? colors.text
                              : isDark
                              ? '#27272A'
                              : '#F7F7F7',
                            borderColor: isActive ? colors.text : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentPillText,
                            {
                              color: isActive ? colors.background : colors.mutedForeground,
                              fontFamily: isActive ? 'DMSans_700Bold' : 'DMSans_500Medium',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {chip.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          <View style={styles.listWrapper} {...bodyPanResponder.panHandlers} collapsable={false}>
            <FlatList
              ref={flatListRef}
              data={filteredItems}
              keyExtractor={(item) => item.key}
              renderItem={renderFavoriteCard}
              bounces={false}
              overScrollMode="never"
              scrollEnabled={isListScrollable && !isLoading}
              scrollEventThrottle={16}
              onLayout={(e) => {
                listLayoutHeightRef.current = e.nativeEvent.layout.height;
                updateScrollableState();
              }}
              onContentSizeChange={(_, h) => {
                listContentHeightRef.current = h;
                updateScrollableState();
              }}
              onScroll={(e) => {
                scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
              }}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: Math.max(insets.bottom, 24) + 24 },
              ]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                isLoading ? (
                  <View style={styles.loadingWrapper}>
                    <Skeleton style={{ height: 110, borderRadius: 16, marginBottom: 14 }} />
                    <Skeleton style={{ height: 110, borderRadius: 16, marginBottom: 14 }} />
                    <Skeleton style={{ height: 110, borderRadius: 16 }} />
                  </View>
                ) : (
                  <View style={styles.emptyContainer}>
                    <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? '#27272A' : '#FFF4ED' }]}>
                      <Ionicons name="heart-outline" size={34} color="#F26522" />
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                      {totalCount > 0 ? 'Nothing in this category' : 'No saved favorites yet'}
                    </Text>
                    <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                      {totalCount > 0
                        ? 'Switch tabs above or explore more coastal stays, experiences, and events.'
                        : 'Tap the heart icon on any stay, experience, or event to save it to your wishlist.'}
                    </Text>
                    <Pressable
                      onPress={handleNavigateDiscover}
                      style={[styles.exploreBtn, { backgroundColor: '#F26522' }]}
                    >
                      <Text style={styles.exploreBtnText}>Explore coastal stays</Text>
                    </Pressable>
                  </View>
                )
              }
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  sheetContainer: {
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 14,
    width: '100%',
  },
  dragHandle: {
    width: 48,
    height: 5,
    borderRadius: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  titleBlock: {
    flex: 1,
    paddingRight: 10,
  },
  sheetTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.4,
  },
  sheetSubtitle: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    marginTop: 2,
  },
  listWrapper: {
    flex: 1,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  segmentPill: {
    flex: 1,
    height: 38,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentPillText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 14,
  },
  favoriteCard: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 10,
    gap: 12,
  },
  thumbContainer: {
    width: 106,
    height: 106,
    borderRadius: 14,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
  },
  heartBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemLocation: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  bottomFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  priceText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  priceUnitText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  eventDateText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#F26522',
  },
  loadingWrapper: {
    paddingTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  exploreBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
