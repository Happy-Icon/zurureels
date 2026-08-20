import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Tabs, useRouter } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useUnreadMessageCount } from '@/lib/queries';

const ACTIVE_COLOR = '#F26522';
const INACTIVE_COLOR = '#717171';

/**
 * Premium Bottom Navigation Bar (Pulse, Discover, Listings, Bookings, Inbox, Profile).
 * Clean, thin, rounded outline icon style:
 * - Inbox: Two overlapping speech bubbles outline (chatbubbles-outline) with unread status dot when not viewed
 * - Discover: Thin outline magnifying glass (search-outline)
 * - Pulse: Thin outline Home (home-outline)
 * - Bookings: Thin outline calendar (calendar-outline)
 * - Profile: Thin outline person/profile (person-outline) or user avatar
 * - Host Listings: Two slightly overlapping cards outline (cards-outline)
 * - Colors: Active = ZuruSasa Orange (#F26522), Inactive = Neutral Gray (#717171)
 */
function CustomBottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { user, viewMode } = useAuth();
  const isHostMode = viewMode === 'host';
  const bottomPad = Platform.OS === 'web' ? 10 : Math.max(insets.bottom, 6);
  const { data: unreadCount = 0 } = useUnreadMessageCount(user?.id);

  const focusedRoute = state.routes[state.index];

  // Hide bottom tab bar on full-screen ZuruFlow video feed in Guest / signed-out mode
  if (!isHostMode && focusedRoute.name === 'index') {
    return null;
  }

  // Dynamic allowed routes per authentication and mode
  const allowedRoutes = !user
    ? ['index', 'discover', 'profile']
    : isHostMode
    ? ['index', 'listings', 'reservations', 'inbox', 'profile']
    : ['index', 'discover', 'saved', 'inbox', 'profile'];

  const inactiveColor = colors.mutedForeground;
  const barBg = colors.card;
  const borderTopColor = colors.border;

  return (
    <View
      style={[
        styles.bottomBarContainer,
        {
          paddingBottom: bottomPad,
          backgroundColor: barBg,
          borderTopColor,
        },
      ]}
    >
      <View style={styles.barRow}>
        {state.routes.map((route, index) => {
          if (!allowedRoutes.includes(route.name)) return null;

          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const isInboxTab = route.name === 'inbox';
          const showUnreadDot = isInboxTab && unreadCount > 0 && !isFocused;

          const label = options.title !== undefined ? options.title : route.name;

          const onPress = () => {
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
              {/* Soft Top Accent Pill Centered Above Active Tab */}
              {isFocused ? <View style={styles.activeTopPill} /> : null}

              {/* Clean Icon Container */}
              <View style={styles.iconBox}>
                {options.tabBarIcon ? (
                  options.tabBarIcon({
                    focused: isFocused,
                    color: isFocused ? ACTIVE_COLOR : inactiveColor,
                    size: 22,
                  })
                ) : (
                  <Ionicons
                    name="grid-outline"
                    size={22}
                    color={isFocused ? ACTIVE_COLOR : inactiveColor}
                  />
                )}
                {/* Unread Messages Orange Status Dot directly on icon top-right */}
                {showUnreadDot ? <View style={styles.unreadDotBadge} /> : null}
              </View>

              {/* Typography */}
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isFocused ? ACTIVE_COLOR : inactiveColor,
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
  const userAvatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

  return (
    <Tabs
      tabBar={(props) => <CustomBottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isHostMode ? 'Dashboard' : 'Home',
          tabBarIcon: ({ color }) => (
            <Ionicons name={isHostMode ? 'grid-outline' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: 'Listings',
          href: isHostMode ? undefined : null,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="cards-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          href: isHostMode ? null : undefined,
          tabBarIcon: ({ color }) => (
            <Ionicons name="search-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Wishlists',
          href: isHostMode || !user ? null : undefined,
          tabBarIcon: ({ color }) => (
            <Ionicons name="heart-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: isHostMode ? 'Bookings' : 'Trips',
          href: isHostMode && user ? undefined : null,
          tabBarIcon: ({ color }) => (
            <Ionicons name="calendar-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          href: user ? undefined : null,
          tabBarIcon: ({ color }) => (
            <Ionicons name="chatbubbles-outline" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: user ? 'Profile' : 'Log In',
          tabBarIcon: ({ color, focused }) => {
            if (user) {
              if (userAvatarUrl) {
                return (
                  <Image
                    source={{ uri: userAvatarUrl }}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: focused ? 1.5 : 0,
                      borderColor: ACTIVE_COLOR,
                    }}
                    contentFit="cover"
                  />
                );
              }
              return (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: focused ? ACTIVE_COLOR : color,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 11,
                      fontFamily: 'DMSans_700Bold',
                      lineHeight: 13,
                    }}
                  >
                    {(user?.email?.charAt(0) || 'U').toUpperCase()}
                  </Text>
                </View>
              );
            }
            return <Ionicons name="person-outline" size={22} color={color} />;
          },
        }}
        listeners={{
          tabPress: (e) => {
            if (!user) {
              e.preventDefault();
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
  unreadDotBadge: {
    position: 'absolute',
    top: 0,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACTIVE_COLOR,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    zIndex: 10,
  },
  iconBox: {
    width: 38,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabLabel: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
});
