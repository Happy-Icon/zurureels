import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/Skeleton';
import { KeyboardScreen } from '@/components/keyboard';

const COMMON_LANGUAGES = [
  'English',
  'Swahili',
  'Amharic',
  'French',
  'German',
  'Spanish',
  'Chinese',
  'Arabic',
];

interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

interface VerificationBadges {
  email: boolean;
  phone: boolean;
  identity: boolean;
  id_url?: string;
  id_status?: string;
}

async function pickImage(square: boolean) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: square,
    aspect: square ? [1, 1] : undefined,
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

export default function PersonalInformationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [idUploading, setIdUploading] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [emergencyContact, setEmergencyContact] = useState<EmergencyContact>({
    name: '',
    phone: '',
    relationship: '',
  });
  const [badges, setBadges] = useState<VerificationBadges>({
    email: false,
    phone: false,
    identity: false,
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [idUrl, setIdUrl] = useState<string | null>(null);
  const [completeness, setCompleteness] = useState(0);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 84;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        setFullName((user.user_metadata?.full_name as string) || '');
        setPhone((user.user_metadata?.phone as string) || '');
        setBadges((prev) => ({ ...prev, email: !!user.email_confirmed_at }));

        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (data) {
          const row = data as Record<string, any>;
          if (row.full_name) setFullName(row.full_name);
          if (row.phone) setPhone(row.phone);
          if (row.languages) setLanguages(row.languages);
          if (row.emergency_contact) setEmergencyContact(row.emergency_contact);
          if (row.verification_badges) {
            const vb = row.verification_badges as VerificationBadges;
            setBadges((prev) => ({ ...prev, ...vb, email: !!user.email_confirmed_at }));
            if (vb.id_url) setIdUrl(vb.id_url);
          }
          if (row.metadata?.avatar_url) setAvatarUrl(row.metadata.avatar_url);
          if (row.metadata?.bio) setBio(row.metadata.bio);
          if (row.bio) setBio(row.bio);
        }
      } catch (e) {
        console.error('Error loading profile', e);
      } finally {
        setPageLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    let score = 0;
    if (fullName) score += 15;
    if (phone) score += 15;
    if (bio) score += 10;
    if (user?.email) score += 10;
    if (languages.length > 0) score += 10;
    if (emergencyContact.name) score += 10;
    if (badges.identity) score += 30;
    setCompleteness(Math.min(score, 100));
  }, [fullName, phone, bio, languages, emergencyContact, badges, user]);

  const handleAvatarUpload = async () => {
    if (!user) return;
    try {
      const asset = await pickImage(true);
      if (!asset) return;
      setAvatarUploading(true);

      const ext = (asset.fileName?.split('.').pop() ?? asset.uri.split('.').pop() ?? 'jpg')
        .toLowerCase()
        .split('?')[0];
      const filePath = `${user.id}/avatar_${Math.random()}.${ext}`;
      const arraybuffer = await fetch(asset.uri).then((r) => r.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arraybuffer, {
          contentType: asset.mimeType ?? 'image/jpeg',
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setAvatarUrl(publicUrl);

      const { data: profileRow } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', user.id)
        .single();
      const newMetadata = {
        ...((profileRow?.metadata as Record<string, unknown>) || {}),
        avatar_url: publicUrl,
      };
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ metadata: newMetadata })
        .eq('id', user.id);
      if (updateError) throw updateError;

      await refreshProfile();
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Something went wrong.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleIdUpload = async () => {
    if (!user) return;
    try {
      const asset = await pickImage(false);
      if (!asset) return;
      setIdUploading(true);

      const ext = (asset.fileName?.split('.').pop() ?? asset.uri.split('.').pop() ?? 'jpg')
        .toLowerCase()
        .split('?')[0];
      const filePath = `${user.id}/id_${Math.random()}.${ext}`;
      const arraybuffer = await fetch(asset.uri).then((r) => r.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('identity-documents')
        .upload(filePath, arraybuffer, {
          contentType: asset.mimeType ?? 'image/jpeg',
        });
      if (uploadError) throw uploadError;

      const newBadges = { ...badges, id_url: filePath, id_status: 'pending' };
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ verification_badges: newBadges })
        .eq('id', user.id);
      if (updateError) throw updateError;

      setIdUrl(filePath);
      setBadges(newBadges);
      Alert.alert('Success', 'Government ID uploaded for verification review.');
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Something went wrong.');
    } finally {
      setIdUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName, phone },
      });
      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone,
          bio,
          languages,
          emergency_contact: emergencyContact,
          verification_badges: badges,
          profile_completeness: completeness,
          metadata: {
            ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
            bio,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (profileError) throw profileError;

      await refreshProfile();
      Alert.alert('Saved', 'Personal information updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  };

  if (pageLoading) {
    return (
      <View style={[styles.fill, { backgroundColor: '#FFFFFF', paddingTop: topPad, paddingHorizontal: 20, gap: 18 }]}>
        <Skeleton style={{ height: 26, width: 220, borderRadius: 6 }} />
        <Skeleton style={{ height: 60, borderRadius: 16 }} />
        <View style={{ alignItems: 'center', marginVertical: 12 }}>
          <Skeleton style={{ width: 96, height: 96, borderRadius: 48 }} />
        </View>
        <Skeleton style={{ height: 18, width: 140, borderRadius: 4 }} />
        <Skeleton style={{ height: 48, borderRadius: 12 }} />
        <Skeleton style={{ height: 18, width: 140, borderRadius: 4 }} />
        <Skeleton style={{ height: 48, borderRadius: 12 }} />
        <Skeleton style={{ height: 18, width: 140, borderRadius: 4 }} />
        <Skeleton style={{ height: 48, borderRadius: 12 }} />
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: '#FFFFFF' }]}>
      {/* 1. Header & Navigation Structure */}
      <View style={[styles.topNavBar, { paddingTop: topPad }]}>
        <Pressable
          testID="back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/profile');
          }}
          style={({ pressed }) => [styles.backIconBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color="#222222" />
        </Pressable>
      </View>

      <KeyboardScreen
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        stickyFooter={
          <View style={[styles.pinnedBottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <Pressable
              testID="save-identity-btn"
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [
                styles.primaryCtaBtn,
                { opacity: pressed || saving ? 0.85 : 1 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryCtaBtnText}>Save changes</Text>
              )}
            </Pressable>
          </View>
        }
      >
        {/* Page Title */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Personal information</Text>
          <Text style={styles.pageSub}>
            Manage your identity, contact details, and emergency contact.
          </Text>
        </View>

        {/* 2. Trust Banner (Airbnb Soft Banner) */}
        <View style={styles.trustBanner}>
          <View style={styles.trustBannerLeft}>
            <MaterialCommunityIcons name="shield-check" size={22} color="#EE7D30" />
            <View style={styles.trustBannerTextWrap}>
              <Text style={styles.trustBannerTitle}>Trust & Verification</Text>
              <Text style={styles.trustBannerSub}>
                {completeness}% profile complete · {badges.identity ? 'Verified Member' : 'Add ID to complete'}
              </Text>
            </View>
          </View>
          <View style={styles.trustBadgePill}>
            <Text style={styles.trustBadgePillText}>{completeness}%</Text>
          </View>
        </View>

        {/* 3. Profile Image */}
        <View style={styles.avatarSection}>
          <Pressable
            testID="avatar-upload"
            onPress={handleAvatarUpload}
            disabled={avatarUploading}
            style={({ pressed }) => [styles.avatarWrap, { opacity: pressed ? 0.85 : 1 }]}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={styles.avatarFallback}>
                <Feather name="user" size={44} color="#717171" />
              </View>
            )}
            <View style={styles.avatarBadge}>
              {avatarUploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="camera" size={14} color="#FFFFFF" />
              )}
            </View>
          </Pressable>
          <Text style={styles.avatarLabel}>Profile photo</Text>
          <Text style={styles.avatarSub}>Clear photo helps hosts and guests recognize you</Text>
        </View>

        <View style={styles.divider} />

        {/* 4. Basic Information (Soft Block Inputs) */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Legal info & contact</Text>

          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <View style={styles.inputBox}>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your legal full name"
                placeholderTextColor="#9CA3AF"
                style={styles.inputText}
              />
            </View>
          </View>

          {/* Phone Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <View style={styles.inputBox}>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. +254 712 345 678"
                keyboardType="phone-pad"
                placeholderTextColor="#9CA3AF"
                style={styles.inputText}
              />
              {phone.length > 5 ? (
                <View style={styles.verifiedInlineRow}>
                  <Feather name="check-circle" size={15} color="#008A05" />
                  <Text style={styles.verifiedInlineText}>Added</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Email Address (Read-only System field) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={[styles.inputBox, styles.inputBoxDisabled]}>
              <TextInput
                value={user?.email ?? ''}
                editable={false}
                style={[styles.inputText, { color: '#717171' }]}
              />
              {badges.email ? (
                <View style={styles.verifiedInlineRow}>
                  <Feather name="check-circle" size={15} color="#008A05" />
                  <Text style={styles.verifiedInlineText}>Verified</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Bio */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>About You (Bio)</Text>
            <View style={[styles.inputBox, styles.textAreaBox]}>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Share a few words about yourself..."
                placeholderTextColor="#9CA3AF"
                multiline
                style={[styles.inputText, styles.textAreaText]}
              />
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Languages Spoken */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Languages spoken</Text>
          <View style={styles.chipsRow}>
            {COMMON_LANGUAGES.map((lang) => {
              const selected = languages.includes(lang);
              return (
                <Pressable
                  key={lang}
                  onPress={() => {
                    if (selected) {
                      setLanguages(languages.filter((l) => l !== lang));
                    } else {
                      setLanguages([...languages, lang]);
                    }
                  }}
                  style={[
                    styles.chipItem,
                    selected ? styles.chipItemSelected : styles.chipItemUnselected,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: selected ? '#EE7D30' : '#222222' },
                    ]}
                  >
                    {lang}
                  </Text>
                  {selected ? <Feather name="check" size={13} color="#EE7D30" /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.divider} />

        {/* 6. Emergency Contact */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Emergency contact</Text>
          <Text style={styles.sectionSub}>
            A trusted contact we can reach in case of an urgent emergency.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Contact Name</Text>
            <View style={styles.inputBox}>
              <TextInput
                value={emergencyContact.name}
                onChangeText={(v) => setEmergencyContact((p) => ({ ...p, name: v }))}
                placeholder="Full name of contact"
                placeholderTextColor="#9CA3AF"
                style={styles.inputText}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Relationship</Text>
            <View style={styles.inputBox}>
              <TextInput
                value={emergencyContact.relationship}
                onChangeText={(v) => setEmergencyContact((p) => ({ ...p, relationship: v }))}
                placeholder="e.g. Spouse, Parent, Sibling"
                placeholderTextColor="#9CA3AF"
                style={styles.inputText}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <View style={styles.inputBox}>
              <TextInput
                value={emergencyContact.phone}
                onChangeText={(v) => setEmergencyContact((p) => ({ ...p, phone: v }))}
                placeholder="e.g. +254 700 000 000"
                keyboardType="phone-pad"
                placeholderTextColor="#9CA3AF"
                style={styles.inputText}
              />
            </View>
          </View>
        </View>
      </KeyboardScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  topNavBar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  backIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleSection: {
    paddingTop: 16,
    paddingBottom: 20,
    gap: 6,
  },
  pageTitle: {
    fontSize: 26,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    letterSpacing: -0.3,
  },
  pageSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    lineHeight: 20,
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  trustBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  trustBannerTextWrap: {
    flex: 1,
    gap: 2,
  },
  trustBannerTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  trustBannerSub: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  trustBadgePill: {
    backgroundColor: '#EE7D3018',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  trustBadgePillText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#EE7D30',
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 8,
    gap: 6,
  },
  avatarWrap: {
    position: 'relative',
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#222222',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    marginTop: 4,
  },
  avatarSub: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  divider: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginVertical: 24,
  },
  sectionBlock: {
    gap: 16,
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    lineHeight: 18,
    marginTop: -8,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  inputBoxDisabled: {
    backgroundColor: '#F0F0F0',
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: '#222222',
  },
  textAreaBox: {
    minHeight: 90,
    alignItems: 'flex-start',
  },
  textAreaText: {
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
    marginTop: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipItemSelected: {
    backgroundColor: '#EE7D3012',
    borderColor: '#EE7D30',
  },
  chipItemUnselected: {
    backgroundColor: '#F7F7F7',
    borderColor: '#EBEBEB',
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
  },
  idButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 16,
  },
  idButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  idIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  idTextWrap: {
    flex: 1,
    gap: 2,
  },
  idTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  idStatusText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  verifiedInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedInlineText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#008A05',
  },
  addInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addInlineText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  pinnedBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  primaryCtaBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#EE7D30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EE7D30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
