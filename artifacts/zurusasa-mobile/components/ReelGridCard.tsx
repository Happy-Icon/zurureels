import React, { useState } from 'react';
import {
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import {
  useReelInteractions,
  useToggleFollow,
  useToggleLike,
  useToggleSave,
} from '@/lib/queries';
import { BookingSheet } from '@/components/BookingSheet';
import type { ReelRow } from '@/lib/supabase';

const ZURU_ORANGE = '#EE7D30';

// Web ReelGridCard categoryColors (tailwind 500/600 at 90%) — note this grid
// palette differs slightly from the full-screen ReelCard one (web parity).
const GRID_CATEGORY_COLORS: Record<string, string> = {
  hotel: '#3B82F6E6',
  villa: '#10B981E6',
  apartment: '#A855F7E6',
  boats: '#06B6D4E6',
  food: '#F97316E6',
  drinks: '#EC4899E6',
  rentals: '#14B8A6E6',
  adventure: '#EF4444E6',
  parks_camps: '#16A34AE6',
  tours: '#F59E0BE6',
  events: '#6366F1E6',
  land_adventure: '#D97706E6',
  air_adventure: '#0EA5E9E6',
  water_adventure: '#2563EBE6',
};

function formatCount(n: number): string {
  if (n > 999) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

interface ReelGridCardProps {
  reel: ReelRow;
  width: number;
  onOpen: () => void;
}

export function ReelGridCard({ reel, width, onOpen }: ReelGridCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const toggleLike = useToggleLike();
  const toggleSave = useToggleSave();
  const toggleFollow = useToggleFollow();
  const [booked, setBooked] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);

  const hostId = reel.user_id ?? null;
  const { data: inter } = useReelInteractions(reel.id, hostId, user?.id, true);

  const exp = reel.experience;
  const meta = (exp?.metadata ?? {}) as Record<string, unknown>;
  const rating = Number((meta.rating as number | string | undefined) ?? 5);
  const hostName = reel.host?.full_name ?? 'ZuruSasa host';
  const avatarUrl =
    (reel.host?.metadata as { avatar_url?: string } | null)?.avatar_url ?? null;
  const category = (reel.category ?? '').toLowerCase();
  const badgeColor = GRID_CATEGORY_COLORS[category] ?? ZURU_ORANGE;
  const bookedOut = exp?.availability_status === 'booked_out';

  const liked = inter?.liked ?? false;
  const saved = inter?.saved ?? false;
  const following = inter?.following ?? false;
  const likeCount = inter?.likeCount ?? 0;

  const requireAuth = (): boolean => {
    if (!user) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push('/auth');
      return false;
    }
    return true;
  };

  const onLike = () => {
    if (!requireAuth() || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleLike.mutate({ reelId: reel.id, userId: user.id, liked });
  };

  const onSave = () => {
    if (!requireAuth() || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleSave.mutate({ reelId: reel.id, userId: user.id, saved });
  };

  const onFollow = () => {
    if (!requireAuth() || !user) return;
    if (!hostId || hostId === user.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFollow.mutate({ reelId: reel.id, hostId, userId: user.id, following });
  };

  const onShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const title = exp?.title ?? 'a coastal experience';
    const location = exp?.location ? ` in ${exp.location}` : '';
    try {
      await Share.share({
        message: `Check out ${title}${location} on ZuruSasa${
          reel.video_url ? `\n${reel.video_url}` : ''
        }`,
      });
    } catch {
      // dismissed
    }
  };

  const onBook = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (bookedOut || !exp?.id) return;
    setBookingOpen(true);
  };

  const height = width * 1.5; // web aspect-[2/3]

  return (
    <View style={[styles.card, { width, height }]}>
      {/* Thumbnail + open */}
      <Pressable
        testID={`grid-card-${reel.id}`}
        onPress={onOpen}
        style={StyleSheet.absoluteFill}
      >
        {reel.thumbnail_url ? (
          <Image
            source={{ uri: reel.thumbnail_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: '#22201d' }]}
          />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.8)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Center play hint */}
        <View pointerEvents="none" style={styles.playOverlay}>
          <View style={styles.playCircle}>
            <MaterialCommunityIcons name="play" size={18} color="#ffffff" />
          </View>
        </View>
      </Pressable>

      {/* Top controls */}
      <View style={styles.topRow} pointerEvents="box-none">
        <View style={styles.badgeColumn} pointerEvents="none">
          {reel.category ? (
            <View style={[styles.badge, { backgroundColor: badgeColor }]}>
              <Text style={styles.badgeText}>
                {reel.category.replace(/_/g, ' ')}
              </Text>
            </View>
          ) : null}
          {reel.is_live ? (
            <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
              <Text style={styles.badgeText}>LIVE</Text>
            </View>
          ) : null}
        </View>
        <Pressable onPress={onOpen} hitSlop={6} style={styles.muteButton}>
          <Feather name="volume-x" size={14} color="#ffffff" />
        </Pressable>
      </View>

      {/* Right interaction rack */}
      <View style={styles.rack} pointerEvents="box-none">
        <Pressable
          testID={`grid-follow-${reel.id}`}
          onPress={onFollow}
          style={styles.avatarRing}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>
                {hostName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {!following && hostId && hostId !== user?.id ? (
            <View style={styles.plusBadge}>
              <MaterialCommunityIcons name="plus-thick" size={9} color="#fff" />
            </View>
          ) : null}
        </Pressable>

        <Pressable
          testID={`grid-like-${reel.id}`}
          onPress={onLike}
          style={styles.rackItem}
          hitSlop={4}
        >
          <View
            style={[
              styles.rackCircle,
              liked ? { backgroundColor: 'rgba(239,68,68,0.25)' } : null,
            ]}
          >
            {liked ? (
              <MaterialCommunityIcons name="heart" size={16} color="#EF4444" />
            ) : (
              <Feather name="heart" size={16} color="#ffffff" />
            )}
          </View>
          {likeCount > 0 ? (
            <Text style={styles.rackCount}>{formatCount(likeCount)}</Text>
          ) : null}
        </Pressable>

        <Pressable
          testID={`grid-save-${reel.id}`}
          onPress={onSave}
          style={styles.rackItem}
          hitSlop={4}
        >
          <View
            style={[
              styles.rackCircle,
              saved ? { backgroundColor: 'rgba(238,125,48,0.25)' } : null,
            ]}
          >
            {saved ? (
              <MaterialCommunityIcons
                name="bookmark"
                size={16}
                color={ZURU_ORANGE}
              />
            ) : (
              <Feather name="bookmark" size={16} color="#ffffff" />
            )}
          </View>
        </Pressable>

        <Pressable onPress={onShare} style={styles.rackItem} hitSlop={4}>
          <View style={styles.rackCircle}>
            <Feather name="share-2" size={16} color="#ffffff" />
          </View>
        </Pressable>
      </View>

      {/* Bottom info + book */}
      <View style={styles.bottom} pointerEvents="box-none">
        <Text style={styles.title} numberOfLines={1}>
          {exp?.title ?? 'Coastal experience'}
        </Text>
        <View style={styles.locationRow}>
          <Feather name="map-pin" size={10} color="rgba(255,255,255,0.9)" />
          <Text style={styles.location} numberOfLines={1}>
            {exp?.location ?? 'Kenyan coast'}
          </Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.price}>
            KES {Number(exp?.current_price ?? 0).toLocaleString()}
            <Text style={styles.priceUnit}> /{exp?.price_unit ?? 'person'}</Text>
          </Text>
          <View style={styles.ratingRow}>
            <MaterialCommunityIcons name="star" size={11} color="#EAB308" />
            <Text style={styles.rating}>{rating.toFixed(1)}</Text>
          </View>
        </View>
        <Pressable
          testID={`grid-book-${reel.id}`}
          onPress={onBook}
          disabled={bookedOut}
          style={({ pressed }) => [
            styles.bookButton,
            {
              backgroundColor: bookedOut
                ? 'rgba(82,76,70,0.85)'
                : booked
                  ? '#2e7d32'
                  : ZURU_ORANGE,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.bookText,
              bookedOut ? { color: 'rgba(255,255,255,0.55)' } : null,
            ]}
          >
            {bookedOut ? 'Fully Booked' : booked ? 'Booked ✓' : 'Book Now'}
          </Text>
        </Pressable>
      </View>

      <BookingSheet
        reel={reel}
        visible={bookingOpen}
        onClose={() => setBookingOpen(false)}
        onSuccess={() => setBooked(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#22201d',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  badgeColumn: {
    gap: 6,
    alignItems: 'flex-start',
    flexShrink: 1,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  muteButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rack: {
    position: 'absolute',
    right: 6,
    top: 48,
    alignItems: 'center',
    gap: 8,
  },
  avatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#EE7D30',
  },
  avatarFallback: {
    backgroundColor: '#3a332c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
  },
  plusBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#EE7D30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rackItem: {
    alignItems: 'center',
    gap: 1,
  },
  rackCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rackCount: {
    color: '#ffffff',
    fontSize: 9,
    fontFamily: 'DMSans_500Medium',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    gap: 3,
  },
  title: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  location: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 9,
    fontFamily: 'DMSans_400Regular',
    flexShrink: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
  },
  priceUnit: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 9,
    fontFamily: 'DMSans_400Regular',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rating: {
    color: '#ffffff',
    fontSize: 9,
    fontFamily: 'DMSans_500Medium',
  },
  bookButton: {
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bookText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
  },
});
