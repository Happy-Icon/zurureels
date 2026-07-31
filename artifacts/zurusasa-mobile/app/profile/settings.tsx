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
  iconBg: string;
  iconColor: string;
  route: string;
  badge?: string;
}

export default function SettingsHubScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { role, viewMode } = useAuth();

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 110 : insets.bottom + 50;

  const accountItems: SettingsMenuItem[] = [
    {
      id: 'info',
      title: 'Personal Information',
      subtitle: 'Name, email, phone number and host identity verification',
      icon: 'user',
      iconBg: '#F0F9FF',
      iconColor: '#0284C7',
      route: '/profile/info',
    },
    {
      id: 'security',
      title: 'Security',
      subtitle: 'Password, 2FA, passkeys, active sessions and login alerts',
      icon: 'shield',
      iconBg: '#ECFDF5',
      iconColor: '#059669',
      route: '/profile/security',
    },
  ];

  const notificationItems: SettingsMenuItem[] = [
    {
      id: 'notifications',
      title: 'Notifications Hub',
      subtitle: 'Travel alerts, host chats, price drops, delivery channels & schedule',
      icon: 'bell',
      iconBg: '#FEF2F2',
      iconColor: '#EF4444',
      route: '/profile/notifications',
      badge: 'Hub',
    },
  ];

  const financialAndSupportItems: SettingsMenuItem[] = [
    {
      id: 'payments',
      title: viewMode === 'host' ? 'Payments & Payouts' : 'Payments & Billing',
      subtitle: viewMode === 'host' ? 'Payout methods, M-Pesa business & earnings' : 'Saved payment methods, receipts and refund history',
      icon: 'credit-card',
      iconBg: '#F0FDF4',
      iconColor: '#16A34A',
      route: '/profile/payments',
    },
    {
      id: 'support',
      title: 'Help & Support',
      subtitle: '24/7 Coastal Concierge, safety center and resolution hub',
      icon: 'help-circle',
      iconBg: '#FAF5FF',
      iconColor: '#9333EA',
      route: '/profile/support',
    },
  ];

  const renderSection = (heading: string, items: SettingsMenuItem[]) => (
    <View style={styles.sectionBlock} key={heading}>
      <Text style={styles.sectionHeading}>{heading}</Text>
      <View style={styles.cardContainer}>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <React.Fragment key={item.id}>
              <Pressable
                onPress={() => router.push(item.route as any)}
                style={({ pressed }) => [styles.rowItem, pressed && styles.rowItemActive]}
              >
                <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
                  <Feather name={item.icon} size={18} color={item.iconColor} />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    {item.badge && (
                      <View style={styles.badgePill}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.rowSub}>{item.subtitle}</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#94A3B8" />
              </Pressable>
              {!isLast && <View style={styles.divider} />}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push('/profile')}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnActive]}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Settings</Text>
          <Text style={styles.pageSubtitle}>
            Manage your personal profile, app preferences, security, notifications, and payouts.
          </Text>
        </View>

        {renderSection('Account Settings', accountItems)}
        {renderSection('Notifications & Alerts', notificationItems)}
        {renderSection('Billing & Support', financialAndSupportItems)}

        <View style={styles.footerInfo}>
          <Text style={styles.footerAppText}>ZuruSasa Mobile · Version 1.2.0 (Build 482)</Text>
          <Text style={styles.footerRegionText}>Kenya Coast 🌴 · Premium Hospitality Platform</Text>
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
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnActive: {
    backgroundColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  titleSection: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 20,
  },
  sectionBlock: {
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
      },
    }),
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowItemActive: {
    opacity: 0.7,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  rowSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  badgePill: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F26522',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 52,
  },
  footerInfo: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  footerAppText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  footerRegionText: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 4,
  },
});
