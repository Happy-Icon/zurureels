
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, type Href } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';
import { uploadToCloudinaryMobile } from '@/lib/cloudinaryUpload';
import { supabase } from '@/lib/supabase';
import { useSavedEvents, useSavedReels } from '@/lib/queries';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationBadge } from '@/components/NotificationBadge';
import { Skeleton } from '@/components/Skeleton';

interface ProfileMenuItem {
  id: string;
  title: string;
  iconFamily: 'feather' | 'ionicons' | 'material';
  iconName: string;
  route?: Href;
  action?: () => void;
  showChevron?: boolean;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const { isDark } = useTheme();
  const { user, profile, signOut, loading, viewMode, switchViewMode, role, refreshProfile } = useAuth();
  const { showAlert } = useCustomAlert();

  const { data: reels } = useSavedReels(user?.id);
  const { data: events } = useSavedEvents(user?.id);
  const savedCount = (reels?.length ?? 0) + (events?.length ?? 0);
  const { unreadCount } = useNotifications();

  // Mode switching state & animation
  const [switchingOverlayVisible, setSwitchingOverlayVisible] = useState(false);
  const [targetMode, setTargetMode] = useState<'guest' | 'host'>('host');
  const [imageError, setImageError] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 12;
  const bottomPad = Platform.OS === 'web' ? 140 : insets.bottom + 140;

