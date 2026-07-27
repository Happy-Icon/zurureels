import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useCustomAlert } from '@/context/CustomAlertContext';

import { Skeleton } from '@/components/Skeleton';

type ProfileRowItem = {
  id: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Feather.glyphMap;
  route?: Href;
  action?: () => void;
  destructive?: boolean;
};

type ProfileSection = {
  title: string;
  items: ProfileRowItem[];
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, signOut, loading, viewMode, switchViewMode, role } = useAuth();
  const { showAlert } = useCustomAlert();

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 12;
  const bottomPad = Platform.OS === 'web' ? 110 : insets.bottom + 90;

  if (loading) {
    return (
      <View style={[styles.fill, { backgroundColor: '#FFFFFF', paddingTop: topPad, paddingHorizontal: 20, gap: 20 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Skeleton style={{ width: 72, height: 72, borderRadius: 36 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton style={{ height: 22, width: 140, borderRadius: 6 }} />
            <Skeleton style={{ height: 14, width: 180, borderRadius: 4 }} />
          </View>
        </View>
        <Skeleton style={{ height: 72, borderRadius: 16 }} />
        <View style={{ gap: 16, marginTop: 12 }}>
          <Skeleton style={{ height: 14, width: 120, borderRadius: 4 }} />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ height: 52, borderRadius: 12 }} />
          ))}
        </View>
      </View>
    );
  }

  // Unauthenticated Signed-Out State
  if (!user) {
    return (
      <View style={[styles.fill, styles.centered, { backgroundColor: '#FFFFFF', paddingTop: topPad }]}>
        <View style={styles.loggedOutIconCircle}>
          <Feather name="user" size={32} color="#EE7D30" />
        </View>
        <Text style={styles.loggedOutTitle}>Your Coastal Story Starts Here</Text>
        <Text style={styles.loggedOutSub}>
          Sign in to discover curated stays, book experiences, and track your reservations across the Kenyan coast.
        </Text>
        <Pressable
          testID="signin-button"
          onPress={() => {
            router.push('/auth');
          }}
          style={({ pressed }) => [
            styles.signInBtn,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.signInBtnText}>Sign in or Sign up</Text>
        </Pressable>
      </View>
    );
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    user.email?.split('@')[0] ||
    'Traveler';
  const avatarUrl = (profile?.metadata as { avatar_url?: string } | null)?.avatar_url;
  const isHost = role === 'host';
  const createdYear = user.created_at ? new Date(user.created_at).getFullYear() : '2026';

  const handleSignOut = () => {
    showAlert({
      title: 'Log Out',
      message: 'Are you sure you want to log out of your ZuruSasa account?',
      icon: 'log-out',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ],
    });
  };

  const accountSection: ProfileSection = {
    title: 'ACCOUNT SETTINGS',
    items: [
      {
        id: 'personal',
        title: 'Personal Information',
        subtitle: 'Manage legal name and contact details',
        icon: 'user',
        route: '/profile/info',
      },
      {
        id: 'saved',
        title: 'Saved Favorites',
        subtitle: 'Reels, stays & experiences you saved',
        icon: 'heart',
        route: '/saved',
      },
      {
        id: 'trips',
        title: 'Reservations & Trips',
        subtitle: 'Active and past booking requests',
        icon: 'calendar',
        route: '/reservations',
      },
      {
        id: 'payments',
        title: 'Payments & Transactions',
        subtitle: 'Receipts and transaction history',
        icon: 'credit-card',
        route: '/profile/payments',
      },
      {
        id: 'notifications',
        title: 'Notifications',
        subtitle: 'Trip alerts and message updates',
        icon: 'bell',
        route: '/profile/notifications',
      },
      {
        id: 'security',
        title: 'Privacy & Security',
        subtitle: 'Password, passkeys & device security',
        icon: 'shield',
        route: '/profile/security',
      },
      {
        id: 'language',
        title: 'Language & Region',
        subtitle: 'English (US) · KES (KSh)',
        icon: 'globe',
        route: '/profile/settings',
      },
    ],
  };

  // Strictly on Host Mode only
  const hostingSection: ProfileSection | null =
    isHost && viewMode === 'host'
      ? {
          title: 'HOSTING SETTINGS',
          items: [
            {
              id: 'verification',
              title: 'Identity Verification (KYC)',
              subtitle:
                profile?.verification_status === 'verified'
                  ? 'Identity Verified'
                  : 'Action required',
              icon: 'check-circle',
              route: '/host/verification',
            },
            {
              id: 'payouts',
              title: 'Payout Settings',
              subtitle: 'M-Pesa and Kenyan bank account',
              icon: 'dollar-sign',
              route: '/host/payouts',
            },
          ],
        }
      : null;

  const supportSection: ProfileSection = {
    title: 'SUPPORT',
    items: [
      {
        id: 'help',
        title: 'Help Center',
        subtitle: 'FAQs, booking guides & policies',
        icon: 'help-circle',
        route: '/profile/support',
      },
      {
        id: 'contact',
        title: 'Contact Support',
        subtitle: '24/7 Zuru concierge assistant',
        icon: 'message-circle',
        route: '/chat/support',
      },
    ],
  };

  const aboutSection: ProfileSection = {
    title: 'ABOUT & LEGAL',
    items: [
      {
        id: 'terms',
        title: 'Terms of Service',
        icon: 'file-text',
        route: '/profile/support',
      },
      {
        id: 'privacy',
        title: 'Privacy Policy',
        icon: 'lock',
        route: '/profile/security',
      },
      {
        id: 'logout',
        title: 'Log Out',
        icon: 'log-out',
        destructive: true,
        action: handleSignOut,
      },
    ],
  };

  const sections = [
    accountSection,
    ...(hostingSection ? [hostingSection] : []),
    supportSection,
    aboutSection,
  ];

  return (
    <View style={[styles.fill, { backgroundColor: '#FFFFFF' }]}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Profile Header & Identity Block (Airbnb Left-Aligned Pattern) */}
        <View style={styles.headerBlock}>
          <Pressable
            testID="edit-profile-avatar"
            onPress={() => {
              router.push('/profile/info');
            }}
            style={({ pressed }) => [
              styles.avatarWrap,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Feather name="user" size={34} color="#717171" />
              </View>
            )}
            <View style={styles.cameraEditBadge}>
              <Feather name="camera" size={12} color="#FFFFFF" />
            </View>
          </Pressable>

          <View style={styles.headerInfoStack}>
            <Text style={styles.userNameText} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.memberStatusText}>
              {isHost ? 'Verified Host' : 'Zuru Member'} · Member since {createdYear}
            </Text>
          </View>

          <Pressable
            testID="edit-profile-icon"
            onPress={() => {
              router.push('/profile/info');
            }}
            style={({ pressed }) => [
              styles.editIconBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            hitSlop={10}
          >
            <Feather name="chevron-right" size={20} color="#717171" />
          </Pressable>
        </View>

        {/* 2. Host Switching Banner (Low-Profile Streamlined Feature Card) */}
        <View style={styles.hostBannerContainer}>
          <View style={styles.hostBannerCard}>
            <View style={styles.hostBannerLeft}>
              <View style={styles.hostBadgeCircle}>
                <Feather
                  name={isHost ? (viewMode === 'host' ? 'check-circle' : 'zap') : 'home'}
                  size={18}
                  color="#EE7D30"
                />
              </View>
              <View style={styles.hostTextWrap}>
                <Text style={styles.hostBannerTitle}>
                  {isHost
                    ? viewMode === 'host'
                      ? 'Hosting Active 🌟'
                      : 'Switch to Host Dashboard'
                    : 'Become a Host'}
                </Text>
                <Text style={styles.hostBannerSub} numberOfLines={2}>
                  {isHost
                    ? 'Manage listings, guest reservations, and payouts.'
                    : 'Host stays, experiences, and tours on ZuruSasa.'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => {
                if (isHost) {
                  switchViewMode(viewMode === 'host' ? 'guest' : 'host');
                } else {
                  router.push('/become-host');
                }
              }}
              style={({ pressed }) => [
                styles.hostPillBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.hostPillBtnText}>
                {isHost
                  ? viewMode === 'host'
                    ? 'Guest Feed'
                    : 'Open'
                  : 'Start'}
              </Text>
              <Feather name="arrow-right" size={13} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* 3. List Container & Row Item Redesign (Edge-to-Edge Divider Pattern) */}
        <View style={styles.sectionsContainer}>
          {sections.map((section, sIdx) => (
            <View key={sIdx} style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>{section.title}</Text>

              <View style={styles.sectionItemsList}>
                {section.items.map((item, iIdx) => {
                  const isLast = iIdx === section.items.length - 1;

                  return (
                    <View key={item.id}>
                      <Pressable
                        onPress={() => {
                          if (item.action) {
                            item.action();
                          } else if (item.route) {
                            router.push(item.route);
                          }
                        }}
                        style={({ pressed }) => [
                          styles.menuRow,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <View
                          style={[
                            styles.rowIconCircle,
                            item.destructive ? styles.iconCircleDestructive : styles.iconCircleNeutral,
                          ]}
                        >
                          <Feather
                            name={item.icon}
                            size={18}
                            color={item.destructive ? '#E53935' : '#222222'}
                          />
                        </View>

                        <View style={styles.rowTextStack}>
                          <Text
                            style={[
                              styles.rowTitleText,
                              item.destructive ? { color: '#E53935' } : { color: '#222222' },
                            ]}
                          >
                            {item.title}
                          </Text>
                          {item.subtitle ? (
                            <Text style={styles.rowSubtext}>{item.subtitle}</Text>
                          ) : null}
                        </View>

                        <Feather
                          name="chevron-right"
                          size={18}
                          color={item.destructive ? '#E53935' : '#B0B0B0'}
                        />
                      </Pressable>
                      {!isLast ? <View style={styles.rowDivider} /> : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        {/* 4. Version & Build Footer */}
        <Text style={styles.versionFooter}>
          ZuruSasa Native v1.2.0 · Kenya Coast 🌴
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  loggedOutIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loggedOutTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    textAlign: 'center',
  },
  loggedOutSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  signInBtn: {
    backgroundColor: '#EE7D30',
    borderRadius: 12,
    paddingHorizontal: 28,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  signInBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  headerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 16,
  },
  avatarWrap: {
    position: 'relative',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  cameraEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#222222',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfoStack: {
    flex: 1,
    gap: 3,
  },
  userNameText: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    letterSpacing: -0.3,
  },
  memberStatusText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  editIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostBannerContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  hostBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF8F5',
    borderWidth: 1,
    borderColor: '#F0E6E1',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  hostBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  hostBadgeCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EE7D3014',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostTextWrap: {
    flex: 1,
    gap: 2,
  },
  hostBannerTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  hostBannerSub: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    lineHeight: 16,
  },
  hostPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EE7D30',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hostPillBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
  },
  sectionsContainer: {
    paddingHorizontal: 20,
    gap: 24,
  },
  sectionBlock: {
    gap: 4,
  },
  sectionHeading: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#717171',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionItemsList: {
    backgroundColor: '#FFFFFF',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  rowIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleNeutral: {
    backgroundColor: '#F7F7F7',
  },
  iconCircleDestructive: {
    backgroundColor: '#FFF0F0',
  },
  rowTextStack: {
    flex: 1,
    gap: 2,
  },
  rowTitleText: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
  },
  rowSubtext: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
  },
  versionFooter: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#A0A0A0',
    marginTop: 32,
  },
});
