import React, { useState, useEffect } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useReviews } from '@/hooks/useReviews';
import { RatingBreakdown } from '@/components/reviews/RatingBreakdown';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { LeaveReviewModal } from '@/components/reviews/LeaveReviewModal';
import { Skeleton } from '@/components/Skeleton';
import { supabase } from '@/lib/supabase';

const SORT_OPTIONS = [
  { id: 'recent', label: 'Most Recent' },
  { id: 'highest', label: 'Highest Rating' },
  { id: 'lowest', label: 'Lowest Rating' },
  { id: 'helpful', label: 'Most Helpful' },
] as const;

export default function ReviewsScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { listingId, bookingId, hostId, title, openWrite } = useLocalSearchParams<{
    listingId?: string;
    bookingId?: string;
    hostId?: string;
    title?: string;
    openWrite?: string;
  }>();

  const activeListingId = listingId || 'exp-default';
  const {
    reviews,
    summary,
    isLoading,
    sortBy,
    setSortBy,
    toggleHelpful,
    refresh,
  } = useReviews(activeListingId);

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const [resolvedHostId, setResolvedHostId] = useState<string | null>(
    hostId && UUID_REGEX.test(hostId) ? hostId : null
  );

  useEffect(() => {
    if (hostId && UUID_REGEX.test(hostId)) {
      setResolvedHostId(hostId);
      return;
    }
    if (activeListingId && activeListingId !== 'exp-default') {
      supabase
        .from('experiences')
        .select('user_id')
        .eq('id', activeListingId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.user_id && UUID_REGEX.test(data.user_id)) {
            setResolvedHostId(data.user_id);
          }
        });
    }
  }, [hostId, activeListingId]);

  const [leaveModalOpen, setLeaveModalOpen] = useState(Boolean(bookingId && openWrite !== 'false'));
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 24;

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header Bar */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border, paddingTop: topPad }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Reviews & Ratings
        </Text>

        {bookingId ? (
          <Pressable
            onPress={() => setLeaveModalOpen(true)}
            style={({ pressed }) => [styles.writeBtn, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name="edit-3" size={14} color="#F26522" />
            <Text style={styles.writeBtnText}>Write</Text>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <ReviewCard review={item} onHelpful={toggleHelpful} />
          </View>
        )}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: bottomPad,
          gap: 12,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F26522" />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeaderStack}>
            {/* 1. Rating Summary & Category Averages */}
            <RatingBreakdown summary={summary} />

            {/* Authenticity & Anti-Fake Review Safeguard Banner */}
            <View style={[styles.trustBanner, { backgroundColor: isDark ? '#18181B' : '#F9FAFB', borderColor: colors.border }]}>
              <View style={styles.trustBannerIcon}>
                <Feather name="shield" size={16} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.trustBannerTitle, { color: colors.text }]}>
                  Verified Guest Reviews Only
                </Text>
                <Text style={[styles.trustBannerBody, { color: colors.mutedForeground }]}>
                  Every review on ZuruSasa is written by travelers who completed their booking. We strictly prohibit fake reviews, incentives, and unverified claims.
                </Text>
              </View>
            </View>

            {/* 2. Sort Dropdown / Filter Chips */}
            <View style={styles.sortSection}>
              <Text style={styles.sortSectionTitle}>All Guest Reviews</Text>
              <View style={styles.sortPillRow}>
                {SORT_OPTIONS.map((opt) => {
                  const isActive = sortBy === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => setSortBy(opt.id as any)}
                      style={[
                        styles.sortChip,
                        isActive ? styles.sortChipActive : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.sortChipText,
                          isActive ? styles.sortChipTextActive : null,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 14, paddingTop: 16 }}>
              <Skeleton style={{ height: 120, borderRadius: 16 }} />
              <Skeleton style={{ height: 120, borderRadius: 16 }} />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Feather name="message-square" size={32} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No reviews yet</Text>
              <Text style={styles.emptySub}>Be the first guest to share your experience!</Text>
            </View>
          )
        }
      />

      {/* Leave Review Modal */}
      {bookingId ? (
        <LeaveReviewModal
          visible={leaveModalOpen}
          bookingId={bookingId}
          hostId={resolvedHostId || ''}
          listingId={activeListingId}
          listingTitle={title || 'Stay'}
          onClose={() => setLeaveModalOpen(false)}
          onSuccess={() => {
            setLeaveModalOpen(false);
            refresh();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    marginBottom: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  writeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBF8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCE3D6',
  },
  writeBtnText: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  listHeaderStack: {
    gap: 16,
    paddingVertical: 12,
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  trustBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DEF7EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  trustBannerTitle: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    marginBottom: 2,
  },
  trustBannerBody: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'DMSans_400Regular',
  },
  sortSection: {
    gap: 10,
    marginTop: 8,
  },
  sortSectionTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  sortPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  sortChipActive: {
    backgroundColor: '#F26522',
    borderColor: '#F26522',
  },
  sortChipText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  sortChipTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  cardWrap: {
    marginBottom: 10,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
});
