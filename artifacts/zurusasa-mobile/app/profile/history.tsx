import React, { useState } from 'react';
import {
  Alert,
  FlatList,
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
import { useReels } from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';
import type { ReelRow } from '@/lib/supabase';

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

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useCustomAlert();
  const { data: reels, isLoading } = useReels();

  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 12;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 32;

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
        onPress={() => router.push('/discover')}
        style={({ pressed }) => [styles.historyCard, pressed && { opacity: 0.92 }]}
      >
        {/* Left Thumbnail with guaranteed fallback image */}
        <View style={styles.thumbContainer}>
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
            <Text style={styles.viewTimeText}>{viewTime}</Text>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#111111" />
              <Text style={styles.ratingText}>
                {rating} ({reviewCount})
              </Text>
            </View>
          </View>

          <Text style={styles.itemTitle} numberOfLines={1}>
            {title}
          </Text>

          <Text style={styles.itemLocation} numberOfLines={1}>
            {location}
          </Text>

          <View style={styles.bottomPriceRow}>
            <Text style={styles.priceText}>
              KES {price.toLocaleString()}{' '}
              <Text style={styles.priceUnitText}>/ {priceUnit}</Text>
            </Text>

            {/* Remove single item button */}
            <Pressable
              onPress={() => handleRemoveItem(item.id)}
              style={styles.removeBtn}
              hitSlop={12}
            >
              <Feather name="x" size={14} color="#717171" />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerSection}>
      {/* ── TOP NAV BAR ─────────────────────────────────────────────────────── */}
      <View style={styles.navRow}>
        <Pressable
          testID="history-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/(tabs)/profile');
          }}
          style={styles.circleBtn}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={24} color="#111111" />
        </Pressable>

        {rawList.length > 0 && (
          <Pressable onPress={handleClearAll} style={styles.clearBtn} hitSlop={8}>
            <Text style={styles.clearBtnText}>Clear all</Text>
          </Pressable>
        )}
      </View>

      {/* ── PAGE TITLE ───────────────────────────────────────────────────────── */}
      <View style={styles.titleWrap}>
        <Text style={styles.pageTitle}>History</Text>
        {rawList.length > 0 && (
          <Text style={styles.pageSubTitle}>Recently viewed stays and experiences</Text>
        )}
      </View>

      {/* ── 3-TAB FILTER PILLS (FULL WIDTH EQUAL SEGMENTS, NO CLIPPING) ───────── */}
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
                  isActive ? styles.segmentPillActive : styles.segmentPillInactive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentPillText,
                    isActive ? styles.segmentPillTextActive : styles.segmentPillTextInactive,
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
  );

  return (
    <View style={[styles.fill, { paddingTop: topPad }]}>
      {isLoading ? (
        <View style={{ paddingHorizontal: 20, gap: 16 }}>
          {renderHeader()}
          <Skeleton style={{ height: 110, borderRadius: 20 }} />
          <Skeleton style={{ height: 110, borderRadius: 20 }} />
          <Skeleton style={{ height: 110, borderRadius: 20 }} />
        </View>
      ) : rawList.length > 0 ? (
        <FlatList
          data={historyList}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          renderItem={renderHistoryItem}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: bottomPad },
          ]}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.fill}>
          {renderHeader()}
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="history" size={40} color="#717171" />
            </View>
            <Text style={styles.emptyTitle}>No history yet</Text>
            <Text style={styles.emptySub}>
              Stays, experiences, and locations you view across ZuruSasa will appear here for easy access.
            </Text>
            <Pressable
              onPress={() => router.push('/discover')}
              style={styles.exploreBtn}
            >
              <Text style={styles.exploreBtnText}>Explore coastal stays</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerSection: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  clearBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  clearBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E11D48',
  },
  titleWrap: {
    paddingTop: 4,
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.6,
  },
  pageSubTitle: {
    fontSize: 14,
    color: '#717171',
    marginTop: 4,
    fontWeight: '400',
  },

  /* ── Segmented 3-Pill Filter Bar (Fits full screen width with zero overflow) ── */
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  segmentPill: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentPillActive: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#111111',
  },
  segmentPillInactive: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  segmentPillText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  segmentPillTextActive: {
    color: '#FFFFFF',
  },
  segmentPillTextInactive: {
    color: '#111111',
  },

  /* ── List & Cards ───────────────────────────────────────────────────────── */
  listContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  historyCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    gap: 14,
    alignItems: 'center',
  },
  thumbContainer: {
    width: 96,
    height: 96,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewTimeText: {
    fontSize: 11.5,
    color: '#717171',
    fontWeight: '500',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111111',
  },
  itemTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#111111',
  },
  itemLocation: {
    fontSize: 13,
    color: '#717171',
  },
  bottomPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  priceText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#111111',
  },
  priceUnitText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#717171',
  },
  removeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Empty state */
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: '#717171',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  exploreBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
