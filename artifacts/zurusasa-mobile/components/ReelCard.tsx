import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { useRouter, useIsFocused } from 'expo-router';
import { useEvent } from 'expo';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuth } from '@/context/AuthContext';
import { resolveAvatarUrl } from '@/lib/avatar';
import {
  useReelInteractions,
  useToggleFollow,
  useToggleLike,
  useToggleSave,
  type ReelInteractions,
} from '@/lib/queries';
import { BookingSheet } from '@/components/BookingSheet';
import { EnquireModal } from '@/components/EnquireModal';
import { supabase, type ReelRow } from '@/lib/supabase';

export const ZURU_ORANGE = '#EE7D30';

let globalMuted = true;

interface ActiveReelPlayerProps {
  videoUrl: string;
  shouldPlay: boolean;
  muted: boolean;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
}

function ActiveReelPlayer({
  videoUrl,
  shouldPlay,
  muted,
  isPlaying,
  setIsPlaying,
}: ActiveReelPlayerProps) {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = muted;
  });

  const eventState = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });

  useEffect(() => {
    if (isMountedRef.current) {
      setIsPlaying(eventState.isPlaying);
    }
  }, [eventState.isPlaying, setIsPlaying]);

  useEffect(() => {
    if (!videoUrl) return;
    try {
      player.muted = muted;
      if (shouldPlay) {
        player.play();
      } else {
        player.pause();
      }
    } catch (err) {
      console.warn('[ActiveReelPlayer] Playback toggle error:', err);
    }

    return () => {
      try {
        player.pause();
      } catch {
        // Player disposed safely
      }
    };
  }, [shouldPlay, muted, player, videoUrl]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      surfaceType="textureView"
    />
  );
}


function formatCount(n: number): string {
  if (n > 999) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

interface ReelCardProps {
  reel: ReelRow;
  isActive: boolean;
  height: number;
  prefetchInteractions?: ReelInteractions;
}


function getOptimizedCloudinaryVideoUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('f_auto')) {
    return url.replace('/upload/', '/upload/f_auto,q_auto,w_720/');
  }
  return url;
}

function getOptimizedCloudinaryImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('f_auto')) {
    return url.replace('/upload/', '/upload/f_auto,q_auto,w_600/');
  }
  return url;
}

