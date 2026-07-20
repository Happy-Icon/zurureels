import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
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
import { useCreateBooking } from '@/lib/queries';
import { useColors } from '@/hooks/useColors';
import type { ReelRow } from '@/lib/supabase';

interface ReelCardProps {
  reel: ReelRow;
  isActive: boolean;
  height: number;
  tabBarHeight: number;
}

export function ReelCard({ reel, isActive, height, tabBarHeight }: ReelCardProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const createBooking = useCreateBooking();
  const [booked, setBooked] = useState<boolean>(false);

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

  const price = useMemo(() => {
    const amount = reel.experience?.current_price;
    if (amount == null) return null;
    const unit = reel.experience?.price_unit ?? '';
    return `KSh ${Number(amount).toLocaleString()}${unit ? ` / ${unit}` : ''}`;
  }, [reel.experience]);

  const onBook = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!user) {
      router.push('/auth');
      return;
    }
    if (!reel.experience?.id || booked || createBooking.isPending) return;
    try {
      await createBooking.mutateAsync({
        userId: user.id,
        experienceId: reel.experience.id,
        reelId: reel.id,
        amount: reel.experience.current_price ?? null,
        guests: 1,
      });
      setBooked(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { height }]}>
      {videoUrl ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      ) : reel.thumbnail_url ? (
        <Image
          source={{ uri: reel.thumbnail_url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1c1a17' }]} />
      )}

      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent', 'transparent', 'rgba(0,0,0,0.75)']}
        locations={[0, 0.25, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {reel.category ? (
        <View style={[styles.categoryPill, { top: topInset + 12 }]}>
          <Text style={styles.categoryText}>{reel.category}</Text>
        </View>
      ) : null}

      <View
        style={[
          styles.bottomOverlay,
          { paddingBottom: tabBarHeight + 16 },
        ]}
      >
        <View style={styles.infoColumn}>
          <View style={styles.hostRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {(reel.host?.full_name ?? 'Z').charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.hostName} numberOfLines={1}>
              {reel.host?.full_name ?? 'ZuruSasa host'}
            </Text>
            {reel.host?.verification_status === 'verified' ? (
              <MaterialCommunityIcons
                name="check-decagram"
                size={16}
                color={colors.primary}
              />
            ) : null}
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {reel.experience?.title ?? 'Coastal experience'}
          </Text>
          {reel.experience?.location ? (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={13} color="#f4f2f1" />
              <Text style={styles.location} numberOfLines={1}>
                {reel.experience.location}
              </Text>
            </View>
          ) : null}
          {price ? <Text style={styles.price}>{price}</Text> : null}
        </View>

        {reel.experience?.id ? (
          <Pressable
            testID={`book-button-${reel.id}`}
            onPress={onBook}
            disabled={booked || createBooking.isPending}
            style={({ pressed }) => [
              styles.bookButton,
              {
                backgroundColor: booked ? '#2e7d32' : colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {createBooking.isPending ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Feather
                  name={booked ? 'check' : 'calendar'}
                  size={16}
                  color="#ffffff"
                />
                <Text style={styles.bookText}>{booked ? 'Requested' : 'Book'}</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#000000',
  },
  categoryPill: {
    position: 'absolute',
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  categoryText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    textTransform: 'capitalize',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    gap: 12,
  },
  infoColumn: {
    flex: 1,
    gap: 6,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
  },
  hostName: {
    color: '#f4f2f1',
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    maxWidth: 180,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 28,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    color: '#e8e5e3',
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
  },
  price: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 96,
    justifyContent: 'center',
  },
  bookText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
});
