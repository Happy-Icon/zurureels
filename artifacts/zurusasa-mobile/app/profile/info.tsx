import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

export default function PersonalInformationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [emergencyContact, setEmergencyContact] = useState<EmergencyContact>({
    name: '',
    phone: '',
    relationship: '',
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 12;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        setFullName((user.user_metadata?.full_name as string) || '');
        setPhone((user.user_metadata?.phone as string) || '');

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

const uriToBlob = (uri: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new TypeError('Network request failed'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
};

  const handleAvatarUpload = async () => {
    if (!user) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      setAvatarUploading(true);
      const ext = (asset.fileName?.split('.').pop() ?? asset.uri.split('.').pop() ?? 'jpg').toLowerCase();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const blob = await uriToBlob(asset.uri);

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`, upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      setAvatarUrl(publicUrl);

      const { data: existing } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', user.id)
        .single();
      const curMeta = (existing?.metadata as Record<string, any>) ?? {};

      await supabase
        .from('profiles')
        .update({ metadata: { ...curMeta, avatar_url: publicUrl } })
        .eq('id', user.id);

      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      await refreshProfile();
      Alert.alert('Success', 'Profile photo updated!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload photo.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', user.id)
        .single();

      const curMeta = (existing?.metadata as Record<string, any>) ?? {};

      await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone,
          bio,
          languages,
          emergency_contact: emergencyContact,
          metadata: { ...curMeta, bio },
        })
        .eq('id', user.id);

      await supabase.auth.updateUser({ data: { full_name: fullName, phone } });
      await refreshProfile();
      Alert.alert('Success', 'Personal information saved.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (pageLoading) {
    return (
      <View style={[styles.fill, { backgroundColor: '#FFFFFF', paddingTop: topPad, paddingHorizontal: 24, gap: 16 }]}>
        <Skeleton style={{ height: 40, width: 40, borderRadius: 20 }} />
        <Skeleton style={{ height: 32, width: 220, borderRadius: 8 }} />
        <Skeleton style={{ height: 90, width: 90, borderRadius: 45 }} />
        <Skeleton style={{ height: 48, borderRadius: 12 }} />
        <Skeleton style={{ height: 48, borderRadius: 12 }} />
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: '#FFFFFF', paddingTop: topPad }]}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          testID="back-btn"
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

      <KeyboardScreen
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
        stickyFooter={
          <View style={[styles.pinnedBottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Pressable
              testID="save-identity-btn"
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [styles.primaryCtaBtn, pressed && { opacity: 0.9 }]}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryCtaBtnText}>Save changes</Text>
              )}
            </Pressable>
          </View>
        }
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Personal information</Text>
        </View>

        {/* Profile Photo */}
        <View style={styles.avatarRow}>
          <Pressable
            testID="avatar-upload"
            onPress={handleAvatarUpload}
            disabled={avatarUploading}
            style={({ pressed }) => [styles.avatarWrap, pressed && { opacity: 0.85 }]}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={styles.avatarFallback}>
                <Feather name="user" size={40} color="#717171" />
              </View>
            )}
            <View style={styles.cameraBadge}>
              {avatarUploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="camera" size={13} color="#FFFFFF" />
              )}
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.avatarTitle}>Profile photo</Text>
            <Text style={styles.avatarSub}>A clear photo helps hosts and guests recognize you</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Input Form Fields */}
        <View style={styles.formBlock}>
          <View style={styles.inputField}>
            <Text style={styles.inputLabel}>Legal name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full name"
              placeholderTextColor="#9CA3AF"
              style={styles.inputText}
            />
          </View>

          <View style={styles.fieldDivider} />

          <View style={styles.inputField}>
            <Text style={styles.inputLabel}>Phone number</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+254 712 345 678"
              keyboardType="phone-pad"
              placeholderTextColor="#9CA3AF"
              style={styles.inputText}
            />
          </View>

          <View style={styles.fieldDivider} />

          <View style={styles.inputField}>
            <Text style={styles.inputLabel}>Email address</Text>
            <TextInput
              value={user?.email ?? ''}
              editable={false}
              style={[styles.inputText, { color: '#717171' }]}
            />
          </View>

          <View style={styles.fieldDivider} />

          <View style={styles.inputField}>
            <Text style={styles.inputLabel}>About you (Bio)</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell hosts or guests a little about yourself"
              placeholderTextColor="#9CA3AF"
              multiline
              style={[styles.inputText, { height: 72, textAlignVertical: 'top', paddingTop: 4 }]}
            />
          </View>
        </View>

        <View style={styles.divider} />

        {/* Emergency Contact */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Emergency contact</Text>
          <Text style={styles.sectionSub}>A trusted contact we can reach in case of an emergency.</Text>

          <View style={styles.formBlock}>
            <View style={styles.inputField}>
              <Text style={styles.inputLabel}>Contact name</Text>
              <TextInput
                value={emergencyContact.name}
                onChangeText={(v) => setEmergencyContact((p) => ({ ...p, name: v }))}
                placeholder="Full name"
                placeholderTextColor="#9CA3AF"
                style={styles.inputText}
              />
            </View>

            <View style={styles.fieldDivider} />

            <View style={styles.inputField}>
              <Text style={styles.inputLabel}>Relationship</Text>
              <TextInput
                value={emergencyContact.relationship}
                onChangeText={(v) => setEmergencyContact((p) => ({ ...p, relationship: v }))}
                placeholder="e.g. Spouse, Parent, Friend"
                placeholderTextColor="#9CA3AF"
                style={styles.inputText}
              />
            </View>

            <View style={styles.fieldDivider} />

            <View style={styles.inputField}>
              <Text style={styles.inputLabel}>Phone number</Text>
              <TextInput
                value={emergencyContact.phone}
                onChangeText={(v) => setEmergencyContact((p) => ({ ...p, phone: v }))}
                placeholder="Phone number"
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
  fill: {
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
  titleSection: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.8,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  avatarWrap: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  avatarSub: {
    fontSize: 13,
    color: '#717171',
    marginTop: 2,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 20,
  },
  formBlock: {
    gap: 12,
  },
  inputField: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#717171',
  },
  inputText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    paddingVertical: 6,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  sectionBlock: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13,
    color: '#717171',
    marginBottom: 16,
  },
  pinnedBottomBar: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  primaryCtaBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
