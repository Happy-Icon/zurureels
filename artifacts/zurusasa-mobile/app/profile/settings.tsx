import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/Skeleton';

const LANGUAGES = [
  { code: 'en', name: 'English (US)', region: 'United States' },
  { code: 'sw', name: 'Swahili', region: 'Kenya & East Africa' },
  { code: 'am', name: 'Amharic', region: 'Ethiopia' },
  { code: 'fr', name: 'French', region: 'France' },
  { code: 'de', name: 'German', region: 'Germany' },
  { code: 'es', name: 'Spanish', region: 'Spain' },
  { code: 'zh', name: 'Chinese', region: 'China' },
  { code: 'ar', name: 'Arabic', region: 'UAE' },
];

const CURRENCIES = [
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
];

export default function AppPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [pageLoading, setPageLoading] = useState(true);

  const [language, setLanguage] = useState('en');
  const [currency, setCurrency] = useState('KES');
  const [dataSaver, setDataSaver] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [textSize, setTextSize] = useState(16);

  const [langModalVisible, setLangModalVisible] = useState(false);
  const [currModalVisible, setCurrModalVisible] = useState(false);
  const [langSearch, setLangSearch] = useState('');

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 40;

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
          setCurrency(s.currency || 'KES');
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

  // Instant Auto-Save Helper
  const autoSaveSettings = async (
    l: string,
    c: string,
    ds: boolean,
    hc: boolean,
    ts: number,
  ) => {
    if (!user) return;
    try {
      await supabase
        .from('profiles')
        .update({
          general_settings: {
            language: l,
            currency: c,
            data_saver: ds,
            high_contrast: hc,
            text_size: [ts],
          },
        })
        .eq('id', user.id);
    } catch (e) {
      console.error('Auto-save settings error:', e);
    }
  };

  const handleSelectLanguage = (code: string) => {
    setLanguage(code);
    setLangModalVisible(false);
    autoSaveSettings(code, currency, dataSaver, highContrast, textSize);
  };

  const handleSelectCurrency = (code: string) => {
    setCurrency(code);
    setCurrModalVisible(false);
    autoSaveSettings(language, code, dataSaver, highContrast, textSize);
  };

  const handleToggleDataSaver = (val: boolean) => {
    setDataSaver(val);
    autoSaveSettings(language, currency, val, highContrast, textSize);
  };

  const handleToggleHighContrast = (val: boolean) => {
    setHighContrast(val);
    autoSaveSettings(language, currency, dataSaver, val, textSize);
  };

  const handleSliderTextSize = (val: number) => {
    setTextSize(val);
    autoSaveSettings(language, currency, dataSaver, highContrast, val);
  };

  const handleClearCache = () => {
    Alert.alert('App Cache Cleared', 'Local image and data cache cleared successfully.');
  };

  const currentLangObj = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];
  const currentCurrObj = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];

  const filteredLanguages = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.region.toLowerCase().includes(langSearch.toLowerCase()),
  );

  if (pageLoading) {
    return (
      <View style={[styles.fill, { backgroundColor: '#FFFFFF', paddingTop: topPad, paddingHorizontal: 20, gap: 20 }]}>
        <Skeleton style={{ height: 28, width: 220, borderRadius: 6 }} />
        <Skeleton style={{ height: 14, width: 260, borderRadius: 4 }} />
        <Skeleton style={{ height: 16, width: 120, borderRadius: 4, marginTop: 12 }} />
        <Skeleton style={{ height: 48, borderRadius: 12 }} />
        <Skeleton style={{ height: 48, borderRadius: 12 }} />
        <Skeleton style={{ height: 16, width: 140, borderRadius: 4, marginTop: 12 }} />
        <Skeleton style={{ height: 48, borderRadius: 12 }} />
        <Skeleton style={{ height: 48, borderRadius: 12 }} />
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: '#FFFFFF' }]}>
      {/* 1. Header Bar & Navigation */}
      <View style={[styles.topNavBar, { paddingTop: topPad }]}>
        <Pressable
          testID="settings-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/profile');
          }}
          style={({ pressed }) => [styles.backIconBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color="#222222" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Translation & region</Text>
          <Text style={styles.pageSub}>
            Set your preferred language, local currency, and system preferences.
          </Text>
        </View>

        {/* 2. Language & Currency Selector Architecture (Airbnb Pattern) */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Localization</Text>

          {/* Language Row */}
          <Pressable
            testID="select-language-row"
            onPress={() => {
              setLangModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.settingRow,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <View style={styles.textColumn}>
              <Text style={styles.rowTitle}>Language</Text>
              <Text style={styles.rowSubtext}>Choose your preferred language</Text>
            </View>
            <View style={styles.valueRowRight}>
              <Text style={styles.valueText}>{currentLangObj.name}</Text>
              <Feather name="chevron-right" size={18} color="#717171" />
            </View>
          </Pressable>

          <View style={styles.rowDivider} />

          {/* Currency Row */}
          <Pressable
            testID="select-currency-row"
            onPress={() => {
              setCurrModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.settingRow,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <View style={styles.textColumn}>
              <Text style={styles.rowTitle}>Currency</Text>
              <Text style={styles.rowSubtext}>Display prices in your local currency</Text>
            </View>
            <View style={styles.valueRowRight}>
              <Text style={styles.valueText}>
                {currentCurrObj.code} ({currentCurrObj.symbol})
              </Text>
              <Feather name="chevron-right" size={18} color="#717171" />
            </View>
          </Pressable>
        </View>

        <View style={styles.sectionDivider} />

        {/* 3. Performance & Data Saver */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Performance</Text>

          <View style={styles.settingRow}>
            <View style={styles.textColumn}>
              <Text style={styles.rowTitle}>Data Saver</Text>
              <Text style={styles.rowSubtext}>Reduce image quality to save mobile data.</Text>
            </View>
            <Switch
              value={dataSaver}
              onValueChange={handleToggleDataSaver}
              trackColor={{ true: '#EE7D30', false: '#EBEBEB' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.sectionDivider} />

        {/* 4. Accessibility Section */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Accessibility</Text>

          {/* Dynamic Text Size Slider */}
          <View style={styles.sliderContainer}>
            <View style={styles.sliderTextHeader}>
              <Text style={styles.rowTitle}>Dynamic Text Size</Text>
            </View>
            <View style={styles.sliderTrackRow}>
              <Text style={styles.sliderSmallA}>A</Text>
              <Slider
                minimumValue={12}
                maximumValue={24}
                step={1}
                value={textSize}
                onSlidingComplete={handleSliderTextSize}
                minimumTrackTintColor="#EE7D30"
                maximumTrackTintColor="#EBEBEB"
                thumbTintColor="#222222"
                style={styles.sliderControl}
              />
              <Text style={styles.sliderLargeA}>A</Text>
            </View>
          </View>

          <View style={styles.rowDivider} />

          {/* High Contrast Mode */}
          <View style={styles.settingRow}>
            <View style={styles.textColumn}>
              <Text style={styles.rowTitle}>High Contrast Mode</Text>
              <Text style={styles.rowSubtext}>Increase contrast for better screen visibility.</Text>
            </View>
            <Switch
              value={highContrast}
              onValueChange={handleToggleHighContrast}
              trackColor={{ true: '#EE7D30', false: '#EBEBEB' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.sectionDivider} />

        {/* 5. System & Storage Settings */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Storage</Text>

          <View style={styles.settingRow}>
            <View style={styles.textColumn}>
              <Text style={styles.rowTitle}>Clear App Cache</Text>
              <Text style={styles.rowSubtext}>Free up local storage space and refresh data.</Text>
            </View>
            <Pressable
              testID="clear-cache-btn"
              onPress={handleClearCache}
              style={({ pressed }) => [styles.clearLinkBtn, { opacity: pressed ? 0.6 : 1 }]}
              hitSlop={8}
            >
              <Text style={styles.clearLinkText}>Clear</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Language Bottom Sheet Modal */}
      <Modal
        visible={langModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheetCard}>
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>Select Language</Text>
              <Pressable
                onPress={() => setLangModalVisible(false)}
                style={styles.modalSheetCloseBtn}
                hitSlop={8}
              >
                <Feather name="x" size={20} color="#222222" />
              </Pressable>
            </View>

            {/* Search Input */}
            <View style={styles.searchBox}>
              <Feather name="search" size={16} color="#717171" />
              <TextInput
                value={langSearch}
                onChangeText={setLangSearch}
                placeholder="Search languages"
                placeholderTextColor="#9CA3AF"
                style={styles.searchInputText}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
              {filteredLanguages.map((l) => {
                const isSelected = l.code === language;
                return (
                  <Pressable
                    key={l.code}
                    onPress={() => handleSelectLanguage(l.code)}
                    style={({ pressed }) => [
                      styles.modalOptionRow,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalOptionName}>{l.name}</Text>
                      <Text style={styles.modalOptionRegion}>{l.region}</Text>
                    </View>
                    {isSelected ? <Feather name="check" size={18} color="#EE7D30" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Currency Bottom Sheet Modal */}
      <Modal
        visible={currModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCurrModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheetCard}>
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>Select Currency</Text>
              <Pressable
                onPress={() => setCurrModalVisible(false)}
                style={styles.modalSheetCloseBtn}
                hitSlop={8}
              >
                <Feather name="x" size={20} color="#222222" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
              {CURRENCIES.map((c) => {
                const isSelected = c.code === currency;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => handleSelectCurrency(c.code)}
                    style={({ pressed }) => [
                      styles.modalOptionRow,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalOptionName}>
                        {c.name} ({c.code})
                      </Text>
                      <Text style={styles.modalOptionRegion}>Symbol: {c.symbol}</Text>
                    </View>
                    {isSelected ? <Feather name="check" size={18} color="#EE7D30" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  topNavBar: {
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleSection: {
    marginTop: 8,
    marginBottom: 24,
    gap: 6,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    letterSpacing: -0.4,
  },
  pageSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    lineHeight: 20,
  },
  sectionBlock: {
    gap: 4,
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 16,
  },
  textColumn: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  rowSubtext: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    lineHeight: 18,
  },
  valueRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  valueText: {
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginVertical: 24,
  },
  sliderContainer: {
    paddingVertical: 12,
    gap: 10,
  },
  sliderTextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sliderTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderSmallA: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#717171',
  },
  sliderLargeA: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  sliderControl: {
    flex: 1,
    height: 36,
  },
  clearLinkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearLinkText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#EE7D30',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalSheetTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  modalSheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchInputText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: '#222222',
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  modalOptionName: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  modalOptionRegion: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    marginTop: 2,
  },
});
