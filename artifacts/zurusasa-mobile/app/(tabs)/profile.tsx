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
import { useRouter, type Href } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { useSavedEvents, useSavedReels } from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';

interface AirbnbMenuItem {
  id: string;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  route?: Href;
  action?: () => void;
  isDividerAfter?: boolean;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, signOut, loading, viewMode, switchViewMode, role } = useAuth();
  const { showAlert } = useCustomAlert();

  const { data: reels } = useSavedReels(user?.id);
  const { data: events } = useSavedEvents(user?.id);
  const savedCount = (reels?.length ?? 0) + (events?.length ?? 0);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 12;
  const bottomPad = Platform.OS === 'web' ? 110 : insets.bottom + 90;

  if (loading) {
    return (
      <View style={[styles.fill, { backgroundColor: '#FFFFFF', paddingTop: topPad, paddingHorizontal: 24, gap: 20 }]}>
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
      <View style={[styles.fill, styles.centered, { backgroundColor: '#FFFFFF', paddingTop: topPad }]}>
        <View style={styles.loggedOutCard}>
          <View style={styles.loggedOutIconRing}>
            <Feather name="user" size={32} color="#000000" />
          </View>
          <Text style={styles.loggedOutTitle}>Your Profile</Text>
          <Text style={styles.loggedOutSub}>
            Log in to manage your reservations, wishlist, payment methods and profile settings.
          </Text>
          <Pressable
            testID="signin-button"
            onPress={() => router.push('/auth')}
            style={({ pressed }) => [styles.signInBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.signInBtnText}>Log in or Sign up</Text>
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
  const initial = displayName.charAt(0).toUpperCase();
  const isHost = role === 'host';

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

  const menuItems: AirbnbMenuItem[] = [
    {
      id: 'settings',
      title: 'Account settings',
      icon: 'settings',
      route: '/profile/settings',
    },
    {
      id: 'view_profile',
      title: 'View profile',
      icon: 'user',
      route: '/profile/info',
    },
    {
      id: 'privacy',
      title: 'Privacy',
      icon: 'shield',
      route: '/profile/security',
    },
    {
      id: 'get_help',
      title: 'Get help',
      icon: 'help-circle',
      route: '/profile/support',
      isDividerAfter: true,
    },
    {
      id: 'notifications',
      title: 'Notifications',
      icon: 'bell',
      route: '/profile/notifications',
    },
    {
      id: 'payments',
      title: 'Payments & payouts',
      icon: 'credit-card',
      route: '/profile/payments',
    },
    {
      id: 'switch_mode',
      title: viewMode === 'host' ? 'Switch to Guest mode' : 'Switch to Host mode',
      icon: 'refresh-cw',
      action: () => switchViewMode(viewMode === 'host' ? 'guest' : 'host'),
    },
    {
      id: 'refer_host',
      title: 'Refer a host',
      icon: 'share-2',
      route: '/become-host',
    },
    {
      id: 'legal',
      title: 'Legal',
      icon: 'file-text',
      route: '/profile/support',
      isDividerAfter: true,
    },
    {
      id: 'logout',
      title: 'Log out',
      icon: 'log-out',
      action: handleSignOut,
    },
  ];

  return (
    <View style={styles.fill}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={{
          paddingTop: topPad,
          paddingBottom: bottomPad,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ───────────────────────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Profile</Text>
          <Pressable
            testID="notification-bell-btn"
            onPress={() => router.push('/profile/notifications')}
            style={({ pressed }) => [styles.bellBtn, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <Feather name="bell" size={20} color="#000000" />
          </Pressable>
        </View>

        {/* ── PROFILE CARD ────────────────────────────────────────────────────── */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImg}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View style={styles.avatarInitialBox}>
                <Text style={styles.avatarInitialText}>{initial}</Text>
              </View>
            )}
          </View>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userRole}>{isHost ? 'Host' : 'Guest'}</Text>
        </View>

        {/* ── QUICK CARDS (2 per row) ─────────────────────────────────────────── */}
        <View style={styles.quickCardsRow}>
          <Pressable
            onPress={() => router.push('/reservations')}
            style={({ pressed }) => [styles.quickCard, pressed && styles.quickCardPressed]}
          >
            <View style={styles.newBadgePill}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
            <View style={styles.quickCardIconWrap}>
              <Feather name="briefcase" size={36} color="#F26522" />
            </View>
            <Text style={styles.quickCardText}>Past trips</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/saved')}
            style={({ pressed }) => [styles.quickCard, pressed && styles.quickCardPressed]}
          >
            <View style={styles.newBadgePill}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
            <View style={styles.quickCardIconWrap}>
              <Feather name="users" size={36} color="#F26522" />
            </View>
            <Text style={styles.quickCardText}>{savedCount > 0 ? `Saved (${savedCount})` : 'Connections'}</Text>
          </Pressable>
        </View>

        {/* ── BECOME A HOST CARD ──────────────────────────────────────────────── */}
        {!isHost && (
          <Pressable
            onPress={() => router.push('/become-host')}
            style={({ pressed }) => [styles.becomeHostCard, pressed && { opacity: 0.95 }]}
          >
            <View style={styles.becomeHostIconWrap}>
              <Feather name="home" size={26} color="#F26522" />
            </View>
            <View style={styles.becomeHostTextStack}>
              <Text style={styles.becomeHostTitle}>Become a host</Text>
              <Text style={styles.becomeHostSub}>
                It's easy to start hosting and earn extra income.
              </Text>
            </View>
          </Pressable>
        )}

        {/* ── MAIN MENU (Airbnb Clean List Rows) ─────────────────────────────── */}
        <View style={styles.menuListBlock}>
          {menuItems.map((item) => (
            <React.Fragment key={item.id}>
              <Pressable
                onPress={() => {
                  if (item.action) {
                    item.action();
                  } else if (item.route) {
                    router.push(item.route);
                  }
                }}
                style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              >
                <Feather name={item.icon} size={22} color="#000000" style={styles.menuIcon} />
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Feather name="chevron-right" size={18} color="#94A3B8" />
              </Pressable>

              {item.isDividerAfter && <View style={styles.sectionDivider} />}
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loggedOutCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitialBox: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#9D174D',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
  menuListBlock: {
    marginBottom: 20,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
  },
  menuRowPressed: {
    opacity: 0.6,
  },
  menuIcon: {
    marginRight: 16,
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
});
