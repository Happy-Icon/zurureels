import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { useSavedEvents, useSavedReels, useToggleSave } from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';
import { useColors } from '@/hooks/useColors';
import type { EventRow, ReelRow } from '@/lib/supabase';

// Synced with the web Saved page's category badge palette.
const CATEGORY_COLORS: Record<string, string> = {
  hotel: '#3b82f6',
  villa: '#10b981',
  boats: '#06b6d4',
  tours: '#f59e0b',
  events: '#a855f7',
  apartment: '#6366f1',
  food: '#f97316',
  drinks: '#ec4899',
  rentals: '#14b8a6',
  adventure: '#ef4444',
  parks_camps: '#16a34a',
};

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

export default function SavedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<'reels' | 'events'>('reels');

  const { data: reels, isLoading: reelsLoading } = useSavedReels(user?.id);
  const { data: events, isLoading: eventsLoading } = useSavedEvents(user?.id);
  const toggleSave = useToggleSave();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 110 : 100;

  if (!loading && !user) {
    return (
      <View
        style={[
          styles.fill,
          styles.centered,
          { backgroundColor: colors.background, paddingTop: topPad },
        ]}
      >
        <View style={[styles.heroIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="bookmark" size={30} color={colors.primary} />
        </View>
        <Text style={[styles.heroTitle, { color: colors.foreground }]}>
          Sign in to see saved
        </Text>
        <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
          Save hotels, tours, and experiences you love.
        </Text>
        <Pressable
          testID="saved-signin"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/auth');
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.primaryButtonText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  const handleUnsave = (reelId: string) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Optimistically drop the card; useToggleSave invalidates ['saved-reels'] on settle.
    queryClient.setQueryData<ReelRow[]>(['saved-reels', user.id], (old) =>
      (old ?? []).filter((r) => r.id !== reelId),
    );
    toggleSave.mutate({ reelId, userId: user.id, saved: true });
  };

  const header = (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.foreground }]}>Saved</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        {tab === 'reels'
          ? `${reels?.length ?? 0} reels saved`
          : `${events?.length ?? 0} events subscribed`}
      </Text>
      <View style={[styles.pillRow, { backgroundColor: colors.muted }]}>
        {(['reels', 'events'] as const).map((key) => (
          <Pressable
            key={key}
            testID={`saved-tab-${key}`}
            onPress={() => setTab(key)}
            style={[
              styles.pill,
              tab === key && {
                backgroundColor: colors.background,
              },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                {
                  color:
                    tab === key ? colors.foreground : colors.mutedForeground,
                },
              ]}
            >
              {key === 'reels' ? 'Reels' : 'Events'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderReel = ({ item }: { item: ReelRow }) => {
    const price = Number(item.experience?.current_price ?? 0);
    const badgeColor = CATEGORY_COLORS[item.category ?? ''] ?? colors.primary;
    return (
      <Pressable
        testID={`saved-reel-${item.id}`}
        onPress={() => router.push('/')}
        style={[styles.reelCard, { backgroundColor: colors.muted }]}
      >
        {item.thumbnail_url ? (
          <Image
            source={{ uri: item.thumbnail_url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : null}
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{item.category ?? 'reel'}</Text>
        </View>
        {item.is_live ? (
          <View style={styles.liveChip}>
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        ) : null}
        <Pressable
          testID={`unsave-${item.id}`}
          hitSlop={8}
          onPress={() => handleUnsave(item.id)}
          style={styles.unsaveBtn}
        >
          <MaterialCommunityIcons
            name="bookmark"
            size={18}
            color={colors.primary}
          />
        </Pressable>
        <View style={styles.reelInfo}>
          <Text style={styles.reelTitle} numberOfLines={2}>
            {item.experience?.title ?? 'Untitled Experience'}
          </Text>
          <Text style={styles.reelLoc} numberOfLines={1}>
            {item.experience?.location ?? 'Unknown Location'}
          </Text>
          <Text style={styles.reelPrice}>
            KES {price.toLocaleString()}
            <Text style={styles.reelUnit}>
              /{item.experience?.price_unit ?? 'person'}
            </Text>
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderEvent = ({ item }: { item: EventRow }) => (
    <View
      style={[
        styles.eventCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={styles.eventTopRow}>
        <View style={[styles.eventChip, { backgroundColor: colors.secondary }]}>
          <Text
            style={[styles.eventChipText, { color: colors.secondaryForeground }]}
          >
            {item.category ?? 'event'}
          </Text>
        </View>
        <Text style={[styles.eventDate, { color: colors.mutedForeground }]}>
          {formatEventDate(item.event_date)}
        </Text>
      </View>
      <Text
        style={[styles.eventTitle, { color: colors.foreground }]}
        numberOfLines={2}
      >
        {item.title ?? 'Event'}
      </Text>
      {item.description ? (
        <Text
          style={[styles.eventDesc, { color: colors.mutedForeground }]}
          numberOfLines={2}
        >
          {item.description}
        </Text>
      ) : null}
      <View style={styles.eventBottomRow}>
        <Text style={[styles.eventPrice, { color: colors.foreground }]}>
          {item.price ? `KES ${Number(item.price).toLocaleString()}` : 'Free'}
        </Text>
        <Pressable
          onPress={() => router.push('/discover')}
          style={({ pressed }) => [
            styles.eventBtn,
            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.eventBtnText, { color: colors.foreground }]}>
            View Event
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const loadingBody = (
    <View style={styles.skeletonGrid}>
      <Skeleton style={styles.skeletonCard} />
      <Skeleton style={styles.skeletonCard} />
      <Skeleton style={styles.skeletonCard} />
      <Skeleton style={styles.skeletonCard} />
    </View>
  );

  const emptyState = (icon: React.ReactNode, title: string, sub: string) => (
    <View style={styles.empty}>
      {icon}
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
        {sub}
      </Text>
      <Pressable
        onPress={() => router.push('/discover')}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.primaryButtonText}>Start Exploring</Text>
      </Pressable>
    </View>
  );

  if (tab === 'events') {
    return (
      <View
        testID="saved-screen"
        style={[styles.fill, { backgroundColor: colors.background }]}
      >
        <FlatList
          data={events ?? []}
          keyExtractor={(e) => e.id}
          renderItem={renderEvent}
          contentContainerStyle={{
            paddingTop: topPad + 8,
            paddingBottom: bottomPad,
            paddingHorizontal: 16,
            gap: 12,
          }}
          ListHeaderComponent={header}
          ListEmptyComponent={
            eventsLoading
              ? loadingBody
              : emptyState(
                  <Feather
                    name="calendar"
                    size={40}
                    color={colors.mutedForeground}
                  />,
                  'No events subscribed',
                  'Subscribe to events you want to hear about.',
                )
          }
        />
      </View>
    );
  }

  return (
    <View
      testID="saved-screen"
      style={[styles.fill, { backgroundColor: colors.background }]}
    >
      <FlatList
        data={reels ?? []}
        keyExtractor={(r) => r.id}
        renderItem={renderReel}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{
          paddingTop: topPad + 8,
          paddingBottom: bottomPad,
          paddingHorizontal: 16,
          gap: 12,
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          reelsLoading
            ? loadingBody
            : emptyState(
                <Feather
                  name="bookmark"
                  size={40}
                  color={colors.mutedForeground}
                />,
                'Nothing saved yet',
                'Save hotels, tours, and events you love for easy access later.',
              )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 26,
    fontFamily: 'InstrumentSerif_400Regular',
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
  primaryButton: {
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  header: { marginBottom: 14, gap: 8 },
  title: {
    fontSize: 30,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
  },
  pillRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: 10,
    padding: 3,
    marginTop: 4,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 8,
  },
  pillText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
  },
  reelCard: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: 14,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    zIndex: 2,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: 'DMSans_600SemiBold',
    textTransform: 'capitalize',
  },
  liveChip: {
    position: 'absolute',
    top: 38,
    right: 10,
    backgroundColor: '#ef4444',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 2,
  },
  liveText: {
    color: '#ffffff',
    fontSize: 9,
    fontFamily: 'DMSans_700Bold',
  },
  unsaveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  reelInfo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  reelTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
  },
  reelLoc: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
  },
  reelPrice: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
  },
  reelUnit: {
    fontSize: 10,
    fontFamily: 'DMSans_400Regular',
  },
  eventCard: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
  },
  eventTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  eventChipText: {
    fontSize: 11,
    fontFamily: 'DMSans_500Medium',
    textTransform: 'capitalize',
  },
  eventDate: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  eventTitle: {
    fontSize: 17,
    fontFamily: 'DMSans_700Bold',
  },
  eventDesc: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 18,
  },
  eventBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  eventPrice: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
  },
  eventBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  eventBtnText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skeletonCard: {
    width: '47%',
    aspectRatio: 3 / 4,
    borderRadius: 14,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
});
