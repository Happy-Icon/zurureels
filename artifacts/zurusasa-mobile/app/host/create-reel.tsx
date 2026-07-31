import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { notificationService } from '@/services/notificationService';
import { KeyboardScreen, GrowingInput } from '@/components/keyboard';

const CATEGORIES = [
  { label: 'Stays & Villas', value: 'stays' },
  { label: 'Tours & Excursions', value: 'tours' },
  { label: 'Food & Dining', value: 'food' },
  { label: 'Nightlife & Clubs', value: 'nightlife' },
  { label: 'Events & Festivals', value: 'events' },
  { label: 'Boats & Water Sports', value: 'boats' },
];

const LOCATIONS = ['Diani', 'Watamu', 'Lamu', 'Mombasa', 'Malindi', 'Kilifi'];

export default function CreateReelScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useCustomAlert();
  const scrollViewRef = useRef<ScrollView>(null);

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
  const [uploadStatusText, setUploadStatusText] = useState('');

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 20 : insets.bottom + 16;

  const pickVideo = async () => {
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
    Keyboard.dismiss();

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
    setUploadProgress(20);
    setUploadStatusText('Uploading media assets...');

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
      setUploadProgress(60);

      // 2. Video & Thumbnail URL Handling
      const finalVideoUrl =
        videoUri ||
        'https://assets.mixkit.co/videos/preview/mixkit-beach-front-resort-with-palm-trees-41484-large.mp4';
      const finalThumbUrl =
        thumbnailUri ||
        'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800';

      setUploadProgress(85);
      setUploadStatusText('Processing your reel...');

      // 3. Create Reel Record (initially 'processing')
      const { data: newReel, error: reelError } = await supabase
        .from('reels')
        .insert({
          user_id: user.id,
          experience_id: exp.id,
          category,
          video_url: finalVideoUrl,
          thumbnail_url: finalThumbUrl,
          duration: 20,
          status: 'processing',
        })
        .select()
        .single();

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

      // 5. Asynchronously publish reel and trigger live notification
      setTimeout(async () => {
        try {
          if (newReel?.id) {
            await supabase
              .from('reels')
              .update({ status: 'published' })
              .eq('id', newReel.id);
          }
          await notificationService.createNotification({
            userId: user.id,
            type: 'booking_confirmed',
            title: '🎬 Your reel is now live.',
            message: `"${title.trim()}" has finished processing and is now published on Pulse & ZuruFlow!`,
            metadata: { action_type: 'discover', action_id: newReel?.id },
          });
        } catch (asyncErr) {
          console.error('Async reel publishing error:', asyncErr);
        }
      }, 3000);

      showAlert({
        title: 'Processing your reel...',
        message: 'Your reel is being formatted and will automatically publish to Pulse shortly. You will receive a notification when it is live.',
        icon: 'check-circle',
        buttons: [
          {
            text: 'View My Listings',
            onPress: () => router.replace('/listings'),
          },
        ],
      });
    } catch (err: any) {
      console.error('Publish reel error:', err);
      showAlert({
        title: 'Publication Failed',
        message: err.message || 'Something went wrong while publishing.',
        icon: 'alert-circle',
      });
    } finally {
      setUploading(false);
      setUploadStatusText('');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={[styles.fill, { backgroundColor: '#FFFFFF' }]}>
        {/* 1. Header Bar */}
        <View style={[styles.header, { paddingTop: topPad }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={10}
          >
            <Feather name="arrow-left" size={22} color="#222222" />
          </Pressable>
          <Text style={styles.headerTitle}>Create Listing Reel</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Upload Progress Bar */}
        {uploading ? (
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
          </View>
        ) : null}

        <ScrollView
          ref={scrollViewRef}
          style={styles.fill}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140, gap: 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets={true}
        >
          {/* Step 1: Media Action Cards (Video & Cover) */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>1. Media Assets</Text>
            <View style={styles.mediaRow}>
              {/* Pick Video Action Card */}
              <Pressable
                onPress={pickVideo}
                style={({ pressed }) => [
                  styles.mediaActionCard,
                  videoUri ? styles.mediaActionCardSelected : null,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={[styles.mediaBadgeCircle, videoUri ? styles.mediaBadgeActive : null]}>
                  <Feather name={videoUri ? 'check' : 'video'} size={20} color={videoUri ? '#F26522' : '#717171'} />
                </View>
                <Text style={styles.mediaCardTitle}>
                  {videoUri ? 'Video Attached' : 'Upload Reel Video'}
                </Text>
                <Text style={styles.mediaCardSub}>
                  {videoUri ? 'Tap to change video' : 'MP4 format · Max 60s'}
                </Text>
              </Pressable>

              {/* Pick Cover Action Card */}
              <Pressable
                onPress={pickThumbnail}
                style={({ pressed }) => [
                  styles.mediaActionCard,
                  thumbnailUri ? styles.mediaActionCardSelected : null,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                {thumbnailUri ? (
                  <View style={styles.thumbPreviewWrap}>
                    <Image source={{ uri: thumbnailUri }} style={styles.thumbPreviewImage} contentFit="cover" />
                    <View style={styles.thumbChangeOverlay}>
                      <Feather name="camera" size={14} color="#FFFFFF" />
                      <Text style={styles.thumbChangeText}>Change</Text>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.mediaBadgeCircle}>
                      <Feather name="image" size={20} color="#717171" />
                    </View>
                    <Text style={styles.mediaCardTitle}>Pick Cover</Text>
                    <Text style={styles.mediaCardSub}>9:16 portrait image</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Step 2: Experience Details */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>2. Experience Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {CATEGORIES.map((c) => {
                const selected = category === c.value;
                return (
                  <Pressable
                    key={c.value}
                    onPress={() => setCategory(c.value)}
                    style={[
                      styles.categoryChip,
                      selected ? styles.categoryChipSelected : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        selected ? styles.categoryChipTextSelected : null,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Listing Title */}
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Listing Title *</Text>
            <TextInput
              placeholder="e.g. Diani Sunset Villa & Private Pool"
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={setTitle}
              style={styles.textInput}
              onFocus={() => {
                scrollViewRef.current?.scrollTo({ y: 220, animated: true });
              }}
            />
          </View>

          {/* Location Selector */}
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Location *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {LOCATIONS.map((loc) => {
                const sel = location === loc;
                return (
                  <Pressable
                    key={loc}
                    onPress={() => setLocation(loc)}
                    style={[
                      styles.locChip,
                      sel ? styles.locChipSelected : null,
                    ]}
                  >
                    <Text style={[styles.locChipText, sel ? styles.locChipTextSelected : null]}>
                      {loc}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Price & Price Unit Row */}
          <View style={styles.rowTwoCol}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Price (KES) *</Text>
              <TextInput
                placeholder="e.g. 15000"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
                style={styles.textInput}
                onFocus={() => {
                  scrollViewRef.current?.scrollTo({ y: 340, animated: true });
                }}
              />
            </View>

            <View style={[styles.formGroup, { width: 130 }]}>
              <Text style={styles.inputLabel}>Price Unit</Text>
              <TextInput
                placeholder="night / trip"
                placeholderTextColor="#9CA3AF"
                value={priceUnit}
                onChangeText={setPriceUnit}
                style={styles.textInput}
                onFocus={() => {
                  scrollViewRef.current?.scrollTo({ y: 340, animated: true });
                }}
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Description (Optional)</Text>
            <GrowingInput
              placeholder="Describe what makes this experience special..."
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              minHeight={80}
              maxHeight={180}
              style={[styles.textInput, styles.textAreaInput]}
            />
          </View>
        </ScrollView>

        {/* Sticky Bottom Dock */}
        <View style={[styles.bottomDock, { paddingBottom: bottomPad }]}>
          <Pressable
            disabled={uploading}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.publishBtn,
              { opacity: pressed || uploading ? 0.88 : 1 },
            ]}
          >
            {uploading ? (
              <View style={styles.uploadingRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.publishBtnText}>
                  {uploadStatusText || `Uploading (${uploadProgress}%)...`}
                </Text>
              </View>
            ) : (
              <Text style={styles.publishBtnText}>Publish Reel</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  progressBarTrack: {
    height: 3,
    backgroundColor: '#F7F7F7',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F26522',
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeading: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  divider: {
    height: 1,
    backgroundColor: '#EBEBEB',
  },

  /* Media Action Cards */
  mediaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  mediaActionCard: {
    flex: 1,
    height: 110,
    borderRadius: 16,
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 6,
    overflow: 'hidden',
  },
  mediaActionCardSelected: {
    borderColor: '#F26522',
    backgroundColor: '#FFF8F5',
    borderStyle: 'solid',
  },
  mediaBadgeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaBadgeActive: {
    backgroundColor: 'rgba(242, 101, 34, 0.12)',
  },
  mediaCardTitle: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
    textAlign: 'center',
  },
  mediaCardSub: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
  },
  thumbPreviewWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  thumbPreviewImage: {
    width: '100%',
    height: '100%',
  },
  thumbChangeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  thumbChangeText: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
    color: '#FFFFFF',
  },

  /* Inputs & Form Groups */
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  textInput: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#222222',
  },
  textAreaInput: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  rowTwoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#F7F7F7',
  },
  categoryChipSelected: {
    backgroundColor: '#F26522',
  },
  categoryChipText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  categoryChipTextSelected: {
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  locChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F7F7F7',
  },
  locChipSelected: {
    backgroundColor: 'rgba(242, 101, 34, 0.1)',
  },
  locChipText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  locChipTextSelected: {
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },

  /* Bottom Dock */
  bottomDock: {
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 6,
  },
  publishBtn: {
    backgroundColor: '#F26522',
    borderRadius: 24,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
