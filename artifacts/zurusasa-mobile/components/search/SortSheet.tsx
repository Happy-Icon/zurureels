import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { SearchFilters } from '@/services/filterService';

interface SortSheetProps {
  visible: boolean;
  selectedSort: SearchFilters['sortBy'];
  onClose: () => void;
  onSelectSort: (sort: SearchFilters['sortBy']) => void;
}

const SORT_OPTIONS: Array<{ id: SearchFilters['sortBy']; label: string; icon: string }> = [
  { id: 'recommended', label: 'Recommended', icon: 'thumbs-up' },
  { id: 'popular', label: 'Most Popular', icon: 'trending-up' },
  { id: 'rating', label: 'Highest Rated', icon: 'star' },
  { id: 'price_asc', label: 'Lowest Price', icon: 'arrow-down' },
  { id: 'price_desc', label: 'Highest Price', icon: 'arrow-up' },
  { id: 'newest', label: 'Newest', icon: 'clock' },
];

export function SortSheet({
  visible,
  selectedSort,
  onClose,
  onSelectSort,
}: SortSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Sort Results</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color="#222222" />
            </Pressable>
          </View>

          <View style={styles.optionsList}>
            {SORT_OPTIONS.map((opt) => {
              const isSelected = selectedSort === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    onSelectSort(opt.id);
                    onClose();
                  }}
                  style={[styles.optionRow, isSelected ? styles.optionRowActive : null]}
                >
                  <View style={styles.optionLeft}>
                    <Feather
                      name={opt.icon as any}
                      size={18}
                      color={isSelected ? '#F26522' : '#717171'}
                    />
                    <Text style={[styles.optionText, isSelected ? styles.optionTextActive : null]}>
                      {opt.label}
                    </Text>
                  </View>
                  {isSelected ? <Feather name="check" size={18} color="#F26522" /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  optionsList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  optionRowActive: {
    backgroundColor: '#FFFBF8',
    borderColor: '#FCE3D6',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  optionTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
});
