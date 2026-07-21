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
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

const WEB_APP_URL = 'https://zurusasa.com';

type MenuItem = {
  key: string;
  label: string;
  route: Href;
  render: (color: string) => React.ReactNode;
};

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, signOut, loading } = useAuth();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : 80;

  if (loading) {
    return (
      <View style={[styles.fill, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View
        style={[
          styles.fill,
          styles.centered,
          { backgroundColor: colors.background, paddingTop: topPad },
        ]}
      >
        <View style={[styles.heroIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="user" size={30} color={colors.primary} />
        </View>
        <Text style={[styles.heroTitle, { color: colors.foreground }]}>
          Your coastal story starts here
        </Text>
        <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
          Sign in to book experiences and track your reservations.
        </Text>
        <Pressable
          testID="signin-button"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/auth');
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.primaryButtonText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    (typeof meta.full_name === 'string' && meta.full_name) || user.email || 'Traveler';
  const avatarUrl =
    ((profile?.metadata as { avatar_url?: string } | null)?.avatar_url as string | undefined) ??
    undefined;
  const isHost = profile?.role === 'host' || meta.role === 'host';

  const menuItems: MenuItem[] = [
    {
      key: 'identity',
      label: 'Digital Identity Center',
      route: '/profile/info',
      render: (c) => (
        <MaterialCommunityIcons name="shield-check-outline" size={21} color={c} />
      ),
    },
    {
      key: 'notifications',
      label: 'Notifications',
      route: '/profile/notifications',
      render: (c) => <Feather name="bell" size={20} color={c} />,
    },
    {
      key: 'payments',
      label: 'Transactions & Receipts',
      route: '/profile/payments',
      render: (c) => <Ionicons name="receipt-outline" size={20} color={c} />,
    },
    {
      key: 'security',
      label: 'Privacy & Security',
      route: '/profile/security',
      render: (c) => <Feather name="shield" size={20} color={c} />,
    },
    {
      key: 'support',
      label: 'Help & Support',
      route: '/profile/support',
      render: (c) => <Feather name="help-circle" size={20} color={c} />,
    },
    {
      key: 'settings',
      label: 'Settings',
      route: '/profile/settings',
      render: (c) => <Feather name="settings" size={20} color={c} />,
    },
  ];

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingBottom: bottomPad + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={[`${colors.primary}1A`, colors.background]}
          style={[styles.header, { paddingTop: topPad + 32 }]}
        >
          <View style={styles.avatarWrap}>
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.background,
                },
              ]}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <Feather name="user" size={44} color={colors.mutedForeground} />
              )}
            </View>
            <Pressable
              testID="avatar-camera-button"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/profile/info');
              }}
              style={({ pressed }) => [
                styles.cameraBadge,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.background,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Feather name="camera" size={15} color="#ffffff" />
            </Pressable>
          </View>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {displayName}
          </Text>
          {user.email ? (
            <Text style={[styles.email, { color: colors.mutedForeground }]} numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}

          {/* Stats — hosts only, mirrors web */}
          {profile?.role === 'host' ? (
            <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>0</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  Reservations
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>0</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  Reviews
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>2</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  Saved
                </Text>
              </View>
            </View>
          ) : null}
        </LinearGradient>

        {/* Menu */}
        <View style={styles.menu}>
          {menuItems.map((item) => (
            <Pressable
              key={item.key}
              testID={`menu-${item.key}`}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(item.route);
              }}
              style={({ pressed }) => [
                styles.menuRow,
                { backgroundColor: pressed ? colors.secondary : 'transparent' },
              ]}
            >
              <View style={styles.menuLeft}>
                {item.render(colors.mutedForeground)}
                <Text style={[styles.menuLabel, { color: colors.foreground }]}>
                  {item.label}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </Pressable>
          ))}

          {/* Sign Out */}
          <Pressable
            testID="signout-button"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              signOut();
            }}
            style={({ pressed }) => [
              styles.menuRow,
              styles.signOutRow,
              {
                backgroundColor: pressed ? `${colors.destructive}14` : 'transparent',
              },
            ]}
          >
            <View style={styles.menuLeft}>
              <Feather name="log-out" size={20} color={colors.destructive} />
              <Text style={[styles.menuLabel, { color: colors.destructive }]}>Sign Out</Text>
            </View>
          </Pressable>
        </View>

        {/* Footer */}
        <Text style={[styles.footer, { color: colors.mutedForeground }]}>ZuruSasa v1.0.0</Text>
      </ScrollView>

      {/* Floating switch/become host button */}
      <Pressable
        testID="host-mode-button"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          WebBrowser.openBrowserAsync(
            isHost ? `${WEB_APP_URL}/host` : `${WEB_APP_URL}/become-host`,
          );
        }}
        style={({ pressed }) => [
          styles.floatingButton,
          {
            backgroundColor: colors.primary,
            bottom: bottomPad + 16,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        <Text style={styles.floatingButtonText}>
          {isHost ? 'Switch to Hosting' : 'Become a Host'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 26,
    fontFamily: 'InstrumentSerif_400Regular',
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
  primaryButton: {
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  avatarImage: { width: '100%', height: '100%' },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  name: {
    marginTop: 16,
    fontSize: 24,
    fontFamily: 'InstrumentSerif_400Regular',
    textAlign: 'center',
  },
  email: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 48,
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  stat: { alignItems: 'center' },
  statValue: {
    fontSize: 22,
    fontFamily: 'DMSans_600SemiBold',
  },
  statLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    marginTop: 2,
  },
  menu: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuLabel: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
  },
  signOutRow: { marginTop: 16 },
  footer: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    padding: 16,
  },
  floatingButton: {
    position: 'absolute',
    right: 24,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  floatingButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
  },
});
