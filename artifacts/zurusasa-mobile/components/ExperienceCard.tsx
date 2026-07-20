import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useColors';
import type { ExperienceRow } from '@/lib/supabase';

const FALLBACK = require('@/assets/images/reel-placeholder.jpg');

function metaImage(exp: ExperienceRow): string | null {
  const meta = exp.metadata;
  if (meta && typeof meta === 'object') {
    const candidates = [
      (meta as Record<string, unknown>)['image_url'],
      (meta as Record<string, unknown>)['cover_image'],
      (meta as Record<string, unknown>)['thumbnail'],
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.startsWith('http')) return c;
    }
  }
  return null;
}

export function ExperienceCard({
  experience,
  onPress,
}: {
  experience: ExperienceRow;
  onPress?: () => void;
}) {
  const colors = useColors();
  const img = metaImage(experience);

  return (
    <Pressable
      testID={`experience-card-${experience.id}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Image
        source={img ? { uri: img } : FALLBACK}
        style={[styles.image, { borderTopLeftRadius: colors.radius, borderTopRightRadius: colors.radius }]}
        contentFit="cover"
        transition={150}
      />
      <View style={styles.body}>
        <Text
          style={[styles.title, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {experience.title ?? 'Experience'}
        </Text>
        {experience.location ? (
          <View style={styles.row}>
            <Feather name="map-pin" size={12} color={colors.mutedForeground} />
            <Text
              style={[styles.location, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {experience.location}
            </Text>
          </View>
        ) : null}
        <View style={styles.footerRow}>
          {experience.current_price != null ? (
            <Text style={[styles.price, { color: colors.primary }]}>
              KSh {Number(experience.current_price).toLocaleString()}
              {experience.price_unit ? (
                <Text style={[styles.unit, { color: colors.mutedForeground }]}>
                  {' '}
                  / {experience.price_unit}
                </Text>
              ) : null}
            </Text>
          ) : (
            <Text style={[styles.unit, { color: colors.mutedForeground }]}>
              Price on request
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 120,
  },
  body: {
    padding: 10,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  price: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
  },
  unit: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
});
