import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';
import { AppearanceModalSheet } from '@/components/settings/AppearanceSelector';

type SettingsModalType =
  | 'booking_permissions'
  | 'accessibility'
  | 'appearance'
  | null;

interface SettingsMenuItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  iconFamily: 'feather' | 'ionicons' | 'material';
  iconName: string;
  onPress: () => void;
}

export default function AccountSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const { appearanceMode, isDark } = useTheme();

  const [activeModal, setActiveModal] = useState<SettingsModalType>(null);

  // Settings State
  const [coHostBooking, setCoHostBooking] = useState(true);
  const [instantBookingRule, setInstantBookingRule] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 24;

  const appearanceLabel =
    appearanceMode === 'system'
      ? 'System'
      : appearanceMode === 'dark'
      ? 'Dark'
      : 'Light';

  const accountMenuItems: SettingsMenuItem[] = [
    {
      id: 'personal_info',
      title: 'Personal information',
      iconFamily: 'feather',
      iconName: 'user',
      onPress: () => router.push('/profile/info'),
    },
    {
      id: 'security',
      title: 'Login & security',
      iconFamily: 'feather',
      iconName: 'shield',
      onPress: () => router.push('/profile/security'),
    },
    {
      id: 'privacy',
      title: 'Privacy',
      iconFamily: 'ionicons',
      iconName: 'hand-right-outline',
      onPress: () => router.push('/profile/privacy'),
    },
    {
      id: 'notifications',
      title: 'Notifications',
      iconFamily: 'material',
      iconName: 'bell-cog-outline',
      onPress: () => router.push('/profile/notifications'),
    },
    {
      id: 'payments',
      title: 'Payments',
      iconFamily: 'material',
      iconName: 'cash-multiple',
      onPress: () => router.push('/profile/payments'),
    },
    {
      id: 'translation',
      title: 'Translation',
      iconFamily: 'feather',
      iconName: 'globe',
      onPress: () => router.push('/profile/translation'),
    },
  ];

  const preferencesMenuItems: SettingsMenuItem[] = [
    {
      id: 'appearance',
      title: 'Appearance',
      subtitle: appearanceLabel,
      iconFamily: 'ionicons',
      iconName: 'color-palette-outline',
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveModal('appearance');
      },
    },
    {
      id: 'all_preferences',
      title: 'Preferences & Playback',
      iconFamily: 'ionicons',
      iconName: 'options-outline',
      onPress: () => router.push('/profile/preferences'),
    },
    {
      id: 'accessibility',
      title: 'Accessibility',
      iconFamily: 'material',
      iconName: 'cog-outline',
      onPress: () => setActiveModal('accessibility'),
    },
  ];

  const hostingMenuItems: SettingsMenuItem[] = [
    {
      id: 'booking_permissions',
      title: 'Booking permissions',
      badge: 'New',
      iconFamily: 'material',
      iconName: 'key-outline',
      onPress: () => setActiveModal('booking_permissions'),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable
          testID="settings-back-btn"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (router.canGoBack()) router.back();
            else router.push('/(tabs)/profile');
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
      </View>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      >
        {/* Title */}
        <Text style={[styles.pageTitle, { color: colors.text }]}>Account Settings</Text>

        {/* Section 1: Account */}
        <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>ACCOUNT</Text>
        <View style={[styles.menuBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {accountMenuItems.map((item, idx) => (
            <Pressable
              key={item.id}
              testID={`settings-item-${item.id}`}
              onPress={item.onPress}
              style={({ pressed }) => [
                styles.rowItem,
                idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                pressed && { opacity: 0.6 },
              ]}
            >
              {/* Left Icon */}
              <View style={styles.iconWrapper}>
                {item.iconFamily === 'feather' && (
                  <Feather name={item.iconName as any} size={20} color={colors.text} />
                )}
                {item.iconFamily === 'ionicons' && (
                  <Ionicons name={item.iconName as any} size={21} color={colors.text} />
                )}
                {item.iconFamily === 'material' && (
                  <MaterialCommunityIcons name={item.iconName as any} size={22} color={colors.text} />
                )}
              </View>

              {/* Title */}
              <View style={styles.titleWrapper}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{item.title}</Text>
              </View>

              {/* Right Chevron */}
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} style={styles.chevron} />
            </Pressable>
          ))}
        </View>

        {/* Section 2: Preferences */}
        <Text style={[styles.sectionHeader, { color: colors.mutedForeground, marginTop: 24 }]}>PREFERENCES</Text>
        <View style={[styles.menuBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {preferencesMenuItems.map((item, idx) => (
            <Pressable
              key={item.id}
              testID={`settings-item-${item.id}`}
              onPress={item.onPress}
              style={({ pressed }) => [
                styles.rowItem,
                idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                pressed && { opacity: 0.6 },
              ]}
            >
              {/* Left Icon */}
              <View style={styles.iconWrapper}>
                {item.iconFamily === 'feather' && (
                  <Feather name={item.iconName as any} size={20} color={colors.text} />
                )}
                {item.iconFamily === 'ionicons' && (
                  <Ionicons name={item.iconName as any} size={21} color={colors.text} />
                )}
                {item.iconFamily === 'material' && (
                  <MaterialCommunityIcons name={item.iconName as any} size={22} color={colors.text} />
                )}
              </View>

              {/* Title & Subtitle */}
              <View style={styles.titleWrapper}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{item.title}</Text>
                {item.subtitle && (
                  <View style={[styles.valueBadge, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
                    <Text style={[styles.valueBadgeText, { color: colors.primary }]}>{item.subtitle}</Text>
                  </View>
                )}
              </View>

              {/* Right Chevron */}
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} style={styles.chevron} />
            </Pressable>
          ))}
        </View>

        {/* Section 3: Hosting */}
        <Text style={[styles.sectionHeader, { color: colors.mutedForeground, marginTop: 24 }]}>HOSTING & OPERATIONS</Text>
        <View style={[styles.menuBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {hostingMenuItems.map((item, idx) => (
            <Pressable
              key={item.id}
              testID={`settings-item-${item.id}`}
              onPress={item.onPress}
              style={({ pressed }) => [
                styles.rowItem,
                idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                pressed && { opacity: 0.6 },
              ]}
            >
              {/* Left Icon */}
              <View style={styles.iconWrapper}>
                {item.iconFamily === 'material' && (
                  <MaterialCommunityIcons name={item.iconName as any} size={22} color={colors.text} />
                )}
              </View>

              {/* Title & Badge */}
              <View style={styles.titleWrapper}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{item.title}</Text>
                {item.badge && (
                  <View style={styles.badgePill}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                )}
              </View>

              {/* Right Chevron */}
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} style={styles.chevron} />
            </Pressable>
          ))}
        </View>

        {/* App Version Footer */}
        <Text style={[styles.versionFooter, { color: colors.mutedForeground }]}>ZuruSasa Mobile · Version 0.1.0</Text>
      </ScrollView>

      {/* ── MODAL: APPEARANCE SELECTOR SHEET ─────────────────────────────────── */}
      <AppearanceModalSheet
        visible={activeModal === 'appearance'}
        onClose={() => setActiveModal(null)}
      />

      {/* ── MODAL 1: BOOKING PERMISSIONS ─────────────────────────────────────── */}
      <Modal
        visible={activeModal === 'booking_permissions'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setActiveModal(null)} style={[styles.modalCloseBtn, { backgroundColor: isDark ? '#27272A' : '#F5F5F5' }]} hitSlop={10}>
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
            <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>Booking permissions</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={[styles.docHeadline, { color: colors.text }]}>Manage who can book</Text>
            <Text style={[styles.formSub, { color: colors.mutedForeground }]}>
              Control permissions for team members, co-hosts, and assistant accounts on ZuruSasa.
            </Text>

            <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.switchTitle, { color: colors.text }]}>Allow Co-Hosts to accept bookings</Text>
                <Text style={[styles.switchSub, { color: colors.mutedForeground }]}>Co-hosts can manage reservation requests on your behalf</Text>
              </View>
              <Switch
                value={coHostBooking}
                onValueChange={(v) => {
                  Haptics.selectionAsync();
                  setCoHostBooking(v);
                }}
                trackColor={{ false: isDark ? '#3F3F46' : '#E2E8F0', true: '#F26522' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.switchRow, { borderBottomColor: colors.border, marginTop: 16 }]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.switchTitle, { color: colors.text }]}>Strict Guest Verification</Text>
                <Text style={[styles.switchSub, { color: colors.mutedForeground }]}>Only allow guests with verified government ID to book instantly</Text>
              </View>
              <Switch
                value={instantBookingRule}
                onValueChange={(v) => {
                  Haptics.selectionAsync();
                  setInstantBookingRule(v);
                }}
                trackColor={{ false: isDark ? '#3F3F46' : '#E2E8F0', true: '#F26522' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <Pressable
              onPress={() => {
                Alert.alert('Permissions Updated', 'Your booking rules have been saved.');
                setActiveModal(null);
              }}
              style={[styles.primaryBtn, { backgroundColor: '#F26522' }]}
            >
              <Text style={styles.primaryBtnText}>Save rules</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* ── MODAL 2: ACCESSIBILITY ───────────────────────────────────────────── */}
      <Modal
        visible={activeModal === 'accessibility'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setActiveModal(null)} style={[styles.modalCloseBtn, { backgroundColor: isDark ? '#27272A' : '#F5F5F5' }]} hitSlop={10}>
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
            <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>Accessibility</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={[styles.docHeadline, { color: colors.text }]}>Display & Accessibility</Text>
            <Text style={[styles.formSub, { color: colors.mutedForeground }]}>
              Customize visual contrast and readability preferences for coastal feeds and reels.
            </Text>

            <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.switchTitle, { color: colors.text }]}>High Contrast Mode</Text>
                <Text style={[styles.switchSub, { color: colors.mutedForeground }]}>Enhances text outlines and button visibility in bright sunlight</Text>
              </View>
              <Switch
                value={highContrast}
                onValueChange={(v) => {
                  Haptics.selectionAsync();
                  setHighContrast(v);
                }}
                trackColor={{ false: isDark ? '#3F3F46' : '#E2E8F0', true: '#F26522' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.switchRow, { borderBottomColor: colors.border, marginTop: 16 }]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.switchTitle, { color: colors.text }]}>Larger Typography</Text>
                <Text style={[styles.switchSub, { color: colors.mutedForeground }]}>Scales text size across listing details and checkout</Text>
              </View>
              <Switch
                value={largeText}
                onValueChange={(v) => {
                  Haptics.selectionAsync();
                  setLargeText(v);
                }}
                trackColor={{ false: isDark ? '#3F3F46' : '#E2E8F0', true: '#F26522' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <Pressable
              onPress={() => {
                Alert.alert('Accessibility Updated', 'Display preferences have been applied.');
                setActiveModal(null);
              }}
              style={[styles.primaryBtn, { backgroundColor: '#F26522' }]}
            >
              <Text style={styles.primaryBtnText}>Apply settings</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
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
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 20,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  sectionHeader: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuBlock: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  rowItemPressed: {
    opacity: 0.6,
  },
  iconWrapper: {
    width: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: 14,
  },
  titleWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: {
    fontSize: 15.5,
    fontFamily: 'DMSans_500Medium',
  },
  valueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  valueBadgeText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_700Bold',
  },
  badgePill: {
    backgroundColor: '#FF385C',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  chevron: {
    marginLeft: 8,
  },
  versionFooter: {
    fontSize: 13,
    marginTop: 28,
    textAlign: 'center',
    fontFamily: 'DMSans_400Regular',
  },

  /* Modal Sheets */
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
    borderBottomColor: '#F0F0F0',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    maxWidth: '70%',
    textAlign: 'center',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  docHeadline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  formSub: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 20,
    marginBottom: 24,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 2,
  },
  switchSub: {
    fontSize: 13,
    color: '#717171',
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
