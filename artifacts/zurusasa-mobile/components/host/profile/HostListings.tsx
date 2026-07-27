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
import type { ExperienceRow } from '@/lib/supabase';

interface HostListingsProps {
  hostName: string;
  listings: ExperienceRow[];
}

export function HostListings({ hostName, listings }: HostListingsProps) {
  const router = useRouter();

  if (!listings || listings.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionHeading}>{hostName.split(' ')[0]}'s Listings</Text>
        <View style={styles.emptyCard}>
          <Feather name="home" size={24} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No active listings yet</Text>
          <Text style={styles.emptySub}>Check back soon for new experiences and stays from {hostName.split(' ')[0]}.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionHeading}>
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
          const imageUri =
            item.image_url ||
            'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600';
          const priceText = item.current_price
            ? `KES ${item.current_price.toLocaleString()}`
            : 'KES 8,500';

          return (
            <Pressable
              onPress={() => router.push('/discover')}
              style={({ pressed }) => [
                styles.listingCard,
                { opacity: pressed ? 0.92 : 1 },
              ]}
            >
              <Image
                source={{ uri: imageUri }}
                style={styles.thumbnail}
                contentFit="cover"
                transition={200}
              />

              <View style={styles.cardInfo}>
                <View style={styles.titleRow}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.title || 'Coastal Stay'}
                  </Text>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color="#F26522" />
                    <Text style={styles.ratingText}>4.9</Text>
                  </View>
                </View>

                <Text style={styles.locationText} numberOfLines={1}>
                  {item.location || 'Mombasa'} · {item.category || 'Experience'}
                </Text>

                <Text style={styles.priceText}>
                  {priceText} <Text style={styles.priceUnit}>/ night</Text>
                </Text>
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
  locationText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
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
