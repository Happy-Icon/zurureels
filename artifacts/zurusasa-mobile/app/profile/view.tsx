import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
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
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { uploadToCloudinaryMobile } from '@/lib/cloudinaryUpload';
import { supabase } from '@/lib/supabase';

interface ProfileFieldConfig {
  id: string;
  label: string;
  iconFamily: 'feather' | 'ionicons' | 'material';
  iconName: string;
  placeholder: string;
  multiline?: boolean;
}

const PROFILE_FIELDS: ProfileFieldConfig[] = [
  {
    id: 'work',
    label: 'My work',
    iconFamily: 'feather',
    iconName: 'briefcase',
    placeholder: 'What do you do? (e.g. developer, designer, entrepreneur)',
  },
  {
    id: 'dreamDestination',
    label: "Where I've always wanted to go",
    iconFamily: 'feather',
    iconName: 'globe',
    placeholder: 'Dream destination (e.g. mombasa, lamu, zanzibar)',
  },
  {
    id: 'uselessSkill',
    label: 'My most useless skill',
    iconFamily: 'feather',
    iconName: 'wand',
    placeholder: 'A fun skill or useless talent (e.g. Reading, Whistling)',
  },
  {
    id: 'pets',
    label: 'Pets',
    iconFamily: 'material',
    iconName: 'paw',
    placeholder: 'Do you have pets? (e.g. cat, dog, none)',
  },
  {
    id: 'location',
    label: 'Where I live',
    iconFamily: 'feather',
    iconName: 'map-pin',
    placeholder: 'Your current hometown (e.g. Nairobi, Kenya)',
  },
  {
    id: 'languages',
    label: 'Languages I speak',
    iconFamily: 'ionicons',
    iconName: 'chatbubble-ellipses-outline',
    placeholder: 'Languages you speak (e.g. English, Swahili)',
  },
  {
    id: 'foodScenes',
    label: 'Food scenes',
    iconFamily: 'material',
    iconName: 'noodles',
    placeholder: 'Favorite food or dining vibes (e.g. Swahili seafood)',
  },
  {
    id: 'bio',
    label: 'About me',
    iconFamily: 'feather',
    iconName: 'user',
    placeholder: 'Tell others a little bit about yourself...',
    multiline: true,
  },
];

