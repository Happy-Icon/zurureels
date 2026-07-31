import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { useCustomAlert } from '@/context/CustomAlertContext';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/Skeleton';

export default function SecurityCenterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useCustomAlert();

  const [pageLoading, setPageLoading] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);
  const [passkeysEnabled, setPasskeysEnabled] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 110 : insets.bottom + 50;

  const deviceLabel =
    Platform.OS === 'ios'
      ? 'iPhone · ZuruSasa Mobile'
      : Platform.OS === 'android'
      ? 'Android Device · ZuruSasa Mobile'
      : 'Web Browser · ZuruSasa';

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('security_settings')
          .eq('id', user.id)
          .single();
        if (data?.security_settings) {
          const s = data.security_settings as any;
          setTwoFactor(s.two_factor || false);
          setLoginAlerts(s.login_alerts !== undefined ? s.login_alerts : true);
        }
      } catch (e) {
        console.error('Error fetching security settings:', e);
      } finally {
        setPageLoading(false);
      }
    };
    fetchSettings();
  }, [user]);

  const autoSaveSecurity = async (tf: boolean, la: boolean) => {
    if (!user) return;
    try {
      await supabase
        .from('profiles')
        .update({
          security_settings: {
            two_factor: tf,
            login_alerts: la,
          },
        })
        .eq('id', user.id);
    } catch (e) {
      console.error('Auto-save security error:', e);
    }
  };

  const handleToggle2FA = (val: boolean) => {
    setTwoFactor(val);
    autoSaveSecurity(val, loginAlerts);
  };

  const handleToggleAlerts = (val: boolean) => {
    setLoginAlerts(val);
    autoSaveSecurity(twoFactor, val);
  };

  const handleChangePassword = () => {
    showAlert({
      title: '🔑 Reset Password Request',
      message: `A password reset link will be sent to ${user?.email || 'your registered email'}.`,
      icon: 'key',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send Reset Link', onPress: () => supabase.auth.resetPasswordForEmail(user?.email || '') },
      ],
    });
  };

  const handleLogoutDevice = () => {
    Alert.alert('Log Out Active Session', 'Are you sure you want to terminate this active device session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  if (pageLoading) {
    return (
      <View style={[styles.container, { paddingTop: topPad, paddingHorizontal: 20, gap: 16 }]}>
        <Skeleton style={{ height: 40, width: 40, borderRadius: 20 }} />
        <Skeleton style={{ height: 32, width: 220, borderRadius: 8 }} />
        <Skeleton style={{ height: 90, borderRadius: 20 }} />
        <Skeleton style={{ height: 140, borderRadius: 20 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnActive]}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </Pressable>
        <Text style={styles.headerTitle}>Security</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Security Center</Text>
          <Text style={styles.pageSubtitle}>
            Protect your ZuruSasa account with passkeys, two-factor authentication, and device login alerts.
          </Text>
        </View>

        {/* ── CARD 1: ACCOUNT ACCESS & PASSWORDS ─────────────────────────────── */}
        <View style={styles.cardContainer}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: '#F0F9FF' }]}>
              <Feather name="key" size={18} color="#0284C7" />
            </View>
            <Text style={styles.cardTitle}>Account Authentication</Text>
          </View>

          <Pressable
            onPress={handleChangePassword}
            style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowActive]}
          >
            <View style={styles.actionIconBox}>
              <Feather name="lock" size={16} color="#0F172A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Change Password</Text>
              <Text style={styles.actionSub}>Update your login password and security credentials</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </Pressable>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Passkeys & Biometrics</Text>
              <Text style={styles.rowSub}>Log in faster using Face ID, Touch ID, or device PIN</Text>
            </View>
            <Switch
              value={passkeysEnabled}
              onValueChange={setPasskeysEnabled}
              trackColor={{ false: '#E2E8F0', true: '#F26522' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* ── CARD 2: MULTI-FACTOR AUTH & ALERTS ──────────────────────────────── */}
        <View style={styles.cardContainer}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
              <Feather name="shield" size={18} color="#059669" />
            </View>
            <Text style={styles.cardTitle}>Protection & 2FA</Text>
          </View>

          <View style={styles.row}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Two-Factor Authentication (2FA)</Text>
              <Text style={styles.rowSub}>Require a verification code on new device sign-in</Text>
            </View>
            <Switch
              value={twoFactor}
              onValueChange={handleToggle2FA}
              trackColor={{ false: '#E2E8F0', true: '#F26522' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Unrecognized Device Login Alerts</Text>
              <Text style={styles.rowSub}>Instant notification when a new device accesses your account</Text>
            </View>
            <Switch
              value={loginAlerts}
              onValueChange={handleToggleAlerts}
              trackColor={{ false: '#E2E8F0', true: '#F26522' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* ── CARD 3: ACTIVE SESSIONS ─────────────────────────────────────────── */}
        <View style={styles.cardContainer}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: '#F5F3FF' }]}>
              <Feather name="smartphone" size={18} color="#7C3AED" />
            </View>
            <Text style={styles.cardTitle}>Active Sessions</Text>
          </View>

          <View style={styles.sessionRow}>
            <View style={styles.sessionIconBox}>
              <Feather name={Platform.OS === 'web' ? 'monitor' : 'smartphone'} size={18} color="#0F172A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sessionTitle}>{deviceLabel}</Text>
              <Text style={styles.sessionSub}>Active now · Mombasa, Kenya</Text>
            </View>
            <View style={styles.activeBadge}>
              <View style={styles.greenDot} />
              <Text style={styles.activeBadgeText}>Current</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Pressable
            onPress={handleLogoutDevice}
            style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnActive]}
          >
            <Feather name="log-out" size={16} color="#EF4444" />
            <Text style={styles.logoutBtnText}>Log Out Active Session</Text>
          </Pressable>
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
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  rowSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionRowActive: {
    backgroundColor: '#F8FAFC',
  },
  actionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  sessionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  logoutBtnActive: {
    opacity: 0.7,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
});
