import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function LoginAndSecurityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [pageLoading, setPageLoading] = useState(true);

  const [twoFactor, setTwoFactor] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<'app' | 'sms'>('app');
  const [loginAlerts, setLoginAlerts] = useState(true);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 40;

  const deviceLabel =
    Platform.OS === 'ios'
      ? 'iPhone · ZuruSasa Mobile App'
      : Platform.OS === 'android'
      ? 'Android Phone · ZuruSasa Mobile App'
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

  // Instant Auto-Save Helper
  const autoSaveSecurity = async (tf: boolean, la: boolean) => {
    if (!user) return;
    try {
      await supabase
        .from('profiles')
        .update({
          security_settings: {
            two_factor: tf,
            login_alerts: la,
            sms_notifications: false,
          },
        })
        .eq('id', user.id);
    } catch (e) {
      console.error('Auto-save security error:', e);
    }
  };

  const handleToggle2FA = (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTwoFactor(val);
    autoSaveSecurity(val, loginAlerts);
  };

  const handleToggleAlerts = (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoginAlerts(val);
    autoSaveSecurity(twoFactor, val);
  };

  const handleLogoutDevice = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Log out of device', 'Are you sure you want to log out of this active session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  if (pageLoading) {
    return (
      <View style={[styles.fill, styles.centered, { backgroundColor: '#FFFFFF' }]}>
        <ActivityIndicator size="large" color="#EE7D30" />
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: '#FFFFFF' }]}>
      {/* 1. Top Header & Navigation */}
      <View style={[styles.topNavBar, { paddingTop: topPad }]}>
        <Pressable
          testID="security-back-btn"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
          <Text style={styles.pageTitle}>Login & security</Text>
        </View>

        {/* 2. Soft Neutral Summary Banner */}
        <View style={styles.summaryBanner}>
          <Feather name="shield" size={18} color="#EE7D30" />
          <Text style={styles.summaryBannerText}>
            Manage your login credentials, multi-factor authentication, and connected devices.
          </Text>
        </View>

        {/* 3. Active Login Sessions ("Where you're logged in") */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Where you're logged in</Text>

          <View style={styles.deviceRow}>
            <View style={styles.deviceIconCircle}>
              <Feather
                name={Platform.OS === 'web' ? 'monitor' : 'smartphone'}
                size={20}
                color="#222222"
              />
            </View>

            <View style={styles.deviceTextWrap}>
              <Text style={styles.deviceTitle}>{deviceLabel}</Text>
              <Text style={styles.deviceSubtext}>Active now · Current location</Text>
            </View>

            <Pressable onPress={handleLogoutDevice} hitSlop={8}>
              <Text style={styles.logoutLink}>Log out</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionDivider} />

        {/* 4. Security Controls & Toggle Architecture */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Account Security</Text>

          {/* Two-Factor Authentication */}
          <View style={styles.settingRow}>
            <View style={styles.textColumn}>
              <Text style={styles.rowTitle}>Two-Factor Authentication (2FA)</Text>
              <Text style={styles.rowSubtext}>
                Add extra security using SMS or an authenticator app when logging in.
              </Text>
            </View>
            <Switch
              value={twoFactor}
              onValueChange={handleToggle2FA}
              trackColor={{ true: '#EE7D30', false: '#EBEBEB' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* 2FA Preferred Method Selector */}
          {twoFactor ? (
            <View style={styles.methodWrap}>
              <Text style={styles.methodLabel}>Preferred 2FA Method</Text>
              <View style={styles.segmentedControlTrack}>
                {(
                  [
                    { key: 'app', label: 'Authenticator App' },
                    { key: 'sms', label: 'SMS Message' },
                  ] as const
                ).map((m) => {
                  const isSelected = twoFactorMethod === m.key;
                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setTwoFactorMethod(m.key);
                      }}
                      style={[
                        styles.segmentedTile,
                        isSelected ? styles.segmentedTileActive : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentedTileText,
                          isSelected ? styles.segmentedTileTextActive : null,
                        ]}
                      >
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.rowDivider} />

          {/* Login Alerts */}
          <View style={styles.settingRow}>
            <View style={styles.textColumn}>
              <Text style={styles.rowTitle}>Login Alerts</Text>
              <Text style={styles.rowSubtext}>
                Get notified if someone logs into your account from an unrecognized device.
              </Text>
            </View>
            <Switch
              value={loginAlerts}
              onValueChange={handleToggleAlerts}
              trackColor={{ true: '#EE7D30', false: '#EBEBEB' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.rowDivider} />

          {/* Password & Credentials */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert('Update Password', 'A password reset link will be sent to your email.');
            }}
            style={({ pressed }) => [
              styles.settingRow,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.textColumn}>
              <Text style={styles.rowTitle}>Password & Security Keys</Text>
              <Text style={styles.rowSubtext}>
                Update your account password or manage security passkeys.
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color="#717171" />
          </Pressable>
        </View>
      </ScrollView>
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
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    letterSpacing: -0.4,
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  summaryBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    lineHeight: 18,
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
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  deviceIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceTextWrap: {
    flex: 1,
    gap: 2,
  },
  deviceTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  deviceSubtext: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  logoutLink: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#EE7D30',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginVertical: 24,
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
  rowDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
  },
  methodWrap: {
    marginTop: 8,
    marginBottom: 12,
    gap: 8,
  },
  methodLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  segmentedControlTrack: {
    flexDirection: 'row',
    backgroundColor: '#F7F7F7',
    borderRadius: 10,
    padding: 3,
  },
  segmentedTile: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentedTileActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentedTileText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  segmentedTileTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
});
