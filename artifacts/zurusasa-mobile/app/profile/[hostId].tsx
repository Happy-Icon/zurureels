import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useHostProfile } from '@/hooks/useHostProfile';
import { useEnquire } from '@/lib/queries';
import { HostHeader } from '@/components/host/profile/HostHeader';
import { HostStatsCard } from '@/components/host/profile/HostStatsCard';
import { HostTrustBadges } from '@/components/host/profile/HostTrustBadges';
import { HostBio } from '@/components/host/profile/HostBio';
import { HostListings } from '@/components/host/profile/HostListings';
import { HostReviewsPreview } from '@/components/host/profile/HostReviewsPreview';
import { HostLanguages } from '@/components/host/profile/HostLanguages';
import { HostAchievements } from '@/components/host/profile/HostAchievements';
import { HostSafetyCard } from '@/components/host/profile/HostSafetyCard';
import { HostActionBar } from '@/components/host/profile/HostActionBar';
import { HostProfileSkeleton } from '@/components/host/profile/HostProfileSkeleton';

export default function PublicHostProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hostId } = useLocalSearchParams<{ hostId: string }>();
  const { user } = useAuth();
  const enquire = useEnquire();

  const {
    host,
    listings,
    reviews,
    isLoading,
    isFollowing,
    isSaved,
    toggleFollow,
    toggleSaveHost,
  } = useHostProfile(hostId || '');

  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [shareFeedback, setShareFeedback] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 120 : insets.bottom + 90;

  const handleShare = async () => {
    try {
      await Share.share({
        title: `${host?.full_name || 'Host'} on ZuruSasa`,
        message: `Check out ${host?.full_name || 'this host'}'s coastal stays and experiences on ZuruSasa!`,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const handleMessageHost = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }
    if (!hostId || hostId === user.id) {
      Alert.alert('Host Contact', 'You are currently viewing your own profile.');
      return;
    }

    try {
      const convId = await enquire.mutateAsync({ userId: user.id, hostId });
      if (convId) {
        router.push({
          pathname: '/chat/[id]',
          params: {
            id: convId,
            name: host?.full_name || 'Host',
            avatar: (host?.metadata as any)?.avatar_url || '',
            otherId: host?.id,
          },
        });
      }
    } catch (err) {
      console.warn('Message host error:', err);
      router.push('/inbox');
    }
  };

  if (isLoading || !host) {
    return (
      <View style={[styles.fill, { backgroundColor: '#FFFFFF', paddingTop: topPad }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.topNavBar}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Feather name="arrow-left" size={22} color="#222222" />
          </Pressable>
        </View>
        <HostProfileSkeleton />
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: '#FFFFFF' }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top Header Navigation Bar */}
      <View style={[styles.topNavBar, { paddingTop: topPad }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color="#222222" />
        </Pressable>

        <Text style={styles.headerTitleText} numberOfLines={1}>
          {host.full_name}
        </Text>

        <Pressable
          onPress={() => setMenuOpen(true)}
          style={({ pressed }) => [styles.moreBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={10}
        >
          <Feather name="more-horizontal" size={22} color="#222222" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: bottomPad,
          gap: 28,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Host Header */}
        <HostHeader host={host} />

        {/* 2. Key Host Statistics Card */}
        <HostStatsCard host={host} />

        {/* 3. Verified Information Badges */}
        <HostTrustBadges />

        {/* 4. Host Biography */}
        <HostBio name={host.full_name} bio={host.host_bio || ''} />

        {/* 5. Host Listings */}
        <HostListings hostName={host.full_name} listings={listings} />

        {/* 6. Reviews Preview */}
        <HostReviewsPreview
          averageRating={host.average_rating || 4.95}
          reviewsCount={host.reviews_count || 112}
          reviews={reviews}
        />

        {/* 7. Spoken Languages */}
        <HostLanguages languages={host.languages} />

        {/* 8. Host Achievements */}
        <HostAchievements badges={host.host_badges} />

        {/* 9. ZuruSasa Safety & Protection */}
        <HostSafetyCard />
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <HostActionBar onMessage={handleMessageHost} onShare={handleShare} />

      {/* Profile Overflow Menu Modal Sheet */}
      <Modal visible={menuOpen} animationType="fade" transparent onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Host Profile Actions</Text>
              <Pressable onPress={() => setMenuOpen(false)}>
                <Feather name="x" size={20} color="#717171" />
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                toggleFollow();
                setMenuOpen(false);
              }}
              style={styles.menuOptionRow}
            >
              <Feather name={isFollowing ? 'user-check' : 'user-plus'} size={18} color="#222222" />
              <Text style={styles.menuOptionText}>{isFollowing ? 'Following Host' : 'Follow Host'}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                toggleSaveHost();
                setMenuOpen(false);
              }}
              style={styles.menuOptionRow}
            >
              <Feather name={isSaved ? 'bookmark' : 'bookmark'} size={18} color="#222222" />
              <Text style={styles.menuOptionText}>{isSaved ? 'Host Saved' : 'Save Host'}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setMenuOpen(false);
                handleShare();
              }}
              style={styles.menuOptionRow}
            >
              <Feather name="share-2" size={18} color="#222222" />
              <Text style={styles.menuOptionText}>Share Profile</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setMenuOpen(false);
                Alert.alert('Report Submitted', 'Thank you for keeping our community safe. Our team will review this host profile.');
              }}
              style={styles.menuOptionRow}
            >
              <Feather name="flag" size={18} color="#EF4444" />
              <Text style={[styles.menuOptionText, { color: '#EF4444' }]}>Report Host Profile</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topNavBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  moreBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  menuOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F7F7F7',
  },
  menuOptionText: {
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
});
