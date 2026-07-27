import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { HostProfileData } from '@/lib/supabase';

interface HostHeaderProps {
  host: HostProfileData;
}

export function HostHeader({ host }: HostHeaderProps) {
  const initials = host.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <View style={styles.container}>
      {/* Avatar & Badges Row */}
      <View style={styles.avatarWrap}>
        {host.avatar_url ? (
          <Image
            source={{ uri: host.avatar_url }}
            style={styles.avatarImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.initialsText}>{initials}</Text>
          </View>
        )}

        {host.is_verified ? (
          <View style={styles.verifiedBadge}>
            <Feather name="check" size={12} color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      {/* Host Name & Badges */}
      <View style={styles.titleGroup}>
        <View style={styles.nameRow}>
          <Text style={styles.hostName}>{host.full_name}</Text>
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
            <Feather name="map-pin" size={14} color="#717171" />
            <Text style={styles.metaText}>{host.location}</Text>
          </View>
        ) : null}

        {host.joined_date ? (
          <View style={styles.metaRow}>
            <Feather name="calendar" size={14} color="#717171" />
            <Text style={styles.metaText}>{host.joined_date}</Text>
          </View>
        ) : null}

        {host.response_rate || host.response_time ? (
          <View style={styles.metaRow}>
            <Feather name="clock" size={14} color="#717171" />
            <Text style={styles.metaText}>
              {host.response_rate ? `${host.response_rate} response rate` : ''}
              {host.response_rate && host.response_time ? ' · ' : ''}
              {host.response_time ? `Responds ${host.response_time}` : ''}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
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
    color: '#222222',
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
    color: '#717171',
  },
});
