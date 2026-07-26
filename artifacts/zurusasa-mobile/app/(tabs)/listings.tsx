import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { supabase, type ReelRow } from '@/lib/supabase';

interface HostReelItem extends ReelRow {
  title?: string | null;
  location?: string | null;
  price?: number | null;
  price_unit?: string | null;
  likes_count?: number;
  availability_status?: 'available' | 'booked_out';
}

import { useCustomAlert } from '@/context/CustomAlertContext';

export default function HostListingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useCustomAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'published' | 'drafts'>('published');
  const [reels, setReels] = useState<HostReelItem[]>([]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newStatus = item.status === 'published' ? 'draft' : 'published';
    try {
      const { error } = await supabase
        .from('reels')
        .update({ status: newStatus })
        .eq('id', item.id);

      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchListings();
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to update status',
      });
    }
  };

  const handleDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    const priceUnit = item.price_unit || item.experience?.price_unit || '';
    const isBookedOut =
      item.availability_status === 'booked_out' ||
      item.experience?.availability_status === 'booked_out';

    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.thumbnailWrap}>
          {item.thumbnail_url ? (
            <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} contentFit="cover" />
          ) : (
            <View style={[styles.placeholderThumb, { backgroundColor: colors.secondary }]}>
              <Feather name="film" size={28} color={colors.mutedForeground} />
            </View>
          )}

          {isBookedOut ? (
            <View style={styles.bookedOverlay}>
              <Text style={styles.bookedTagText}>FULLY BOOKED</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.titleArea}>
              <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
                {title}
              </Text>
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                <Text style={[styles.locationText, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {location}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.metaRow}>
            {item.category ? (
              <View style={[styles.badge, { backgroundColor: `${colors.primary}18` }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>{item.category}</Text>
              </View>
            ) : null}
            <Text style={[styles.price, { color: colors.foreground }]}>
              KES {price.toLocaleString()}
              {priceUnit ? ` / ${priceUnit}` : ''}
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => handleToggleStatus(item)}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.secondary, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Feather
                name={item.status === 'published' ? 'eye-off' : 'eye'}
                size={14}
                color={colors.foreground}
              />
              <Text style={[styles.actionBtnText, { color: colors.foreground }]}>
                {item.status === 'published' ? 'Unpublish' : 'Publish'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleDelete(item.id)}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: `${colors.destructive}18`, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Feather name="trash-2" size={14} color={colors.destructive} />
              <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.fill, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          Loading host listings…
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Host Listings</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Manage your accommodation and tour reels.
          </Text>
        </View>
        <Pressable
          testID="create-listing-btn"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/host/create-reel');
          }}
          style={({ pressed }) => [
            styles.createBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Feather name="plus" size={16} color="#ffffff" />
          <Text style={styles.createBtnText}>Create</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsRow, { backgroundColor: colors.secondary }]}>
        {(['published', 'drafts'] as const).map((t) => {
          const isActive = activeTab === t;
          const count = reels.filter((r) =>
            t === 'published' ? r.status === 'published' || !r.status : r.status === 'draft',
          ).length;

          return (
            <Pressable
              key={t}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab(t);
              }}
              style={[
                styles.tabPill,
                { backgroundColor: isActive ? colors.background : 'transparent' },
              ]}
            >
              <Text
                style={[
                  styles.tabPillText,
                  { color: isActive ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* List */}
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="film" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No {activeTab} yet</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              {activeTab === 'published'
                ? 'Create your first video reel listing to showcase your stay or tour!'
                : 'Saved draft reels will appear here.'}
            </Text>
            <Pressable
              onPress={() => router.push('/host/create-reel')}
              style={({ pressed }) => [
                styles.emptyBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Text style={styles.emptyBtnText}>Create Listing</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontFamily: 'DMSans_400Regular' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerTitle: { fontSize: 26, fontFamily: 'DMSans_700Bold' },
  headerSub: { fontSize: 13, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  createBtnText: { color: '#ffffff', fontSize: 13, fontFamily: 'DMSans_700Bold' },
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    padding: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  tabPill: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabPillText: { fontSize: 13, fontFamily: 'DMSans_600SemiBold' },
  card: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  thumbnailWrap: { width: 100, height: 100, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  thumbnail: { width: '100%', height: '100%' },
  placeholderThumb: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  bookedOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookedTagText: { color: '#ffffff', fontSize: 9, fontFamily: 'DMSans_700Bold' },
  cardContent: { flex: 1, justifyContent: 'space-between' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleArea: { flex: 1 },
  title: { fontSize: 15, fontFamily: 'DMSans_700Bold' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  locationText: { fontSize: 12, fontFamily: 'DMSans_400Regular' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 11, fontFamily: 'DMSans_600SemiBold', textTransform: 'capitalize' },
  price: { fontSize: 14, fontFamily: 'DMSans_700Bold' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: { fontSize: 12, fontFamily: 'DMSans_600SemiBold' },
  emptyCard: {
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontFamily: 'DMSans_700Bold' },
  emptySub: { fontSize: 13, fontFamily: 'DMSans_400Regular', textAlign: 'center' },
  emptyBtn: { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
  emptyBtnText: { color: '#ffffff', fontSize: 14, fontFamily: 'DMSans_700Bold' },
});
