import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { supabase, type ReelRow } from '@/lib/supabase';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { ReelCard } from '@/components/ReelCard';
import { Skeleton } from '@/components/Skeleton';

interface HostReelItem extends ReelRow {
  title?: string | null;
  location?: string | null;
  price?: number | null;
  price_unit?: string | null;
  likes_count?: number;
  availability_status?: 'available' | 'booked_out';
}

export default function HostListingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height: winHeight } = useWindowDimensions();
  const { user } = useAuth();
  const { showAlert } = useCustomAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'published' | 'drafts'>('published');
  const [reels, setReels] = useState<HostReelItem[]>([]);
  const [selectedPreviewReel, setSelectedPreviewReel] = useState<HostReelItem | null>(null);

  const topPad = Platform.OS === 'web' ? 60 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 100 : 90;

  const fetchListings = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('reels')
        .select('*, experience:experiences(id, title, location, current_price, price_unit, availability_status)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReels((data as HostReelItem[]) ?? []);
    } catch (err) {
      console.error('Error fetching host listings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchListings();
  };

  const handleToggleStatus = async (item: HostReelItem) => {
    const newStatus = item.status === 'published' ? 'draft' : 'published';
    try {
      const { error } = await supabase
        .from('reels')
        .update({ status: newStatus })
        .eq('id', item.id);

      if (error) throw error;
      fetchListings();
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to update status',
      });
    }
  };

  const handleDelete = (id: string) => {
    showAlert({
      title: 'Delete Listing',
      message: 'Are you sure you want to permanently delete this listing? This action cannot be undone.',
      icon: 'trash-2',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('reels').delete().eq('id', id);
              if (error) throw error;
              fetchListings();
            } catch (err: any) {
              showAlert({
                title: 'Error',
                message: err.message || 'Failed to delete listing',
              });
            }
          },
        },
      ],
    });
  };

  const filteredReels = reels.filter((r) => {
    if (activeTab === 'published') return r.status === 'published' || !r.status;
    return r.status === 'draft';
  });

  const renderItem = ({ item }: { item: HostReelItem }) => {
    const title = item.title || item.experience?.title || 'Untitled Experience';
    const location = item.location || item.experience?.location || 'Kenya Coast';
    const price = item.price ?? item.experience?.current_price ?? 0;
    const priceUnit = item.price_unit || item.experience?.price_unit || 'night';
    const isBookedOut =
      item.availability_status === 'booked_out' ||
      item.experience?.availability_status === 'booked_out';

    return (
      <View style={styles.card}>
        <Pressable
          onPress={() => setSelectedPreviewReel(item)}
          style={({ pressed }) => [styles.thumbnailWrap, { opacity: pressed ? 0.88 : 1 }]}
        >
          {item.thumbnail_url ? (
            <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} contentFit="cover" />
          ) : (
            <View style={styles.placeholderThumb}>
              <Feather name="film" size={24} color="#717171" />
            </View>
          )}

          <View style={styles.playBadgeCircle}>
            <Feather name="play" size={14} color="#FFFFFF" />
          </View>

          {isBookedOut ? (
            <View style={styles.bookedOverlay}>
              <Text style={styles.bookedTagText}>FULLY BOOKED</Text>
            </View>
          ) : null}
        </Pressable>

        <View style={styles.cardContent}>
          <Pressable onPress={() => setSelectedPreviewReel(item)}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.titleArea}>
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                <View style={styles.locationRow}>
                  <Feather name="map-pin" size={12} color="#717171" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {location}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>

          <View style={styles.metaRow}>
            {item.category ? (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>
                  {item.category.toUpperCase().replace(/_/g, ' ')}
                </Text>
              </View>
            ) : null}
            <Text style={styles.price}>
              KES {price.toLocaleString()}
              <Text style={styles.priceUnitText}> / {priceUnit}</Text>
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => handleToggleStatus(item)}
              style={({ pressed }) => [
                styles.actionBtn,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Feather
                name={item.status === 'published' ? 'eye-off' : 'eye'}
                size={13}
                color="#222222"
              />
              <Text style={styles.actionBtnText}>
                {item.status === 'published' ? 'Unpublish' : 'Publish'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleDelete(item.id)}
              style={({ pressed }) => [
                styles.deleteBtn,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Feather name="trash-2" size={13} color="#EF4444" />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.fill, { backgroundColor: '#FFFFFF' }]}>
        {/* Header Bar Skeleton */}
        <View style={[styles.header, { paddingTop: topPad }]}>
          <View style={styles.headerTextStack}>
            <Skeleton style={{ width: 160, height: 26, borderRadius: 6 }} />
            <Skeleton style={{ width: 220, height: 14, borderRadius: 4, marginTop: 6 }} />
          </View>
          <Skeleton style={{ width: 84, height: 38, borderRadius: 20 }} />
        </View>

        {/* Segmented Control Track Skeleton */}
        <View style={styles.segmentedControlTrack}>
          <Skeleton style={{ flex: 1, height: 36, borderRadius: 9, marginHorizontal: 2 }} />
          <Skeleton style={{ flex: 1, height: 36, borderRadius: 9, marginHorizontal: 2 }} />
        </View>

        {/* Listings Cards Skeletons */}
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.card}>
              <Skeleton style={{ width: 100, height: 100, borderRadius: 12 }} />
              <View style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
                <Skeleton style={{ width: '80%', height: 18, borderRadius: 4 }} />
                <Skeleton style={{ width: '55%', height: 14, borderRadius: 4 }} />
                <Skeleton style={{ width: '40%', height: 14, borderRadius: 4 }} />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <Skeleton style={{ width: 70, height: 26, borderRadius: 6 }} />
                  <Skeleton style={{ width: 60, height: 26, borderRadius: 6 }} />
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: '#FFFFFF' }]}>
      {/* 1. Header Bar */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View style={styles.headerTextStack}>
          <Text style={styles.headerTitle}>Host Listings</Text>
          <Text style={styles.headerSub}>Manage your accommodation and tour reels.</Text>
        </View>
        <Pressable
          testID="create-listing-btn"
          onPress={() => {
            router.push('/host/create-reel');
          }}
          style={({ pressed }) => [
            styles.createBtn,
            { opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Feather name="plus" size={15} color="#FFFFFF" />
          <Text style={styles.createBtnText}>Create</Text>
        </Pressable>
      </View>

      {/* 2. Segmented Tab Control */}
      <View style={styles.segmentedControlTrack}>
        {(['published', 'drafts'] as const).map((t) => {
          const isActive = activeTab === t;
          const count = reels.filter((r) =>
            t === 'published' ? r.status === 'published' || !r.status : r.status === 'draft',
          ).length;

          return (
            <Pressable
              key={t}
              onPress={() => {
                setActiveTab(t);
              }}
              style={[
                styles.segmentedTile,
                isActive ? styles.segmentedTileActive : null,
              ]}
            >
              <Text
                style={[
                  styles.segmentedTileText,
                  isActive ? styles.segmentedTileTextActive : null,
                ]}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 3. Listings List */}
      <FlatList
        data={filteredReels}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: bottomPad + 24,
          gap: 12,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F26522" />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.compactEmptyCard}>
            <View style={styles.emptyIconCircle}>
              <Feather name="film" size={22} color="#717171" />
            </View>
            <Text style={styles.emptyTitle}>No {activeTab} yet</Text>
            <Text style={styles.emptySub}>
              {activeTab === 'published'
                ? 'Create your first video reel listing to showcase your stay or tour!'
                : 'Saved draft reels will appear here.'}
            </Text>
            <Pressable
              onPress={() => router.push('/host/create-reel')}
              style={({ pressed }) => [
                styles.emptyBtn,
                { opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Text style={styles.emptyBtnText}>Create Listing</Text>
            </Pressable>
          </View>
        }
      />

      {/* Reel Preview Modal */}
      <Modal
        visible={Boolean(selectedPreviewReel)}
        animationType="slide"
        onRequestClose={() => setSelectedPreviewReel(null)}
      >
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
          <Pressable
            onPress={() => setSelectedPreviewReel(null)}
            style={{
              position: 'absolute',
              top: 50,
              left: 20,
              zIndex: 100,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(0,0,0,0.5)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            hitSlop={10}
          >
            <Feather name="x" size={24} color="#FFFFFF" />
          </Pressable>
          {selectedPreviewReel ? (
            <ReelCard reel={selectedPreviewReel} isActive={true} height={winHeight} />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontFamily: 'DMSans_400Regular', color: '#717171' },
  
  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerTextStack: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    marginTop: 2,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F26522',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#F26522',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
  },

  /* Segmented Control */
  segmentedControlTrack: {
    flexDirection: 'row',
    marginHorizontal: 20,
    padding: 3,
    borderRadius: 12,
    backgroundColor: '#F7F7F7',
    marginBottom: 16,
  },
  segmentedTile: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 9,
  },
  segmentedTileActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentedTileText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  segmentedTileTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },

  /* Listing Card */
  card: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    backgroundColor: '#FFFFFF',
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  thumbnailWrap: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  playBadgeCircle: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderThumb: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookedOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookedTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: 'DMSans_700Bold',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleArea: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  locationText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(242, 101, 34, 0.1)',
  },
  categoryBadgeText: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  price: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  priceUnitText: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F7F7F7',
  },
  actionBtnText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  deleteBtnText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#EF4444',
  },

  /* Empty State */
  compactEmptyCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    gap: 8,
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyBtn: {
    backgroundColor: '#F26522',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
  },
});
