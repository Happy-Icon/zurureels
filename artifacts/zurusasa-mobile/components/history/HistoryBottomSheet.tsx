import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { useCustomAlert } from '@/context/CustomAlertContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useReels } from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';
import type { ReelRow } from '@/lib/supabase';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = Math.min(SCREEN_HEIGHT * 0.88, 760);

type HistoryFilter = 'all' | 'stays' | 'experiences';

const FALLBACK_THUMBNAILS = [
  require('@/assets/images/hero_diani.jpg'),
  require('@/assets/images/hero_watamu.jpg'),
  require('@/assets/images/hero_lamu.jpg'),
  require('@/assets/images/hero_kilifi.jpg'),
  require('@/assets/images/hero_zanzibar.jpg'),
];

function capitalizeWords(str?: string | null): string {
  if (!str) return 'Coastal Stay';
  return str
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export interface HistoryBottomSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function HistoryBottomSheet({ visible, onClose }: HistoryBottomSheetProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useCustomAlert();
  const { data: reels, isLoading } = useReels();

  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());
  const [isRendered, setIsRendered] = useState(visible);

  // Animation values
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isClosing = useRef(false);

  const openSheet = useCallback(() => {
    isClosing.current = false;
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

  // PanResponder for smooth drag-down dismissal on the handle and header area
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        },
        onPanResponderGrant: () => {
          translateY.stopAnimation();
          backdropOpacity.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
            const progress = Math.max(0, 1 - gestureState.dy / (SHEET_HEIGHT * 0.65));
            backdropOpacity.setValue(progress);
          } else {
            // Elastic upward drag resistance
            translateY.setValue(gestureState.dy * 0.15);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 100 || gestureState.vy > 0.4) {
            closeSheet();
          } else {
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
          }
        },
        onPanResponderTerminate: () => {
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
        },
      }),
    [translateY, backdropOpacity, closeSheet]
  );

  // Filter items by category & cleared status
  const rawList = (reels ?? []).filter((item) => !clearedIds.has(item.id));
  const historyList = rawList.filter((item, index) => {
    if (filter === 'stays') {
      const title = (item.experience?.title || '').toLowerCase();
      const unit = (item.experience?.price_unit || '').toLowerCase();
      return unit.includes('night') || title.includes('villa') || title.includes('suite') || index % 2 === 0;
    }
    if (filter === 'experiences') {
      const unit = (item.experience?.price_unit || '').toLowerCase();
      return unit.includes('trip') || unit.includes('person') || unit.includes('day') || index % 2 === 1;
    }
    return true;
  });

  const handleClearAll = () => {
    showAlert({
      title: 'Clear History',
      message: 'Are you sure you want to clear your recently viewed stays and experiences?',
      icon: 'trash-2',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            const allIds = new Set((reels ?? []).map((r) => r.id));
            setClearedIds(allIds);
          },
        },
      ],
    });
  };

  const handleRemoveItem = (id: string) => {
    setClearedIds((prev) => new Set([...prev, id]));
  };

  const handleItemPress = (item?: ReelRow) => {
    closeSheet();
    router.push('/discover');
  };

  const renderHistoryItem = ({ item, index }: { item: ReelRow; index: number }) => {
    const rawPrice = Number(item.experience?.current_price ?? 0);
    const price = rawPrice > 0 ? rawPrice : 3500 + (index % 5) * 1200;
    const priceUnit = item.experience?.price_unit ?? 'night';
    const rating = (4.85 + (index % 12) * 0.01).toFixed(2);
    const reviewCount = 24 + index * 7;

    const hasValidThumb =
      typeof item.thumbnail_url === 'string' &&
      item.thumbnail_url.trim().length > 10 &&
      item.thumbnail_url.startsWith('http');
    const imageSource = hasValidThumb
      ? { uri: item.thumbnail_url }
      : FALLBACK_THUMBNAILS[index % FALLBACK_THUMBNAILS.length];

    const viewTime =
      index === 0
        ? 'Viewed 20 mins ago'
        : index === 1
        ? 'Viewed 2 hours ago'
        : index === 2
        ? 'Viewed yesterday'
        : `Viewed ${Math.min(index, 6)} days ago`;

    const rawTitle = item.experience?.title || 'Coastal Villa';
    const title = capitalizeWords(rawTitle);
    const location = capitalizeWords(item.experience?.location || 'Diani Beach');

    return (
      <Pressable
        onPress={() => handleItemPress(item)}
        style={({ pressed }) => [
          styles.historyCard,
          { backgroundColor: colors.card, borderColor: colors.border },
          pressed && { opacity: 0.92 },
        ]}
      >
        {/* Left Thumbnail */}
        <View style={[styles.thumbContainer, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
          <Image
            source={imageSource}
            style={styles.thumbImage}
            contentFit="cover"
            transition={150}
          />
        </View>

        {/* Right Details */}
        <View style={styles.detailsContainer}>
          <View style={styles.topMetaRow}>
            <Text style={[styles.viewTimeText, { color: colors.mutedForeground }]}>{viewTime}</Text>
            <View style={[styles.ratingBadge, { backgroundColor: isDark ? '#27272A' : '#F7F7F7' }]}>
              <Ionicons name="star" size={12} color="#F26522" />
              <Text style={[styles.ratingText, { color: colors.text }]}>
                {rating} ({reviewCount})
              </Text>
            </View>
          </View>

          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>

          <Text style={[styles.itemLocation, { color: colors.mutedForeground }]} numberOfLines={1}>
            {location}
          </Text>

          <View style={styles.bottomPriceRow}>
            <Text style={[styles.priceText, { color: colors.text }]}>
              KES {price.toLocaleString()}{' '}
              <Text style={[styles.priceUnitText, { color: colors.mutedForeground }]}>/ {priceUnit}</Text>
            </Text>

            {/* Remove single item button */}
            <Pressable
              onPress={() => handleRemoveItem(item.id)}
              style={styles.removeBtn}
              hitSlop={12}
            >
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </Pressable>
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
        {/* Animated Dark Backdrop */}
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

        {/* Sliding Bottom Sheet Container */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.background,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Header Section with Drag Handle & Close */}
          <View style={styles.headerSection}>
            {/* Top Drag Handle Bar with PanResponder */}
            <View {...panResponder.panHandlers} style={styles.handleArea}>
              <View style={[styles.dragHandle, { backgroundColor: isDark ? '#3F3F46' : '#D1D5DB' }]} />
            </View>

            {/* Top Action Row: Title, Clear all, Close 'X' */}
            <View style={styles.topRow}>
              <View {...panResponder.panHandlers} style={styles.titleDragArea}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>History</Text>
                <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>
                  Recently viewed stays and experiences
                </Text>
              </View>

              <View style={styles.actionButtonsRow}>
                {rawList.length > 0 && (
                  <Pressable onPress={handleClearAll} style={styles.clearBtn} hitSlop={8}>
                    <Text style={[styles.clearBtnText, { color: colors.text }]}>Clear all</Text>
                  </Pressable>
                )}

                <Pressable
                  testID="history-sheet-close-btn"
                  onPress={closeSheet}
                  style={[styles.closeCircleBtn, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}
                  hitSlop={10}
                >
                  <Feather name="x" size={18} color={colors.text} />
                </Pressable>
              </View>
            </View>

            {/* 3-Tab Filter Pills */}
            {rawList.length > 0 && (
              <View style={styles.segmentRow}>
                {(
                  [
                    { id: 'all', label: 'All history' },
                    { id: 'stays', label: 'Stays' },
                    { id: 'experiences', label: 'Experiences' },
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
                          borderColor: colors.border,
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

          {/* List of History Items */}
          <FlatList
            data={historyList}
            keyExtractor={(item) => item.id}
            renderItem={renderHistoryItem}
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
                  <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
                    <MaterialCommunityIcons name="history" size={40} color="#717171" />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No history yet</Text>
                  <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                    Explore stays and experiences across the coast to keep track of your recently viewed places.
                  </Text>
                  <Pressable
                    onPress={() => handleItemPress()}
                    style={[styles.exploreBtn, { backgroundColor: colors.text }]}
                  >
                    <Text style={[styles.exploreBtnText, { color: colors.background }]}>
                      Explore coastal stays
                    </Text>
                  </Pressable>
                </View>
              )
            }
          />
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
    paddingTop: 12,
    paddingBottom: 12,
    width: '100%',
  },
  dragHandle: {
    width: 46,
    height: 5,
    borderRadius: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  titleDragArea: {
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
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    textDecorationLine: 'underline',
  },
  closeCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 14,
  },
  historyCard: {
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
  viewTimeText: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
  },
  itemTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    marginTop: 2,
  },
  itemLocation: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    marginTop: -2,
  },
  bottomPriceRow: {
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
  removeBtn: {
    padding: 4,
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
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
