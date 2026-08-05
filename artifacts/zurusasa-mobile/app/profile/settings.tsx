import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';

interface SettingsMenuItem {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  route: string;
  isDividerAfter?: boolean;
}

export default function SettingsHubScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { viewMode } = useAuth();

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 12;
  const bottomPad = Platform.OS === 'web' ? 110 : insets.bottom + 50;

  const settingsItems: SettingsMenuItem[] = [
    {
      id: 'info',
      title: 'Personal information',
      subtitle: 'Provide legal name, contact info & identity verification',
      icon: 'user',
      route: '/profile/info',
    },
    {
      id: 'security',
      title: 'Login & security',
      subtitle: 'Update password, 2FA, privacy & device security',
      icon: 'shield',
      route: '/profile/security',
      isDividerAfter: true,
    },
    {
      id: 'payments',
      title: viewMode === 'host' ? 'Payout methods' : 'Payments & payouts',
      subtitle: viewMode === 'host' ? 'M-Pesa business & bank account details' : 'Saved payment methods & receipts',
      icon: 'credit-card',
      route: '/profile/payments',
    },
    {
      id: 'notifications',
      title: 'Notifications',
      subtitle: 'Choose notification preferences & delivery channels',
      icon: 'bell',
      route: '/profile/notifications',
      isDividerAfter: true,
    },
    {
      id: 'global',
      title: 'Global preferences',
      subtitle: 'Set preferred language, currency & timezone',
      icon: 'globe',
      route: '/profile/settings',
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/profile');
          }}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnActive]}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={20} color="#000000" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Account settings</Text>
        </View>

        {/* ── LIST ROWS ────────────────────────────────────────────────────── */}
        <View style={styles.menuListBlock}>
          {settingsItems.map((item) => (
            <React.Fragment key={item.id}>
              <Pressable
                onPress={() => router.push(item.route as any)}
                style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              >
                <Feather name={item.icon} size={22} color="#000000" style={styles.menuIcon} />
                <View style={styles.menuTextStack}>
                  <Text style={styles.menuRowTitle}>{item.title}</Text>
                  <Text style={styles.menuRowSub}>{item.subtitle}</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#94A3B8" />
              </Pressable>

              {item.isDividerAfter && <View style={styles.divider} />}
            </React.Fragment>
          ))}
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
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnActive: {
    backgroundColor: '#E5E7EB',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  titleSection: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.8,
  },
  menuListBlock: {
    marginBottom: 20,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
  },
  menuRowPressed: {
    opacity: 0.6,
  },
  menuIcon: {
    marginRight: 16,
  },
  menuTextStack: {
    flex: 1,
    paddingRight: 8,
  },
  menuRowTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  menuRowSub: {
    fontSize: 13,
    color: '#717171',
    marginTop: 2,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
});
