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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { useMyBookings } from '@/lib/queries';
import { Skeleton } from '@/components/Skeleton';
import { useColors } from '@/hooks/useColors';

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, signOut, loading } = useAuth();
  const { data: bookings, isLoading: bookingsLoading } = useMyBookings(user?.id);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : 80;

  if (!loading && !user) {
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

  const displayName =
    profile?.full_name ?? user?.email?.split('@')[0] ?? 'Traveler';

  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: bottomPad }}
    >
      <View style={styles.profileHeader}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]}>
              {displayName}
            </Text>
            {profile?.verification_status === 'verified' ? (
              <MaterialCommunityIcons
                name="check-decagram"
                size={18}
                color={colors.primary}
              />
            ) : null}
          </View>
          {user?.email ? (
            <Text style={[styles.email, { color: colors.mutedForeground }]}>
              {user.email}
            </Text>
          ) : null}
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Reservations
      </Text>

      {bookingsLoading ? (
        <View style={styles.bookingList}>
          <Skeleton style={styles.bookingSkeleton} />
          <Skeleton style={styles.bookingSkeleton} />
        </View>
      ) : !bookings || bookings.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Feather name="calendar" size={22} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No reservations yet. Find something on the Pulse feed.
          </Text>
        </View>
      ) : (
        <View style={styles.bookingList}>
          {bookings.map((b) => (
            <View
              key={b.id}
              style={[
                styles.bookingCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <View style={styles.bookingInfo}>
                <Text
                  style={[styles.bookingTitle, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {b.experience?.title ?? 'Experience'}
                </Text>
                {b.experience?.location ? (
                  <Text
                    style={[styles.bookingLoc, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    {b.experience.location}
                  </Text>
                ) : null}
                {b.amount != null ? (
                  <Text style={[styles.bookingAmount, { color: colors.primary }]}>
                    KSh {Number(b.amount).toLocaleString()}
                  </Text>
                ) : null}
              </View>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor:
                      b.status === 'confirmed' ? '#2e7d3220' : colors.secondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        b.status === 'confirmed'
                          ? '#2e7d32'
                          : colors.secondaryForeground,
                    },
                  ]}
                >
                  {b.status ?? 'pending'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <Pressable
        testID="signout-button"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          signOut();
        }}
        style={({ pressed }) => [
          styles.signOutButton,
          {
            borderColor: colors.border,
            borderRadius: colors.radius,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather name="log-out" size={16} color={colors.destructive} />
        <Text style={[styles.signOutText, { color: colors.destructive }]}>
          Sign out
        </Text>
      </Pressable>
    </ScrollView>
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
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 24,
    fontFamily: 'DMSans_700Bold',
  },
  profileInfo: { flex: 1, gap: 2 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 24,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  email: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_600SemiBold',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  bookingList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  bookingSkeleton: {
    height: 76,
  },
  bookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  bookingInfo: { flex: 1, gap: 2 },
  bookingTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
  },
  bookingLoc: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
  },
  bookingAmount: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    textTransform: 'capitalize',
  },
  emptyCard: {
    marginHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 28,
    paddingVertical: 12,
  },
  signOutText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
  },
});
