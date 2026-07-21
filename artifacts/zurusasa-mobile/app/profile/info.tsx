import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { ScreenHeader } from '@/components/profile/ScreenHeader';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/hooks/useColors';

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

export default function DigitalIdentityScreen() {
  const colors = useColors();
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
      Alert.alert('Success', 'Profile picture updated!');
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
      Alert.alert('Success', 'ID document uploaded! It is now pending review.');
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
      Alert.alert('Saved', 'Digital identity updated successfully');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const toggleLanguage = (lang: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  };

  const inputStyle = [
    styles.input,
    {
      borderColor: colors.border,
      color: colors.foreground,
      backgroundColor: colors.card,
    },
  ];

  if (pageLoading) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <ScreenHeader />
        <View style={[styles.fill, styles.centered]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScreenHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Trust Score */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.row}>
                <MaterialCommunityIcons
                  name="shield-check-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                  Trust Score
                </Text>
              </View>
              <Text style={[styles.mutedSmall, { color: colors.mutedForeground }]}>
                Complete your profile to build trust
              </Text>
            </View>
            <Text style={[styles.scoreText, { color: colors.primary }]}>
              {completeness}%
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.primary, width: `${completeness}%` },
              ]}
            />
          </View>
          {completeness < 100 ? (
            <View style={styles.warningBox}>
              <Feather name="alert-triangle" size={15} color="#c2410c" />
              <Text style={styles.warningText}>
                Add a government ID to reach 100% verified status.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Profile Picture */}
        <View
          style={[
            styles.card,
            styles.centered,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Pressable
            testID="avatar-upload"
            onPress={handleAvatarUpload}
            disabled={avatarUploading}
            style={({ pressed }) => [
              styles.avatar,
              {
                backgroundColor: colors.secondary,
                borderColor: `${colors.primary}33`,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImage}
                contentFit="cover"
              />
            ) : (
              <Feather name="user" size={40} color={colors.mutedForeground} />
            )}
            <View style={styles.avatarOverlay}>
              {avatarUploading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Feather name="upload" size={18} color="#ffffff" />
              )}
            </View>
          </Pressable>
          <Text style={[styles.cardTitle, { color: colors.foreground, marginTop: 12 }]}>
            Profile Picture
          </Text>
          <Text style={[styles.mutedSmall, { color: colors.mutedForeground }]}>
            Tap the photo to upload a clear picture of yourself
          </Text>
        </View>

        {/* Basic Information */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Basic Information
        </Text>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Full Name</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
            placeholderTextColor={colors.mutedForeground}
            style={inputStyle}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Phone Number</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+254 7..."
            keyboardType="phone-pad"
            placeholderTextColor={colors.mutedForeground}
            style={inputStyle}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Email Address</Text>
          <TextInput
            value={user?.email ?? ''}
            editable={false}
            style={[
              styles.input,
              {
                borderColor: colors.border,
                color: colors.mutedForeground,
                backgroundColor: colors.secondary,
              },
            ]}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Your Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell the community about yourself..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[...inputStyle, styles.textArea]}
          />
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Share your background, interests, and why you love ZuruSasa.
          </Text>
        </View>

        {/* Languages */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Languages Spoken
        </Text>
        <Text style={[styles.mutedSmall, { color: colors.mutedForeground, marginBottom: 10 }]}>
          Help hosts and guests understand you better.
        </Text>
        <View style={styles.chipsWrap}>
          {COMMON_LANGUAGES.map((lang) => {
            const selected = languages.includes(lang);
            return (
              <Pressable
                key={lang}
                onPress={() => toggleLanguage(lang)}
                style={[
                  styles.chip,
                  selected
                    ? { backgroundColor: `${colors.primary}1A`, borderColor: colors.primary }
                    : { backgroundColor: 'transparent', borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  {lang}
                </Text>
                {selected ? <Feather name="x" size={13} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>

        {/* Verifications */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Verifications</Text>
        <Text style={[styles.mutedSmall, { color: colors.mutedForeground, marginBottom: 10 }]}>
          Verified profiles get 3x more bookings.
        </Text>
        <VerificationRow label="Email Address" verified={badges.email} colors={colors} />
        <VerificationRow
          label="Phone Number"
          verified={!!phone && phone.length > 5}
          colors={colors}
        />
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border, marginTop: 10 },
          ]}
        >
          <View style={styles.rowBetween}>
            <View style={[styles.row, { flex: 1 }]}>
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: badges.identity ? '#d1fae5' : colors.secondary,
                  },
                ]}
              >
                <Feather
                  name="file-text"
                  size={15}
                  color={badges.identity ? '#059669' : colors.mutedForeground}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.badgeLabel, { color: colors.foreground }]}>
                  Government ID
                </Text>
                <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                  Passport, ID Card or Driving License
                </Text>
              </View>
            </View>
            {badges.identity ? (
              <StatusPill text="Verified" bg="#10b981" fg="#ffffff" />
            ) : idUrl ? (
              <StatusPill text="Pending Review" bg="#fef3c7" fg="#b45309" />
            ) : (
              <StatusPill text="Not Provided" bg={colors.secondary} fg={colors.mutedForeground} />
            )}
          </View>

          {!badges.identity && !idUrl ? (
            <Pressable
              testID="id-upload"
              onPress={handleIdUpload}
              disabled={idUploading}
              style={({ pressed }) => [
                styles.uploadBox,
                {
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.secondary : 'transparent',
                },
              ]}
            >
              {idUploading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Feather name="upload" size={24} color={colors.mutedForeground} />
              )}
              <Text style={[styles.mutedSmall, { color: colors.mutedForeground }]}>
                Tap to upload ID (JPG, PNG)
              </Text>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Max file size: 5MB
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Emergency Contact */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Emergency Contact
        </Text>
        <Text style={[styles.mutedSmall, { color: colors.mutedForeground, marginBottom: 10 }]}>
          Trusted contact for safety purposes.
        </Text>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Contact Name</Text>
          <TextInput
            value={emergencyContact.name}
            onChangeText={(v) => setEmergencyContact((p) => ({ ...p, name: v }))}
            placeholder="e.g. John Doe"
            placeholderTextColor={colors.mutedForeground}
            style={inputStyle}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Relationship</Text>
          <TextInput
            value={emergencyContact.relationship}
            onChangeText={(v) => setEmergencyContact((p) => ({ ...p, relationship: v }))}
            placeholder="e.g. Brother, Friend"
            placeholderTextColor={colors.mutedForeground}
            style={inputStyle}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Contact Phone</Text>
          <TextInput
            value={emergencyContact.phone}
            onChangeText={(v) => setEmergencyContact((p) => ({ ...p, phone: v }))}
            placeholder="+254 7..."
            keyboardType="phone-pad"
            placeholderTextColor={colors.mutedForeground}
            style={inputStyle}
          />
        </View>

        {/* Save */}
        <Pressable
          testID="save-identity"
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: colors.primary, opacity: pressed || saving ? 0.85 : 1 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Feather name="save" size={16} color="#ffffff" />
          )}
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function VerificationRow({
  label,
  verified,
  colors,
}: {
  label: string;
  verified: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        styles.card,
        styles.rowBetween,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          marginBottom: 10,
          gap: 0,
        },
      ]}
    >
      <View style={styles.row}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: verified ? '#d1fae5' : colors.secondary },
          ]}
        >
          <Feather
            name={verified ? 'check' : 'clock'}
            size={15}
            color={verified ? '#059669' : colors.mutedForeground}
          />
        </View>
        <Text style={[styles.badgeLabel, { color: colors.foreground }]}>{label}</Text>
      </View>
      {verified ? (
        <StatusPill text="Verified" bg="#10b981" fg="#ffffff" />
      ) : (
        <StatusPill text="Unverified" bg={colors.secondary} fg={colors.mutedForeground} />
      )}
    </View>
  );
}

function StatusPill({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <Text style={[styles.statusPillText, { color: fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 48 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontFamily: 'DMSans_600SemiBold' },
  mutedSmall: { fontSize: 13, fontFamily: 'DMSans_400Regular' },
  hint: { fontSize: 11, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  scoreText: { fontSize: 24, fontFamily: 'DMSans_700Bold' },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    padding: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#c2410c',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'DMSans_600SemiBold',
    marginTop: 8,
    marginBottom: 6,
  },
  fieldGroup: { marginBottom: 14, gap: 6 },
  label: { fontSize: 13, fontFamily: 'DMSans_500Medium' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
  },
  textArea: { minHeight: 110, textAlignVertical: 'top' },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontFamily: 'DMSans_500Medium' },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: { fontSize: 14, fontFamily: 'DMSans_500Medium' },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: { fontSize: 12, fontFamily: 'DMSans_500Medium' },
  uploadBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 24,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 14,
    marginTop: 12,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
