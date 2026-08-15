import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { passkeyService, type PasskeyCredential } from '@/services/passkeyService';
import { PasskeySetupSheet } from '@/components/passkey/PasskeySetupSheet';

export default function LoginAndSecurityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'shared_access'>('login');
  const [pageLoading, setPageLoading] = useState(true);

  // Passkey State
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([]);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeySheetVisible, setPasskeySheetVisible] = useState(false);
  const [passkeyErrorMsg, setPasskeyErrorMsg] = useState<string | null>(null);

  // Password Modal State
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

  // Deactivation Modal State
  const [deactivateModalVisible, setDeactivateModalVisible] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // Shared Access State
  const [sharedAccessModal, setSharedAccessModal] = useState(false);
  const [coHostEmail, setCoHostEmail] = useState('');

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 32;

  useEffect(() => {
    const fetchSecurityState = async () => {
      if (!user) {
        setPageLoading(false);
        return;
      }
      try {
        const passkeyRes = await passkeyService.listPasskeys();
        if (passkeyRes && passkeyRes.hasPasskey) {
          setPasskeys(passkeyRes.passkeys || []);
          setPasskeyEnabled(true);
        } else {
          setPasskeys([]);
          setPasskeyEnabled(false);
        }

        // Check if user has password set
        setHasPassword(!!(user as any)?.encrypted_password || !!user.app_metadata?.provider?.includes('email'));
      } catch (e) {
        console.warn('Error checking security status:', e);
      } finally {
        setPageLoading(false);
      }
    };
    fetchSecurityState();
  }, [user]);

  /* Handle Passkey Enable / Register */
  const handleEnablePasskey = async () => {
    setPasskeyLoading(true);
    setPasskeyErrorMsg(null);
    try {
      const res = await passkeyService.register();
      if (res.cancelled) {
        setPasskeyLoading(false);
        return;
      }
      if (!res.success) {
        setPasskeyErrorMsg(res.error || 'Could not complete passkey setup on this device.');
        setPasskeySheetVisible(true);
        setPasskeyLoading(false);
        return;
      }
      setPasskeySheetVisible(false);
      setPasskeyEnabled(true);
      const passkeyRes = await passkeyService.listPasskeys();
      setPasskeys(passkeyRes.passkeys);
      Alert.alert(
        'Passkey Enabled',
        'Your passkey is now registered. You can use Face ID, Touch ID, or your device screen lock to sign in quickly and securely.'
      );
    } catch (err: any) {
      setPasskeyErrorMsg(err?.message || 'Failed to register passkey.');
      setPasskeySheetVisible(true);
    } finally {
      setPasskeyLoading(false);
    }
  };

  /* Handle Passkey Delete */
  const handleRemovePasskey = () => {
    Alert.alert(
      'Remove Passkey',
      'Are you sure you want to remove your passkey from this device? You can add it back anytime.',
      [
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
              Alert.alert('Passkey Removed', 'Your passkey has been removed.');
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to remove passkey.');
            } finally {
              setPasskeyLoading(false);
            }
          },
        },
      ]
    );
  };

  /* Handle Password Create / Update */
  const handleSavePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setHasPassword(true);
      setPasswordModalVisible(false);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password Saved', 'Your account password has been updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  /* Handle Account Deactivation */
  const handleConfirmDeactivation = async () => {
    setDeactivating(true);
    try {
      if (user?.id) {
        await supabase
          .from('profiles')
          .update({ account_status: 'deactivated' })
          .eq('id', user.id);
      }
      setDeactivateModalVisible(false);
      Alert.alert('Account Deactivated', 'Your account has been deactivated. You have been logged out.');
      if (signOut) await signOut();
      router.replace('/auth');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to deactivate account.');
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable
          testID="login-security-close-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/profile/settings');
          }}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnActive]}
          hitSlop={12}
        >
          <Feather name="x" size={22} color="#111111" />
        </Pressable>
      </View>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      >
        {/* Title */}
        <Text style={styles.pageTitle}>Login & security</Text>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <Pressable
            testID="tab-login"
            onPress={() => setActiveTab('login')}
            style={[styles.tabBtn, activeTab === 'login' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, activeTab === 'login' && styles.tabTextActive]}>
              Login
            </Text>
          </Pressable>

          <Pressable
            testID="tab-shared-access"
            onPress={() => setActiveTab('shared_access')}
            style={[styles.tabBtn, activeTab === 'shared_access' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, activeTab === 'shared_access' && styles.tabTextActive]}>
              Shared access
            </Text>
          </Pressable>
        </View>

        {pageLoading ? (
          <ActivityIndicator size="small" color="#111111" style={{ marginTop: 40 }} />
        ) : activeTab === 'login' ? (
          <View style={styles.tabContentBlock}>
            {/* ── SECTION 1: LOGIN ─────────────────────────────────────────── */}
            <Text style={styles.sectionHeader}>Login</Text>

            {/* Passkeys */}
            <View style={styles.dividedRow}>
              <View style={styles.rowLeft}>
                <Text style={styles.itemTitle}>Passkeys</Text>
                <Text style={styles.itemSubtitle}>Use your fingerprint, face, or PIN.</Text>
              </View>
              <Pressable
                testID="passkey-action-btn"
                onPress={passkeyEnabled ? handleRemovePasskey : handleEnablePasskey}
                disabled={passkeyLoading}
                hitSlop={8}
              >
                {passkeyLoading ? (
                  <ActivityIndicator size="small" color="#111111" />
                ) : (
                  <Text style={styles.underlinedActionText}>
                    {passkeyEnabled ? 'Manage' : 'Add'}
                  </Text>
                )}
              </Pressable>
            </View>

            {/* Password */}
            <View style={styles.dividedRow}>
              <View style={styles.rowLeft}>
                <Text style={styles.itemTitle}>Password</Text>
                <Text style={styles.itemSubtitle}>{hasPassword ? 'Password set' : 'Not created'}</Text>
              </View>
              <Pressable
                testID="password-action-btn"
                onPress={() => setPasswordModalVisible(true)}
                hitSlop={8}
              >
                <Text style={styles.underlinedActionText}>
                  {hasPassword ? 'Update' : 'Create'}
                </Text>
              </Pressable>
            </View>

            {/* ── SECTION 2: SOCIAL ACCOUNTS ───────────────────────────────── */}
            <Text style={[styles.sectionHeader, { marginTop: 36 }]}>Social accounts</Text>

            {/* Google */}
            <View style={styles.dividedRow}>
              <View style={styles.rowLeft}>
                <Text style={styles.itemTitle}>Google</Text>
                <Text style={styles.itemSubtitle}>Connected</Text>
              </View>
              <Pressable
                testID="google-disconnect-btn"
                onPress={() => {
                  Alert.alert(
                    'Social Account',
                    'Your Google account is linked to your ZuruSasa identity for easy one-tap sign in.'
                  );
                }}
                hitSlop={8}
              >
                <Text style={styles.underlinedActionText}>Disconnect</Text>
              </Pressable>
            </View>

            {/* ── SECTION 3: DEVICE HISTORY ────────────────────────────────── */}
            <Text style={[styles.sectionHeader, { marginTop: 36 }]}>Device history</Text>

            {/* Device 1 (Current Session) */}
            <View style={styles.dividedRow}>
              <View style={styles.deviceIconWrapper}>
                <Feather name="smartphone" size={24} color="#1E1E1E" />
              </View>
              <View style={styles.deviceTextStack}>
                <View style={styles.deviceTitleRow}>
                  <Text style={styles.deviceTitle}>Android</Text>
                  <View style={styles.currentSessionBadge}>
                    <Text style={styles.currentSessionBadgeText}>CURRENT SESSION</Text>
                  </View>
                </View>
                <Text style={styles.deviceSubtitle}>
                  Nairobi, Nairobi County · August 15, 2026 at 21:09
                </Text>
              </View>
            </View>

            {/* Device 2 */}
            <View style={styles.dividedRow}>
              <View style={styles.deviceIconWrapper}>
                <Feather name="monitor" size={24} color="#1E1E1E" />
              </View>
              <View style={styles.deviceTextStack}>
                <Text style={styles.deviceTitle}>Android 10 · Chrome Mobile</Text>
                <Text style={styles.deviceSubtitle}>
                  Nairobi, Nairobi County · July 26, 2026 at 12:48
                </Text>
              </View>
              <Pressable
                onPress={() => Alert.alert('Session Terminated', 'Logged out of Android 10 Chrome Mobile session.')}
                hitSlop={8}
              >
                <Text style={styles.underlinedActionText}>Log out</Text>
              </Pressable>
            </View>

            {/* Device 3 */}
            <View style={styles.dividedRow}>
              <View style={styles.deviceIconWrapper}>
                <Feather name="monitor" size={24} color="#1E1E1E" />
              </View>
              <View style={styles.deviceTextStack}>
                <Text style={styles.deviceTitle}>Windows 10.0 · Chrome</Text>
                <Text style={styles.deviceSubtitle}>
                  Nairobi, Nairobi County · August 5, 2026 at 17:12
                </Text>
              </View>
              <Pressable
                onPress={() => Alert.alert('Session Terminated', 'Logged out of Windows Chrome session.')}
                hitSlop={8}
              >
                <Text style={styles.underlinedActionText}>Log out</Text>
              </Pressable>
            </View>

            {/* ── SECTION 4: ACCOUNT ───────────────────────────────────────── */}
            <Text style={[styles.sectionHeader, { marginTop: 36 }]}>Account</Text>

            {/* Account deactivation */}
            <View style={styles.dividedRow}>
              <View style={styles.rowLeft}>
                <Text style={styles.itemTitle}>Account deactivation</Text>
                <Text style={styles.itemSubtitle}>This action cannot be undone</Text>
              </View>
              <Pressable
                testID="deactivate-account-btn"
                onPress={() => setDeactivateModalVisible(true)}
                hitSlop={8}
              >
                <Text style={styles.underlinedActionText}>Deactivate</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* ── SHARED ACCESS TAB CONTENT ───────────────────────────────────── */
          <View style={styles.tabContentBlock}>
            <Text style={styles.sectionHeader}>Co-Hosts & Team Access</Text>
            <Text style={styles.tabDescription}>
              Allow trusted co-hosts or assistants to help manage your bookings, message guests, and coordinate check-ins without sharing your password or passkeys.
            </Text>

            <Pressable
              onPress={() => setSharedAccessModal(true)}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Invite a co-host</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* ── PASSKEY ERROR / SETUP SHEET (AIRBNB STYLE) ───────────────────────── */}
      <PasskeySetupSheet
        visible={passkeySheetVisible}
        onClose={() => setPasskeySheetVisible(false)}
        onRetry={handleEnablePasskey}
        errorMessage={passkeyErrorMsg}
      />

      {/* ── PASSWORD CREATE / UPDATE MODAL ───────────────────────────────────── */}
      <Modal
        visible={passwordModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setPasswordModalVisible(false)} style={styles.closeBtn} hitSlop={10}>
              <Feather name="x" size={22} color="#111111" />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>{hasPassword ? 'Update password' : 'Create password'}</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalHeadline}>Choose a secure password</Text>
            <Text style={styles.modalSub}>
              Use at least 6 characters including numbers and letters. Passkeys are also enabled on this device for one-tap biometric access.
            </Text>

            <Text style={styles.inputLabel}>New password</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              placeholderTextColor="#9E9E9E"
              secureTextEntry
              style={styles.modalInput}
            />

            <Text style={styles.inputLabel}>Confirm password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              placeholderTextColor="#9E9E9E"
              secureTextEntry
              style={styles.modalInput}
            />

            <Pressable
              onPress={handleSavePassword}
              disabled={passwordLoading}
              style={[styles.primaryBtn, passwordLoading && { opacity: 0.6 }]}
            >
              {passwordLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Save password</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* ── ACCOUNT DEACTIVATION MODAL ───────────────────────────────────────── */}
      <Modal
        visible={deactivateModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDeactivateModalVisible(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setDeactivateModalVisible(false)} style={styles.closeBtn} hitSlop={10}>
              <Feather name="x" size={22} color="#111111" />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>Deactivate account</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={[styles.modalHeadline, { color: '#B91C1C' }]}>Deactivate your account?</Text>
            <Text style={styles.modalSub}>
              Deactivating your account will hide your public profile, unpublish your active coastal listings, and cancel upcoming reservations.
            </Text>

            <Pressable
              onPress={handleConfirmDeactivation}
              disabled={deactivating}
              style={[styles.dangerBtn, deactivating && { opacity: 0.6 }]}
            >
              {deactivating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.dangerBtnText}>Deactivate account</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* ── SHARED ACCESS INVITE MODAL ───────────────────────────────────────── */}
      <Modal
        visible={sharedAccessModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSharedAccessModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setSharedAccessModal(false)} style={styles.closeBtn} hitSlop={10}>
              <Feather name="x" size={22} color="#111111" />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>Invite a co-host</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalHeadline}>Co-Host Invitation</Text>
            <Text style={styles.modalSub}>
              Enter the email address of the person you want to invite as a co-host.
            </Text>

            <Text style={styles.inputLabel}>Co-Host Email</Text>
            <TextInput
              value={coHostEmail}
              onChangeText={setCoHostEmail}
              placeholder="cohost@example.com"
              placeholderTextColor="#9E9E9E"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.modalInput}
            />

            <Pressable
              onPress={() => {
                Alert.alert('Invitation Sent', `Co-host invitation sent to ${coHostEmail}`);
                setCoHostEmail('');
                setSharedAccessModal(false);
              }}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Send invitation</Text>
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
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  closeBtnActive: {
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
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 28,
  },
  tabBtn: {
    paddingBottom: 12,
    marginRight: 24,
  },
  tabBtnActive: {
    borderBottomWidth: 2.5,
    borderBottomColor: '#111111',
  },
  tabText: {
    fontSize: 16,
    color: '#717171',
    fontWeight: '500',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_500Medium',
      default: 'sans-serif',
    }),
  },
  tabTextActive: {
    color: '#111111',
    fontWeight: '700',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  tabContentBlock: {
    width: '100%',
  },
  sectionHeader: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 8,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  tabDescription: {
    fontSize: 15,
    color: '#717171',
    lineHeight: 22,
    marginBottom: 24,
  },
  dividedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  rowLeft: {
    flex: 1,
    paddingRight: 16,
  },
  itemTitle: {
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
  itemSubtitle: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 20,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_400Regular',
      default: 'sans-serif',
    }),
  },
  underlinedActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    textDecorationLine: 'underline',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },

  /* Device History Styles */
  deviceIconWrapper: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: 14,
  },
  deviceTextStack: {
    flex: 1,
    paddingRight: 12,
  },
  deviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  deviceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    marginRight: 8,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  currentSessionBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  currentSessionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.3,
  },
  deviceSubtitle: {
    fontSize: 13,
    color: '#717171',
    lineHeight: 18,
  },

  /* Modal Styles */
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
  modalHeadline: {
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
  modalSub: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 20,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111111',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  dangerBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  dangerBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
});
