import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useUnreadMessageCount } from '@/lib/queries';
import { resolveAvatarUrl } from '@/lib/avatar';

const ACTIVE_COLOR = '#F26522';
const INACTIVE_COLOR = '#94A3B8';

type TabsTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * Persistent Bottom Navigation Bar across all views (Dynamic Auth-State: 3 tabs logged out, 5 tabs logged in).
 * - Colors: Active = #F26522, Inactive = #94A3B8
 * - Dark gradient scrim when over full-bleed video.
 */
function CustomBottomTabBar({ state, descriptors, navigation }: TabsTabBarProps) {
  const insets = useSafeAreaInsets();
  const { user, viewMode } = useAuth();
  const isHostMode = viewMode === 'host';
  const bottomPad = Platform.OS === 'web' ? 8 : Math.max(insets.bottom, 6);
  const { data: unreadCount = 0 } = useUnreadMessageCount(user?.id);

  const focusedRoute = state.routes[state.index];
  const isOverVideo = !isHostMode && focusedRoute.name === 'index';

  // Dynamic allowed routes per authentication and mode
  // LOGGED OUT: 3 tabs (Home, Discover, Log In)
  // LOGGED IN: 5 tabs (Home, Discover, Wishlist, Inbox, Profile)
  const allowedRoutes = !user
    ? ['index', 'discover', 'profile']
    : isHostMode
    ? ['index', 'listings', 'reservations', 'inbox', 'profile']
    : ['index', 'discover', 'saved', 'inbox', 'profile'];

  const inactiveColor = '#FFFFFF';
  const barBg = isOverVideo ? 'rgba(0,0,0,0.95)' : '#0F172A';

  return (
    <View
      style={[
        styles.bottomBarContainer,
        {
          paddingBottom: bottomPad,
          height: 56 + bottomPad,
          backgroundColor: barBg,
        },
      ]}
    >
      <View style={styles.barRow}>
        {state.routes.map((route: any, index: number) => {
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
              accessibilityLabel={label}
              style={({ pressed }) => [
                styles.tabItem,
                { transform: [{ scale: pressed ? 0.90 : 1 }] },
              ]}
            >
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
                    name={isFocused ? 'grid' : 'grid-outline'}
                    size={22}
                    color={isFocused ? ACTIVE_COLOR : inactiveColor}
                  />
                )}
                {/* Red Unread Notification Dot */}
                {showUnreadDot ? <View style={styles.unreadDotBadge} /> : null}
              </View>

              {/* Text Label */}
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isFocused ? ACTIVE_COLOR : 'rgba(255, 255, 255, 0.65)',
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
  const { user, profile, viewMode } = useAuth();
  const isHostMode = viewMode === 'host';
  const userAvatarUrl = resolveAvatarUrl(profile, user, profile);

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
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={isHostMode ? (focused ? 'grid' : 'grid-outline') : (focused ? 'home' : 'home-outline')}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: 'Listings',
          href: isHostMode ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'cards' : 'cards-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          href: isHostMode ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Wishlists',
          href: isHostMode || !user ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'heart' : 'heart-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: isHostMode ? 'Bookings' : 'Trips',
          href: isHostMode && user ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          href: user ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              size={24}
              color={color}
            />
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
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      borderWidth: focused ? 2 : 0,
                      borderColor: ACTIVE_COLOR,
                    }}
                    contentFit="cover"
                  />
                );
              }
              return (
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: focused ? ACTIVE_COLOR : 'rgba(255,255,255,0.15)',
                    borderWidth: focused ? 2 : 0,
                    borderColor: ACTIVE_COLOR,
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
            return <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />;
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
    borderTopWidth: 0,
    zIndex: 100,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: '100%',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: '100%',
  },
  unreadDotBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#000000',
    zIndex: 10,
  },
  iconBox: {
    width: 32,
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
