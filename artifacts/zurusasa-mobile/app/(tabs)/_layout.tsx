import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

const ACTIVE_COLOR = '#F26522';
const INACTIVE_COLOR = '#94A3B8';

/**
 * Premium 4-Tab Bottom Navigation Bar (Pulse, Discover, Inbox, Profile).
 * Refined aesthetic:
 * - 1.5px stroke-width minimalist line icons
 * - Inactive tab color: Muted slate gray (#94A3B8)
 * - Active tab color: Warm orange (#F26522) with subtle 10% opacity duotone icon fill
 * - Active indicator: Soft 2px top accent pill (#F26522) centered above active tab
 * - Typography: 10px font size, DMSans_500Medium (#94A3B8) to DMSans_600SemiBold (#F26522)
 * - Touch state: Soft micro-spring scaling (0.95 scale)
 */
function CustomBottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { user, viewMode } = useAuth();
  const isHostMode = viewMode === 'host';
  const bottomPad = Platform.OS === 'web' ? 10 : Math.max(insets.bottom, 6);

  const focusedRoute = state.routes[state.index];
  const focusedOptions = descriptors[focusedRoute.key]?.options;

  // Hide bottom tab bar on full-screen ZuruFlow video feed in Guest mode / signed out
  if (!isHostMode && (focusedRoute.name === 'index' || (focusedOptions?.tabBarStyle as any)?.display === 'none')) {
    return null;
  }

  // Explicit allowed routes list
  const allowedRoutes = !user
    ? ['index', 'discover', 'profile']
    : isHostMode
    ? ['index', 'listings', 'reservations', 'inbox', 'profile']
    : ['index', 'discover', 'inbox', 'profile'];

  return (
    <View
      style={[
        styles.bottomBarContainer,
        {
          paddingBottom: bottomPad,
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
        },
      ]}
    >
      <View style={styles.barRow}>
        {state.routes.map((route, index) => {
          if (!allowedRoutes.includes(route.name)) return null;

          const { options } = descriptors[route.key];

          const isProfileActive =
            focusedRoute.name === 'profile' ||
            focusedRoute.name === 'saved' ||
            (!isHostMode && focusedRoute.name === 'reservations');

          const isFocused =
            route.name === 'profile' ? isProfileActive : state.index === index;

          const label = options.title !== undefined ? options.title : route.name;

          const onPress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tabItem,
                { transform: [{ scale: pressed ? 0.95 : 1 }] },
              ]}
            >
              {/* Soft 2px Top Accent Pill Centered Above Active Tab */}
              {isFocused ? <View style={styles.activeTopPill} /> : null}

              {/* Icon Container with 10% Duotone Fill */}
              <View
                style={[
                  styles.iconBox,
                  isFocused ? styles.iconBoxActive : styles.iconBoxInactive,
                ]}
              >
                {options.tabBarIcon ? (
                  options.tabBarIcon({
                    focused: isFocused,
                    color: isFocused ? ACTIVE_COLOR : INACTIVE_COLOR,
                    size: 20,
                  })
                ) : (
                  <Feather
                    name="grid"
                    size={20}
                    color={isFocused ? ACTIVE_COLOR : INACTIVE_COLOR}
                  />
                )}
              </View>

              {/* Typography: 10px Font Size */}
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isFocused ? ACTIVE_COLOR : INACTIVE_COLOR,
                    fontFamily: isFocused ? 'DMSans_600SemiBold' : 'DMSans_500Medium',
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const router = useRouter();
  const { user, viewMode } = useAuth();
  const isHostMode = viewMode === 'host';

  return (
    <Tabs
      tabBar={(props) => <CustomBottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isHostMode ? 'Dashboard' : 'Pulse',
          tabBarStyle: isHostMode ? undefined : { display: 'none' },
          tabBarIcon: ({ color }) => (
            <Feather name={isHostMode ? 'grid' : 'zap'} size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: 'Listings',
          href: isHostMode ? undefined : null,
          tabBarIcon: ({ color }) => <Feather name="film" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          href: isHostMode ? null : undefined,
          tabBarIcon: ({ color }) => <Feather name="compass" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          href: null,
          tabBarIcon: ({ color }) => <Feather name="heart" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: isHostMode ? 'Bookings' : 'Trips',
          href: isHostMode && user ? undefined : null,
          tabBarIcon: ({ color }) => <Feather name="calendar" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          href: user ? undefined : null,
          tabBarIcon: ({ color }) => <Feather name="message-square" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: user ? 'Profile' : 'Log In',
          tabBarIcon: ({ color }) => <Feather name="user" size={20} color={color} />,
        }}
        listeners={{
          tabPress: (e) => {
            if (!user) {
              e.preventDefault();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/auth');
            }
          },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bottomBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 6,
    zIndex: 100,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 6,
    minHeight: 50,
  },
  activeTopPill: {
    position: 'absolute',
    top: 0,
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: ACTIVE_COLOR,
  },
  iconBox: {
    width: 38,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxActive: {
    backgroundColor: 'rgba(242, 101, 34, 0.10)',
  },
  iconBoxInactive: {
    backgroundColor: 'transparent',
  },
  tabLabel: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
});
