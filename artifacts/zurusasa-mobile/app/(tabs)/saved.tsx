import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';
import { useSavedEvents, useSavedReels } from '@/lib/queries';

export default function WishlistsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const { data: reels, isLoading: reelsLoading, refetch: refetchReels } = useSavedReels(user?.id);
  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = useSavedEvents(user?.id);
  const [refreshing, setRefreshing] = useState(false);

  // Recently viewed & Saved Favorites modal state
  const [recentlyViewedModal, setRecentlyViewedModal] = useState(false);
  const [savedFavoritesModal, setSavedFavoritesModal] = useState(false);

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 120 : insets.bottom + 90;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchReels(), refetchEvents()]);
    setRefreshing(false);
  };

  const totalSavedCount = (reels?.length ?? 0) + (events?.length ?? 0);
  const firstThumbnail = reels?.[0]?.thumbnail_url || null;

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScrollView
        style={[styles.fill, { backgroundColor: colors.background }]}
        contentContainerStyle={{
          paddingTop: topPad,
          paddingBottom: bottomPad,
          paddingHorizontal: 24,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F26522" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER TITLE (MATCHING SCREENSHOT) ─────────────────────────────── */}
        <View style={styles.headerWrap}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Wishlists</Text>
        </View>

        {/* ── WISHLISTS 2-COLUMN GRID ────────────────────────────────────────── */}
        <View style={styles.gridRow}>
          {/* Card 1: Recently viewed (EXACT MATCH TO SCREENSHOT) */}
          <Pressable
            testID="recently-viewed-card"
            onPress={() => setRecentlyViewedModal(true)}
            style={({ pressed }) => [styles.gridCard, pressed && { opacity: 0.88 }]}
          >
            <View style={styles.historyGreyTile}>
              <MaterialCommunityIcons name="history" size={56} color="#FFFFFF" />
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Recently viewed</Text>
          </Pressable>

          {/* Card 2: Saved Favorites */}
          <Pressable
            testID="saved-favorites-card"
            onPress={() => setSavedFavoritesModal(true)}
            style={({ pressed }) => [styles.gridCard, pressed && { opacity: 0.88 }]}
          >
            <View style={[styles.collectionTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {firstThumbnail ? (
                <Image
                  source={{ uri: firstThumbnail }}
                  style={styles.collectionImg}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.collectionFallback, { backgroundColor: isDark ? '#27272A' : '#FFF5EF' }]}>
                  <Ionicons name="heart" size={44} color="#F26522" />
                </View>
              )}
              <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.countBadgeText}>{totalSavedCount}</Text>
              </View>
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Saved favorites</Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{totalSavedCount} saved</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── SAVED FAVORITES MODAL SHEET ───────────────────────────────────────── */}
      <Modal
        visible={savedFavoritesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSavedFavoritesModal(false)}
      >
        <View style={[styles.modalSheet, { backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setSavedFavoritesModal(false)} style={[styles.circleCloseBtn, { backgroundColor: isDark ? '#27272A' : '#F5F5F5' }]}>
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
            <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>Saved favorites</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            contentContainerStyle={[styles.modalScrollContent, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
          >
            {totalSavedCount > 0 ? (
              <View style={{ gap: 14 }}>
                {reels?.map((reel) => (
                  <Pressable
                    key={`saved-reel-${reel.id}`}
                    onPress={() => {
                      setSavedFavoritesModal(false);
                      router.push('/discover');
                    }}
                    style={[styles.recentItemRow, { borderBottomColor: colors.border }]}
                  >
                    <View style={styles.recentThumbBox}>
                      {reel.thumbnail_url ? (
                        <Image source={{ uri: reel.thumbnail_url }} style={styles.recentThumb} contentFit="cover" />
                      ) : (
                        <View style={[styles.recentThumb, { backgroundColor: isDark ? '#27272A' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }]}>
                          <Feather name="film" size={20} color={colors.mutedForeground} />
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, paddingLeft: 12 }}>
                      <Text style={[styles.recentTitle, { color: colors.text }]} numberOfLines={1}>
                        {reel.experience?.title ?? 'Coastal Stay'}
                      </Text>
                      <Text style={[styles.recentLocation, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {reel.experience?.location ?? 'Kenya Coast'}
                      </Text>
                      <Text style={styles.recentPrice}>
                        KES {Number(reel.experience?.current_price ?? 0).toLocaleString()} / night
                      </Text>
                    </View>
                    <Ionicons name="heart" size={20} color="#F26522" style={{ marginRight: 8 }} />
                  </Pressable>
                ))}

                {events?.map((ev) => (
                  <Pressable
                    key={`saved-event-${ev.id}`}
                    onPress={() => {
                      setSavedFavoritesModal(false);
                      router.push('/discover');
                    }}
                    style={[styles.recentItemRow, { borderBottomColor: colors.border }]}
                  >
                    <View style={styles.recentThumbBox}>
                      {ev.image_url ? (
                        <Image source={{ uri: ev.image_url }} style={styles.recentThumb} contentFit="cover" />
                      ) : (
                        <View style={[styles.recentThumb, { backgroundColor: isDark ? '#27272A' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }]}>
                          <Feather name="calendar" size={20} color={colors.mutedForeground} />
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, paddingLeft: 12 }}>
                      <Text style={[styles.recentTitle, { color: colors.text }]} numberOfLines={1}>
                        {ev.title ?? 'Coastal Event'}
                      </Text>
                      <Text style={[styles.recentLocation, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {ev.location ?? 'Kenya Coast'}
                      </Text>
                      <Text style={styles.recentPrice}>
                        {ev.event_date ? new Date(ev.event_date).toLocaleDateString() : 'Upcoming Event'}
                      </Text>
                    </View>
                    <Ionicons name="heart" size={20} color="#F26522" style={{ marginRight: 8 }} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.emptyRecentWrap}>
                <View style={[styles.emptyRecentIconCircle, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
                  <Ionicons name="heart-outline" size={32} color={colors.mutedForeground} />
                </View>
                <Text style={[styles.emptyRecentTitle, { color: colors.text }]}>No saved favorites yet</Text>
                <Text style={[styles.emptyRecentSub, { color: colors.mutedForeground }]}>
                  Tap the heart icon on any stay, experience, or event to save it to your favorites list.
                </Text>
                <Pressable
                  onPress={() => {
                    setSavedFavoritesModal(false);
                    router.push('/discover');
                  }}
                  style={[styles.exploreCtaBtn, { backgroundColor: '#F26522' }]}
                >
                  <Text style={styles.exploreCtaBtnText}>Explore coastal stays</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── RECENTLY VIEWED MODAL SHEET ──────────────────────────────────────── */}
      <Modal
        visible={recentlyViewedModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRecentlyViewedModal(false)}
      >
        <View style={[styles.modalSheet, { backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setRecentlyViewedModal(false)} style={[styles.circleCloseBtn, { backgroundColor: isDark ? '#27272A' : '#F5F5F5' }]}>
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
            <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>Recently viewed</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            contentContainerStyle={[styles.modalScrollContent, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
          >
            {reels && reels.length > 0 ? (
              reels.map((reel) => (
                <Pressable
                  key={reel.id}
                  onPress={() => {
                    setRecentlyViewedModal(false);
                    router.push('/discover');
                  }}
                  style={[styles.recentItemRow, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.recentThumbBox}>
                    {reel.thumbnail_url ? (
                      <Image source={{ uri: reel.thumbnail_url }} style={styles.recentThumb} contentFit="cover" />
                    ) : (
                      <View style={[styles.recentThumb, { backgroundColor: isDark ? '#27272A' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }]}>
                        <Feather name="film" size={20} color={colors.mutedForeground} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, paddingLeft: 12 }}>
                    <Text style={[styles.recentTitle, { color: colors.text }]} numberOfLines={1}>
                      {reel.experience?.title ?? 'Coastal Stay'}
                    </Text>
                    <Text style={[styles.recentLocation, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {reel.experience?.location ?? 'Kenya Coast'}
                    </Text>
                    <Text style={styles.recentPrice}>
                      KES {Number(reel.experience?.current_price ?? 0).toLocaleString()} / night
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyRecentWrap}>
                <View style={[styles.emptyRecentIconCircle, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
                  <MaterialCommunityIcons name="history" size={32} color={colors.mutedForeground} />
                </View>
                <Text style={[styles.emptyRecentTitle, { color: colors.text }]}>No recently viewed items</Text>
                <Text style={[styles.emptyRecentSub, { color: colors.mutedForeground }]}>
                  Stays and experiences you browse on Discover and Pulse will appear here automatically.
                </Text>
                <Pressable
                  onPress={() => {
                    setRecentlyViewedModal(false);
                    router.push('/discover');
                  }}
                  style={[styles.exploreCtaBtn, { backgroundColor: '#F26522' }]}
                >
                  <Text style={styles.exploreCtaBtnText}>Explore coastal stays</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  headerWrap: {
    marginBottom: 28,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.8,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  gridCard: {
    width: '47%',
  },
  historyGreyTile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    backgroundColor: '#8E8E93',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionTile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  collectionImg: {
    width: '100%',
    height: '100%',
  },
  collectionFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    marginTop: 10,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  cardSub: {
    fontSize: 13,
    color: '#717171',
    marginTop: 2,
  },

  /* Recently viewed modal */
  modalSheet: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  circleCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  recentItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  recentThumbBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
  },
  recentThumb: {
    width: '100%',
    height: '100%',
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  recentLocation: {
    fontSize: 13,
    color: '#717171',
    marginTop: 2,
  },
  recentPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F26522',
    marginTop: 2,
  },
  emptyRecentWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyRecentIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyRecentTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },
  emptyRecentSub: {
    fontSize: 14,
    color: '#717171',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  exploreCtaBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  exploreCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
