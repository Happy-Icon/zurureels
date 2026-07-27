import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface SearchEmptyStateProps {
  onResetFilters: () => void;
  onExploreAll: () => void;
}

export function SearchEmptyState({
  onResetFilters,
  onExploreAll,
}: SearchEmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Feather name="search" size={32} color="#F26522" />
      </View>

      <Text style={styles.headline}>No matching stays found</Text>
      <Text style={styles.subtitle}>
        Try clearing your filters or searching a different coastal destination like Diani or Mombasa.
      </Text>

      <View style={styles.btnRow}>
        <Pressable
          onPress={onResetFilters}
          style={({ pressed }) => [
            styles.resetBtn,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={styles.resetBtnText}>Clear Filters</Text>
        </Pressable>

        <Pressable
          onPress={onExploreAll}
          style={({ pressed }) => [
            styles.exploreBtn,
            { opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Text style={styles.exploreBtnText}>Explore All</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(242, 101, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  headline: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 290,
    marginBottom: 8,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resetBtn: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  exploreBtn: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
});
