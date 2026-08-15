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

type SettingsModalType =
  | 'booking_permissions'
  | 'accessibility'
  | null;

export default function AccountSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeModal, setActiveModal] = useState<SettingsModalType>(null);

  // Settings State
  const [coHostBooking, setCoHostBooking] = useState(true);
  const [instantBookingRule, setInstantBookingRule] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 24;

  const mainMenuItems = [
    {
      id: 'personal_info',
      title: 'Personal information',
      iconFamily: 'feather' as const,
      iconName: 'user' as const,
      onPress: () => router.push('/profile/info'),
    },
    {
      id: 'security',
      title: 'Login & security',
      iconFamily: 'feather' as const,
      iconName: 'shield' as const,
      onPress: () => router.push('/profile/security'),
    },
    {
      id: 'privacy',
      title: 'Privacy',
      iconFamily: 'ionicons' as const,
      iconName: 'hand-right-outline' as const,
      onPress: () => router.push('/profile/privacy'),
    },
    {
      id: 'notifications',
      title: 'Notifications',
      iconFamily: 'material' as const,
      iconName: 'bell-cog-outline' as const,
      onPress: () => router.push('/profile/notifications'),
    },
    {
      id: 'payments',
      title: 'Payments',
      iconFamily: 'material' as const,
      iconName: 'cash-multiple' as const,
      onPress: () => router.push('/profile/payments'),
    },
    {
      id: 'translation',
      title: 'Translation',
      iconFamily: 'feather' as const,
      iconName: 'globe' as const,
      onPress: () => router.push('/profile/translation'),
    },
    {
      id: 'booking_permissions',
      title: 'Booking permissions',
      badge: 'New',
      iconFamily: 'material' as const,
      iconName: 'key-outline' as const,
      onPress: () => setActiveModal('booking_permissions'),
    },
    {
      id: 'accessibility',
      title: 'Accessibility',
      iconFamily: 'material' as const,
      iconName: 'cog-outline' as const,
      onPress: () => setActiveModal('accessibility'),
    },
  ];

  return (
    <View style={styles.container}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable
          testID="settings-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/(tabs)/profile');
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
        <Text style={styles.pageTitle}>Account Settings</Text>

        {/* Top Menu Block */}
        <View style={styles.menuBlock}>
          {mainMenuItems.map((item) => (
            <Pressable
              key={item.id}
              testID={`settings-item-${item.id}`}
              onPress={item.onPress}
              style={({ pressed }) => [styles.rowItem, pressed && styles.rowItemPressed]}
            >
              {/* Left Icon */}
              <View style={styles.iconWrapper}>
                {item.iconFamily === 'feather' && (
                  <Feather name={item.iconName as any} size={22} color="#1E1E1E" />
                )}
                {item.iconFamily === 'ionicons' && (
                  <Ionicons name={item.iconName as any} size={22} color="#1E1E1E" />
                )}
                {item.iconFamily === 'material' && (
                  <MaterialCommunityIcons name={item.iconName as any} size={23} color="#1E1E1E" />
                )}
              </View>

              {/* Title & Badge */}
              <View style={styles.titleWrapper}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                {item.badge && (
                  <View style={styles.badgePill}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                )}
              </View>

              {/* Right Chevron */}
              <Feather name="chevron-right" size={20} color="#717171" style={styles.chevron} />
            </Pressable>
          ))}
        </View>

        {/* Divider before Version */}
        <View style={styles.dividerLine} />

        {/* App Version Footer */}
        <Text style={styles.versionFooter}>Version 0.1.0</Text>
      </ScrollView>

      {/* ── MODAL 1: BOOKING PERMISSIONS ─────────────────────────────────────── */}
      <Modal
        visible={activeModal === 'booking_permissions'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseBtn} hitSlop={10}>
              <Feather name="x" size={22} color="#111111" />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>Booking permissions</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={styles.docHeadline}>Manage who can book</Text>
            <Text style={styles.formSub}>
              Control permissions for team members, co-hosts, and assistant accounts on ZuruSasa.
            </Text>

            <View style={styles.switchRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.switchTitle}>Allow Co-Hosts to accept bookings</Text>
                <Text style={styles.switchSub}>Co-hosts can manage reservation requests on your behalf</Text>
              </View>
              <Switch
                value={coHostBooking}
                onValueChange={setCoHostBooking}
                trackColor={{ false: '#E2E8F0', true: '#111111' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.switchRow, { marginTop: 16 }]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.switchTitle}>Strict Guest Verification</Text>
                <Text style={styles.switchSub}>Only allow guests with verified government ID to book instantly</Text>
              </View>
              <Switch
                value={instantBookingRule}
                onValueChange={setInstantBookingRule}
                trackColor={{ false: '#E2E8F0', true: '#111111' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <Pressable
              onPress={() => {
                Alert.alert('Permissions Updated', 'Your booking rules have been saved.');
                setActiveModal(null);
              }}
              style={styles.primaryBtn}
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
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseBtn} hitSlop={10}>
              <Feather name="x" size={22} color="#111111" />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>Accessibility</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={styles.docHeadline}>Display & Accessibility</Text>
            <Text style={styles.formSub}>
              Customize visual contrast and readability preferences for coastal feeds and reels.
            </Text>

            <View style={styles.switchRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.switchTitle}>High Contrast Mode</Text>
                <Text style={styles.switchSub}>Enhances text outlines and button visibility in bright sunlight</Text>
              </View>
              <Switch
                value={highContrast}
                onValueChange={setHighContrast}
                trackColor={{ false: '#E2E8F0', true: '#111111' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.switchRow, { marginTop: 16 }]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.switchTitle}>Larger Typography</Text>
                <Text style={styles.switchSub}>Scales text size across listing details and checkout</Text>
              </View>
              <Switch
                value={largeText}
                onValueChange={setLargeText}
                trackColor={{ false: '#E2E8F0', true: '#111111' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <Pressable
              onPress={() => {
                Alert.alert('Accessibility Updated', 'Display preferences have been applied.');
                setActiveModal(null);
              }}
              style={styles.primaryBtn}
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
    marginBottom: 20,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  menuBlock: {
    width: '100%',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
  },
  rowItemPressed: {
    opacity: 0.6,
  },
  iconWrapper: {
    width: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: 16,
  },
  titleWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 16,
    color: '#1E1E1E',
    fontWeight: '400',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_500Medium',
      default: 'sans-serif',
    }),
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
    marginLeft: 12,
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 16,
  },
  versionFooter: {
    fontSize: 13,
    color: '#717171',
    marginTop: 8,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_400Regular',
      default: 'sans-serif',
    }),
  },

  /* Modal Sheets */
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
