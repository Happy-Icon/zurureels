import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

// Same list as the web app's coastalCities (src/data/mockCityPulse.ts).
export const COASTAL_CITIES = [
  'Mombasa',
  'Diani',
  'Lamu',
  'Watamu',
  'Malindi',
  'Kilifi',
  'Nyali',
  'Bamburi',
];

interface CityPickerSheetProps {
  visible: boolean;
  selectedCity: string;
  onClose: () => void;
  onUseMyLocation: () => void;
  onSelectCity: (city: string) => void;
}

export function CityPickerSheet({
  visible,
  selectedCity,
  onClose,
  onUseMyLocation,
  onSelectCity,
}: CityPickerSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 12) + 8,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Pressable
            testID="use-my-location"
            onPress={onUseMyLocation}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="navigation" size={16} color={colors.primary} />
            <Text style={[styles.rowText, { color: colors.foreground }]}>
              Use My Location
            </Text>
            {selectedCity === 'Current Location' ? (
              <Feather name="check" size={16} color={colors.primary} />
            ) : null}
          </Pressable>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <ScrollView style={{ maxHeight: 340 }}>
            {COASTAL_CITIES.map((city) => (
              <Pressable
                key={city}
                testID={`city-option-${city}`}
                onPress={() => onSelectCity(city)}
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.rowText, { color: colors.foreground }]}>
                  {city}
                </Text>
                {selectedCity === city ? (
                  <Feather name="check" size={16} color={colors.primary} />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
  },
  separator: {
    height: 1,
    marginVertical: 4,
    marginHorizontal: 8,
  },
});
