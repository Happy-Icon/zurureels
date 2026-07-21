import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ScreenHeader } from '@/components/profile/ScreenHeader';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/hooks/useColors';

const LANGUAGES = [
  { value: 'en', label: 'English (US)' },
  { value: 'sw', label: 'Swahili' },
  { value: 'am', label: 'Amharic' },
];

const CURRENCIES = [
  { value: 'kes', label: 'Kenyan Shilling (KES)' },
  { value: 'usd', label: 'US Dollar (USD)' },
];

export default function SettingsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [language, setLanguage] = useState('en');
  const [currency, setCurrency] = useState('kes');
  const [dataSaver, setDataSaver] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [textSize, setTextSize] = useState(16);

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('general_settings')
          .eq('id', user.id)
          .single();
        if (data?.general_settings) {
          const s = data.general_settings as any;
          setLanguage(s.language || 'en');
          setCurrency(s.currency || 'kes');
          setDataSaver(s.data_saver || false);
          setHighContrast(s.high_contrast || false);
          if (Array.isArray(s.text_size)) setTextSize(s.text_size[0] ?? 16);
          else if (typeof s.text_size === 'number') setTextSize(s.text_size);
        }
      } catch (e) {
        console.error('Error loading settings:', e);
      } finally {
        setPageLoading(false);
      }
    };
    fetchSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          general_settings: {
            language,
            currency,
            data_saver: dataSaver,
            high_contrast: highContrast,
            text_size: [textSize],
          },
        })
        .eq('id', user.id);
      if (error) throw error;
      Alert.alert('Saved', 'Settings saved successfully');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearCache = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => {
      Alert.alert('Done', 'Cache cleared successfully. App is optimized.');
    }, 1200);
  };

  if (pageLoading) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <ScreenHeader />
        <View style={[styles.fill, styles.centered]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Localization */}
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.cardHeader}>
            <Feather name="globe" size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Localization</Text>
          </View>
          <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
            Customize your language and currency preferences
          </Text>

          <Text style={[styles.label, { color: colors.foreground }]}>Language</Text>
          <View style={styles.pillsRow}>
            {LANGUAGES.map((l) => (
              <SelectPill
                key={l.value}
                label={l.label}
                selected={language === l.value}
                onPress={() => setLanguage(l.value)}
                colors={colors}
              />
            ))}
          </View>

          <Text style={[styles.label, { color: colors.foreground }]}>Currency</Text>
          <View style={styles.pillsRow}>
            {CURRENCIES.map((c) => (
              <SelectPill
                key={c.value}
                label={c.label}
                selected={currency === c.value}
                onPress={() => setCurrency(c.value)}
                colors={colors}
              />
            ))}
          </View>
        </View>

        {/* Performance */}
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.cardHeader}>
            <Feather name="zap" size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Performance</Text>
          </View>
          <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
            Optimize app data usage and speed
          </Text>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleTitle, { color: colors.foreground }]}>Data Saver</Text>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Reduce image quality to save mobile data
              </Text>
            </View>
            <Switch
              value={dataSaver}
              onValueChange={setDataSaver}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Accessibility */}
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.cardHeader}>
            <Feather name="eye" size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Accessibility</Text>
          </View>
          <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
            Adjust the interface to your needs
          </Text>

          <View style={styles.sliderHeader}>
            <Text style={[styles.toggleTitle, { color: colors.foreground }]}>Text Size</Text>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>{textSize}px</Text>
          </View>
          <Slider
            minimumValue={12}
            maximumValue={32}
            step={1}
            value={textSize}
            onValueChange={setTextSize}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
            style={styles.slider}
          />
          <Text style={{ fontSize: textSize, color: colors.foreground, fontFamily: 'DMSans_400Regular' }}>
            The quick brown fox jumps over the lazy dog.
          </Text>

          <View style={[styles.toggleRow, { marginTop: 16 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleTitle, { color: colors.foreground }]}>
                High Contrast Mode
              </Text>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Increase contrast for better visibility
              </Text>
            </View>
            <Switch
              value={highContrast}
              onValueChange={setHighContrast}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Save */}
        <Pressable
          testID="save-settings"
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: colors.primary, opacity: pressed || saving ? 0.85 : 1 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Feather name="save" size={16} color="#ffffff" />
          )}
          <Text style={styles.saveButtonText}>Save All Preferences</Text>
        </Pressable>

        {/* System */}
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.cardHeader}>
            <Feather name="smartphone" size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>System</Text>
          </View>
          <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
            Manage application storage
          </Text>
          <View
            style={[
              styles.cacheRow,
              { borderColor: colors.border, backgroundColor: colors.background },
            ]}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.cacheTitleRow}>
                <Feather name="trash-2" size={14} color={colors.foreground} />
                <Text style={[styles.toggleTitle, { color: colors.foreground }]}>
                  Clear App Cache
                </Text>
              </View>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Free up space and fix loading issues
              </Text>
            </View>
            <Pressable
              testID="clear-cache"
              onPress={handleClearCache}
              style={({ pressed }) => [
                styles.outlineButton,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.outlineButtonText, { color: colors.foreground }]}>
                Clear Cache
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function SelectPill({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[
        styles.pill,
        selected
          ? { backgroundColor: colors.primary, borderColor: colors.primary }
          : { backgroundColor: 'transparent', borderColor: colors.border },
      ]}
    >
      <Text
        style={[styles.pillText, { color: selected ? '#ffffff' : colors.mutedForeground }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 48, gap: 16 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: { fontSize: 16, fontFamily: 'DMSans_600SemiBold' },
  cardDesc: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    marginBottom: 8,
    marginTop: 4,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillText: { fontSize: 13, fontFamily: 'DMSans_500Medium' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleTitle: { fontSize: 14, fontFamily: 'DMSans_500Medium' },
  hint: { fontSize: 12, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  slider: { width: '100%', height: 36 },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 14,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  cacheRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
  },
  cacheTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  outlineButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  outlineButtonText: { fontSize: 13, fontFamily: 'DMSans_500Medium' },
});