  useEffect(() => {
    if (switchingOverlayVisible) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.94,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [switchingOverlayVisible, pulseAnim]);

  if (loading) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: topPad, paddingHorizontal: 24, gap: 20 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton style={{ height: 36, width: 120, borderRadius: 8 }} />
          <Skeleton style={{ height: 40, width: 40, borderRadius: 20 }} />
        </View>
        <Skeleton style={{ height: 180, borderRadius: 28 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Skeleton style={{ flex: 1, height: 140, borderRadius: 24 }} />
          <Skeleton style={{ flex: 1, height: 140, borderRadius: 24 }} />
        </View>
        <Skeleton style={{ height: 90, borderRadius: 24 }} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.fill, styles.centered, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={[styles.loggedOutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.loggedOutIconRing, { backgroundColor: isDark ? '#27272A' : '#F8FAFC' }]}>
            <Feather name="user" size={32} color={colors.text} />
          </View>
          <Text style={[styles.loggedOutTitle, { color: colors.text }]}>Your Profile</Text>
          <Text style={[styles.loggedOutSub, { color: colors.mutedForeground }]}>
            Log in to manage your reservations, wishlist, payment methods and profile settings.
          </Text>
          <Pressable
            testID="signin-button"
            onPress={() => router.push('/auth')}
            style={({ pressed }) => [styles.signInBtn, { backgroundColor: '#F26522' }, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.signInBtnText}>Log in or Sign up</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const profMeta = (profile?.metadata ?? {}) as Record<string, any>;
  const displayName =
    (typeof profile?.full_name === 'string' && profile.full_name.trim()) ||
    (typeof meta.full_name === 'string' && (meta.full_name as string).trim()) ||
    (typeof meta.legal_name === 'string' && (meta.legal_name as string).trim()) ||
    user.email?.split('@')[0] ||
    user.phone ||
    'Traveler';

  const rawAvatarUrl =
    (profile as any)?.avatar_url ||
    profMeta?.avatar_url ||
    (meta.avatar_url as string) ||
    (meta.picture as string) ||
    (meta.avatar as string) ||
    null;

  const avatarUrl = typeof rawAvatarUrl === 'string' && rawAvatarUrl.trim().length > 0
    ? rawAvatarUrl
    : null;

  const initial = displayName.charAt(0).toUpperCase();
  const isHostMode = viewMode === 'host';
  const isVerified = Boolean(
    (profile as any)?.is_verified ||
    (profile as any)?.verification_status === 'verified' ||
    meta?.verification_status === 'verified'
  );
  const userContact = user.phone || (profile as any)?.phone || user.email || (profile as any)?.email || '';
  const userLocation = profMeta?.location || (meta.location as string) || '';
  const userWork = profMeta?.work || (meta.work as string) || '';

  const handlePickAndUploadAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert({
          title: 'Permission Required',
          message: 'Please allow photo library access to change your profile picture.',
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

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const pickedUri = result.assets[0].uri;
      setUploadingAvatar(true);

      let finalAvatarUrl = pickedUri;
      try {
        const uploadRes = await uploadToCloudinaryMobile(pickedUri, {
          resourceType: 'image',
          folder: 'avatars',
        });
        if (uploadRes?.secure_url) {
          finalAvatarUrl = uploadRes.secure_url;
        }
      } catch (e) {
        console.warn('Cloudinary upload error, using direct uri:', e);
      }

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

        setImageError(false);
        if (refreshProfile) await refreshProfile();
      }

      showAlert({
        title: 'Profile Photo Updated',
        message: 'Your new profile picture has been saved.',
        icon: 'check-circle',
      });
    } catch (err: any) {
      console.warn('Avatar update note:', err);
      showAlert({
        title: 'Upload Failed',
        message: err?.message || 'Could not upload profile picture.',
        icon: 'alert-circle',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSignOut = () => {
    showAlert({
      title: 'Log out',
      message: 'Are you sure you want to log out of your ZuruSasa account?',
      icon: 'log-out',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ],
    });
  };

  const handleSwitchMode = () => {
    const nextMode = isHostMode ? 'guest' : 'host';
    setTargetMode(nextMode);
    setSwitchingOverlayVisible(true);

    setTimeout(() => {
      switchViewMode(nextMode);
    }, 1100);

    setTimeout(() => {
      setSwitchingOverlayVisible(false);
    }, 1500);
  };

  /* Exact menu items matching user screenshot */
  const block1Items: ProfileMenuItem[] = [
    {
      id: 'settings',
      title: 'Account settings',
      iconFamily: 'material',
      iconName: 'cog-outline',
      route: '/profile/settings',
      showChevron: true,
    },
    {
      id: 'get_help',
      title: 'Get help',
      iconFamily: 'feather',
      iconName: 'help-circle',
      route: '/profile/support',
      showChevron: true,
    },
    {
      id: 'view_profile',
      title: 'View profile',
      iconFamily: 'feather',
      iconName: 'user',
      route: '/profile/view',
      showChevron: true,
    },
    {
      id: 'privacy',
      title: 'Privacy',
      iconFamily: 'ionicons',
      iconName: 'hand-right-outline',
      route: '/profile/privacy',
      showChevron: true,
    },
  ];

  const block2Items: ProfileMenuItem[] = [
    {
      id: 'refer_host',
      title: 'Refer a host',
      iconFamily: 'material',
      iconName: 'account-multiple-outline',
      route: '/profile/refer',
      showChevron: true,
    },
    {
      id: 'legal',
      title: 'Legal',
      iconFamily: 'material',
      iconName: 'book-open-outline',
      route: '/profile/legal',
      showChevron: true,
    },
    {
      id: 'logout',
      title: 'Log out',
      iconFamily: 'material',
      iconName: 'door-open',
      action: handleSignOut,
      showChevron: false,
    },
  ];

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScrollView
        style={[styles.fill, { backgroundColor: colors.background }]}
        contentContainerStyle={{
          paddingTop: topPad,
          paddingBottom: bottomPad,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ───────────────────────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Profile</Text>
          <Pressable
            testID="notification-bell-btn"
            onPress={() => router.push('/notifications')}
            style={({ pressed }) => [
              styles.bellBtn,
              { backgroundColor: isDark ? '#27272A' : '#F3F4F6' },
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={8}
          >
            <Feather name="bell" size={20} color={colors.text} />
            <NotificationBadge count={unreadCount} />
          </Pressable>
        </View>

        {/* ── PROFILE HERO CARD ────────────────────────────────────────────────── */}
        <Pressable
          testID="profile-hero-card"
          onPress={() => router.push('/profile/view')}
          style={({ pressed }) => [
            styles.profileCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            pressed && { opacity: 0.95 },
          ]}
        >
          <View style={styles.avatarContainer}>
            {avatarUrl && !imageError ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImg}
                contentFit="cover"
                transition={150}
                onError={() => setImageError(true)}
              />
            ) : (
              <View style={[styles.avatarInitialBox, { backgroundColor: isDark ? '#27272A' : '#FFF7ED', borderColor: isDark ? '#3F3F46' : '#FED7AA' }]}>
                <Text style={styles.avatarInitialText}>{initial}</Text>
              </View>
            )}
            <Pressable
              testID="avatar-camera-btn"
              onPress={handlePickAndUploadAvatar}
              style={({ pressed }) => [styles.avatarCameraBadge, pressed && { opacity: 0.8 }]}
              hitSlop={6}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="camera" size={12} color="#FFFFFF" />
              )}
            </Pressable>
          </View>

          <Text style={[styles.userName, { color: colors.text }]}>{displayName}</Text>

          {userContact ? (
            <Text style={[styles.userContactText, { color: colors.mutedForeground }]}>{userContact}</Text>
          ) : null}

          <View style={[styles.roleTagPill, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
            <Text style={[styles.roleTagText, { color: isDark ? '#E4E4E7' : '#374151' }]}>
              {isHostMode
                ? isVerified
                  ? 'Verified Host'
                  : 'Host'
                : isVerified
                  ? 'Verified Guest'
                  : 'Guest Traveler'}
            </Text>
          </View>

          {userLocation || userWork ? (
            <View style={styles.metaPreviewRow}>
              {userLocation ? (
                <View style={[styles.metaChip, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
                  <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                  <Text style={[styles.metaChipText, { color: colors.mutedForeground }]}>{userLocation}</Text>
                </View>
              ) : null}
              {userWork ? (
                <View style={[styles.metaChip, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
                  <Feather name="briefcase" size={11} color={colors.mutedForeground} />
                  <Text style={[styles.metaChipText, { color: colors.mutedForeground }]}>{userWork}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.showProfilePill, { backgroundColor: isDark ? '#27272A' : '#FFF5EF' }]}>
            <Text style={styles.showProfilePillText}>Show profile</Text>
            <Feather name="chevron-right" size={14} color="#F26522" />
          </View>
        </Pressable>

        {/* ── QUICK CARDS (Bookings & History) ─────────────────────────────────── */}
        <View style={styles.quickCardsRow}>
          <Pressable
            testID="profile-quick-bookings"
            onPress={() => router.push('/reservations')}
            style={({ pressed }) => [
              styles.quickCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && styles.quickCardPressed,
            ]}
          >
            <View style={[styles.quickCardIconWrap, { backgroundColor: isDark ? '#27272A' : '#FFF5EF' }]}>
              <Feather name="briefcase" size={36} color="#F26522" />
            </View>
            <Text style={[styles.quickCardText, { color: colors.text }]}>Bookings</Text>
          </Pressable>

          <Pressable
            testID="profile-quick-history"
            onPress={() => router.push('/profile/history')}
            style={({ pressed }) => [
              styles.quickCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && styles.quickCardPressed,
            ]}
          >
            <View style={[styles.quickCardIconWrap, { backgroundColor: isDark ? '#27272A' : '#FFF5EF' }]}>
              <MaterialCommunityIcons name="history" size={38} color="#F26522" />
            </View>
            <Text style={[styles.quickCardText, { color: colors.text }]}>History</Text>
          </Pressable>
        </View>

        {/* ── BECOME A HOST CARD ──────────────────────────────────────────────── */}
        {!isHostMode && role !== 'host' && (
          <Pressable
            onPress={() => router.push('/become-host')}
            style={({ pressed }) => [
              styles.becomeHostCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && { opacity: 0.95 },
            ]}
          >
            <View style={[styles.becomeHostIconWrap, { backgroundColor: isDark ? '#27272A' : '#FFF5EF' }]}>
              <Feather name="home" size={26} color="#F26522" />
            </View>
            <View style={styles.becomeHostTextStack}>
              <Text style={[styles.becomeHostTitle, { color: colors.text }]}>Become a host</Text>
              <Text style={[styles.becomeHostSub, { color: colors.mutedForeground }]}>
                It's easy to start hosting and earn extra income.
              </Text>
            </View>
          </Pressable>
        )}

        {/* ── EXACT MENU LIST (MATCHING SCREENSHOT) ────────────────────────────── */}
        <View style={styles.menuListBlock}>
          {/* Block 1 */}
          {block1Items.map((item) => (
            <Pressable
              key={item.id}
              testID={`profile-menu-${item.id}`}
              onPress={() => {
                if (item.action) item.action();
                else if (item.route) router.push(item.route);
              }}
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
            >
              <View style={styles.menuIconWrap}>
                {item.iconFamily === 'feather' && (
                  <Feather name={item.iconName as any} size={22} color={colors.text} />
                )}
                {item.iconFamily === 'ionicons' && (
                  <Ionicons name={item.iconName as any} size={22} color={colors.text} />
                )}
                {item.iconFamily === 'material' && (
                  <MaterialCommunityIcons name={item.iconName as any} size={24} color={colors.text} />
                )}
              </View>
              <Text style={[styles.menuTitle, { color: colors.text }]}>{item.title}</Text>
              {item.showChevron && <Feather name="chevron-right" size={20} color={colors.mutedForeground} />}
            </Pressable>
          ))}

          {/* Subtle Divider Line */}
          <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

          {/* Block 2 */}
          {block2Items.map((item) => (
            <Pressable
              key={item.id}
              testID={`profile-menu-${item.id}`}
              onPress={() => {
                if (item.action) item.action();
                else if (item.route) router.push(item.route);
              }}
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
            >
              <View style={styles.menuIconWrap}>
                {item.iconFamily === 'feather' && (
                  <Feather name={item.iconName as any} size={22} color={colors.text} />
                )}
                {item.iconFamily === 'ionicons' && (
                  <Ionicons name={item.iconName as any} size={22} color={colors.text} />
                )}
                {item.iconFamily === 'material' && (
                  <MaterialCommunityIcons name={item.iconName as any} size={24} color={colors.text} />
                )}
              </View>
              <Text style={[styles.menuTitle, { color: colors.text }]}>{item.title}</Text>
              {item.showChevron && <Feather name="chevron-right" size={20} color={colors.mutedForeground} />}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* ── FLOATING SWITCH BUTTON (ORANGE PILL - PROMINENTLY FLOATING ABOVE TAB BAR) ── */}
      <View
        pointerEvents="box-none"
        style={[
          styles.floatingButtonContainer,
          { bottom: Platform.OS === 'web' ? 30 : insets.bottom + 84 },
        ]}
      >
        <Pressable
          testID="floating-switch-mode-btn"
          onPress={handleSwitchMode}
          style={({ pressed }) => [
            styles.floatingSwitchBtn,
            pressed && styles.floatingSwitchBtnPressed,
          ]}
        >
          <MaterialCommunityIcons
            name="swap-horizontal-bold"
            size={20}
            color="#FFFFFF"
            style={styles.switchIcon}
          />
          <Text style={styles.floatingSwitchText}>
            {isHostMode ? 'Switch to travelling' : 'Switch to hosting'}
          </Text>
        </Pressable>
      </View>

      {/* ── FULL-SCREEN MODE SWITCHING TRANSITION (USING ASSETS/IMAGES/SWITCHLOGO.PNG) ── */}
      <Modal
        visible={switchingOverlayVisible}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
      >
        <View style={[styles.switchingContainer, { backgroundColor: isDark ? '#0A0A0A' : colors.background }]}>
          <Animated.View
            style={[
              styles.switchingLogoWrap,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Image
              source={require('@/assets/images/switchlogo.png')}
              style={[styles.switchLogoImg, { borderRadius: 20 }]}
              contentFit="cover"
            />
          </Animated.View>

          <Text style={[styles.switchingText, { color: colors.text }]}>
            {targetMode === 'host' ? 'Switching to hosting' : 'Switching to travelling'}
          </Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loggedOutCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 28,
    alignItems: 'center',
    gap: 14,
  },
  loggedOutIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loggedOutTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
  },
  loggedOutSub: {
    fontSize: 14,
    color: '#717171',
    textAlign: 'center',
    lineHeight: 20,
  },
  signInBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: 12,
    height: 48,
    width: '100%',
    marginTop: 8,
  },
  signInBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.8,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 12,
    position: 'relative',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  avatarInitialBox: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialText: {
    fontSize: 34,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  avatarVerifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  userName: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
    textAlign: 'center',
  },
  userContactText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
  },
  roleTagPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  roleTagText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#374151',
  },
  metaPreviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginTop: 10,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  metaChipText: {
    fontSize: 11,
    fontFamily: 'DMSans_500Medium',
    color: '#4B5563',
  },
  showProfilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 14,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  showProfilePillText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  userRole: {
    fontSize: 14,
    fontWeight: '400',
    color: '#717171',
    marginTop: 2,
    textAlign: 'center',
  },
  quickCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  quickCard: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    height: 136,
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  quickCardPressed: {
    backgroundColor: '#F9FAFB',
  },
  newBadgePill: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#1E293B',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  quickCardIconWrap: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCardText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
    textAlign: 'center',
  },
  becomeHostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    marginBottom: 20,
    gap: 16,
  },
  becomeHostIconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  becomeHostTextStack: {
    flex: 1,
  },
  becomeHostTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  becomeHostSub: {
    fontSize: 13,
    color: '#717171',
    lineHeight: 18,
    marginTop: 2,
  },

  /* ── MENU LIST ──────────────────────────────────────────────────────────── */
  menuListBlock: {
    marginTop: 8,
    marginBottom: 24,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
  },
  menuRowPressed: {
    opacity: 0.6,
  },
  menuIconWrap: {
    width: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    color: '#1E1E1E',
    fontWeight: '400',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_500Medium',
      default: 'sans-serif',
    }),
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 8,
  },

  /* ── FLOATING SWITCH BUTTON (ORANGE PILL) ────────────────────────────────── */
  floatingButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    elevation: 20,
  },
  floatingSwitchBtn: {
    backgroundColor: '#F26522',
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
  },
  floatingSwitchBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  switchIcon: {
    marginRight: 8,
  },
  floatingSwitchText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },

  /* ── SWITCHING TRANSITION SCREEN (SCREENSHOT 2) ─────────────────────────── */
  switchingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchingLogoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  switchLogoImg: {
    width: 92,
    height: 92,
  },
  switchingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
    letterSpacing: -0.3,
  },
});
