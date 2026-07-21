import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import {
  useEnquire,
  useReelInteractions,
  useToggleFollow,
  useToggleLike,
  useToggleSave,
} from '@/lib/queries';
import { getReelExpiry } from '@/lib/reelExpiry';
import { BookingSheet } from '@/components/BookingSheet';
import { ReelInfoSheet } from '@/components/ReelInfoSheet';
import { ZuruAgentChat } from '@/components/ZuruAgentChat';
import type { ReelRow } from '@/lib/supabase';

export const ZURU_ORANGE = '#EE7D30';

// Same palette as the web ReelCard categoryColors (tailwind 500/600 at 90%)
const CATEGORY_COLORS: Record<string, string> = {
  hotel: '#3B82F6E6',
  villa: '#10B981E6',
  boats: '#06B6D4E6',
  tours: '#F59E0BE6',
  events: '#A855F7E6',
  apartment: '#6366F1E6',
  food: '#F97316E6',
  drinks: '#EC4899E6',
  rentals: '#14B8A6E6',
  adventure: '#EF4444E6',
  parks_camps: '#16A34AE6',
  land_adventure: '#D97706E6',
  air_adventure: '#0EA5E9E6',
  water_adventure: '#2563EBE6',
};

// Mirrors the web app's module-level `globalMuted` — feed starts muted and
// the choice sticks as you scroll between reels.
let globalMuted = true;

