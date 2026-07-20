import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import {
  useCreateBooking,
  useEnquire,
  useReelInteractions,
  useToggleFollow,
  useToggleLike,
  useToggleSave,
} from '@/lib/queries';
import { getReelExpiry } from '@/lib/reelExpiry';
import { ReelInfoSheet } from '@/components/ReelInfoSheet';
import type { ReelRow } from '@/lib/supabase';

export const RAIL_WIDTH = 78;
export const ZURU_ORANGE = '#EE7D30';

const CATEGORY_COLORS: Record<string, string> = {
  rentals: '#0d9488',
  stays: '#0d9488',
  villa: '#0d9488',
  food: '#f97316',
  adventure: '#7c3aed',
  culture: '#db2777',
  water: '#0284c7',
  boats: '#0284c7',
  parks_camps: '#16a34a',
};

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

interface ReelCardProps {
  reel: ReelRow;
  isActive: boolean;
  height: number;
  tabBarHeight: number;
  index: number;
  count: number;
  onScrollToIndex: (index: number) => void;
}

export function ReelCard({
  reel,
  isActive,
  height,
  tabBarHeight,
  index,
  count,
  onScrollToIndex,
}: ReelCardProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const createBooking = useCreateBooking();
  const enquire = useEnquire();
  const toggleLike = useToggleLike();
  const toggleSave = useToggleSave();
  const toggleFollow = useToggleFollow();
  const [booked, setBooked] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(Platform.OS === 'web');
  const [infoOpen, setInfoOpen] = useState<boolean>(false);

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
    p.muted = Platform.OS === 'web';
  });

  useEffect(() => {
    if (!videoUrl) return;
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player, videoUrl]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  const exp = reel.experience;
  const meta = (exp?.metadata ?? {}) as Record<string, unknown>;
  const rating = Number((meta.rating as number | string | undefined) ?? 5);
  const isAgent =
    reel.host?.verification_status === 'verified' || meta.verified === true;
  const expiry = getReelExpiry(reel.created_at);
  const hostName = reel.host?.full_name ?? 'ZuruSasa host';
  const avatarUrl =
    (reel.host?.metadata as { avatar_url?: string } | null)?.avatar_url ?? null;
  const categoryColor = reel.category
    ? (CATEGORY_COLORS[reel.category.toLowerCase()] ?? '#0d9488')
    : '#0d9488';

  const priceAmount = exp?.current_price;
  const priceUnit = exp?.price_unit ?? 'person';

  const topInset = Platform.OS === 'web' ? 14 : insets.top;
  const bottomGap = tabBarHeight + (insets.bottom > 0 ? insets.bottom : 8);

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

  const onBook = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!requireAuth() || !user) return;
    if (!exp?.id || booked || createBooking.isPending) return;
    try {
      await createBooking.mutateAsync({
        userId: user.id,
        experienceId: exp.id,
        reelId: reel.id,
        amount: exp.current_price ?? null,
        guests: 1,
      });
      setBooked(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const liked = inter?.liked ?? false;
  const saved = inter?.saved ?? false;
  const following = inter?.following ?? false;
  const likeCount = inter?.likeCount ?? 0;

  return (
    <View style={[styles.page, { height }]}>
      {/* Video card */}
      <View
        style={[
          styles.videoCard,
          { marginTop: topInset, marginBottom: bottomGap },
        ]}
      >
        {videoUrl ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            surfaceType="textureView"
          />
        ) : reel.thumbnail_url ? (
          <Image
            source={{ uri: reel.thumbnail_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: '#1c1a17' }]}
          />
        )}

        <LinearGradient
          colors={[
            'rgba(0,0,0,0.45)',
            'transparent',
            'transparent',
            'rgba(0,0,0,0.8)',
          ]}
          locations={[0, 0.22, 0.5, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Bottom info overlay */}
        <View style={styles.bottomOverlay}>
          {isAgent ? (
            <View style={styles.agentPill}>
              <MaterialCommunityIcons name="creation" size={14} color="#fff" />
              <Text style={styles.agentPillText}>ZURU AGENT</Text>
            </View>
          ) : null}

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
                  size={12}
                  color={expiry.urgent ? '#fb923c' : 'rgba(255,255,255,0.75)'}
                />
                <Text
                  style={[
                    styles.expiryText,
                    {
                      color: expiry.urgent
                        ? '#fb923c'
                        : 'rgba(255,255,255,0.75)',
                    },
                  ]}
                >
                  {expiry.label.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.title} numberOfLines={2}>
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
            ) : (
              <View />
            )}
            <View style={styles.ratingRow}>
              <MaterialCommunityIcons name="star" size={16} color="#fbbf24" />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            {exp?.id ? (
              <Pressable
                testID={`book-button-${reel.id}`}
                onPress={onBook}
                disabled={booked || createBooking.isPending}
                style={({ pressed }) => [
                  styles.bookButton,
                  {
                    backgroundColor: booked ? '#2e7d32' : ZURU_ORANGE,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                {createBooking.isPending ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.bookText}>
                    {booked ? 'Requested ✓' : 'Book Now'}
                  </Text>
                )}
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
      </View>

      {/* Right action rail */}
      <View
        style={[
          styles.rail,
          { paddingTop: topInset + 44, paddingBottom: bottomGap + 18 },
        ]}
      >
        <Pressable
          onPress={() => onScrollToIndex(index - 1)}
          disabled={index === 0}
          hitSlop={6}
          style={({ pressed }) => [
            styles.chevronButton,
            { opacity: index === 0 ? 0.35 : pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="chevron-up" size={22} color="#ffffff" />
        </Pressable>

        <View style={styles.railGroup}>
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
              <View style={styles.followBadge}>
                <Feather
                  name={following ? 'check' : 'plus'}
                  size={12}
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
              <MaterialCommunityIcons name="heart" size={30} color="#f43f5e" />
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
                size={28}
                color={ZURU_ORANGE}
              />
            ) : (
              <Feather name="bookmark" size={25} color="#ffffff" />
            )}
            <Text style={styles.railLabel}>{saved ? 'SAVED' : 'SAVE'}</Text>
          </Pressable>

          <Pressable onPress={onShare} hitSlop={6} style={styles.railItem}>
            <Feather name="share-2" size={24} color="#ffffff" />
            <Text style={styles.railLabel}>SHARE</Text>
          </Pressable>

          <Pressable
            testID={`info-button-${reel.id}`}
            onPress={() => setInfoOpen(true)}
            hitSlop={6}
            style={styles.railItem}
          >
            <Feather name="info" size={24} color="#ffffff" />
            <Text style={styles.railLabel}>INFO</Text>
          </Pressable>

          <Pressable
            testID={`sound-button-${reel.id}`}
            onPress={() => {
              Haptics.selectionAsync();
              setMuted((m) => !m);
            }}
            hitSlop={6}
            style={styles.railItem}
          >
            <View
              style={[
                styles.soundCircle,
                {
                  backgroundColor: muted
                    ? 'rgba(255,255,255,0.14)'
                    : ZURU_ORANGE,
                },
              ]}
            >
              <Feather
                name={muted ? 'volume-x' : 'volume-2'}
                size={20}
                color="#ffffff"
              />
            </View>
            <Text style={styles.railLabel}>
              {muted ? 'MUTED' : 'SOUND ON'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => onScrollToIndex(index + 1)}
          disabled={index >= count - 1}
          hitSlop={6}
          style={({ pressed }) => [
            styles.chevronButton,
            { opacity: index >= count - 1 ? 0.35 : pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="chevron-down" size={22} color="#ffffff" />
        </Pressable>
      </View>

      <ReelInfoSheet
        reel={reel}
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#000000',
  },
  videoCard: {
    flex: 1,
    marginLeft: 8,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#0d0b09',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingBottom: 16,
    gap: 8,
  },
  agentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    backgroundColor: ZURU_ORANGE,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  agentPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  categoryText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    textTransform: 'capitalize',
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  expiryText: {
    fontSize: 10.5,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.6,
  },
  title: {
    color: '#ffffff',
    fontSize: 34,
    lineHeight: 38,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  location: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  price: {
    color: '#ffffff',
    fontSize: 19,
    fontFamily: 'DMSans_700Bold',
  },
  priceUnit: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  bookButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  enquireButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22,22,22,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  enquireText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chevronButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  railGroup: {
    alignItems: 'center',
    gap: 18,
  },
  railItem: {
    alignItems: 'center',
    gap: 4,
    minWidth: RAIL_WIDTH,
  },
  railLabel: {
    color: '#ffffff',
    fontSize: 9.5,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  avatarWrap: {
    width: 56,
    alignItems: 'center',
    marginBottom: 4,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
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
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
  },
  followBadge: {
    position: 'absolute',
    bottom: -7,
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: ZURU_ORANGE,
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
