import React from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useColors, useTheme } from '@/hooks/useColors';
import type { ExperienceRow } from '@/lib/supabase';

interface HostListingsProps {
  hostName: string;
  listings: ExperienceRow[];
}

function getCategoryIcon(cat?: string | null): any {
  const c = (cat || '').toLowerCase();
  if (c.includes('boat') || c.includes('marine') || c.includes('water') || c.includes('sea')) return 'anchor';
  if (c.includes('stay') || c.includes('villa') || c.includes('cottage') || c.includes('home')) return 'home';
  if (c.includes('tour') || c.includes('safari') || c.includes('walk')) return 'compass';
  if (c.includes('food') || c.includes('dining') || c.includes('drink')) return 'coffee';
  if (c.includes('event') || c.includes('party')) return 'calendar';
  return 'map-pin';
}

export function HostListings({ hostName, listings }: HostListingsProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const router = useRouter();

  if (!listings || listings.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>
          {hostName.split(' ')[0]}'s Listings
        </Text>
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="home" size={24} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No active listings yet</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Check back soon for new experiences and stays published by {hostName.split(' ')[0]}.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>
          {hostName.split(' ')[0]}'s Listings ({listings.length})
        </Text>
      </View>

      <FlatList
        horizontal
        data={listings}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 14 }}
        renderItem={({ item }) => {
          const imageUri = item.image_url;
          const hasValidImage = Boolean(
            imageUri &&
            !imageUri.startsWith('file://') &&
            !imageUri.includes('unsplash.com')
          );

          const priceText =
            item.current_price != null && item.current_price > 0
              ? `KES ${item.current_price.toLocaleString()}`
              : item.current_price === 0
              ? 'Free'
              : null;

          const priceUnit = item.price_unit ? ` / ${item.price_unit}` : '';
          const meta = (item.metadata ?? {}) as Record<string, unknown>;
          const rawRating = meta.rating ?? (item as any).rating;
          const rating = rawRating != null && Number(rawRating) > 0 ? Number(rawRating) : null;

          return (
            <Pressable
              onPress={() => {
                router.push({
                  pathname: '/discover',
                  params: { query: item.title || item.category || '' },
                });
              }}
              style={({ pressed }) => [
                styles.listingCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              {hasValidImage ? (
                <Image
                  source={{ uri: imageUri! }}
                  style={styles.thumbnail}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View
                  style={[
                    styles.thumbnailFallback,
                    { backgroundColor: isDark ? '#2A1810' : '#FFF3EB' },
                  ]}
                >
                  <Feather name={getCategoryIcon(item.category)} size={28} color="#F26522" />
                  <Text style={styles.fallbackCategoryText} numberOfLines={1}>
                    {item.category || item.entity_name || 'Experience'}
                  </Text>
                </View>
              )}

              <View style={styles.cardInfo}>
                <View style={styles.titleRow}>
                  <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title || item.entity_name || 'Coastal Listing'}
                  </Text>
                  {rating ? (
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={12} color="#F26522" />
                      <Text style={[styles.ratingText, { color: colors.text }]}>
                        {rating.toFixed(1)}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.newBadge, { backgroundColor: isDark ? '#33231B' : '#FFF3EB' }]}>
                      <Text style={styles.newBadgeText}>New</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.locationText, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {item.location ? `${item.location} · ` : ''}{item.category || 'Experience'}
                </Text>

                {priceText ? (
                  <Text style={[styles.priceText, { color: colors.text }]}>
                    {priceText}
                    {priceUnit ? (
                      <Text style={[styles.priceUnit, { color: colors.mutedForeground }]}>
                        {priceUnit}
                      </Text>
                    ) : null}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  listingCard: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  thumbnail: {
    width: '100%',
    height: 130,
    backgroundColor: '#F7F7F7',
  },
  thumbnailFallback: {
    width: '100%',
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  fallbackCategoryText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#F26522',
    textTransform: 'capitalize',
  },
  cardInfo: {
    padding: 12,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  itemTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  newBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newBadgeText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  locationText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textTransform: 'capitalize',
  },
  priceText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
    marginTop: 2,
  },
  priceUnit: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  emptyCard: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    marginTop: 4,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
  },
});