export default function ViewProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, refreshProfile, viewMode } = useAuth();
  const { showAlert } = useCustomAlert();

  const modalScrollRef = useRef<ScrollView>(null);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selectedAvatarUri, setSelectedAvatarUri] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Dynamic keyboard listeners to adapt bottom padding
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Form values state
  const [formValues, setFormValues] = useState<Record<string, string>>({
    work: '',
    dreamDestination: '',
    uselessSkill: '',
    pets: '',
    location: '',
    languages: '',
    foodScenes: '',
    bio: '',
  });

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 32;

  // Load existing profile metadata directly from user & profile record
  useEffect(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, any>;
    const profMeta = ((profile?.metadata ?? {}) as Record<string, any>);

    setFormValues({
      work: profMeta.work || meta.work || '',
      dreamDestination: profMeta.dreamDestination || meta.dreamDestination || '',
      uselessSkill: profMeta.uselessSkill || meta.uselessSkill || '',
      pets: profMeta.pets || meta.pets || '',
      location: profMeta.location || meta.location || '',
      languages: profMeta.languages || meta.languages || '',
      foodScenes: profMeta.foodScenes || meta.foodScenes || '',
      bio: profMeta.bio || meta.bio || '',
    });
  }, [user, profile]);

  const meta = (user?.user_metadata ?? {}) as Record<string, any>;
  const displayName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    user?.email?.split('@')[0] ||
    'Traveler';

  // Direct avatar URL resolution from local selection, Supabase profile metadata, and auth user_metadata
  const currentAvatarUrl =
    selectedAvatarUri ||
    (profile?.metadata as { avatar_url?: string } | null)?.avatar_url ||
    meta.avatar_url ||
    meta.picture ||
    meta.avatar ||
    null;

  const initial = displayName.charAt(0).toUpperCase();
  const isHost = viewMode === 'host';

  const hasCompletedProfile = Boolean(
    formValues.work.trim() ||
    formValues.dreamDestination.trim() ||
    formValues.uselessSkill.trim() ||
    formValues.pets.trim() ||
    formValues.location.trim() ||
    formValues.languages.trim() ||
    formValues.foodScenes.trim() ||
    formValues.bio.trim()
  );

  const updateField = (id: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [id]: value }));
  };

  // Auto-scroll field into view when tapped or focused
  const handleFieldFocus = (fieldId: string, index: number) => {
    setActiveFieldId(fieldId);
    setTimeout(() => {
      // Header and intro take ~220px. Each field row is ~72px.
      const targetY = Math.max(0, 160 + index * 75);
      modalScrollRef.current?.scrollTo({ y: targetY, animated: true });
    }, 120);
  };

  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert({
          title: 'Permission Required',
          message: 'Please enable photo library permissions in your device settings to select a profile picture.',
          icon: 'alert-circle',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const pickedUri = result.assets[0].uri;
      setSelectedAvatarUri(pickedUri);
      setUploadingAvatar(true);

      // 1. Upload picked image to Cloudinary/Storage for a permanent public URL
      let finalAvatarUrl = pickedUri;
      try {
        const uploadResult = await uploadToCloudinaryMobile(pickedUri, {
          resourceType: 'image',
          folder: 'avatars',
        });
        if (uploadResult?.secure_url) {
          finalAvatarUrl = uploadResult.secure_url;
        }
      } catch (uploadErr) {
        console.warn('Cloudinary upload fallback to direct uri:', uploadErr);
      }

      // 2. Persist permanent URL directly into Supabase profiles and user auth metadata
      if (user?.id) {
        const existingMeta = (profile?.metadata ?? {}) as Record<string, any>;
        await supabase
          .from('profiles')
          .update({
            metadata: {
              ...existingMeta,
              avatar_url: finalAvatarUrl,
            },
          })
          .eq('id', user.id);

        await supabase.auth.updateUser({
          data: {
            avatar_url: finalAvatarUrl,
            picture: finalAvatarUrl,
          },
        });

        setSelectedAvatarUri(finalAvatarUrl);

        if (refreshProfile) {
          await refreshProfile();
        }
      }

      showAlert({
        title: 'Picture Updated',
        message: 'Your profile picture has been updated.',
        icon: 'check-circle',
      });
    } catch (err: any) {
      console.warn('Avatar update note:', err);
      showAlert({
        title: 'Update Failed',
        message: err?.message || 'Could not update profile picture.',
        icon: 'alert-circle',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    Keyboard.dismiss();
    setSaving(true);
    try {
      const trimmedValues = {
        work: formValues.work.trim(),
        dreamDestination: formValues.dreamDestination.trim(),
        uselessSkill: formValues.uselessSkill.trim(),
        pets: formValues.pets.trim(),
        location: formValues.location.trim(),
        languages: formValues.languages.trim(),
        foodScenes: formValues.foodScenes.trim(),
        bio: formValues.bio.trim(),
      };

      if (user?.id) {
        const existingMeta = (profile?.metadata ?? {}) as Record<string, any>;
        await supabase
          .from('profiles')
          .update({
            metadata: {
              ...existingMeta,
              ...trimmedValues,
              ...(selectedAvatarUri ? { avatar_url: selectedAvatarUri } : {}),
            },
          })
          .eq('id', user.id);

        const { error } = await supabase.auth.updateUser({
          data: {
            ...(user?.user_metadata ?? {}),
            ...trimmedValues,
            ...(selectedAvatarUri ? { avatar_url: selectedAvatarUri, picture: selectedAvatarUri } : {}),
          },
        });

        if (error) throw error;

        if (refreshProfile) {
          await refreshProfile();
        }
      }

      setEditModalVisible(false);
      showAlert({
        title: 'Profile Updated',
        message: 'Your public profile details have been saved.',
        icon: 'check-circle',
      });
    } catch (e: any) {
      showAlert({
        title: 'Save Failed',
        message: e?.message || 'Unable to update profile. Please try again.',
        icon: 'alert-circle',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderFieldIcon = (field: ProfileFieldConfig, size = 22, color = '#222222') => {
    if (field.iconFamily === 'feather') {
      if (field.iconName === 'wand') {
        return <MaterialCommunityIcons name="magic-staff" size={size} color={color} />;
      }
      return <Feather name={field.iconName as any} size={size} color={color} />;
    }
    if (field.iconFamily === 'ionicons') {
      return <Ionicons name={field.iconName as any} size={size} color={color} />;
    }
    return <MaterialCommunityIcons name={field.iconName as any} size={size} color={color} />;
  };

  return (
    <View style={styles.fill}>
      {/* ── TOP HEADER BAR ───────────────────────────────────────────────────── */}
      <View style={[styles.headerRow, { paddingTop: topPad }]}>
        <Pressable
          testID="view-profile-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/(tabs)/profile');
          }}
          style={styles.circleBtn}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={24} color="#111111" />
        </Pressable>

        <Pressable
          testID="view-profile-edit-btn"
          onPress={() => setEditModalVisible(true)}
          style={styles.editPillBtn}
          hitSlop={8}
        >
          <Text style={styles.editPillBtnText}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
      >
        {/* ── HERO PROFILE CARD (MATCHING SCREENSHOT 1 & 2) ────────────────────── */}
        <View style={styles.heroCard}>
          <Pressable
            onPress={() => setEditModalVisible(true)}
            style={styles.avatarContainer}
          >
            {currentAvatarUrl ? (
              <Image source={{ uri: currentAvatarUrl }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <View style={styles.avatarInitialBox}>
                <Text style={styles.avatarInitialText}>{initial}</Text>
              </View>
            )}
          </Pressable>
          <Text style={styles.heroName}>{displayName}</Text>
          <Text style={styles.heroRole}>{isHost ? 'Host' : 'Guest'}</Text>
        </View>

        {/* ── STATE 1: UNCOMPLETED PROFILE (SCREENSHOT 2) ─────────────────────── */}
        {!hasCompletedProfile ? (
          <View style={styles.uncompletedSection}>
            <Text style={styles.completeTitle}>Complete your profile</Text>
            <Text style={styles.completeSub}>
              Your ZuruSasa profile is an important part of every reservation. Create yours to help other hosts and guests get to know you.
            </Text>

            <Pressable
              testID="get-started-profile-btn"
              onPress={() => {
                handleFieldFocus('work', 0);
                setEditModalVisible(true);
              }}
              style={({ pressed }) => [
                styles.getStartedBtn,
                pressed && styles.getStartedBtnPressed,
              ]}
            >
              <Text style={styles.getStartedBtnText}>Get started</Text>
            </Pressable>
          </View>
        ) : (
          /* ── STATE 2: COMPLETED PROFILE (SCREENSHOT 1) ───────────────────────── */
          <View style={styles.completedSection}>
            {formValues.work.trim() ? (
              <View style={styles.attributeRow}>
                <View style={styles.attributeIconWrap}>
                  <Feather name="briefcase" size={22} color="#222222" />
                </View>
                <Text style={styles.attributeText}>
                  My work: <Text style={styles.attributeValue}>{formValues.work}</Text>
                </Text>
              </View>
            ) : null}

            {formValues.dreamDestination.trim() ? (
              <View style={styles.attributeRow}>
                <View style={styles.attributeIconWrap}>
                  <Feather name="globe" size={22} color="#222222" />
                </View>
                <Text style={styles.attributeText}>
                  Where I've always wanted to go: <Text style={styles.attributeValue}>{formValues.dreamDestination}</Text>
                </Text>
              </View>
            ) : null}

            {formValues.uselessSkill.trim() ? (
              <View style={styles.attributeRow}>
                <View style={styles.attributeIconWrap}>
                  <MaterialCommunityIcons name="magic-staff" size={22} color="#222222" />
                </View>
                <Text style={styles.attributeText}>
                  Most useless skill: <Text style={styles.attributeValue}>{formValues.uselessSkill}</Text>
                </Text>
              </View>
            ) : null}

            {formValues.pets.trim() ? (
              <View style={styles.attributeRow}>
                <View style={styles.attributeIconWrap}>
                  <MaterialCommunityIcons name="paw" size={22} color="#222222" />
                </View>
                <Text style={styles.attributeText}>
                  Pets: <Text style={styles.attributeValue}>{formValues.pets}</Text>
                </Text>
              </View>
            ) : null}

            {formValues.location.trim() ? (
              <View style={styles.attributeRow}>
                <View style={styles.attributeIconWrap}>
                  <Feather name="map-pin" size={22} color="#222222" />
                </View>
                <Text style={styles.attributeText}>
                  Where I live: <Text style={styles.attributeValue}>{formValues.location}</Text>
                </Text>
              </View>
            ) : null}

            {formValues.languages.trim() ? (
              <View style={styles.attributeRow}>
                <View style={styles.attributeIconWrap}>
                  <Ionicons name="chatbubble-ellipses-outline" size={22} color="#222222" />
                </View>
                <Text style={styles.attributeText}>
                  Languages: <Text style={styles.attributeValue}>{formValues.languages}</Text>
                </Text>
              </View>
            ) : null}

            {/* Divider */}
            {formValues.foodScenes.trim() ? (
              <>
                <View style={styles.sectionDivider} />
                <View style={styles.interestsSection}>
                  <Text style={styles.interestsHeading}>My interests</Text>
                  <View style={styles.attributeRow}>
                    <View style={styles.attributeIconWrap}>
                      <MaterialCommunityIcons name="noodles" size={22} color="#222222" />
                    </View>
                    <Text style={styles.attributeText}>
                      Food scenes: <Text style={styles.attributeValue}>{formValues.foodScenes}</Text>
                    </Text>
                  </View>
                </View>
              </>
            ) : null}

            {formValues.bio.trim() ? (
              <>
                <View style={styles.sectionDivider} />
                <View style={styles.interestsSection}>
                  <Text style={styles.interestsHeading}>About me</Text>
                  <Text style={styles.bioText}>{formValues.bio}</Text>
                </View>
              </>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* ── EDIT PROFILE MODAL SHEET (MATCHING SCREENSHOT 3) ─────────────────── */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          Keyboard.dismiss();
          setEditModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalSheet}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
        >
          {/* Modal Header */}
          <View style={[styles.modalHeader, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
            <View style={{ width: 36 }} />
            <Text style={styles.modalHeaderTitle}>Edit profile</Text>
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                setEditModalVisible(false);
              }}
              style={styles.modalCloseCircle}
              hitSlop={10}
            >
              <Feather name="x" size={20} color="#111111" />
            </Pressable>
          </View>

          <ScrollView
            ref={modalScrollRef}
            style={styles.modalScroll}
            contentContainerStyle={[
              styles.modalScrollContent,
              { paddingBottom: Math.max(160, keyboardHeight + 80) },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {/* Center Avatar with Live Camera / Library Picker */}
            <View style={styles.modalAvatarCenter}>
              <Pressable
                onPress={handlePickAvatar}
                disabled={uploadingAvatar}
                style={styles.modalAvatarContainer}
              >
                {currentAvatarUrl ? (
                  <Image source={{ uri: currentAvatarUrl }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <View style={styles.avatarInitialBox}>
                    <Text style={styles.avatarInitialText}>{initial}</Text>
                  </View>
                )}
                {uploadingAvatar && (
                  <View style={styles.avatarLoadingOverlay}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                )}
              </Pressable>

              <Pressable
                onPress={handlePickAvatar}
                disabled={uploadingAvatar}
                style={styles.avatarEditPill}
              >
                <Feather name="camera" size={14} color="#111111" style={{ marginRight: 4 }} />
                <Text style={styles.avatarEditPillText}>Edit</Text>
              </Pressable>
            </View>

            {/* Intro text */}
            <View style={styles.introBlock}>
              <Text style={styles.introTitle}>My profile</Text>
              <Text style={styles.introDesc}>
                Hosts and guests can see your profile, and it may appear across ZuruSasa to help us build trust in our community.{' '}
                <Text
                  onPress={() =>
                    showAlert({
                      title: 'About Public Profiles',
                      message:
                        'Public profiles help build trust between guests and hosts across the ZuruSasa coastal community.',
                      icon: 'shield',
                    })
                  }
                  style={styles.learnMoreLink}
                >
                  Learn more
                </Text>
              </Text>
            </View>

            {/* ── INTERACTIVE FIELDS (AUTO-SCROLLS INTO VIEW WHEN CLICKED) ───────── */}
            <View style={styles.fieldsList}>
              {PROFILE_FIELDS.map((field, index) => {
                const val = formValues[field.id] || '';
                const isExpanded = activeFieldId === field.id || val.length > 0;

                return (
                  <View key={field.id} style={styles.fieldRowContainer}>
                    <Pressable
                      onPress={() => {
                        if (activeFieldId === field.id) {
                          setActiveFieldId(null);
                        } else {
                          handleFieldFocus(field.id, index);
                        }
                      }}
                      style={styles.fieldHeaderPressable}
                    >
                      <View style={styles.fieldIconCol}>
                        {renderFieldIcon(field, 22, '#222222')}
                      </View>
                      <View style={styles.fieldLabelCol}>
                        <Text style={styles.fieldRowLabel}>{field.label}</Text>
                        {!isExpanded && (
                          <Text style={styles.fieldAddPrompt}>Tap to add</Text>
                        )}
                      </View>
                      <Feather
                        name={isExpanded ? 'chevron-down' : 'chevron-right'}
                        size={18}
                        color="#9E9E9E"
                      />
                    </Pressable>

                    {/* Expandable TextInput with Auto-Scroll & Keyboard Safe Offset */}
                    {isExpanded && (
                      <View style={styles.inputExpansionWrap}>
                        <TextInput
                          value={val}
                          onChangeText={(text) => updateField(field.id, text)}
                          onFocus={() => handleFieldFocus(field.id, index)}
                          placeholder={field.placeholder}
                          placeholderTextColor="#9E9E9E"
                          multiline={field.multiline}
                          autoFocus={activeFieldId === field.id && val.length === 0}
                          style={[
                            styles.fieldAnswerInput,
                            field.multiline && { height: 78, textAlignVertical: 'top' },
                          ]}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Bottom Done Action Button */}
            <Pressable
              testID="edit-profile-done-btn"
              onPress={handleSaveProfile}
              disabled={saving}
              style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.9 }]}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.doneBtnText}>Done</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  editPillBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  editPillBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },

  /* ── Hero Profile Card (Screenshot 1 & 2) ───────────────────────────────── */
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 28,
  },
  avatarContainer: {
    width: 104,
    height: 104,
    borderRadius: 52,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitialBox: {
    width: '100%',
    height: '100%',
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialText: {
    fontSize: 42,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  heroName: {
    fontSize: 26,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  heroRole: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    marginTop: 4,
    textAlign: 'center',
  },

  /* ── Uncompleted Profile CTA (Screenshot 2) ─────────────────────────────── */
  uncompletedSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  completeTitle: {
    fontSize: 24,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 10,
  },
  completeSub: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
    marginBottom: 28,
  },
  getStartedBtn: {
    backgroundColor: '#FF385C',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  getStartedBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },

  /* ── Completed Attributes Display (Screenshot 1) ────────────────────────── */
  completedSection: {
    paddingTop: 4,
  },
  attributeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  attributeIconWrap: {
    width: 34,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: 10,
  },
  attributeText: {
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: '#222222',
    flex: 1,
    lineHeight: 22,
  },
  attributeValue: {
    fontFamily: 'DMSans_400Regular',
    color: '#222222',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginVertical: 18,
  },
  interestsSection: {
    paddingTop: 4,
  },
  interestsHeading: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: '#4B5563',
    lineHeight: 22,
  },

  /* ── Edit Profile Modal Sheet (Screenshot 3) ───────────────────────────── */
  modalSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  modalCloseCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  modalAvatarCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  modalAvatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditPill: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarEditPillText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  introBlock: {
    marginBottom: 20,
  },
  introTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  introDesc: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    lineHeight: 20,
  },
  learnMoreLink: {
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
    textDecorationLine: 'underline',
  },

  /* ── Interactive Form Rows ──────────────────────────────────────────────── */
  fieldsList: {
    marginBottom: 28,
  },
  fieldRowContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingVertical: 12,
  },
  fieldHeaderPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  fieldIconCol: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  fieldLabelCol: {
    flex: 1,
  },
  fieldRowLabel: {
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: '#222222',
  },
  fieldAddPrompt: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#9E9E9E',
    marginTop: 2,
  },
  inputExpansionWrap: {
    marginTop: 8,
    paddingLeft: 36,
  },
  fieldAnswerInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: '#111111',
  },
  doneBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
});
