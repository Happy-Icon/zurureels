import React from 'react';
import {
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
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { useSavedEvents, useSavedReels } from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';

type ProfileRowItem = {
  id: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Feather.glyphMap;
  route?: Href;
  action?: () => void;
  badge?: string | number;
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

  const { data: reels } = useSavedReels(user?.id);
  const { data: events } = useSavedEvents(user?.id);
  const savedCount = (reels?.length ?? 0) + (events?.length ?? 0);

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 110 : insets.bottom + 90;

  // ── Skeleton Loading State ──────────────────────────────────────────────────
  if (loading) {
    return (
      <View
        style={[
          styles.fill,
          {
            backgroundColor: '#F8FAFC',
            paddingTop: topPad,
            paddingHorizontal: 20,
            gap: 20,
          },
        ]}
      >
        <View style={styles.skeletonHeaderRow}>
          <Skeleton style={styles.skeletonAvatar} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton style={{ height: 22, width: 150, borderRadius: 6 }} />
            <Skeleton style={{ height: 16, width: 110, borderRadius: 12 }} />
            <Skeleton style={{ height: 14, width: 130, borderRadius: 4 }} />
          </View>
        </View>

        <Skeleton style={{ height: 80, borderRadius: 16 }} />

        <View style={{ gap: 16, marginTop: 8 }}>
          <Skeleton style={{ height: 14, width: 120, borderRadius: 4 }} />
          <Skeleton style={{ height: 220, borderRadius: 16 }} />
        </View>
      </View>
    );
  }

  // ── Signed-Out (Unauthenticated) State ─────────────────────────────────────
  if (!user) {
    return (
      <View
        style={[
          styles.fill,
          styles.centered,
          { backgroundColor: '#F8FAFC', paddingTop: topPad },
        ]}
      >
        <View style={styles.loggedOutCard}>
          <View style={styles.loggedOutIconRing}>
            <Feather name="user" size={32} color="#F26522" />
          </View>
          <Text style={styles.loggedOutTitle}>Your Coastal Story Starts Here</Text>
          <Text style={styles.loggedOutSub}>
            Sign in to discover curated stays, book experiences, and track your
            reservations across the Kenyan coast.
          </Text>
          <Pressable
            testID="signin-button"
            onPress={() => router.push('/auth')}
            style={({ pressed }) => [
              styles.signInBtn,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={styles.signInBtnText}>Sign in or Sign up</Text>
            <Feather name="arrow-right" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
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
  const createdYear = user.created_at
    ? new Date(user.created_at).getFullYear()
    : '2026';

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

  // ── Section Declarations ───────────────────────────────────────────────────
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
        badge: savedCount > 0 ? savedCount : undefined,
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
    ],
  };

  const preferencesSection: ProfileSection = {
    title: 'PREFERENCES & SECURITY',
    items: [
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
        title: 'Contact Concierge',
        subtitle: '24/7 Zuru concierge assistant',
        icon: 'message-circle',
        route: '/chat/support',
      },
    ],
  };

  const sections = [
    accountSection,
    preferencesSection,
    ...(hostingSection ? [hostingSection] : []),
    supportSection,
  ];

  return (
    <View style={styles.fill}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={{
          paddingTop: topPad,
          paddingBottom: bottomPad,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. HERO HEADER (USER IDENTITY) ────────────────────────────────── */}
        <View style={styles.heroCard}>
          <Pressable
            testID="edit-profile-avatar"
            onPress={() => router.push('/profile/info')}
            style={({ pressed }) => [
              styles.avatarContainer,
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={styles.avatarRing}>
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImg}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Feather name="user" size={30} color="#64748B" />
                </View>
              )}
            </View>
            <View style={styles.cameraBadge}>
              <Feather name="camera" size={11} color="#FFFFFF" />
            </View>
          </Pressable>

          <View style={styles.heroInfoStack}>
            <View style={styles.nameBadgeRow}>
              <Text style={styles.userNameText} numberOfLines={1}>
                {displayName}
              </Text>
            </View>

            {/* Verified Badge Pill */}
            <View style={styles.badgePillWrapper}>
              {isHost ? (
                <View style={styles.verifiedHostBadge}>
                  <Feather name="check" size={11} color="#047857" style={{ marginRight: 3 }} />
                  <Text style={styles.verifiedHostBadgeText}>Verified Host</Text>
                </View>
              ) : (
                <View style={styles.verifiedTravelerBadge}>
                  <Feather name="shield" size={11} color="#475569" style={{ marginRight: 3 }} />
                  <Text style={styles.verifiedTravelerBadgeText}>Verified Traveler</Text>
                </View>
              )}
            </View>

            <Text style={styles.joinDateText}>Member since {createdYear}</Text>
          </View>

          <Pressable
            testID="edit-profile-icon"
            onPress={() => router.push('/profile/info')}
            style={({ pressed }) => [
              styles.editChevronBtn,
              pressed && { opacity: 0.6 },
            ]}
            hitSlop={12}
          >
            <Feather name="chevron-right" size={20} color="#94A3B8" />
          </Pressable>
        </View>

        {/* ── 2. HOST DASHBOARD BANNER ──────────────────────────────────────── */}
        <View style={styles.bannerContainer}>
          <LinearGradient
            colors={['#F26522', '#F59E0B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hostGradientBanner}
          >
            <View style={styles.bannerLeftContent}>
              <View style={styles.bannerIconCircle}>
                <Feather
                  name={isHost ? (viewMode === 'host' ? 'check-circle' : 'zap') : 'home'}
                  size={18}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.bannerTextStack}>
                <Text style={styles.bannerTitleText}>
                  {isHost
                    ? viewMode === 'host'
                      ? 'Host Dashboard Active 🌟'
                      : 'Switch to Host Dashboard'
                    : 'Become a Host'}
                </Text>
                <Text style={styles.bannerSubText} numberOfLines={2}>
                  {isHost
                    ? 'Manage listings, reservations & payouts.'
                    : 'Host stays, experiences & tours on ZuruSasa.'}
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
                styles.bannerCtaBtn,
                pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
              ]}
            >
              <Text style={styles.bannerCtaText}>
                {isHost
                  ? viewMode === 'host'
                    ? 'Guest Feed'
                    : 'Switch'
                  : 'Start'}
              </Text>
              <Feather name="arrow-right" size={13} color="#F26522" />
            </Pressable>
          </LinearGradient>
        </View>

        {/* ── 3. SECTION GROUPINGS (CARD CONTAINERS) ───────────────────────── */}
        {sections.map((section, sIdx) => (
          <View key={sIdx} style={styles.sectionWrapper}>
            <Text style={styles.sectionHeaderTitle}>{section.title}</Text>

            <View style={styles.cardContainer}>
              {section.items.map((item, iIdx) => {
                const isLast = iIdx === section.items.length - 1;

                return (
                  <React.Fragment key={item.id}>
                    <Pressable
                      onPress={() => {
                        if (item.action) {
                          item.action();
                        } else if (item.route) {
                          router.push(item.route);
                        }
                      }}
                      style={({ pressed }) => [
                        styles.rowPressable,
                        pressed && styles.rowPressableActive,
                      ]}
                    >
                      {/* Clean 1.75px stroke Lucide/Feather icon inline */}
                      <View style={styles.rowIconWrapper}>
                        <Feather name={item.icon} size={19} color="#475569" />
                      </View>

                      <View style={styles.rowTextStack}>
                        <Text style={styles.rowTitleText}>{item.title}</Text>
                        {item.subtitle ? (
                          <Text style={styles.rowSubtitleText}>{item.subtitle}</Text>
                        ) : null}
                      </View>

                      {/* Numeric Count Badge if present */}
                      {item.badge !== undefined ? (
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>{item.badge}</Text>
                        </View>
                      ) : null}

                      <Feather name="chevron-right" size={18} color="#CBD5E1" />
                    </Pressable>
                    {!isLast && <View style={styles.rowDivider} />}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        ))}

        {/* ── 4. LOG OUT BUTTON ────────────────────────────────────────────── */}
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [
            styles.logoutBtn,
            pressed && { opacity: 0.8, backgroundColor: '#FFE4E6' },
          ]}
        >
          <Feather name="log-out" size={18} color="#E11D48" />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </Pressable>

        {/* ── 5. FOOTER ────────────────────────────────────────────────────── */}
        <Text style={styles.versionFooter}>
          ZuruSasa Native v1.2.0 · Kenya Coast 🌴
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#F8FAFC', // subtle off-white bg-slate-50/60
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  // Skeleton Styles
  skeletonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  skeletonAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },

  // Logged-Out Card
  loggedOutCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 28,
    alignItems: 'center',
    gap: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  loggedOutIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: 'rgba(242, 101, 34, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  loggedOutTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#0F172A',
    textAlign: 'center',
  },
  loggedOutSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F26522',
    borderRadius: 14,
    paddingHorizontal: 24,
    height: 48,
    width: '100%',
    marginTop: 8,
  },
  signInBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },

  // 1. Hero Header
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    marginBottom: 16,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarRing: {
    width: 64, // w-16 h-16
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(242, 101, 34, 0.25)', // ring-2 ring-[#F26522]/20
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfoStack: {
    flex: 1,
    gap: 4,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userNameText: {
    fontSize: 19, // text-xl font-bold text-slate-900
    fontFamily: 'DMSans_700Bold',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  badgePillWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  verifiedHostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5', // bg-emerald-50
    borderColor: '#A7F3D0', // border-emerald-200
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  verifiedHostBadgeText: {
    fontSize: 11, // text-xs font-semibold
    fontFamily: 'DMSans_700Bold',
    color: '#047857', // text-emerald-700
  },
  verifiedTravelerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  verifiedTravelerBadgeText: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
    color: '#475569',
  },
  joinDateText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#94A3B8', // text-slate-400
    marginTop: 1,
  },
  editChevronBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 2. Host Dashboard Banner
  bannerContainer: {
    marginBottom: 20,
    shadowColor: '#F26522',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  hostGradientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16, // rounded-2xl
    padding: 16, // p-4
    gap: 12,
  },
  bannerLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  bannerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextStack: {
    flex: 1,
    gap: 2,
  },
  bannerTitleText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  bannerSubText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 16,
  },
  bannerCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF', // bg-white text-[#F26522]
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12, // rounded-xl
  },
  bannerCtaText: {
    color: '#F26522',
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },

  // 3. Section Groupings
  sectionWrapper: {
    marginBottom: 20,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#64748B', // text-slate-500
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingLeft: 4,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16, // rounded-2xl
    borderWidth: 1,
    borderColor: '#F1F5F9', // border-slate-100
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
    overflow: 'hidden',
  },
  rowPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    backgroundColor: '#FFFFFF',
  },
  rowPressableActive: {
    backgroundColor: '#F8FAFC', // active:bg-slate-50
  },
  rowIconWrapper: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextStack: {
    flex: 1,
    gap: 2,
  },
  rowTitleText: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: '#0F172A', // text-slate-900
  },
  rowSubtitleText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#94A3B8', // text-slate-400
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F8FAFC', // divide-slate-50
    marginLeft: 54, // inset divider past the icon
  },
  countBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 2,
  },
  countBadgeText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },

  // 4. Logout Button
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF1F2', // bg-rose-50
    borderColor: '#FFE4E6', // border-rose-100
    borderWidth: 1,
    borderRadius: 16, // rounded-2xl
    paddingVertical: 14, // py-3.5
    marginTop: 4,
    marginBottom: 20,
  },
  logoutBtnText: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: '#E11D48', // text-rose-600
  },

  // 5. Version Footer
  versionFooter: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#94A3B8', // text-slate-400
    marginBottom: 8,
  },
});
