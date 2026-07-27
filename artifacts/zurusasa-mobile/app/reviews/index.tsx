import React, { useState } from 'react';
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
import { useReviews } from '@/hooks/useReviews';
import { RatingBreakdown } from '@/components/reviews/RatingBreakdown';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { LeaveReviewModal } from '@/components/reviews/LeaveReviewModal';
import { Skeleton } from '@/components/Skeleton';

const SORT_OPTIONS = [
  { id: 'recent', label: 'Most Recent' },
  { id: 'highest', label: 'Highest Rating' },
  { id: 'lowest', label: 'Lowest Rating' },
  { id: 'helpful', label: 'Most Helpful' },
] as const;

export default function ReviewsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { listingId, bookingId, hostId, title } = useLocalSearchParams<{
    listingId?: string;
    bookingId?: string;
    hostId?: string;
    title?: string;
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

  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 24;

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={[styles.fill, { backgroundColor: '#FFFFFF' }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header Bar */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color="#222222" />
        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
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
      {bookingId && hostId ? (
        <LeaveReviewModal
          visible={leaveModalOpen}
          bookingId={bookingId}
          hostId={hostId}
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
    gap: 20,
    paddingVertical: 12,
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
