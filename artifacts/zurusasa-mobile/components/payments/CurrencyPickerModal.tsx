import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { CURRENCIES_LIST, type CurrencyItem } from './paymentTypes';
import { paymentsStyles as styles } from './paymentsStyles';

export interface CurrencyPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCurrency: (currency: CurrencyItem) => void;
  selectedCurrency: CurrencyItem;
}

export function CurrencyPickerModal({
  visible,
  onClose,
  onSelectCurrency,
  selectedCurrency,
}: CurrencyPickerModalProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [currencySearch, setCurrencySearch] = useState('');

  const filteredCurrencies = useMemo(() => {
    if (!currencySearch.trim()) return CURRENCIES_LIST;
    const query = currencySearch.toLowerCase();
    return CURRENCIES_LIST.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.code.toLowerCase().includes(query) ||
        c.symbol.toLowerCase().includes(query)
    );
  }, [currencySearch]);

  const handleClose = () => {
    setCurrencySearch('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View
        style={[
          styles.currencyModalContainer,
          {
            backgroundColor: colors.background,
            paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16,
          },
        ]}
      >
        {/* Header */}
        <View style={[styles.currencyModalHeader, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={handleClose}
            style={styles.circleBtn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close currency selector"
          >
            <Feather name="x" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.currencyHeaderTitle, { color: colors.text }]}>Choose a currency</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Search input */}
        <View style={styles.searchContainer}>
          <View
            style={[
              styles.searchBarWrapper,
              { borderColor: colors.border, backgroundColor: isDark ? '#27272A' : '#F9FAFB' },
            ]}
          >
            <Feather name="search" size={18} color={colors.mutedForeground} style={{ marginRight: 8 }} />
            <TextInput
              value={currencySearch}
              onChangeText={setCurrencySearch}
              placeholder="Search currencies"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search currencies input"
            />
            {currencySearch.length > 0 && (
              <Pressable
                onPress={() => setCurrencySearch('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search text"
              >
                <Feather name="x-circle" size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Currency list */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.currencyListContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {filteredCurrencies.map((item) => {
            const isSelected = selectedCurrency.code === item.code;
            return (
              <Pressable
                key={item.code}
                onPress={() => {
                  onSelectCurrency(item);
                  handleClose();
                }}
                style={[styles.currencyItemRow, { borderBottomColor: colors.border }]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${item.name}, currency symbol ${item.symbol}`}
              >
                <Text
                  style={[
                    styles.currencyItemLabel,
                    { color: colors.text },
                    isSelected && styles.currencyItemLabelActive,
                  ]}
                >
                  {item.name} - {item.symbol}
                </Text>
                {isSelected && <Feather name="check" size={20} color={colors.text} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}
