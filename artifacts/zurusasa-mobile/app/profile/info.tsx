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
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { personaVerificationService } from '@/services/personaVerificationService';

type EditFieldType =
  | 'legal_name'
  | 'preferred_name'
  | 'host_display_name'
  | 'phone'
  | 'email'
  | 'residential_address'
  | 'postal_address'
  | 'emergency_contact'
  | 'identity_verification'
  | null;

function maskEmail(emailStr?: string): string {
  if (!emailStr) return 'Not provided';
  const parts = emailStr.split('@');
  if (parts.length !== 2) return emailStr;
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

export default function PersonalInfoScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeEdit, setActiveEdit] = useState<EditFieldType>(null);

  // Profile Form State
  const [legalName, setLegalName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [hostDisplayName, setHostDisplayName] = useState('Show my first name only');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [residentialAddress, setResidentialAddress] = useState('');
  const [postalAddress, setPostalAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRel, setEmergencyRel] = useState('');
  const [identityStatus, setIdentityStatus] = useState('Not started');

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 32;

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      try {
        const userMeta = user.user_metadata || {};
        setEmail(user.email || '');
        setLegalName(userMeta.full_name || userMeta.legal_name || user.email?.split('@')[0] || 'Traveler');
        if (userMeta.phone) setPhone(userMeta.phone);

        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (data) {
          const row = data as Record<string, any>;
          if (row.full_name) setLegalName(row.full_name);
          if (row.preferred_name) setPreferredName(row.preferred_name);
          if (row.host_display_name) setHostDisplayName(row.host_display_name);
          if (row.phone) setPhone(row.phone);
          if (row.residential_address) setResidentialAddress(row.residential_address);
          if (row.postal_address) setPostalAddress(row.postal_address);
          if (row.emergency_contact) {
            setEmergencyName(row.emergency_contact.name || '');
            setEmergencyPhone(row.emergency_contact.phone || '');
            setEmergencyRel(row.emergency_contact.relationship || '');
          }
          if (row.is_verified) setIdentityStatus('Verified');
          else if (row.identity_verification_status) setIdentityStatus(row.identity_verification_status);
        }
      } catch (e) {
        console.warn('Note loading personal info:', e);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [user]);

  const handleSaveField = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        full_name: legalName.trim(),
        preferred_name: preferredName.trim() || null,
        host_display_name: hostDisplayName,
        phone: phone.trim() || null,
        residential_address: residentialAddress.trim() || null,
        postal_address: postalAddress.trim() || null,
        emergency_contact: emergencyName.trim()
          ? {
              name: emergencyName.trim(),
              phone: emergencyPhone.trim(),
              relationship: emergencyRel.trim(),
            }
          : null,
      };

      await supabase.from('profiles').update(updates).eq('id', user.id);
      await supabase.auth.updateUser({
        data: {
          full_name: legalName.trim(),
          phone: phone.trim(),
        },
      });

      if (refreshProfile) await refreshProfile();
      Alert.alert('Saved', 'Your personal information has been updated.');
      setActiveEdit(null);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not update profile information.');
    } finally {
      setSaving(false);
    }
  };

  const handleStartVerification = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to verify your identity.');
      return;
    }

    setSaving(true);
    try {
      await personaVerificationService.launchVerification({
        userId: user.id,
        onSuccess: async () => {
          setSaving(false);
          setIdentityStatus('Verified');
          if (refreshProfile) await refreshProfile();
          Alert.alert('Identity Verified', 'Your official identity has been successfully verified with Persona.');
          setActiveEdit(null);
        },
        onCanceled: () => {
          setSaving(false);
        },
        onError: (errorMessage) => {
          setSaving(false);
          Alert.alert('Verification Notice', errorMessage);
        },
      });
    } catch (err: any) {
      setSaving(false);
      Alert.alert('Verification Error', err?.message || 'Could not start identity verification.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable
          testID="personal-info-back-btn"
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
        <Text style={[styles.pageTitle, { color: colors.text }]}>Personal info</Text>

        {loading ? (
          <ActivityIndicator size="small" color={colors.text} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.fieldsContainer}>
            {/* 1. Legal name */}
            <View style={[styles.rowWrapper, { borderBottomColor: colors.border }]}>
              <View style={styles.rowTop}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Legal name</Text>
                <Pressable
                  testID="edit-legal-name-btn"
                  onPress={() => setActiveEdit('legal_name')}
                  hitSlop={8}
                >
                  <Text style={styles.actionBtnText}>{legalName ? 'Edit' : 'Add'}</Text>
                </Pressable>
              </View>
              <Text style={[styles.fieldValue, { color: colors.mutedForeground }]}>{legalName || 'Not provided'}</Text>
            </View>

            {/* 2. Preferred first name */}
            <View style={[styles.rowWrapper, { borderBottomColor: colors.border }]}>
              <View style={styles.rowTop}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Preferred first name</Text>
                <Pressable
                  testID="edit-preferred-name-btn"
                  onPress={() => setActiveEdit('preferred_name')}
                  hitSlop={8}
                >
                  <Text style={styles.actionBtnText}>{preferredName ? 'Edit' : 'Add'}</Text>
                </Pressable>
              </View>
              <Text style={[styles.fieldValue, { color: colors.mutedForeground }]}>{preferredName || 'Not provided'}</Text>
            </View>

            {/* 3. Host display name for experiences and services */}
            <View style={[styles.rowWrapper, { borderBottomColor: colors.border }]}>
              <View style={styles.rowTop}>
                <Text style={[styles.fieldLabel, { color: colors.text, maxWidth: '80%' }]}>
                  Host display name for experiences and services
                </Text>
                <Pressable
                  testID="edit-host-display-btn"
                  onPress={() => setActiveEdit('host_display_name')}
                  hitSlop={8}
                >
                  <Text style={styles.actionBtnText}>Edit</Text>
                </Pressable>
              </View>
              <Text style={[styles.fieldValue, { color: colors.mutedForeground }]}>{hostDisplayName || 'Show my first name only'}</Text>
            </View>

            {/* 4. Phone number */}
            <View style={[styles.rowWrapper, { borderBottomColor: colors.border }]}>
              <View style={styles.rowTop}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Phone number</Text>
                <Pressable
                  testID="edit-phone-btn"
                  onPress={() => setActiveEdit('phone')}
                  hitSlop={8}
                >
                  <Text style={styles.actionBtnText}>{phone ? 'Edit' : 'Add'}</Text>
                </Pressable>
              </View>
              <Text style={[styles.fieldValue, { color: phone ? colors.mutedForeground : colors.mutedForeground }, !phone && styles.explanatoryText]}>
                {phone ||
                  'Add a number so confirmed guests and ZuruSasa can get in touch. You can add other numbers and choose how they’re used.'}
              </Text>
            </View>

            {/* 5. Email */}
            <View style={[styles.rowWrapper, { borderBottomColor: colors.border }]}>
              <View style={styles.rowTop}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Email</Text>
                <Pressable
                  testID="edit-email-btn"
                  onPress={() => setActiveEdit('email')}
                  hitSlop={8}
                >
                  <Text style={styles.actionBtnText}>Edit</Text>
                </Pressable>
              </View>
              <Text style={[styles.fieldValue, { color: colors.mutedForeground }]}>{maskEmail(email)}</Text>
            </View>

            {/* 6. Residential address */}
            <View style={[styles.rowWrapper, { borderBottomColor: colors.border }]}>
              <View style={styles.rowTop}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Residential address</Text>
                <Pressable
                  testID="edit-residential-addr-btn"
                  onPress={() => setActiveEdit('residential_address')}
                  hitSlop={8}
                >
                  <Text style={styles.actionBtnText}>{residentialAddress ? 'Edit' : 'Add'}</Text>
                </Pressable>
              </View>
              <Text style={[styles.fieldValue, { color: colors.mutedForeground }]}>{residentialAddress || 'Not provided'}</Text>
            </View>

            {/* 7. Postal address */}
            <View style={[styles.rowWrapper, { borderBottomColor: colors.border }]}>
              <View style={styles.rowTop}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Postal address</Text>
                <Pressable
                  testID="edit-postal-addr-btn"
                  onPress={() => setActiveEdit('postal_address')}
                  hitSlop={8}
                >
                  <Text style={styles.actionBtnText}>{postalAddress ? 'Edit' : 'Add'}</Text>
                </Pressable>
              </View>
              <Text style={[styles.fieldValue, { color: colors.mutedForeground }]}>{postalAddress || 'Not provided'}</Text>
            </View>

            {/* 8. Emergency contact */}
            <View style={[styles.rowWrapper, { borderBottomColor: colors.border }]}>
              <View style={styles.rowTop}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Emergency contact</Text>
                <Pressable
                  testID="edit-emergency-contact-btn"
                  onPress={() => setActiveEdit('emergency_contact')}
                  hitSlop={8}
                >
                  <Text style={styles.actionBtnText}>{emergencyName ? 'Edit' : 'Add'}</Text>
                </Pressable>
              </View>
              <Text style={[styles.fieldValue, { color: colors.mutedForeground }]}>
                {emergencyName ? `${emergencyName} (${emergencyPhone || 'No phone'})` : 'Not provided'}
              </Text>
            </View>

            {/* 9. Identity verification */}
            <View style={[styles.rowWrapper, { borderBottomColor: colors.border }]}>
              <View style={styles.rowTop}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Identity verification</Text>
                <Pressable
                  testID="edit-identity-btn"
                  onPress={() => {
                    if (identityStatus === 'Verified') {
                      setActiveEdit('identity_verification');
                    } else {
                      handleStartVerification();
                    }
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.actionBtnText}>
                    {identityStatus === 'Verified' ? 'View' : 'Start'}
                  </Text>
                </Pressable>
              </View>
              <Text style={[styles.fieldValue, { color: colors.mutedForeground }]}>{identityStatus}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── EDIT BOTTOM SHEET / MODAL ────────────────────────────────────────── */}
      <Modal
        visible={!!activeEdit}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveEdit(null)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.card, paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setActiveEdit(null)} style={styles.modalCloseBtn} hitSlop={10}>
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
            <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>
              {activeEdit === 'legal_name' && 'Legal name'}
              {activeEdit === 'preferred_name' && 'Preferred first name'}
              {activeEdit === 'host_display_name' && 'Host display name'}
              {activeEdit === 'phone' && 'Phone number'}
              {activeEdit === 'email' && 'Email address'}
              {activeEdit === 'residential_address' && 'Residential address'}
              {activeEdit === 'postal_address' && 'Postal address'}
              {activeEdit === 'emergency_contact' && 'Emergency contact'}
              {activeEdit === 'identity_verification' && 'Identity verification'}
            </Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            {/* Legal Name */}
            {activeEdit === 'legal_name' && (
              <View>
                <Text style={[styles.modalFieldTitle, { color: colors.text }]}>Legal name</Text>
                <Text style={[styles.modalFieldSub, { color: colors.mutedForeground }]}>
                  This is the name on your government travel document, such as your National ID, Passport, or Driver’s License.
                </Text>
                <TextInput
                  value={legalName}
                  onChangeText={setLegalName}
                  placeholder="First and last legal name"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.modalInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                />
              </View>
            )}

            {/* Preferred Name */}
            {activeEdit === 'preferred_name' && (
              <View>
                <Text style={[styles.modalFieldTitle, { color: colors.text }]}>Preferred first name</Text>
                <Text style={[styles.modalFieldSub, { color: colors.mutedForeground }]}>
                  This is what hosts and guests will call you across ZuruSasa experiences.
                </Text>
                <TextInput
                  value={preferredName}
                  onChangeText={setPreferredName}
                  placeholder="e.g. Angelo"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.modalInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                />
              </View>
            )}

            {/* Host Display Name */}
            {activeEdit === 'host_display_name' && (
              <View>
                <Text style={[styles.modalFieldTitle, { color: colors.text }]}>Host display name</Text>
                <Text style={[styles.modalFieldSub, { color: colors.mutedForeground }]}>
                  Choose how your name appears on your verified coastal listings and reel profiles.
                </Text>
                {['Show my first name only', 'Show my full legal name', 'Show my business / agency name'].map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => setHostDisplayName(opt)}
                    style={[
                      styles.modalOptionCard,
                      { backgroundColor: isDark ? '#27272A' : '#FAFAFA', borderColor: colors.border },
                      hostDisplayName === opt && [styles.modalOptionActive, { borderColor: '#F26522', backgroundColor: colors.card }],
                    ]}
                  >
                    <Text style={[styles.modalOptionText, { color: colors.text }, hostDisplayName === opt && styles.modalOptionTextActive]}>
                      {opt}
                    </Text>
                    {hostDisplayName === opt && <Feather name="check" size={18} color="#F26522" />}
                  </Pressable>
                ))}
              </View>
            )}

            {/* Phone */}
            {activeEdit === 'phone' && (
              <View>
                <Text style={[styles.modalFieldTitle, { color: colors.text }]}>Phone number</Text>
                <Text style={[styles.modalFieldSub, { color: colors.mutedForeground }]}>
                  Used for booking notifications, M-Pesa STK payment confirmations, and host check-in calls.
                </Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+254 712 345678"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                  style={[styles.modalInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                />
              </View>
            )}

            {/* Email */}
            {activeEdit === 'email' && (
              <View>
                <Text style={[styles.modalFieldTitle, { color: colors.text }]}>Email address</Text>
                <Text style={[styles.modalFieldSub, { color: colors.mutedForeground }]}>
                  Use an address you always have access to for receipts, security alerts, and passkey recovery.
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.modalInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                />
              </View>
            )}

            {/* Residential address */}
            {activeEdit === 'residential_address' && (
              <View>
                <Text style={[styles.modalFieldTitle, { color: colors.text }]}>Residential address</Text>
                <Text style={[styles.modalFieldSub, { color: colors.mutedForeground }]}>
                  Your primary residence for tax documentation and verification compliance.
                </Text>
                <TextInput
                  value={residentialAddress}
                  onChangeText={setResidentialAddress}
                  placeholder="Street address, city, country"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.modalInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                />
              </View>
            )}

            {/* Postal address */}
            {activeEdit === 'postal_address' && (
              <View>
                <Text style={[styles.modalFieldTitle, { color: colors.text }]}>Postal address</Text>
                <Text style={[styles.modalFieldSub, { color: colors.mutedForeground }]}>
                  Postal box or mailing address for formal notices and invoices.
                </Text>
                <TextInput
                  value={postalAddress}
                  onChangeText={setPostalAddress}
                  placeholder="P.O. Box 80400 Mombasa, Kenya"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.modalInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                />
              </View>
            )}

            {/* Emergency contact */}
            {activeEdit === 'emergency_contact' && (
              <View>
                <Text style={[styles.modalFieldTitle, { color: colors.text }]}>Emergency contact</Text>
                <Text style={[styles.modalFieldSub, { color: colors.mutedForeground }]}>
                  A trusted contact we can reach out to in an urgent situation during a trip.
                </Text>
                <TextInput
                  value={emergencyName}
                  onChangeText={setEmergencyName}
                  placeholder="Contact Name"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.modalInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                />
                <TextInput
                  value={emergencyPhone}
                  onChangeText={setEmergencyPhone}
                  placeholder="Contact Phone (+254...)"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                  style={[styles.modalInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                />
                <TextInput
                  value={emergencyRel}
                  onChangeText={setEmergencyRel}
                  placeholder="Relationship (e.g. Spouse, Parent, Friend)"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.modalInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                />
              </View>
            )}

            {/* Identity verification */}
            {activeEdit === 'identity_verification' && (
              <View>
                <Text style={[styles.modalFieldTitle, { color: colors.text }]}>Government ID Verification</Text>
                <Text style={[styles.modalFieldSub, { color: colors.mutedForeground }]}>
                  Upload a photo of your Kenyan National ID or Passport to receive the Verified badge on ZuruSasa.
                </Text>
                <View style={[styles.idCardBox, { backgroundColor: isDark ? '#27272A' : '#F8FAFC', borderColor: colors.border }]}>
                  <Feather name="shield" size={32} color={colors.text} style={{ marginBottom: 12 }} />
                  <Text style={[styles.idCardTitle, { color: colors.text }]}>Status: {identityStatus}</Text>
                  <Text style={[styles.idCardSub, { color: colors.mutedForeground }]}>
                    {identityStatus === 'Verified'
                      ? 'Your identity is fully verified with ZuruSasa.'
                      : 'Fast AI & manual verification completed within 2 hours.'}
                  </Text>
                </View>
              </View>
            )}

            {/* Save / Verify Action Button */}
            {activeEdit === 'identity_verification' ? (
              identityStatus === 'Verified' ? (
                <Pressable
                  onPress={() => setActiveEdit(null)}
                  style={({ pressed }) => [
                    styles.modalSaveBtn,
                    { backgroundColor: '#F26522' },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.modalSaveBtnText}>Done</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleStartVerification}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.modalSaveBtn,
                    { backgroundColor: '#F26522' },
                    pressed && { opacity: 0.85 },
                    saving && { opacity: 0.6 },
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSaveBtnText}>Start Persona Verification</Text>
                  )}
                </Pressable>
              )
            ) : (
              <Pressable
                onPress={handleSaveField}
                disabled={saving}
                style={({ pressed }) => [
                  styles.modalSaveBtn,
                  { backgroundColor: '#F26522' },
                  pressed && { opacity: 0.85 },
                  saving && { opacity: 0.6 },
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Save</Text>
                )}
              </Pressable>
            )}
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
    color: '#111111',
    letterSpacing: -0.5,
    marginBottom: 24,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  fieldsContainer: {
    width: '100%',
  },
  rowWrapper: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1E1E1E',
    letterSpacing: -0.2,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_500Medium',
      default: 'sans-serif',
    }),
  },
  actionBtnText: {
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
  fieldValue: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 20,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_400Regular',
      default: 'sans-serif',
    }),
  },
  explanatoryText: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 20,
    marginTop: 2,
  },

  /* Modal Styles */
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
  modalFieldTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 6,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  modalFieldSub: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 20,
    marginBottom: 20,
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
  modalOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    marginBottom: 10,
  },
  modalOptionActive: {
    borderColor: '#111111',
  },
  modalOptionText: {
    fontSize: 15,
    color: '#4B5563',
  },
  modalOptionTextActive: {
    color: '#111111',
    fontWeight: '600',
  },
  idCardBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  idCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 4,
  },
  idCardSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  modalSaveBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
});
