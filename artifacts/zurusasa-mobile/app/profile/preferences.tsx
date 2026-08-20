import React, { useState } from 'react';
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
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';
import { AppearanceSelector } from '@/components/settings/AppearanceSelector';

export default function PreferencesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const { isDark } = useTheme();

  // Additional Preference states
  const [reduceMotion, setReduceMotion] = useState(false);
  const [autoPlayReels, setAutoPlayReels] = useState(true);

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 32;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Pressable
          testID="preferences-back-btn"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (router.canGoBack()) router.back();
            else router.push('/profile/settings');
          }}
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: isDark ? '#27272A' : '#F5F5F5' },
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Preferences</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      >
        {/* Section 1: Appearance */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconWrap, { backgroundColor: isDark ? '#27272A' : '#FFF5EF' }]}>
              <Ionicons name="color-palette-outline" size={20} color="#F26522" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>Appearance</Text>
              <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                Customize theme mode for feeds, maps, and host controls.
              </Text>
            </View>
          </View>

          <AppearanceSelector />
        </View>

        {/* Section 2: Motion & Feed Playback */}
        <View style={[styles.sectionBlock, { marginTop: 28 }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconWrap, { backgroundColor: isDark ? '#27272A' : '#FFF5EF' }]}>
              <Ionicons name="film-outline" size={20} color="#F26522" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>Feed Playback</Text>
              <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                Control video autoplay and transitions on cellular networks.
              </Text>
            </View>
          </View>

          <View style={[styles.switchCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.switchTitle, { color: colors.text }]}>Autoplay Coastal Reels</Text>
              <Text style={[styles.switchSub, { color: colors.mutedForeground }]}>
                Play preview videos automatically as you scroll through ZuruFlow
              </Text>
            </View>
            <Switch
              value={autoPlayReels}
              onValueChange={(val) => {
                Haptics.selectionAsync();
                setAutoPlayReels(val);
              }}
              trackColor={{ false: isDark ? '#3F3F46' : '#E2E8F0', true: '#F26522' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.switchCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.switchTitle, { color: colors.text }]}>Reduce Motion</Text>
              <Text style={[styles.switchSub, { color: colors.mutedForeground }]}>
                Minimizes animations when opening sheets and booking cards
              </Text>
            </View>
            <Switch
              value={reduceMotion}
              onValueChange={(val) => {
                Haptics.selectionAsync();
                setReduceMotion(val);
              }}
              trackColor={{ false: isDark ? '#3F3F46' : '#E2E8F0', true: '#F26522' }}
              thumbColor="#FFFFFF"
            />
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionBlock: {
    width: '100%',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 18,
    marginTop: 2,
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  switchTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    marginBottom: 3,
  },
  switchSub: {
    fontSize: 12.5,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 17,
  },
});
