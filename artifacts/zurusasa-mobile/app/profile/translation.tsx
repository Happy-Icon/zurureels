import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function TranslationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [autoTranslate, setAutoTranslate] = useState(true);

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 32;

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('translation_settings')
          .eq('id', user.id)
          .single();

        if (data?.translation_settings) {
          const t = data.translation_settings as Record<string, any>;
          if (t.auto_translate !== undefined) {
            setAutoTranslate(t.auto_translate);
          }
        }
      } catch (e) {
        console.warn('Note loading translation settings:', e);
      }
    };
    loadSettings();
  }, [user]);

  const handleToggle = async (val: boolean) => {
    setAutoTranslate(val);
    if (!user?.id) return;
    try {
      await supabase
        .from('profiles')
        .update({ translation_settings: { auto_translate: val, target_language: 'English' } })
        .eq('id', user.id);
    } catch (e) {
      console.warn('Error updating translation setting:', e);
    }
  };

  return (
    <View style={styles.container}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable
          testID="translation-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/profile/settings');
          }}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnActive]}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color="#111111" />
        </Pressable>
      </View>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      >
        {/* Title */}
        <Text style={styles.pageTitle}>Translation</Text>

        {/* Intro Subtitle */}
        <Text style={styles.pageSubtitle}>
          Automatically translate the reviews, descriptions and messages written by guests and Hosts to English. Turn this feature off if you'd like to show the original language.
        </Text>

        {/* Automatic translation row */}
        <View style={styles.toggleRow}>
          <View style={styles.textContainer}>
            <Text style={styles.toggleTitle}>Automatic translation</Text>
            <Text style={styles.toggleSubtitle}>
              Translate reviews, descriptions and messages into English.
            </Text>
          </View>

          <Switch
            value={autoTranslate}
            onValueChange={handleToggle}
            trackColor={{ false: '#E2E8F0', true: '#111111' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  backBtnActive: {
    backgroundColor: '#F5F5F5',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.5,
    marginBottom: 16,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#484848',
    lineHeight: 22,
    marginBottom: 32,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_400Regular',
      default: 'sans-serif',
    }),
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  textContainer: {
    flex: 1,
    paddingRight: 16,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1E1E1E',
    marginBottom: 4,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_500Medium',
      default: 'sans-serif',
    }),
  },
  toggleSubtitle: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 20,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_400Regular',
      default: 'sans-serif',
    }),
  },
});
