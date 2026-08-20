import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, type AppearanceMode } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';

interface AppearanceOption {
  id: AppearanceMode;
  label: string;
  sublabel: string;
  iconName: keyof typeof Ionicons.glyphMap;
}

const APPEARANCE_OPTIONS: AppearanceOption[] = [
  {
    id: 'system',
    label: 'System',
    sublabel: 'Automatically match your device appearance settings',
    iconName: 'phone-portrait-outline',
  },
  {
    id: 'light',
    label: 'Light',
    sublabel: 'Clean light surfaces and high-contrast text',
    iconName: 'sunny-outline',
  },
  {
    id: 'dark',
    label: 'Dark',
    sublabel: 'Deep dark surfaces and reduced glare in low light',
    iconName: 'moon-outline',
  },
];

interface AppearanceSelectorProps {
  onOptionSelected?: (mode: AppearanceMode) => void;
}

export function AppearanceSelector({ onOptionSelected }: AppearanceSelectorProps) {
  const { appearanceMode, setAppearanceMode, isDark } = useTheme();
  const colors = useColors();

  const handleSelect = (mode: AppearanceMode) => {
    Haptics.selectionAsync();
    setAppearanceMode(mode);
    onOptionSelected?.(mode);
  };

  return (
    <View style={styles.optionsList}>
      {APPEARANCE_OPTIONS.map((opt) => {
        const isSelected = appearanceMode === opt.id;

        return (
          <Pressable
            key={opt.id}
            testID={`appearance-option-${opt.id}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${opt.label} appearance mode: ${opt.sublabel}`}
            onPress={() => handleSelect(opt.id)}
            style={({ pressed }) => [
              styles.optionCard,
              {
                backgroundColor: isSelected
                  ? isDark
                    ? '#27272A'
                    : '#FFF5EF'
                  : colors.card,
                borderColor: isSelected ? '#F26522' : colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {/* Left Icon */}
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: isSelected
                    ? '#F26522'
                    : isDark
                    ? '#333338'
                    : '#F3F4F6',
                },
              ]}
            >
              <Ionicons
                name={opt.iconName}
                size={20}
                color={isSelected ? '#FFFFFF' : colors.text}
              />
            </View>

            {/* Label & Description */}
            <View style={styles.textStack}>
              <Text
                style={[
                  styles.optionTitle,
                  {
                    color: isSelected ? (isDark ? '#FFFFFF' : '#111827') : colors.text,
                    fontFamily: isSelected ? 'DMSans_700Bold' : 'DMSans_600SemiBold',
                  },
                ]}
              >
                {opt.label}
              </Text>
              <Text
                style={[
                  styles.optionSub,
                  { color: isSelected ? (isDark ? '#D4D4D8' : '#717171') : colors.mutedForeground },
                ]}
              >
                {opt.sublabel}
              </Text>
            </View>

            {/* Selection Checkmark Indicator */}
            <View
              style={[
                styles.radioRing,
                {
                  borderColor: isSelected ? '#F26522' : colors.border,
                  backgroundColor: isSelected ? '#F26522' : 'transparent',
                },
              ]}
            >
              {isSelected ? (
                <Feather name="check" size={13} color="#FFFFFF" />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

interface AppearanceModalSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function AppearanceModalSheet({ visible, onClose }: AppearanceModalSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.modalContainer,
          {
            backgroundColor: colors.background,
            paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        {/* Modal Header */}
        <View
          style={[
            styles.modalHeader,
            { borderBottomColor: colors.border },
          ]}
        >
          <Pressable
            testID="appearance-modal-close"
            onPress={onClose}
            style={[styles.modalCloseBtn, { backgroundColor: isDark ? '#27272A' : '#F5F5F5' }]}
            hitSlop={10}
          >
            <Feather name="x" size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>Appearance</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Modal Content */}
        <View style={styles.modalBody}>
          <Text style={[styles.headline, { color: colors.text }]}>Select Theme</Text>
          <Text style={[styles.subheadline, { color: colors.mutedForeground }]}>
            Choose how ZuruSasa looks across feeds, discovery, maps, and reservation manager.
          </Text>

          <AppearanceSelector onOptionSelected={() => {}} />

          <Pressable
            testID="appearance-done-btn"
            onPress={onClose}
            style={({ pressed }) => [
              styles.doneBtn,
              { opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  optionsList: {
    gap: 12,
    marginTop: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 14,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textStack: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    marginBottom: 3,
  },
  optionSub: {
    fontSize: 12.5,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 17,
  },
  radioRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  headline: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    marginBottom: 6,
  },
  subheadline: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 20,
    marginBottom: 16,
  },
  doneBtn: {
    backgroundColor: '#F26522',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    shadowColor: '#F26522',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
});
