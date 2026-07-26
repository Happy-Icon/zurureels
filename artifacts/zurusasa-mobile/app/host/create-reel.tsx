import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { supabase } from '@/lib/supabase';

const CATEGORIES = [
  { label: 'Stays & Villas', value: 'stays' },
  { label: 'Tours & Excursions', value: 'tours' },
  { label: 'Food & Dining', value: 'food' },
  { label: 'Nightlife & Clubs', value: 'nightlife' },
  { label: 'Events & Festivals', value: 'events' },
  { label: 'Boats & Water Sports', value: 'boats' },
];

const LOCATIONS = ['Diani', 'Watamu', 'Lamu', 'Mombasa', 'Malindi', 'Kilifi'];

import { useCustomAlert } from '@/context/CustomAlertContext';

export default function CreateReelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useCustomAlert();

  const [category, setCategory] = useState('stays');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('Diani');
  const [price, setPrice] = useState('');
  const [priceUnit, setPriceUnit] = useState('night');
  const [description, setDescription] = useState('');

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const topPad = Platform.OS === 'web' ? 20 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 20;

  const pickVideo = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert({
        title: 'Permission needed',
        message: 'Please allow camera roll access to upload reel videos.',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
    }
  };

  const pickThumbnail = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setThumbnailUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      showAlert({
        title: 'Sign In Required',
        message: 'Please sign in to publish a reel',
      });
      return;
    }

    if (!title.trim()) {
      showAlert({
        title: 'Missing Title',
        message: 'Please enter a title for your experience.',
      });
      return;
    }

    if (!price || isNaN(Number(price))) {
      showAlert({
        title: 'Missing Price',
        message: 'Please enter a valid numeric price (KES).',
      });
      return;
    }

    setUploading(true);
    setUploadProgress(15);

    try {
      // 1. Create Experience record
      const numPrice = parseFloat(price);
      const { data: exp, error: expError } = await supabase
        .from('experiences')
        .insert({
          user_id: user.id,
          category,
          entity_name: user.user_metadata?.full_name || 'Local Experience',
          title: title.trim(),
          location: location.toLowerCase(),
          current_price: numPrice,
          price_unit: priceUnit,
          description: description.trim(),
        })
        .select()
        .single();

      if (expError) throw expError;
      setUploadProgress(50);

      // 2. Mock / Storage Video Upload Link (Cloudinary or Direct Supabase Storage)
      const finalVideoUrl = videoUri || 'https://assets.mixkit.co/videos/preview/mixkit-beach-front-resort-with-palm-trees-41484-large.mp4';
      const finalThumbUrl = thumbnailUri || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800';

      setUploadProgress(80);

      // 3. Create Reel Record
      const { error: reelError } = await supabase
        .from('reels')
        .insert({
          user_id: user.id,
          experience_id: exp.id,
          category,
          video_url: finalVideoUrl,
          thumbnail_url: finalThumbUrl,
          duration: 20,
          status: 'published',
        });

      if (reelError) throw reelError;

      // 4. Create Event Record if category is 'events'
      if (category === 'events') {
        await supabase.from('events').insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim(),
          location: location.toLowerCase(),
          price: numPrice,
          category: 'events',
          event_date: new Date().toISOString(),
        });
      }

      setUploadProgress(100);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({
        title: 'Reel Published! 🎉',
        message: 'Your story is now live for guests to discover.',
        icon: 'check-circle',
        buttons: [
          {
            text: 'Done',
            onPress: () => router.replace('/listings'),
          },
        ],
      });
    } catch (err: any) {
      console.error('Publish reel error:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert({
        title: 'Publication Failed',
        message: err.message || 'Something went wrong while publishing.',
        icon: 'alert-circle',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Create Listing Reel</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPad + 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1: Category Picker */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Experience Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {CATEGORIES.map((c) => {
              const selected = category === c.value;
              return (
                <Pressable
                  key={c.value}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCategory(c.value);
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? colors.primary : colors.secondary,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: selected ? '#ffffff' : colors.foreground }]}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Title */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Listing Title *</Text>
          <TextInput
            placeholder="e.g. Diani Sunset Villa & Private Pool"
            placeholderTextColor={colors.mutedForeground}
            value={title}
            onChangeText={setTitle}
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
          />
        </View>

        {/* Location & Price Row */}
        <View style={styles.row}>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.foreground }]}>Location *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {LOCATIONS.map((loc) => {
                const sel = location === loc;
                return (
                  <Pressable
                    key={loc}
                    onPress={() => setLocation(loc)}
                    style={[
                      styles.locChip,
                      {
                        backgroundColor: sel ? `${colors.primary}20` : colors.secondary,
                        borderColor: sel ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.locChipText, { color: sel ? colors.primary : colors.foreground }]}>
                      {loc}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Price & Unit */}
        <View style={styles.row}>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.foreground }]}>Price (KES) *</Text>
            <TextInput
              placeholder="e.g. 15000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={price}
              onChangeText={setPrice}
              style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            />
          </View>

          <View style={[styles.formGroup, { width: 120 }]}>
            <Text style={[styles.label, { color: colors.foreground }]}>Price Unit</Text>
            <TextInput
              placeholder="night / trip"
              placeholderTextColor={colors.mutedForeground}
              value={priceUnit}
              onChangeText={setPriceUnit}
              style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            />
          </View>
        </View>

        {/* Description */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Description (Optional)</Text>
          <TextInput
            placeholder="Describe what makes this experience special..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            value={description}
            onChangeText={setDescription}
            style={[
              styles.input,
              {
                backgroundColor: colors.secondary,
                color: colors.foreground,
                borderColor: colors.border,
                minHeight: 80,
                textAlignVertical: 'top',
              },
            ]}
          />
        </View>

        {/* Media Pickers */}
        <View style={styles.mediaSection}>
          <Text style={[styles.label, { color: colors.foreground }]}>Video & Thumbnail</Text>
          <View style={styles.row}>
            <Pressable
              onPress={pickVideo}
              style={({ pressed }) => [
                styles.mediaCard,
                { backgroundColor: colors.secondary, borderColor: videoUri ? colors.primary : colors.border, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name={videoUri ? 'check-circle' : 'video'} size={24} color={videoUri ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.mediaCardText, { color: colors.foreground }]}>
                {videoUri ? 'Video Selected' : 'Pick Video'}
              </Text>
            </Pressable>

            <Pressable
              onPress={pickThumbnail}
              style={({ pressed }) => [
                styles.mediaCard,
                { backgroundColor: colors.secondary, borderColor: thumbnailUri ? colors.primary : colors.border, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              {thumbnailUri ? (
                <Image source={{ uri: thumbnailUri }} style={styles.thumbImage} contentFit="cover" />
              ) : (
                <>
                  <Feather name="image" size={24} color={colors.mutedForeground} />
                  <Text style={[styles.mediaCardText, { color: colors.foreground }]}>Pick Cover</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* Submit Button */}
        <Pressable
          disabled={uploading}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitBtn,
            { backgroundColor: colors.primary, opacity: pressed || uploading ? 0.8 : 1 },
          ]}
        >
          {uploading ? (
            <View style={styles.uploadingRow}>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.submitBtnText}>Publishing ({uploadProgress}%)...</Text>
            </View>
          ) : (
            <Text style={styles.submitBtnText}>Publish Reel</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontFamily: 'InstrumentSerif_400Regular' },
  formGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: 'DMSans_600SemiBold' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontFamily: 'DMSans_600SemiBold' },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
  },
  row: { flexDirection: 'row', gap: 12 },
  locChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  locChipText: { fontSize: 12, fontFamily: 'DMSans_500Medium' },
  mediaSection: { gap: 8 },
  mediaCard: {
    flex: 1,
    height: 90,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  mediaCardText: { fontSize: 12, fontFamily: 'DMSans_600SemiBold' },
  thumbImage: { width: '100%', height: '100%' },
  submitBtn: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  submitBtnText: { color: '#ffffff', fontSize: 15, fontFamily: 'DMSans_700Bold' },
  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
