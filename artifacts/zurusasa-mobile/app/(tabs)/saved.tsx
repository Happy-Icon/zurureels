import React, { useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useSavedEvents, useSavedReels, useToggleSave } from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';
import type { EventRow, ReelRow } from '@/lib/supabase';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatEventDate(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const year =
    d.getFullYear() === new Date().getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year}`;
}

type FilterTab = 'all' | 'reels' | 'events';

export default function WishlistsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  const { data: reels, isLoading: reelsLoading } = useSavedReels(user?.id);
  const { data: events, isLoading: eventsLoading } = useSavedEvents(user?.id);
  const toggleSave = useToggleSave();

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 110 : insets.bottom + 90;

  const handleUnsave = (reelId: string) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    queryClient.setQueryData<ReelRow[]>(['saved-reels', user.id], (old) =>
      (old ?? []).filter((r) => r.id !== reelId),
    );
    toggleSave.mutate({ reelId, userId: user.id, saved: true });
  };

  const totalSavedCount = (reels?.length ?? 0) + (events?.length ?? 0);
  const isLoading = reelsLoading || eventsLoading;

  // Unauthenticated signed-out state
  if (!loading && !user) {
    return (
      <View style={[styles.fill, { backgroundColor: '#FFFFFF', paddingTop: topPad }]}>
        <View style={styles.topNavBar}>
          <Pressable
            testID="saved-back-btn"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/profile');
            }}
            style={({ pressed }) => [styles.backIconBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={10}
          >
            <Feather name="arrow-left" size={22} color="#222222" />
          </Pressable>
        </View>

        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="heart-outline" size={32} color="#222222" />
          </View>

          <Text style={styles.emptyHeadline}>Log in to view wishlists</Text>
          <Text style={styles.emptyBody}>
            You can create, view, or edit wishlists once you're logged in.
          </Text>

          <Pressable
            testID="saved-signin"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/auth');
            }}
            style={({ pressed }) => [
              styles.primaryCtaBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.primaryCtaBtnText}>Log in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Header component with title & segmented filter chips
  const renderHeader = () => (
    <View style={styles.headerWrap}>
      <View style={styles.topNavBar}>
        <Pressable
          testID="saved-back-btn"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/profile');
          }}
          style={({ pressed }) => [styles.backIconBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color="#222222" />
        </Pressable>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>Wishlists</Text>
        {totalSavedCount > 0 ? (
          <Text style={styles.itemCountSub}>{totalSavedCount} saved items</Text>
        ) : null}
      </View>

      {/* Segmented Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChipRow}
      >
        {(
          [
            { id: 'all', label: 'All Saved' },
            { id: 'reels', label: 'Reels & Stays' },
            { id: 'events', label: 'Events' },
          ] as const
        ).map((chip) => {
          const isActive = filterTab === chip.id;
          return (
            <Pressable
              key={chip.id}
              testID={`saved-chip-${chip.id}`}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilterTab(chip.id);
              }}
              style={[
                styles.chipBtn,
                isActive ? styles.chipActive : styles.chipInactive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isActive ? '#FFFFFF' : '#222222' },
                ]}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  // Render reel item in 2-column grid
  const renderReelCard = ({ item }: { item: ReelRow }) => {
    const price = Number(item.experience?.current_price ?? 0);
    const priceUnit = item.experience?.price_unit ?? 'night';

    return (
      <Pressable
        testID={`saved-reel-${item.id}`}
        onPress={() => router.push('/')}
        style={styles.gridCard}
      >
        <View style={styles.cardImageWrap}>
          {item.thumbnail_url ? (
            <Image
              source={{ uri: item.thumbnail_url }}
              style={styles.cardImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.cardImageFallback}>
              <Feather name="film" size={24} color="#717171" />
            </View>
          )}

          {/* Floating Heart Icon Overlay */}
          <Pressable
            testID={`unsave-${item.id}`}
            hitSlop={8}
            onPress={() => handleUnsave(item.id)}
            style={styles.floatingHeartBtn}
          >
            <Ionicons name="heart" size={18} color="#EE7D30" />
          </Pressable>
        </View>

        {/* Stacked Text Below Image */}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.experience?.title ?? 'Coastal Experience'}
          </Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            {item.experience?.location ?? 'Kenya Coast'}
          </Text>
          <Text style={styles.cardPrice}>
            KES {price.toLocaleString()} <Text style={styles.cardPriceUnit}>/ {priceUnit}</Text>
          </Text>
        </View>
      </Pressable>
    );
  };

  // Render event item
  const renderEventCard = ({ item }: { item: EventRow }) => (
    <Pressable
      onPress={() => router.push('/discover')}
      style={styles.eventRowCard}
    >
      <View style={styles.eventRowContent}>
        <View style={styles.eventHeaderRow}>
          <Text style={styles.eventCategoryTag}>{item.category ?? 'Event'}</Text>
          <Text style={styles.eventDateText}>{formatEventDate(item.event_date)}</Text>
        </View>
        <Text style={styles.eventTitleText} numberOfLines={1}>
          {item.title ?? 'Coastal Event'}
        </Text>
        <Text style={styles.eventPriceText}>
          {item.price ? `KES ${Number(item.price).toLocaleString()}` : 'Free Entry'}
        </Text>
      </View>
      <View style={styles.eventChevronCircle}>
        <Feather name="chevron-right" size={18} color="#717171" />
      </View>
    </Pressable>
  );

  // Combined dataset based on active filter chip
  const filteredReels = filterTab === 'events' ? [] : (reels ?? []);
  const filteredEvents = filterTab === 'reels' ? [] : (events ?? []);
  const isCombineEmpty = filteredReels.length === 0 && filteredEvents.length === 0;

  return (
    <View testID="saved-screen" style={[styles.fill, { backgroundColor: '#FFFFFF' }]}>
      {isCombineEmpty && !isLoading ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad }}
        >
          {renderHeader()}
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="heart-outline" size={30} color="#222222" />
            </View>

            <Text style={styles.emptyHeadline}>Create your first wishlist</Text>
            <Text style={styles.emptyBody}>
              As you search, tap the heart icon on any stay, experience, or event to save it here.
            </Text>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/discover');
              }}
              style={({ pressed }) => [
                styles.primaryCtaBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.primaryCtaBtnText}>Start exploring</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={filteredReels}
          keyExtractor={(r) => r.id}
          renderItem={renderReelCard}
          numColumns={2}
          columnWrapperStyle={styles.gridColumnWrapper}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: bottomPad,
          }}
          ListHeaderComponent={
            <View>
              {renderHeader()}
              {filteredEvents.length > 0 ? (
                <View style={styles.eventsSectionWrap}>
                  <Text style={styles.sectionHeading}>Subscribed Events</Text>
                  {filteredEvents.map((ev) => (
                    <React.Fragment key={ev.id}>{renderEventCard({ item: ev })}</React.Fragment>
                  ))}
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.skeletonGrid}>
                <Skeleton style={styles.skeletonCard} />
                <Skeleton style={styles.skeletonCard} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topNavBar: {
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerWrap: {
    marginBottom: 20,
  },
  titleRow: {
    marginTop: 8,
    marginBottom: 16,
    gap: 4,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    letterSpacing: -0.4,
  },
  itemCountSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  filterChipRow: {
    gap: 8,
    paddingRight: 20,
  },
  chipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  chipActive: {
    backgroundColor: '#222222',
  },
  chipInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
  },
  gridColumnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridCard: {
    width: '48%',
    gap: 8,
  },
  cardImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F7F7F7',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingHeartBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardContent: {
    gap: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  cardSub: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  cardPrice: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    marginTop: 2,
  },
  cardPriceUnit: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  eventsSectionWrap: {
    marginBottom: 20,
    gap: 10,
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    marginBottom: 4,
  },
  eventRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 14,
  },
  eventRowContent: {
    flex: 1,
    gap: 3,
  },
  eventHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventCategoryTag: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#EE7D30',
    textTransform: 'uppercase',
  },
  eventDateText: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  eventTitleText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  eventPriceText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  eventChevronCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyHeadline: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
    marginBottom: 8,
  },
  primaryCtaBtn: {
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  skeletonGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skeletonCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 14,
  },
});
