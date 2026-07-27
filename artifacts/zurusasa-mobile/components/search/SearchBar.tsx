import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onFocus?: () => void;
  onFilterPress: () => void;
  onSortPress: () => void;
  activeFilterCount: number;
  inputRef?: React.RefObject<TextInput | null>;
}

export function SearchBar({
  value,
  onChangeText,
  onFocus,
  onFilterPress,
  onSortPress,
  activeFilterCount,
  inputRef,
}: SearchBarProps) {
  return (
    <View style={styles.container}>
      {/* Floating Search Pill Bar */}
      <View style={styles.floatingPill}>
        <Feather name="search" size={18} color="#222222" style={styles.searchIcon} />

        <TextInput
          ref={inputRef as any}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          placeholder="Where to? · Try 'Villa in Diani under 20k'"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          returnKeyType="search"
        />

        {value.length > 0 ? (
          <Pressable onPress={() => onChangeText('')} hitSlop={8} style={styles.clearBtn}>
            <Feather name="x-circle" size={16} color="#9CA3AF" />
          </Pressable>
        ) : null}

        {/* Sort Button */}
        <Pressable
          onPress={onSortPress}
          style={({ pressed }) => [
            styles.iconCircleBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="swap-vertical" size={16} color="#222222" />
        </Pressable>

        {/* Filter Button */}
        <Pressable
          onPress={onFilterPress}
          style={({ pressed }) => [
            styles.iconCircleBtn,
            styles.filterBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="sliders" size={15} color="#222222" />
          {activeFilterCount > 0 ? (
            <View style={styles.badgePill}>
              <Text style={styles.badgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  floatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    height: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    gap: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  searchIcon: {
    marginLeft: 2,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 2,
  },
  iconCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtn: {
    position: 'relative',
  },
  badgePill: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#F26522',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
  },
});