function formatCount(n: number): string {
  if (n > 999) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

interface ReelCardProps {
  reel: ReelRow;
  isActive: boolean;
  height: number;
}

export function ReelCard({ reel, isActive, height }: ReelCardProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const enquire = useEnquire();
  const toggleLike = useToggleLike();
  const toggleSave = useToggleSave();
  const toggleFollow = useToggleFollow();
  const [booked, setBooked] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(globalMuted);
  const [infoOpen, setInfoOpen] = useState<boolean>(false);
  const [agentOpen, setAgentOpen] = useState<boolean>(false);
  const [bookingOpen, setBookingOpen] = useState<boolean>(false);

  const hostId = reel.user_id ?? null;
  const { data: inter } = useReelInteractions(
    reel.id,
    hostId,
    user?.id,
    isActive,
  );

  const videoUrl = reel.video_url ?? '';

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = globalMuted;
  });

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });

  useEffect(() => {
    if (!videoUrl) return;
    if (isActive) {
      setMuted(globalMuted);
      player.muted = globalMuted;
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player, videoUrl]);

  const toggleMute = () => {
    const next = !muted;
    globalMuted = next;
    player.muted = next;
    setMuted(next);
  };

  // Web behavior: tapping the video while muted unmutes it; otherwise toggles play.
  const onVideoTap = () => {
    if (!videoUrl) return;
    if (muted) {
      toggleMute();
      if (!isPlaying) player.play();
      return;
    }
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  const exp = reel.experience;
  const meta = (exp?.metadata ?? {}) as Record<string, unknown>;
  const rating = Number((meta.rating as number | string | undefined) ?? 5);
  const expiry = getReelExpiry(reel.created_at);
  const hostName = reel.host?.full_name ?? 'ZuruSasa host';
  const avatarUrl =
    (reel.host?.metadata as { avatar_url?: string } | null)?.avatar_url ?? null;
  const categoryColor = reel.category
    ? (CATEGORY_COLORS[reel.category.toLowerCase()] ?? `${ZURU_ORANGE}E6`)
    : `${ZURU_ORANGE}E6`;

  const priceAmount = exp?.current_price;
  const priceUnit = exp?.price_unit ?? 'person';
  const bookedOut = exp?.availability_status === 'booked_out';

  // Web: bottom content sits at bottom-6 (24px), the rail at bottom-32 (128px).
  const baseBottom = Math.max(24, insets.bottom + 10);
  const railBottom = baseBottom + 104;

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
    toggleLike.mutate({
      reelId: reel.id,
      userId: user.id,
      liked: inter?.liked ?? false,
    });
  };

  const onSave = () => {
    if (!requireAuth() || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleSave.mutate({
      reelId: reel.id,
      userId: user.id,
      saved: inter?.saved ?? false,
    });
  };

  const onFollow = () => {
    if (!requireAuth() || !user) return;
    if (!hostId || hostId === user.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFollow.mutate({
      reelId: reel.id,
      hostId,
      userId: user.id,
      following: inter?.following ?? false,
    });
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
      // user dismissed the share sheet
    }
  };

  const onEnquire = async () => {
    if (!requireAuth() || !user) return;
    if (!hostId) {
      Alert.alert('Host unavailable', 'This reel has no host to message.');
      return;
    }
    if (hostId === user.id) {
      Alert.alert('This is your reel', 'You cannot enquire on your own listing.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await enquire.mutateAsync({ userId: user.id, hostId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Enquiry sent',
        `Your chat with ${hostName} is open — replies will show up in your ZuruSasa inbox.`,
      );
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Could not send enquiry',
        err instanceof Error ? err.message : 'Please try again.',
      );
    }
  };

  const onBook = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (bookedOut || !exp?.id) return;
    setBookingOpen(true);
  };

  const liked = inter?.liked ?? false;
  const saved = inter?.saved ?? false;
  const following = inter?.following ?? false;
  const likeCount = inter?.likeCount ?? 0;

  return (
    <View style={[styles.page, { height }]}>
      {/* Full-bleed video */}
      {reel.thumbnail_url ? (
        <Image
          source={{ uri: reel.thumbnail_url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : null}
      {videoUrl ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          surfaceType="textureView"
        />
      ) : !reel.thumbnail_url ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#14110e' }]} />
      ) : null}

      {/* Bottom legibility gradient (web: from-black/80 via-transparent) */}
      <LinearGradient
        colors={['transparent', 'transparent', 'rgba(0,0,0,0.8)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Tap to unmute / play-pause */}
      <Pressable
        testID={`video-tap-${reel.id}`}
        onPress={onVideoTap}
        style={StyleSheet.absoluteFill}
      >
        {videoUrl && !isPlaying ? (
          <View pointerEvents="none" style={styles.playOverlay}>
            <View style={styles.playCircle}>
              <MaterialCommunityIcons name="play" size={46} color="#ffffff" />
            </View>
          </View>
        ) : null}
      </Pressable>

      {/* Right action rail (overlaid on the video, like web mobile) */}
      <View style={[styles.rail, { bottom: railBottom }]}>
        <Pressable
          testID={`follow-button-${reel.id}`}
          onPress={onFollow}
          style={styles.avatarWrap}
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
          {hostId && hostId !== user?.id ? (
            <View
              style={[
                styles.followBadge,
                following ? { backgroundColor: '#10b981' } : null,
              ]}
            >
              <Feather
                name={following ? 'check' : 'plus'}
                size={13}
                color="#ffffff"
              />
            </View>
          ) : null}
        </Pressable>

        <Pressable
          testID={`like-button-${reel.id}`}
          onPress={onLike}
          hitSlop={6}
          style={styles.railItem}
        >
          {liked ? (
            <MaterialCommunityIcons name="heart" size={29} color="#EF4444" />
          ) : (
            <Feather name="heart" size={28} color="#ffffff" />
          )}
          <Text style={styles.railLabel}>{formatCount(likeCount)}</Text>
        </Pressable>

        <Pressable
          testID={`save-button-${reel.id}`}
          onPress={onSave}
          hitSlop={6}
          style={styles.railItem}
        >
          {saved ? (
            <MaterialCommunityIcons
              name="bookmark"
              size={29}
              color={ZURU_ORANGE}
            />
          ) : (
            <Feather name="bookmark" size={26} color="#ffffff" />
          )}
          <Text style={styles.railLabel}>{saved ? 'SAVED' : 'SAVE'}</Text>
        </Pressable>

        <Pressable onPress={onShare} hitSlop={6} style={styles.railItem}>
          <Feather name="share-2" size={25} color="#ffffff" />
          <Text style={styles.railLabel}>SHARE</Text>
        </Pressable>

        <Pressable
          testID={`info-button-${reel.id}`}
          onPress={() => setInfoOpen(true)}
          hitSlop={6}
          style={styles.railItem}
        >
          <Feather name="info" size={25} color="#ffffff" />
          <Text style={styles.railLabel}>INFO</Text>
        </Pressable>

        <Pressable
          testID={`sound-button-${reel.id}`}
          onPress={() => {
            Haptics.selectionAsync();
            toggleMute();
          }}
          hitSlop={6}
          style={styles.railItem}
        >
          <View
            style={[
              styles.soundCircle,
              {
                backgroundColor: muted ? ZURU_ORANGE : 'rgba(0,0,0,0.25)',
              },
            ]}
          >
            <Feather
              name={muted ? 'volume-x' : 'volume-2'}
              size={21}
              color="#ffffff"
            />
          </View>
          <Text style={styles.railLabel}>{muted ? 'SOUND ON' : 'MUTE'}</Text>
        </Pressable>
      </View>

      {/* Bottom info stack */}
      <View style={[styles.bottomOverlay, { bottom: baseBottom }]}>
        <Pressable
          testID={`zuru-agent-${reel.id}`}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setAgentOpen(true);
          }}
          style={({ pressed }) => [
            styles.agentButton,
            { transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
        >
          <MaterialCommunityIcons name="creation" size={18} color="#ffffff" />
          <Text style={styles.agentText}>ZURU AGENT</Text>
        </Pressable>

        <View style={styles.metaRow}>
          {reel.category ? (
            <View
              style={[styles.categoryPill, { backgroundColor: categoryColor }]}
            >
              <Text style={styles.categoryText}>
                {reel.category.replace(/_/g, ' ')}
              </Text>
            </View>
          ) : null}
          {expiry ? (
            <View style={styles.expiryRow}>
              <Feather
                name="clock"
                size={11}
                color={expiry.urgent ? '#fb923c' : 'rgba(255,255,255,0.9)'}
              />
              <Text
                style={[
                  styles.expiryText,
                  {
                    color: expiry.urgent ? '#fb923c' : 'rgba(255,255,255,0.9)',
                  },
                ]}
              >
                {expiry.label.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.title} numberOfLines={1}>
          {exp?.title ?? 'Coastal experience'}
        </Text>

        {exp?.location ? (
          <Text style={styles.location} numberOfLines={1}>
            {exp.location}
          </Text>
        ) : null}

        <View style={styles.priceRow}>
          {priceAmount != null ? (
            <Text style={styles.price}>
              KES {Number(priceAmount).toLocaleString()}
              <Text style={styles.priceUnit}>/{priceUnit}</Text>
            </Text>
          ) : null}
          <Text style={styles.ratingText}>⭐ {rating.toFixed(1)}</Text>
        </View>

        <View style={styles.buttonRow}>
          {exp?.id ? (
            <Pressable
              testID={`book-button-${reel.id}`}
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
          ) : null}
          <Pressable
            testID={`enquire-button-${reel.id}`}
            onPress={onEnquire}
            disabled={enquire.isPending}
            style={({ pressed }) => [
              styles.enquireButton,
              { opacity: pressed || enquire.isPending ? 0.7 : 1 },
            ]}
          >
            {enquire.isPending ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.enquireText}>Enquire</Text>
            )}
          </Pressable>
        </View>
      </View>

      <ReelInfoSheet
        reel={reel}
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
      />

      <BookingSheet
        reel={reel}
        visible={bookingOpen}
        onClose={() => setBookingOpen(false)}
        onSuccess={() => setBooked(true)}
      />

      <ZuruAgentChat
        visible={agentOpen}
        onClose={() => setAgentOpen(false)}
        reelSummary={{
          title: exp?.title ?? null,
          category: reel.category,
          location: exp?.location ?? null,
          price: exp?.current_price ?? null,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    backgroundColor: '#000000',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rail: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 20,
    zIndex: 20,
  },
  railItem: {
    alignItems: 'center',
    gap: 4,
    minWidth: 52,
  },
  railLabel: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarFallback: {
    backgroundColor: '#3a332c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
  },
  followBadge: {
    position: 'absolute',
    bottom: -8,
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: ZURU_ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 64,
    paddingHorizontal: 16,
    gap: 5,
    zIndex: 15,
  },
  agentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(238,125,48,0.92)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 8,
    shadowColor: ZURU_ORANGE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  agentText: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 1.4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
  },
  categoryText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontFamily: 'DMSans_700Bold',
    textTransform: 'capitalize',
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expiryText: {
    fontSize: 9.5,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 1,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 28,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  location: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  price: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  priceUnit: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10.5,
    fontFamily: 'DMSans_400Regular',
  },
  ratingText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontFamily: 'DMSans_700Bold',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  bookButton: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontFamily: 'DMSans_700Bold',
  },
  enquireButton: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  enquireText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontFamily: 'DMSans_500Medium',
  },
});
