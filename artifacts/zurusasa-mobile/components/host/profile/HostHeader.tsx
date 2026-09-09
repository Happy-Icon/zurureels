import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { HostProfileData } from '@/lib/supabase';
import { useColors, useTheme } from '@/hooks/useColors';

interface HostHeaderProps {
  host: HostProfileData;
  isFollowing?: boolean;
  onToggleFollow?: () => void;
  isOwnProfile?: boolean;
}

export function HostHeader({
  host,
  isFollowing = false,
  onToggleFollow,
  isOwnProfile = false,
}: HostHeaderProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const [avatarError, setAvatarError] = React.useState(false);

  React.useEffect(() => {
    setAvatarError(false);
  }, [host.avatar_url]);

  const initials = host.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const hasValidAvatar = Boolean(
    host.avatar_url &&
    !avatarError &&
    !host.avatar_url.startsWith('file://')
  );

  return (
    <View style={styles.container}>
      {/* Avatar & Badges Row */}
      <View style={styles.avatarWrap}>
        {hasValidAvatar ? (
          <Image
            source={{ uri: host.avatar_url! }}
            style={[styles.avatarImage, { borderColor: colors.card }]}
            contentFit="cover"
            transition={200}
            onError={() => setAvatarError(true)}
          />
        ) : (
          <View style={[styles.avatarFallback, { borderColor: colors.card }]}>
            <Text style={styles.initialsText}>{initials}</Text>
          </View>
        )}

        {host.is_verified ? (
          <View style={[styles.verifiedBadge, { borderColor: colors.card }]}>
            <Feather name="check" size={12} color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      {/* Host Name & Badges */}
      <View style={styles.titleGroup}>
        <View style={styles.nameRow}>
          <Text style={[styles.hostName, { color: colors.text }]}>{host.full_name}</Text>
        </View>

        {host.is_super_host ? (
          <View style={styles.superHostPill}>
            <Ionicons name="star" size={12} color="#F26522" />
            <Text style={styles.superHostText}>Super Host</Text>
          </View>
        ) : null}
      </View>

      {/* Meta Information */}
      <View style={styles.metaStack}>
        {host.location ? (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={14} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{host.location}</Text>
          </View>
        ) : null}

        {host.joined_date ? (
          <View style={styles.metaRow}>
            <Feather name="calendar" size={14} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{host.joined_date}</Text>
          </View>
        ) : null}

        {host.response_rate || host.response_time ? (
          <View style={styles.metaRow}>
            <Feather name="clock" size={14} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {host.response_rate ? `${host.response_rate} response rate` : ''}
              {host.response_rate && host.response_time ? ' · ' : ''}
              {host.response_time ? `Responds ${host.response_time}` : ''}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Elegant Follow Action Button */}
      {!isOwnProfile && onToggleFollow ? (
        <Pressable
          testID="host-profile-follow-btn"
          onPress={onToggleFollow}
          style={({ pressed }) => [
            styles.followButton,
            isFollowing
              ? [
                  styles.followingButton,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F4F4F5',
                    borderColor: isDark ? 'rgba(255,255,255,0.18)' : '#E4E4E7',
                  },
                ]
              : styles.notFollowingButton,
            {
              transform: [{ scale: pressed ? 0.96 : 1 }],
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Feather
            name={isFollowing ? 'check' : 'user-plus'}
            size={16}
            color={isFollowing ? colors.text : '#FFFFFF'}
          />
          <Text
            style={[
              styles.followButtonText,
              isFollowing
                ? [styles.followingButtonText, { color: colors.text }]
                : styles.notFollowingButtonText,
            ]}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 14,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#F7F7F7',
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  initialsText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontFamily: 'DMSans_700Bold',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  titleGroup: {
    alignItems: 'center',
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hostName: {
    fontSize: 26,
    fontFamily: 'DMSans_700Bold',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  superHostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(242, 101, 34, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  superHostText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  metaStack: {
    alignItems: 'center',
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 28,
    height: 42,
    borderRadius: 21,
    marginTop: 2,
    minWidth: 140,
  },
  notFollowingButton: {
    backgroundColor: '#F26522',
    shadowColor: '#F26522',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  followingButton: {
    borderWidth: 1.5,
  },
  followButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.2,
  },
  notFollowingButtonText: {
    color: '#FFFFFF',
  },
  followingButtonText: {},
});