function ReelCardComponent({ reel, isActive, height, prefetchInteractions }: ReelCardProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, viewMode } = useAuth();
  const isScreenFocused = useIsFocused();
  const toggleLike = useToggleLike();
  const toggleSave = useToggleSave();
  const toggleFollow = useToggleFollow();
  const [booked, setBooked] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(globalMuted);
  const [enquireOpen, setEnquireOpen] = useState<boolean>(false);
  const [bookingOpen, setBookingOpen] = useState<boolean>(false);

  const hostId = reel.user_id ?? reel.host?.id ?? null;
  const { data: interFallback } = useReelInteractions(
    reel.id,
    hostId,
    user?.id,
    isActive && !prefetchInteractions,
  );
  const inter = prefetchInteractions ?? interFallback;

  const videoUrl = useMemo(() => getOptimizedCloudinaryVideoUrl(reel.video_url), [reel.video_url]);
  const thumbnailUrl = useMemo(() => getOptimizedCloudinaryImageUrl(reel.thumbnail_url), [reel.thumbnail_url]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  useEffect(() => {
    if (!isActive) setUserPaused(false);
  }, [isActive]);

  const isAnyModalOpen = enquireOpen || bookingOpen;
  const shouldPlay = isActive && isScreenFocused && viewMode === 'guest' && !isAnyModalOpen && !userPaused;

  const toggleMute = () => {
    Haptics.selectionAsync().catch(() => {});
    const next = !muted;
    globalMuted = next;
    setMuted(next);
  };

  // Instant local optimistic state for 0ms response latency
  const [localLiked, setLocalLiked] = useState<boolean | null>(null);
  const [localSaved, setLocalSaved] = useState<boolean | null>(null);
  const [localLikeCount, setLocalLikeCount] = useState<number | null>(null);

  useEffect(() => {
    if (inter) {
      setLocalLiked(inter.liked);
      setLocalSaved(inter.saved);
      setLocalLikeCount(inter.likeCount);
    }
  }, [inter?.liked, inter?.saved, inter?.likeCount]);

  const liked = localLiked !== null ? localLiked : (inter?.liked ?? false);
  const saved = localSaved !== null ? localSaved : (inter?.saved ?? false);
  const likeCount = localLikeCount !== null ? localLikeCount : (inter?.likeCount ?? 0);
  const following = inter?.following ?? false;

  // Double-tap and button spring animations
  const lastTapTimeRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showBurstHeart, setShowBurstHeart] = useState(false);
  const burstAnimScale = useRef(new Animated.Value(0)).current;
  const burstAnimOpacity = useRef(new Animated.Value(0)).current;
  const burstAnimY = useRef(new Animated.Value(0)).current;

  const likeScale = useRef(new Animated.Value(1)).current;
  const saveScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
    };
  }, []);

  const triggerBurstHeart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setShowBurstHeart(true);
    burstAnimScale.setValue(0);
    burstAnimOpacity.setValue(1);
    burstAnimY.setValue(0);

    Animated.parallel([
      Animated.spring(burstAnimScale, {
        toValue: 1.25,
        friction: 4,
        tension: 110,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(burstAnimOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(burstAnimY, {
            toValue: -35,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start(() => {
      setShowBurstHeart(false);
    });
  };

  const handleDoubleTap = () => {
    if (!videoUrl) return;
    triggerBurstHeart();

    if (!liked) {
      if (!requireAuth() || !user) return;
      Animated.sequence([
        Animated.timing(likeScale, { toValue: 1.35, duration: 100, useNativeDriver: true }),
        Animated.spring(likeScale, { toValue: 1, friction: 3, useNativeDriver: true }),
      ]).start();

      setLocalLiked(true);
      setLocalLikeCount((prev) => (prev ?? likeCount) + 1);

      toggleLike.mutate({
        reelId: reel.id,
        userId: user.id,
        liked: false,
      });
    }
  };

  const handleSingleTap = () => {
    if (!videoUrl) return;
    if (muted) {
      toggleMute();
      setUserPaused(false);
    } else {
      setUserPaused((prev) => !prev);
    }
  };

  const doubleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(280)
        .runOnJS(true)
        .onEnd(() => {
          handleDoubleTap();
        }),
    [videoUrl, liked, user, likeCount, reel.id]
  );

  const singleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(1)
        .runOnJS(true)
        .onEnd(() => {
          handleSingleTap();
        }),
    [videoUrl, muted]
  );

  const tapGestures = useMemo(
    () => Gesture.Exclusive(doubleTapGesture, singleTapGesture),
    [doubleTapGesture, singleTapGesture]
  );

  const exp = reel.experience;
  const meta = (exp?.metadata ?? {}) as Record<string, unknown>;
  const rawRating = (meta.rating as number | string | undefined);
  const rating = rawRating != null && Number(rawRating) > 0 ? Number(rawRating) : null;
  const hostName = reel.host?.full_name ?? 'Zuru Host';
  const initialAvatar =
    reel.host?.avatar_url ||
    resolveAvatarUrl(
      reel.host
        ? {
            ...reel.host,
            id: hostId ?? undefined,
            email: reel.host.email,
            avatar_url: reel.host.avatar_url,
          }
        : (hostId ? { id: hostId } : null),
      user,
      profile
    );

  const [lazyAvatar, setLazyAvatar] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!initialAvatar && !lazyAvatar && hostId) {
      (async () => {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email, metadata')
            .eq('id', hostId)
            .maybeSingle();
          if (active && data) {
            const resolved = resolveAvatarUrl(
              { ...reel.host, ...data, id: hostId },
              user,
              profile
            );
            if (resolved) {
              setLazyAvatar(resolved);
            }
          }
        } catch {
          // ignore
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [initialAvatar, lazyAvatar, hostId, reel.host, user, profile]);

  const finalAvatarUrl = initialAvatar || lazyAvatar;
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [finalAvatarUrl]);

  const priceAmount = exp?.current_price;
  const priceUnit = exp?.price_unit ?? 'person';
  const bookedOut = exp?.availability_status === 'booked_out';

  const baseBottom = Math.max(80, insets.bottom + 76);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    Animated.sequence([
      Animated.timing(likeScale, { toValue: 1.35, duration: 100, useNativeDriver: true }),
      Animated.spring(likeScale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();

    const nextLiked = !liked;
    setLocalLiked(nextLiked);
    setLocalLikeCount(Math.max(0, likeCount + (nextLiked ? 1 : -1)));

    toggleLike.mutate({
      reelId: reel.id,
      userId: user.id,
      liked: liked,
    });
  };

  const onSave = () => {
    if (!requireAuth() || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    Animated.sequence([
      Animated.timing(saveScale, { toValue: 1.35, duration: 100, useNativeDriver: true }),
      Animated.spring(saveScale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();

    const nextSaved = !saved;
    setLocalSaved(nextSaved);

    toggleSave.mutate({
      reelId: reel.id,
      userId: user.id,
      saved: saved,
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
    Haptics.selectionAsync().catch(() => {});
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

  return (
    <View style={[styles.page, { height }]}>
      {/* Full-bleed video / thumbnail */}
      {thumbnailUrl ? (
        <Image
          source={{ uri: thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : null}
      {isActive && videoUrl ? (
        <ActiveReelPlayer
          videoUrl={videoUrl}
          shouldPlay={shouldPlay}
          muted={muted}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
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

      {/* Tap to unmute / play-pause overlay with native gesture handler */}
      <GestureDetector gesture={tapGestures}>
        <View
          testID={`video-tap-${reel.id}`}
          style={StyleSheet.absoluteFill}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Double tap to like reel, single tap to pause' : 'Tap to play video'}
        >
          {videoUrl && !isPlaying ? (
            <View pointerEvents="none" style={styles.playOverlay}>
              <View style={styles.playCircle}>
                <MaterialCommunityIcons name="play" size={46} color="#FFFFFF" />
              </View>
            </View>
          ) : null}
        </View>
      </GestureDetector>

      {/* TikTok-style Center Bursting Heart on Double-Tap */}
      {showBurstHeart ? (
        <View pointerEvents="none" style={styles.centerBurstWrap}>
          <Animated.View
            style={[
              styles.burstHeartContainer,
              {
                transform: [
                  { scale: burstAnimScale },
                  { translateY: burstAnimY },
                  { rotate: '-12deg' },
                ],
                opacity: burstAnimOpacity,
              },
            ]}
          >
            <Ionicons name="heart" size={105} color="#EF4444" style={styles.burstHeartShadow} />
          </Animated.View>
        </View>
      ) : null}

      {/* 3. Streamlined Right Action Rail (Vertical Column) */}
      <View style={[styles.rail, { bottom: railBottom }]}>
        {/* Host Avatar with Online Green Dot -> Opens Host Profile */}
        <Pressable
          testID={`host-avatar-${reel.id}`}
          accessibilityRole="button"
          accessibilityLabel={`View ${hostName}'s host profile`}
          onPress={() => {
            if (hostId) {
              router.push(`/profile/${hostId}` as any);
            }
          }}
          style={styles.avatarWrap}
        >
          {finalAvatarUrl && !avatarError ? (
            <Image
              source={{ uri: finalAvatarUrl }}
              style={styles.avatar}
              contentFit="cover"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>
                {hostName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </Pressable>

        {/* Heart / Like Count */}
        <Pressable
          testID={`like-button-${reel.id}`}
          accessibilityRole="button"
          accessibilityLabel={liked ? `Unlike, ${likeCount} likes` : `Like, ${likeCount} likes`}
          onPress={onLike}
          hitSlop={8}
          style={styles.railItem}
        >
          <Animated.View style={{ transform: [{ scale: likeScale }], alignItems: 'center' }}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={28}
              color={liked ? '#EF4444' : '#FFFFFF'}
            />
          </Animated.View>
          {likeCount > 0 ? (
            <Text style={styles.railCountText}>{formatCount(likeCount)}</Text>
          ) : null}
        </Pressable>

        {/* Wishlist / Bookmark */}
        <Pressable
          testID={`save-button-${reel.id}`}
          accessibilityRole="button"
          accessibilityLabel={saved ? "Remove from saved experiences" : "Save experience"}
          onPress={onSave}
          hitSlop={8}
          style={styles.railItem}
        >
          <Animated.View style={{ transform: [{ scale: saveScale }] }}>
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={26}
              color={saved ? '#EE7D30' : '#FFFFFF'}
            />
          </Animated.View>
        </Pressable>

        {/* Share Button */}
        <Pressable onPress={onShare} hitSlop={6} style={styles.railItem} accessibilityRole="button" accessibilityLabel="Share experience">
          <Feather name="share-2" size={24} color="#FFFFFF" />
        </Pressable>

        {/* Info Button */}
        <Pressable
          testID={`info-button-${reel.id}`}
          accessibilityRole="button"
          accessibilityLabel="View experience details and booking"
          onPress={() => {
            setBookingOpen(true);
          }}
          hitSlop={6}
          style={styles.railItem}
        >
          <Feather name="info" size={24} color="#FFFFFF" />
        </Pressable>

        {/* Mute/Audio Toggle */}
        <Pressable
          testID={`sound-button-${reel.id}`}
          accessibilityRole="button"
          accessibilityLabel={muted ? "Unmute audio" : "Mute audio"}
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
        {/* Zuru Agent Concierge Prompt Badge → opens new Zuru Agent chat */}
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
          <Text style={styles.aiPromptText}>✨ Ask Zuru Agent</Text>
        </Pressable>

        <Pressable
          testID={`listing-details-${reel.id}`}
          onPress={() => {
            setBookingOpen(true);
          }}
          style={{ gap: 4 }}
        >
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
              <Text style={styles.ratingText}>{rating != null ? rating.toFixed(1) : 'New'}</Text>
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

      <BookingSheet
        reel={reel}
        visible={bookingOpen}
        initialStep="details"
        onClose={() => setBookingOpen(false)}
        onSuccess={() => setBooked(true)}
      />

      <EnquireModal
        visible={enquireOpen}
        onClose={() => setEnquireOpen(false)}
        hostId={hostId ?? ''}
        hostName={hostName}
        hostAvatarUrl={finalAvatarUrl}
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


export const ReelCard = React.memo(
  ReelCardComponent,
  (prev, next) =>
    prev.isActive === next.isActive &&
    prev.height === next.height &&
    prev.reel.id === next.reel.id &&
    prev.prefetchInteractions?.liked === next.prefetchInteractions?.liked &&
    prev.prefetchInteractions?.saved === next.prefetchInteractions?.saved &&
    prev.prefetchInteractions?.likeCount === next.prefetchInteractions?.likeCount &&
    prev.prefetchInteractions?.following === next.prefetchInteractions?.following
);

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
    ...StyleSheet.absoluteFill,
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
  centerBurstWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 25,
  },
  burstHeartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  burstHeartShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
});
