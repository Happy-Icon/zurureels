import React, { useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { ExperienceCard } from '@/components/ExperienceCard';
import { CenteredState, Skeleton } from '@/components/Skeleton';
import { useColors } from '@/hooks/useColors';
import { useExperiences } from '@/lib/queries';

const CATEGORIES: { key: string | null; label: string }[] = [
  { key: null, label: 'All' },
  { key: 'stays', label: 'Stays' },
  { key: 'food', label: 'Food' },
  { key: 'adventure', label: 'Adventure' },
  { key: 'culture', label: 'Culture' },
  { key: 'water', label: 'Water' },
];

export default function DiscoverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<string | null>(null);
  const { data, isLoading, isError, refetch, isRefetching } =
    useExperiences(category);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : 80;

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Discover
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Coastal experiences worth the trip
        </Text>
      </View>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <Pressable
                key={c.label}
                testID={`category-${c.label}`}
                onPress={() => setCategory(c.key)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.secondary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: active
                        ? colors.primaryForeground
                        : colors.secondaryForeground,
                    },
                  ]}
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.skeletonGrid}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} style={styles.skeletonCard} />
          ))}
        </View>
      ) : isError ? (
        <CenteredState>
          <Feather name="alert-circle" size={30} color={colors.mutedForeground} />
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
            Couldn't load experiences
          </Text>
          <Pressable
            testID="retry-experiences"
            onPress={() => refetch()}
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </CenteredState>
      ) : !data || data.length === 0 ? (
        <CenteredState>
          <Feather name="compass" size={30} color={colors.mutedForeground} />
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
            No experiences in this category yet
          </Text>
        </CenteredState>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
          renderItem={({ item }) => <ExperienceCard experience={item} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          scrollEnabled={data.length > 0}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 2,
  },
  headerTitle: {
    fontSize: 30,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  headerSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
  },
  chips: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  skeletonCard: {
    width: '47%',
    height: 180,
  },
  columnWrapper: {
    gap: 12,
    paddingHorizontal: 16,
  },
  listContent: {
    gap: 12,
    paddingTop: 4,
  },
  stateText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
});
