import React, { useState, useCallback } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';
import { useSavedEvents, useSavedReels } from '@/lib/queries';
import { HistoryBottomSheet } from '@/components/history/HistoryBottomSheet';
import { SavedFavoritesBottomSheet } from '@/components/saved/SavedFavoritesBottomSheet';

export default function WishlistsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const { data: reels, isLoading: reelsLoading, refetch: refetchReels } = useSavedReels(user?.id);
  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = useSavedEvents(user?.id);
  const [refreshing, setRefreshing] = useState(false);

  // Automatically refresh wishlists whenever user switches to this tab
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        refetchReels();
        refetchEvents();
      }
    }, [user?.id, refetchReels, refetchEvents]),
  );

  // Recently viewed & Saved Favorites modal state
  const [recentlyViewedModal, setRecentlyViewedModal] = useState(false);
  const [savedFavoritesModal, setSavedFavoritesModal] = useState(false);

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 120 : insets.bottom + 90;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchReels(), refetchEvents()]);
    } catch (e) {
      console.warn('[Saved] Refresh error (offline):', e);
    } finally {
      setRefreshing(false);
    }
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

      {/* ── SAVED FAVORITES BOTTOM SHEET ──────────────────────────────────────── */}
      <SavedFavoritesBottomSheet
        visible={savedFavoritesModal}
        onClose={() => setSavedFavoritesModal(false)}
        reels={reels}
        events={events}
        isLoading={reelsLoading || eventsLoading}
        userId={user?.id}
        onRefresh={onRefresh}
      />

      {/* ── RECENTLY VIEWED BOTTOM SHEET ────────────────────────────────────── */}
      <HistoryBottomSheet
        visible={recentlyViewedModal}
        onClose={() => setRecentlyViewedModal(false)}
      />
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
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
    letterSpacing: -0.8,
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
    fontFamily: 'DMSans_700Bold',
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
    marginTop: 10,
  },
  cardSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    marginTop: 2,
  },
});
