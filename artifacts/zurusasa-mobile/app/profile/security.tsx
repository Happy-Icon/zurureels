import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { passkeyService, type PasskeyCredential } from '@/services/passkeyService';
import { Skeleton } from '@/components/Skeleton';

export default function SecurityCenterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { showAlert } = useCustomAlert();

  const [pageLoading, setPageLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Settings State
  const [publicProfile, setPublicProfile] = useState(true);
  const [activityStatus, setActivityStatus] = useState(true);
  const [searchIndexing, setSearchIndexing] = useState(false);
  const [analyticsSharing, setAnalyticsSharing] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [accountStatus, setAccountStatus] = useState<'active' | 'deactivated' | 'pending_deletion' | 'deleted'>('active');

  // Passkey State
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([]);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 12;
  const bottomPad = Platform.OS === 'web' ? 110 : insets.bottom + 50;

  const deviceLabel =
    Platform.OS === 'ios'
      ? 'iPhone · ZuruSasa Mobile'
      : Platform.OS === 'android'
      ? 'Android Device · ZuruSasa Mobile'
      : 'Web Browser · ZuruSasa';

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) {
        setPageLoading(false);
        return;
      }
      try {
        const [profileRes, passkeyRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('security_settings, privacy_settings, account_status')
            .eq('id', user.id)
            .single(),
          passkeyService.listPasskeys(),
        ]);

        const data = profileRes.data;
        if (data) {
          if (data.account_status) setAccountStatus(data.account_status as any);
          if (data.security_settings) {
            const s = data.security_settings as any;
            setTwoFactor(s.two_factor || false);
            setLoginAlerts(s.login_alerts !== undefined ? s.login_alerts : true);
          }
          if (data.privacy_settings) {
            const p = data.privacy_settings as any;
            setPublicProfile(p.public_profile !== undefined ? p.public_profile : true);
            setActivityStatus(p.show_activity_status !== undefined ? p.show_activity_status : true);
            setSearchIndexing(p.search_engine_indexing !== undefined ? p.search_engine_indexing : false);
            setAnalyticsSharing(p.analytics_sharing !== undefined ? p.analytics_sharing : true);
          }
        }

        // Passkey state is strictly determined by real server WebAuthn credentials
        if (passkeyRes && passkeyRes.hasPasskey) {
          setPasskeys(passkeyRes.passkeys || []);
          setPasskeyEnabled(true);
        } else {
          setPasskeys([]);
          setPasskeyEnabled(false);
        }
      } catch (e) {
        console.error('Error fetching settings:', e);
      } finally {
        setPageLoading(false);
      }
    };
    fetchSettings();
  }, [user]);

  const handleEnablePasskey = async () => {
    setPasskeyLoading(true);
    try {
      const res = await passkeyService.register();
      if (res.cancelled) {
        setPasskeyLoading(false);
        return;
      }
      if (!res.success) {
        showAlert({
          title: 'Passkey Setup',
          message: res.error || 'Could not register passkey on this device.',
          icon: 'alert-triangle',
        });
        setPasskeyLoading(false);
        return;
      }
      setPasskeyEnabled(true);
      const passkeyRes = await passkeyService.listPasskeys();
      setPasskeys(passkeyRes.passkeys);
      showAlert({
        title: 'Passkey Enabled',
        message: 'Your passkey is now registered. You can use Face ID, Touch ID, or your device screen lock to sign in quickly and securely.',
        icon: 'check-circle',
      });
    } catch (err: any) {
      showAlert({
        title: 'Passkey Setup Error',
        message: err?.message || 'Failed to register passkey.',
        icon: 'alert-triangle',
      });
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleRemovePasskey = () => {
    showAlert({
      title: 'Remove Passkey',
      message: 'Are you sure you want to remove your registered passkey from this device? You can re-enable it at any time.',
      icon: 'key',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setPasskeyLoading(true);
            try {
              const firstId = passkeys[0]?.id;
              await passkeyService.removePasskey(firstId);
              setPasskeyEnabled(false);
              setPasskeys([]);
              showAlert({
                title: 'Passkey Removed',
                message: 'Your passkey has been removed from this device.',
                icon: 'check-circle',
              });
            } catch (err: any) {
              showAlert({
                title: 'Error',
                message: err?.message || 'Failed to remove passkey.',
              });
            } finally {
              setPasskeyLoading(false);
            }
          },
        },
      ],
    });
  };

  const autoSaveSettings = async (
    tf: boolean,
    la: boolean,
    pub: boolean,
    act: boolean,
    idx: boolean,
    ana: boolean
  ) => {
    if (!user) return;
    try {
      await supabase
        .from('profiles')
        .update({
          security_settings: { two_factor: tf, login_alerts: la },
          privacy_settings: {
            public_profile: pub,
            show_activity_status: act,
            search_engine_indexing: idx,
            analytics_sharing: ana,
          },
        } as any)
        .eq('id', user.id);
    } catch (e) {
      console.error('Auto-save error:', e);
    }
  };

  const handleTogglePrivacy = (key: 'pub' | 'act' | 'idx' | 'ana', val: boolean) => {
    const nextPub = key === 'pub' ? val : publicProfile;
    const nextAct = key === 'act' ? val : activityStatus;
    const nextIdx = key === 'idx' ? val : searchIndexing;
    const nextAna = key === 'ana' ? val : analyticsSharing;

    if (key === 'pub') setPublicProfile(val);
    if (key === 'act') setActivityStatus(val);
    if (key === 'idx') setSearchIndexing(val);
    if (key === 'ana') setAnalyticsSharing(val);

    autoSaveSettings(twoFactor, loginAlerts, nextPub, nextAct, nextIdx, nextAna);
  };

  const handleChangePassword = () => {
    showAlert({
      title: 'Reset password',
      message: `A password reset link will be sent to ${user?.email || 'your email'}.`,
      icon: 'key',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send reset link',
          onPress: async () => {
            if (user?.email) {
              await supabase.auth.resetPasswordForEmail(user.email);
            }
          },
        },
      ],
    });
  };

  const handleDeactivateToggle = () => {
    if (!user) return;

    if (accountStatus === 'deactivated') {
      showAlert({
        title: 'Reactivate account',
        message: 'Reactivating your account will restore your public profile and unhide your listings.',
        icon: 'rotate-ccw',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reactivate',
            onPress: async () => {
              setActionLoading(true);
              try {
                const { data, error } = await supabase.rpc('reactivate_account', { p_user_id: user.id });
                if (error) throw error;
                setAccountStatus('active');
                showAlert({ title: 'Account reactivated', message: data?.message || 'Your account is active.', icon: 'check-circle' });
              } catch (err: any) {
                showAlert({ title: 'Error', message: err.message });
              } finally {
                setActionLoading(false);
              }
            },
          },
        ],
      });
    } else {
      showAlert({
        title: 'Deactivate account',
        message: 'Your profile and listings will be hidden. Existing reservations continue normally. You can reactivate anytime.',
        icon: 'power',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm deactivation',
            style: 'destructive',
            onPress: async () => {
              setActionLoading(true);
              try {
                const { data, error } = await supabase.rpc('deactivate_account', { p_user_id: user.id });
                if (error) throw error;
                setAccountStatus('deactivated');
                showAlert({ title: 'Account deactivated', message: data?.message || 'Your account is deactivated.', icon: 'check-circle' });
              } catch (err: any) {
                showAlert({ title: 'Error', message: err.message });
              } finally {
                setActionLoading(false);
              }
            },
          },
        ],
      });
    }
  };

  const handleDeleteRequest = async () => {
    if (!user) return;

    setActionLoading(true);
    try {
      const { data: eligibility, error } = await supabase.rpc('check_deletion_eligibility', {
        p_user_id: user.id,
      });

      if (error) throw error;
      const res = eligibility as { can_delete: boolean; blockers: any[] };

      if (!res.can_delete && res.blockers.length > 0) {
        const blockerText = res.blockers.map((b: any) => `• ${b.message}`).join('\n');
        showAlert({
          title: "Account cannot be deleted yet",
          message: `Complete outstanding obligations first:\n\n${blockerText}`,
          icon: 'alert-triangle',
          buttons: [
            { text: 'View reservations', onPress: () => router.push('/reservations') },
            { text: 'Close', style: 'cancel' },
          ],
        });
        return;
      }

      showAlert({
        title: 'Delete account permanently?',
        message: 'WARNING: All personal data, saved items, and profile details will be permanently removed.',
        icon: 'trash-2',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Permanently delete',
            style: 'destructive',
            onPress: async () => {
              setActionLoading(true);
              try {
                const { error: fnError } = await supabase.functions.invoke('delete-account', { method: 'POST' });
                if (fnError) throw fnError;
                await signOut();
                showAlert({ title: 'Account deleted', message: 'Your account was deleted.', icon: 'check-circle' });
              } catch (fnErr: any) {
                showAlert({ title: 'Deletion error', message: fnErr.message });
              } finally {
                setActionLoading(false);
              }
            },
          },
        ],
      });
    } catch (err: any) {
      showAlert({ title: 'Error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <View style={[styles.container, { paddingTop: topPad, paddingHorizontal: 24, gap: 16 }]}>
        <Skeleton style={{ height: 40, width: 40, borderRadius: 20 }} />
        <Skeleton style={{ height: 32, width: 220, borderRadius: 8 }} />
        <Skeleton style={{ height: 160, borderRadius: 16 }} />
        <Skeleton style={{ height: 140, borderRadius: 16 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          testID="security-back-btn"
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
          <Text style={styles.pageTitle}>Login & security</Text>
        </View>

        {/* ── SECTION 1: LOGIN ─────────────────────────────────────────────── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Login</Text>
          <View style={styles.menuRowsGroup}>
            {/* Passkeys (Biometrics) */}
            <View style={styles.menuRow}>
              <View style={styles.menuTextStack}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.menuRowTitle}>Passkeys (Biometrics)</Text>
                  {passkeyEnabled && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>ACTIVE</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.menuRowSub}>
                  {passkeyEnabled
                    ? `Registered on ${passkeys[0]?.name || 'this device'} · Face ID / Touch ID sign-in active`
                    : 'Sign in faster using Face ID, Touch ID, or screen lock'}
                </Text>
              </View>
              {passkeyLoading ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : passkeyEnabled ? (
                <Pressable
                  onPress={handleRemovePasskey}
                  hitSlop={8}
                  style={({ pressed }) => [styles.passkeyRemoveBtn, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.passkeyRemoveText}>Remove</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleEnablePasskey}
                  hitSlop={8}
                  style={({ pressed }) => [styles.passkeyEnableBtn, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.passkeyEnableText}>Enable</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.divider} />

            <Pressable
              onPress={handleChangePassword}
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
            >
              <View style={styles.menuTextStack}>
                <Text style={styles.menuRowTitle}>Password</Text>
                <Text style={styles.menuRowSub}>Updated recently</Text>
              </View>
              <Text style={styles.actionText}>Update</Text>
            </Pressable>

            <View style={styles.divider} />

            <View style={styles.toggleRow}>
              <View style={styles.menuTextStack}>
                <Text style={styles.menuRowTitle}>Two-factor authentication</Text>
                <Text style={styles.menuRowSub}>Add an extra layer of security to your account</Text>
              </View>
              <Switch
                value={twoFactor}
                onValueChange={(val) => {
                  setTwoFactor(val);
                  autoSaveSettings(val, loginAlerts, publicProfile, activityStatus, searchIndexing, analyticsSharing);
                }}
                trackColor={{ false: '#E5E7EB', true: '#000000' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.toggleRow}>
              <View style={styles.menuTextStack}>
                <Text style={styles.menuRowTitle}>Login alerts</Text>
                <Text style={styles.menuRowSub}>Receive alerts for new device sign-ins</Text>
              </View>
              <Switch
                value={loginAlerts}
                onValueChange={(val) => {
                  setLoginAlerts(val);
                  autoSaveSettings(twoFactor, val, publicProfile, activityStatus, searchIndexing, analyticsSharing);
                }}
                trackColor={{ false: '#E5E7EB', true: '#000000' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* ── SECTION 2: DEVICE HISTORY ────────────────────────────────────── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Device history</Text>
          <View style={styles.menuRowsGroup}>
            <View style={styles.menuRow}>
              <View style={styles.menuTextStack}>
                <Text style={styles.menuRowTitle}>{deviceLabel}</Text>
                <Text style={styles.menuRowSub}>Active session · Current device</Text>
              </View>
              <Feather name="check" size={18} color="#059669" />
            </View>
          </View>
        </View>

        {/* ── SECTION 3: PRIVACY ───────────────────────────────────────────── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Privacy & sharing</Text>
          <View style={styles.menuRowsGroup}>
            <View style={styles.toggleRow}>
              <View style={styles.menuTextStack}>
                <Text style={styles.menuRowTitle}>Public profile visibility</Text>
                <Text style={styles.menuRowSub}>Show profile page to non-authenticated users</Text>
              </View>
              <Switch
                value={publicProfile}
                onValueChange={(v) => handleTogglePrivacy('pub', v)}
                trackColor={{ false: '#E5E7EB', true: '#000000' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.toggleRow}>
              <View style={styles.menuTextStack}>
                <Text style={styles.menuRowTitle}>Activity status</Text>
                <Text style={styles.menuRowSub}>Show when you're online to guests and hosts</Text>
              </View>
              <Switch
                value={activityStatus}
                onValueChange={(v) => handleTogglePrivacy('act', v)}
                trackColor={{ false: '#E5E7EB', true: '#000000' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.toggleRow}>
              <View style={styles.menuTextStack}>
                <Text style={styles.menuRowTitle}>Search engine indexing</Text>
                <Text style={styles.menuRowSub}>Allow search engines (Google, Bing) to index host profile</Text>
              </View>
              <Switch
                value={searchIndexing}
                onValueChange={(v) => handleTogglePrivacy('idx', v)}
                trackColor={{ false: '#E5E7EB', true: '#000000' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* ── SECTION 4: DANGER ZONE (Account Lifecycle) ────────────────────── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Account management</Text>
          <View style={styles.menuRowsGroup}>
            {/* Deactivate Account */}
            <Pressable
              onPress={handleDeactivateToggle}
              disabled={actionLoading}
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
            >
              <View style={styles.menuTextStack}>
                <Text style={styles.menuRowTitle}>
                  {accountStatus === 'deactivated' ? 'Reactivate account' : 'Deactivate account'}
                </Text>
                <Text style={styles.menuRowSub}>
                  {accountStatus === 'deactivated'
                    ? 'Restore public profile and unhide listings'
                    : 'Temporarily hide profile and listings from search'}
                </Text>
              </View>
              {actionLoading ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Feather name="chevron-right" size={18} color="#94A3B8" />
              )}
            </Pressable>

            <View style={styles.divider} />

            {/* Delete Account */}
            <Pressable
              onPress={handleDeleteRequest}
              disabled={actionLoading}
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
            >
              <View style={styles.menuTextStack}>
                <Text style={[styles.menuRowTitle, { color: '#E11D48' }]}>Delete account</Text>
                <Text style={styles.menuRowSub}>
                  Permanently delete your account and personal data
                </Text>
              </View>
              {actionLoading ? (
                <ActivityIndicator size="small" color="#E11D48" />
              ) : (
                <Feather name="chevron-right" size={18} color="#E11D48" />
              )}
            </Pressable>
          </View>
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
  sectionBlock: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  menuRowsGroup: {
    backgroundColor: '#FFFFFF',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  menuRowPressed: {
    opacity: 0.6,
  },
  menuTextStack: {
    flex: 1,
    paddingRight: 12,
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
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    textDecorationLine: 'underline',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 2,
  },
  activeBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  passkeyEnableBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  passkeyEnableText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  passkeyRemoveBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  passkeyRemoveText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
});
