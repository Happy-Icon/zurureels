import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { RecentSearchItem } from '@/services/searchService';

interface SearchSuggestionsProps {
  recentSearches: RecentSearchItem[];
  popularDestinations: Array<{ id: string; name: string; count: string; image: string }>;
  trendingTags: string[];
  onSelectQuery: (query: string) => void;
  onSelectCity: (city: string) => void;
  onClearHistory: () => void;
}

export function SearchSuggestions({
  recentSearches,
  popularDestinations,
  trendingTags,
  onSelectQuery,
  onSelectCity,
  onClearHistory,
}: SearchSuggestionsProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* 1. RECENT SEARCHES */}
      {recentSearches.length > 0 ? (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Searches</Text>
            <Pressable onPress={onClearHistory} hitSlop={8}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          </View>

          <View style={styles.recentList}>
            {recentSearches.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => onSelectQuery(item.query)}
                style={styles.recentRow}
              >
                <Feather name="clock" size={15} color="#717171" />
                <Text style={styles.recentQueryText}>{item.query}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* 2. TRENDING SEARCHES */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Trending Coastal Searches</Text>
        <View style={styles.tagWrap}>
          {trendingTags.map((tag, idx) => (
            <Pressable
              key={idx}
              onPress={() => onSelectQuery(tag)}
              style={({ pressed }) => [
                styles.trendingTag,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="trending-up" size={13} color="#F26522" />
              <Text style={styles.tagText}>{tag}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* 3. POPULAR DESTINATIONS */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Popular Destinations</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {popularDestinations.map((dest) => (
            <Pressable
              key={dest.id}
              onPress={() => onSelectCity(dest.name)}
              style={({ pressed }) => [
                styles.destCard,
                { opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Image source={{ uri: dest.image }} style={styles.destImage} contentFit="cover" />
              <View style={styles.destInfo}>
                <Text style={styles.destName}>{dest.name}</Text>
                <Text style={styles.destCount}>{dest.count}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingVertical: 12,
    gap: 24,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  clearText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  recentList: {
    gap: 4,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F7F7F7',
  },
  recentQueryText: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trendingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFFBF8',
    borderWidth: 1,
    borderColor: '#FCE3D6',
  },
  tagText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  destCard: {
    width: 140,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    overflow: 'hidden',
  },
  destImage: {
    width: '100%',
    height: 90,
    backgroundColor: '#F7F7F7',
  },
  destInfo: {
    padding: 10,
    gap: 2,
  },
  destName: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  destCount: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
});
