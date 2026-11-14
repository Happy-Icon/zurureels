import React from 'react';
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

import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

export default function TranslationSettingsScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 32;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      >
        {/* Title */}
        <Text style={[styles.pageTitle, { color: colors.text }]}>Translation</Text>

        {/* Intro Subtitle */}
        <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
          Automatic translation of reviews, descriptions, and host-guest messages between Swahili, English, and international languages is currently in development and will be available in an upcoming release.
        </Text>

        {/* Automatic translation row (Deferred / Coming Soon — REM-12) */}
        <View style={[styles.toggleRow, { opacity: 0.65 }]}>
          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={[styles.toggleTitle, { color: colors.text }]}>Automatic translation</Text>
              <View style={[styles.comingSoonBadge, { backgroundColor: isDark ? '#27272A' : '#FFF7ED', borderColor: isDark ? '#3F3F46' : '#FED7AA' }]}>
                <Text style={styles.comingSoonText}>COMING SOON</Text>
              </View>
            </View>
            <Text style={[styles.toggleSubtitle, { color: colors.mutedForeground }]}>
              Reviews, listing descriptions, and messages are currently displayed in their original language.
            </Text>
          </View>

          <Switch
            testID="translation-auto-switch"
            value={false}
            disabled={true}
            trackColor={{ false: isDark ? '#3F3F46' : '#E2E8F0', true: colors.text }}
            thumbColor={isDark ? '#A1A1AA' : '#FFFFFF'}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    color: '#111111',
    letterSpacing: -0.5,
    marginBottom: 16,
    fontFamily: 'DMSans_700Bold',
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#484848',
    lineHeight: 22,
    marginBottom: 32,
    fontFamily: 'DMSans_400Regular',
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  toggleTitle: {
    fontSize: 16,
    color: '#1E1E1E',
    fontFamily: 'DMSans_500Medium',
  },
  comingSoonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  comingSoonText: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
    letterSpacing: 0.4,
  },
  toggleSubtitle: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 20,
    fontFamily: 'DMSans_400Regular',
  },
});
