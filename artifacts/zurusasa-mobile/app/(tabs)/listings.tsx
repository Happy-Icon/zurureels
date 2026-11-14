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
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { supabase, type ReelRow } from '@/lib/supabase';
import {
  formatEventScheduleBadge,
  getCategoryDisplayMeta,
  resolveReelContentType,
  type PublishingContentType,
} from '@/constants/taxonomy';
import { invalidateServerCache } from '@/lib/redis';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { ReelCard } from '@/components/ReelCard';
import { Skeleton } from '@/components/Skeleton';
import {
  HostLocationPickerModal,
  type PickedHostLocation,
} from '@/components/map/HostLocationPickerModal';
import { resolveExperienceCoords } from '@/services/mapService';

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
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height: winHeight } = useWindowDimensions();
  const { user } = useAuth();
  const { showAlert } = useCustomAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'published' | 'drafts'>('published');
  const [formatFilter, setFormatFilter] = useState<'all' | PublishingContentType>('all');
  const [reels, setReels] = useState<HostReelItem[]>([]);
  const [selectedPreviewReel, setSelectedPreviewReel] = useState<HostReelItem | null>(null);
  const [pinningReel, setPinningReel] = useState<HostReelItem | null>(null);

  const topPad = Platform.OS === 'web' ? 60 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 100 : 90;

  const fetchListings = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('reels')
        .select('*, experience:experiences(id, title, location, city, formatted_address, country_code, display_latitude, display_longitude, location_precision, current_price, price_unit, availability_status, metadata)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: HostReelItem[] = (data || []).map((r: any) => ({
        ...r,
        title: r.experience?.title,
        location: r.experience?.location,
        price: r.experience?.current_price,
        price_unit: r.experience?.price_unit,
        availability_status: r.experience?.availability_status,
      }));

      setReels(mapped);
    } catch (err) {
      console.error('[HostListings] fetch error:', err);
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

  const handleTogglePublish = async (id: string, currentStatus: string | null) => {
    const nextStatus = currentStatus === 'published' ? 'draft' : 'published';
    try {
      const { error } = await supabase
        .from('reels')
        .update({ status: nextStatus })
        .eq('id', id);

      if (error) throw error;
      setReels((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)),
      );
      await invalidateServerCache('invalidate_reels_feed');
      showAlert({
        title: 'Listing Updated',
        message: `Listing is now marked as ${nextStatus}.`,
        icon: 'check-circle',
      });
    } catch (err: any) {
      showAlert({
        title: 'Error Updating',
        message: err?.message || 'Could not update status.',
        icon: 'alert-circle',
      });
    }
  };

  const handleDelete = (id: string) => {
    showAlert({
      title: 'Delete Listing?',
      message: 'Are you sure you want to remove this reel listing? This cannot be undone.',
      icon: 'alert-triangle',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('reels').delete().eq('id', id);
              if (error) throw error;
              setReels((prev) => prev.filter((r) => r.id !== id));
              await invalidateServerCache('invalidate_reels_feed');
            } catch (err: any) {
              showAlert({
                title: 'Delete Failed',
                message: err?.message || 'Could not delete listing.',
                icon: 'alert-circle',
              });
            }
          },
        },
      ],
    });
  };

  const handleSaveHostPin = async (picked: PickedHostLocation) => {
    const target = pinningReel;
    setPinningReel(null);
    if (!target || !target.experience_id) return;

    try {
      const { data: updatedExp, error: expErr } = await supabase
        .from('experiences')
        .update({
          latitude: picked.latitude,
          longitude: picked.longitude,
          location_precision: picked.precision,
          city: picked.city,
          formatted_address: picked.formattedAddress,
          country_code: picked.countryCode,
          location: picked.city.toLowerCase(),
        })
        .eq('id', target.experience_id)
        .select('id, display_latitude, display_longitude, location_precision, city, formatted_address, country_code, location')
        .single();

      if (expErr) throw expErr;

      await supabase
        .from('reels')
        .update({
          lat: updatedExp?.display_latitude ?? picked.latitude,
          lng: updatedExp?.display_longitude ?? picked.longitude,
        })
        .eq('id', target.id);

      await invalidateServerCache('invalidate_reels_feed').catch(() => null);
      await fetchListings();

      showAlert({
        title: 'Map Pin Saved',
        message:
          picked.precision === 'approximate'
            ? 'Your ~500m privacy circle is now live on Discover Map. Exact coordinates remain private until booking confirmation.'
            : 'Your exact property pin is now live on the ZuruSasa Discover Map.',
        icon: 'check-circle',
      });
    } catch (err: any) {
      showAlert({
        title: 'Could Not Save Pin',
        message: err?.message || 'Failed to update map coordinates.',
        icon: 'alert-circle',
      });
    }
  };

  const tabFilteredReels = reels.filter((r) =>
    activeTab === 'published' ? r.status === 'published' || !r.status : r.status === 'draft',
  );
  const filteredReels = tabFilteredReels.filter((r) =>
    formatFilter === 'all' ? true : resolveReelContentType(r) === formatFilter,
  );

  const renderItem = ({ item }: { item: HostReelItem }) => {
    const priceUnit = item.price_unit ? `/${item.price_unit}` : '';
    const isBooked = item.availability_status === 'booked_out';
    const resolvedPin = resolveExperienceCoords(item.experience, {
      lat: item.lat,
      lng: item.lng,
    });
    const expMeta = ((item.experience as any)?.metadata || {}) as Record<string, any>;
    const contentType = resolveReelContentType(item);
    const subcategory = (item as any).subcategory || expMeta.subcategory || null;
    const catMeta = getCategoryDisplayMeta(
      item.category || (item.experience as any)?.category,
      contentType,
      subcategory,
    );
    const badgeLabel =
      contentType === 'event'
        ? `EVENT · ${formatEventScheduleBadge(expMeta.event_date, expMeta.start_time)}`
        : contentType === 'special_offer' && expMeta.discount_label
        ? `OFFER · ${String(expMeta.discount_label).toUpperCase()}`
        : catMeta.shortLabel.toUpperCase();

    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          onPress={() => setSelectedPreviewReel(item)}
          style={[styles.thumbnailWrap, { backgroundColor: isDark ? '#27272A' : '#F7F7F7' }]}
        >
          {item.thumbnail_url ? (
            <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} contentFit="cover" />
          ) : (
            <View style={[styles.placeholderThumb, { backgroundColor: isDark ? '#27272A' : '#F7F7F7' }]}>
              <Feather name="film" size={24} color={colors.mutedForeground} />
            </View>
          )}
          <View style={styles.playBadgeCircle}>
            <Feather name="play" size={11} color="#FFFFFF" />
          </View>
          {isBooked ? (
            <View style={styles.bookedOverlay}>
              <Text style={styles.bookedTagText}>BOOKED OUT</Text>
            </View>
          ) : null}
        </Pressable>

        <View style={styles.cardContent}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.titleArea}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {item.title || 'Untitled Listing'}
              </Text>
              {item.location ? (
                <View style={styles.locationRow}>
                  <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                  <Text style={[styles.locationText, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.location}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.metaRow}>
            <View
              style={[
                styles.categoryBadge,
                { backgroundColor: isDark ? '#27272A' : '#F3F4F6' },
              ]}
            >
              <Ionicons name={catMeta.icon} size={11} color="#F26522" />
              <Text style={[styles.categoryBadgeText, { color: colors.text }]} numberOfLines={1}>
                {badgeLabel}
              </Text>
            </View>
            {item.price != null ? (
              <Text style={[styles.price, { color: colors.text }]}>
                {contentType === 'event' && item.price === 0
                  ? 'Free Entry'
                  : `KES ${item.price.toLocaleString()}`}
                {contentType === 'event' && item.price === 0 ? null : (
                  <Text style={[styles.priceUnitText, { color: colors.mutedForeground }]}>{priceUnit}</Text>
                )}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => setPinningReel(item)}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                alignSelf: 'flex-start',
                backgroundColor: resolvedPin.hasPin
                  ? isDark
                    ? '#27272A'
                    : '#F3F4F6'
                  : 'rgba(242, 101, 34, 0.12)',
                borderWidth: 1,
                borderColor: resolvedPin.hasPin
                  ? colors.border
                  : 'rgba(242, 101, 34, 0.35)',
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather
              name="map-pin"
              size={11}
              color={resolvedPin.hasPin ? colors.mutedForeground : '#F26522'}
            />
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'DMSans_700Bold',
                color: resolvedPin.hasPin ? colors.text : '#F26522',
              }}
            >
              {resolvedPin.hasPin
                ? `${resolvedPin.precision === 'approximate' ? '~500m pin' : 'Exact pin'} · Edit`
                : 'Add map pin'}
            </Text>
          </Pressable>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => router.push(`/host/edit-reel?id=${item.id}` as any)}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: isDark ? '#27272A' : '#F7F7F7', opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Feather name="edit-2" size={13} color={colors.text} />
              <Text style={[styles.actionBtnText, { color: colors.text }]}>Edit</Text>
            </Pressable>

            <Pressable
              onPress={() => handleTogglePublish(item.id, item.status)}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: isDark ? '#27272A' : '#F7F7F7', opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Feather
                name={item.status === 'published' ? 'eye-off' : 'eye'}
                size={13}
                color={colors.text}
              />
              <Text style={[styles.actionBtnText, { color: colors.text }]}>
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
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad }]}>
          <View style={styles.headerTextStack}>
            <Skeleton style={{ width: 160, height: 26, borderRadius: 6 }} />
            <Skeleton style={{ width: 220, height: 14, borderRadius: 4, marginTop: 6 }} />
          </View>
          <Skeleton style={{ width: 84, height: 38, borderRadius: 20 }} />
        </View>

        <View style={[styles.segmentedControlTrack, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
          <Skeleton style={{ flex: 1, height: 36, borderRadius: 9, marginHorizontal: 2 }} />
          <Skeleton style={{ flex: 1, height: 36, borderRadius: 9, marginHorizontal: 2 }} />
        </View>

        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View style={styles.headerTextStack}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Host Listings</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Manage your accommodation and tour reels.</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Pressable
            testID="calendar-btn"
            onPress={() => router.push('/host/calendar' as any)}
            style={({ pressed }) => [
              styles.calendarHeaderBtn,
              { backgroundColor: isDark ? '#27272A' : '#F3F4F6' },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Feather name="calendar" size={16} color={colors.text} />
          </Pressable>
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
      </View>

      <View style={[styles.segmentedControlTrack, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
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
                isActive ? [styles.segmentedTileActive, { backgroundColor: colors.card }] : null,
              ]}
            >
              <Text
                style={[
                  styles.segmentedTileText,
                  { color: isActive ? colors.text : colors.mutedForeground },
                  isActive ? styles.segmentedTileTextActive : null,
                ]}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.formatFilterRow}>
        {(
          [
            { id: 'all', label: 'All', icon: 'grid-outline' },
            { id: 'experience', label: 'Experiences', icon: 'home-outline' },
            { id: 'event', label: 'Events', icon: 'calendar-outline' },
            { id: 'special_offer', label: 'Offers', icon: 'pricetag-outline' },
          ] as const
        ).map((pill) => {
          const active = formatFilter === pill.id;
          return (
            <Pressable
              key={pill.id}
              onPress={() => setFormatFilter(pill.id)}
              style={[
                styles.formatFilterPill,
                {
                  backgroundColor: active
                    ? '#F26522'
                    : isDark
                    ? '#27272A'
                    : '#F3F4F6',
                  borderColor: active ? '#F26522' : colors.border,
                },
              ]}
            >
              <Ionicons
                name={pill.icon}
                size={13}
                color={active ? '#FFFFFF' : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.formatFilterText,
                  { color: active ? '#FFFFFF' : colors.text },
                ]}
              >
                {pill.label}
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
          <View style={[styles.compactEmptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? '#27272A' : '#F7F7F7' }]}>
              <Feather name="film" size={22} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No {activeTab} yet</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
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

      <HostLocationPickerModal
        visible={Boolean(pinningReel)}
        initialLocationText={pinningReel?.location || 'Diani'}
        initialCoordinates={
          pinningReel?.experience?.display_latitude && pinningReel?.experience?.display_longitude
            ? {
                latitude: Number(pinningReel.experience.display_latitude),
                longitude: Number(pinningReel.experience.display_longitude),
              }
            : null
        }
        initialPrecision={
          pinningReel?.experience?.location_precision === 'approximate'
            ? 'approximate'
            : 'exact'
        }
        onClose={() => setPinningReel(null)}
        onConfirm={handleSaveHostPin}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(242, 101, 34, 0.1)',
    maxWidth: '58%',
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
  calendarHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  formatFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
  },
  formatFilterText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
  },
});
