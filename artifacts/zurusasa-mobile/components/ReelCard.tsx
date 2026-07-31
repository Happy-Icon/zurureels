import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PanResponder,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuth } from '@/context/AuthContext';
import {
  useReelInteractions,
  useToggleFollow,
  useToggleLike,
  useToggleSave,
} from '@/lib/queries';
import { BookingSheet } from '@/components/BookingSheet';
import { ReelInfoSheet } from '@/components/ReelInfoSheet';
import { EnquireModal } from '@/components/EnquireModal';
import type { ReelRow } from '@/lib/supabase';

export const ZURU_ORANGE = '#EE7D30';

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

import { useIsFocused } from '@react-navigation/native';

export function ReelCard({ reel, isActive, height }: ReelCardProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, viewMode } = useAuth();
  const isScreenFocused = useIsFocused();
  const toggleLike = useToggleLike();
  const toggleSave = useToggleSave();
  const toggleFollow = useToggleFollow();
  const [booked, setBooked] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(globalMuted);
  const [infoOpen, setInfoOpen] = useState<boolean>(false);
  const [enquireOpen, setEnquireOpen] = useState<boolean>(false);
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

  const shouldPlay = isActive && isScreenFocused && viewMode === 'guest';

  useEffect(() => {
    if (!videoUrl) return;
    if (shouldPlay) {
      setMuted(globalMuted);
      player.muted = globalMuted;
      player.play();
    } else {
      player.pause();
    }
  }, [shouldPlay, player, videoUrl]);

  const toggleMute = () => {
    const next = !muted;
    globalMuted = next;
    player.muted = next;
    setMuted(next);
  };

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
  const rating = Number((meta.rating as number | string | undefined) ?? 5.0);
  const hostName = reel.host?.full_name ?? 'Zuru Host';
  const avatarUrl =
    (reel.host?.metadata as { avatar_url?: string } | null)?.avatar_url ?? null;

  const priceAmount = exp?.current_price;
  const priceUnit = exp?.price_unit ?? 'person';
  const bookedOut = exp?.availability_status === 'booked_out';

  const baseBottom = Math.max(16, insets.bottom + 12);
  const railBottom = baseBottom + 120;

  const requireAuth = (): boolean => {
    if (!user) {
      router.push('/auth');
      return false;
    }
    return true;
  };

  const onLike = () => {
    if (!requireAuth() || !user) return;
    toggleLike.mutate({
      reelId: reel.id,
      userId: user.id,
      liked: inter?.liked ?? false,
    });
  };

  const onSave = () => {
    if (!requireAuth() || !user) return;
    toggleSave.mutate({
      reelId: reel.id,
      userId: user.id,
      saved: inter?.saved ?? false,
    });
  };

  const onFollow = () => {
    if (!requireAuth() || !user) return;
    if (!hostId || hostId === user.id) return;
    toggleFollow.mutate({
      reelId: reel.id,
      hostId,
      userId: user.id,
      following: inter?.following ?? false,
    });
  };

  const onShare = async () => {
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

  const onEnquire = () => {
    if (!requireAuth()) return;
    if (!hostId) {
      Alert.alert('Host unavailable', 'This reel has no host to message.');
      return;
    }
    if (hostId === user?.id) {
      Alert.alert('This is your reel', 'You cannot enquire on your own listing.');
      return;
    }
    setEnquireOpen(true);
  };

  const onBook = () => {
    if (bookedOut || !exp?.id) return;
    setBookingOpen(true);
  };

  const liked = inter?.liked ?? false;
  const saved = inter?.saved ?? false;
  const following = inter?.following ?? false;
  const likeCount = inter?.likeCount ?? 0;

  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  const handleTouchStart = (e: any) => {
    touchStartX.current = e.nativeEvent.pageX ?? e.nativeEvent.locationX ?? 0;
    touchStartY.current = e.nativeEvent.pageY ?? e.nativeEvent.locationY ?? 0;
  };

  const handleTouchEnd = (e: any) => {
    const endX = e.nativeEvent.pageX ?? e.nativeEvent.locationX ?? 0;
    const endY = e.nativeEvent.pageY ?? e.nativeEvent.locationY ?? 0;
    const deltaX = endX - touchStartX.current;
    const deltaY = endY - touchStartY.current;

    if (deltaX >= 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (hostId) {
        router.push(`/profile/${hostId}` as any);
      }
    }
  };

  return (
    <View style={[styles.page, { height }]}>
      {/* Full-bleed video / thumbnail */}
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

      {/* 1. Dual-Gradient Overlay Scrim for Legibility (Bottom 260px) */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.5, 1]}
        style={styles.bottomGradientScrim}
        pointerEvents="none"
      />

      {/* Tap to unmute / play-pause overlay & Swipe Right gesture listener */}
      <Pressable
        testID={`video-tap-${reel.id}`}
        onPress={onVideoTap}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={StyleSheet.absoluteFill}
      >
        {videoUrl && !isPlaying ? (
          <View pointerEvents="none" style={styles.playOverlay}>
            <View style={styles.playCircle}>
              <MaterialCommunityIcons name="play" size={46} color="#FFFFFF" />
            </View>
          </View>
        ) : null}
      </Pressable>

      {/* 3. Streamlined Right Action Rail (Vertical Column) */}
      <View style={[styles.rail, { bottom: railBottom }]}>
        {/* Host Avatar with Online Green Dot -> Opens Host Profile */}
        <Pressable
          testID={`host-avatar-${reel.id}`}
          onPress={() => {
            if (hostId) {
              router.push(`/profile/${hostId}` as any);
            }
          }}
          style={styles.avatarWrap}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>
                {hostName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.onlineDot} />
          {!following && hostId && hostId !== user?.id ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onFollow();
              }}
              style={styles.plusBadge}
            >
              <Feather name="plus" size={10} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </Pressable>

        {/* Heart / Like Count */}
        <Pressable
          testID={`like-button-${reel.id}`}
          onPress={onLike}
          hitSlop={6}
          style={styles.railItem}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={28}
            color={liked ? '#EF4444' : '#FFFFFF'}
          />
          {likeCount > 0 ? (
            <Text style={styles.railCountText}>{formatCount(likeCount)}</Text>
          ) : null}
        </Pressable>

        {/* Wishlist / Bookmark */}
        <Pressable
          testID={`save-button-${reel.id}`}
          onPress={onSave}
          hitSlop={6}
          style={styles.railItem}
        >
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={26}
            color={saved ? '#EE7D30' : '#FFFFFF'}
          />
        </Pressable>

        {/* Share Button */}
        <Pressable onPress={onShare} hitSlop={6} style={styles.railItem}>
          <Feather name="share-2" size={24} color="#FFFFFF" />
        </Pressable>

        {/* Info Button */}
        <Pressable
          testID={`info-button-${reel.id}`}
          onPress={() => setInfoOpen(true)}
          hitSlop={6}
          style={styles.railItem}
        >
          <Feather name="info" size={24} color="#FFFFFF" />
        </Pressable>

        {/* Mute/Audio Toggle */}
        <Pressable
          testID={`sound-button-${reel.id}`}
          onPress={() => {
            toggleMute();
          }}
          hitSlop={6}
          style={styles.railItem}
        >
          <View style={styles.soundCircle}>
            <Feather
              name={muted ? 'volume-x' : 'volume-2'}
              size={18}
              color="#FFFFFF"
            />
          </View>
        </Pressable>
      </View>

      {/* 4. Bottom Information Stack & 5. Action Dock */}
      <View style={[styles.bottomOverlay, { bottom: baseBottom }]}>
        {/* Category Glass Pill */}
        {reel.category ? (
          <View style={styles.categoryGlassPill}>
            <Text style={styles.categoryGlassText}>
              {(reel.category ?? 'Reel').toUpperCase().replace(/_/g, ' ')}
            </Text>
          </View>
        ) : null}

        {/* Title & Rating Row */}
        <View style={styles.titleRatingRow}>
          <Text style={styles.titleText} numberOfLines={1}>
            {exp?.title ?? 'Coastal Experience'}
          </Text>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={13} color="#FFD166" />
            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
          </View>
        </View>

        {/* Location Row */}
        <View style={styles.locationRow}>
          <Feather name="map-pin" size={12} color="rgba(255,255,255,0.85)" />
          <Text style={styles.locationText} numberOfLines={1}>
            {exp?.location ?? 'Kenyan Coast'}
          </Text>
        </View>

        {/* Price Row */}
        {priceAmount != null ? (
          <Text style={styles.priceText}>
            KES {Number(priceAmount).toLocaleString()}
            <Text style={styles.priceUnitText}> / {priceUnit}</Text>
          </Text>
        ) : null}

        {/* Zuru AI Concierge Prompt Badge → opens new Zuru AI chat */}
        <Pressable
          testID={`zuru-agent-${reel.id}`}
          onPress={() => {
            const prompt = exp?.title
              ? `Tell me about "${exp.title}"${
                  exp.location ? ` in ${exp.location}` : ''
                } — is it worth booking?`
              : 'What can you tell me about this experience?';
            router.push({ pathname: '/ai/chat' as any, params: { initialPrompt: prompt } });
          }}
          style={({ pressed }) => [
            styles.aiPromptPill,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <MaterialCommunityIcons name="creation" size={15} color="#FFFFFF" />
          <Text style={styles.aiPromptText}>✨ Ask Zuru AI Assistant</Text>
        </Pressable>

        {/* 5. Bottom Action Dock (Primary Dual Buttons) */}
        <View style={styles.actionDockRow}>
          {exp?.id ? (
            <Pressable
              testID={`book-button-${reel.id}`}
              onPress={onBook}
              disabled={bookedOut}
              style={({ pressed }) => [
                styles.primaryBookBtn,
                {
                  backgroundColor: bookedOut
                    ? 'rgba(82,76,70,0.85)'
                    : booked
                    ? '#008A05'
                    : '#EE7D30',
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.primaryBookBtnText,
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
            style={({ pressed }) => [
              styles.secondaryGlassBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={styles.secondaryGlassBtnText}>Enquire</Text>
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

      <EnquireModal
        visible={enquireOpen}
        onClose={() => setEnquireOpen(false)}
        hostId={hostId ?? ''}
        hostName={hostName}
        hostAvatarUrl={avatarUrl}
        experienceTitle={exp?.title ?? null}
        experienceLocation={exp?.location ?? null}
        experiencePrice={priceAmount != null ? Number(priceAmount) : null}
        experiencePriceUnit={priceUnit}
        reelThumbnailUrl={reel.thumbnail_url ?? null}
      />
      {/* ZuruAgentChat removed — AI pill navigates to /ai/chat */}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    backgroundColor: '#000000',
  },
  bottomGradientScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 280,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rail: {
    position: 'absolute',
    right: 14,
    alignItems: 'center',
    gap: 18,
    zIndex: 20,
  },
  railItem: {
    alignItems: 'center',
    gap: 3,
  },
  railCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  avatarWrap: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#008A05',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  plusBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EE7D30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 16,
    right: 70,
    gap: 6,
    zIndex: 15,
  },
  categoryGlassPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryGlassText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.4,
  },
  titleRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.3,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
  },
  priceText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
  },
  priceUnitText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
  },
  aiPromptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginVertical: 4,
  },
  aiPromptText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
  },
  actionDockRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryBookBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBookBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  secondaryGlassBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryGlassBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
