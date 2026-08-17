import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
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
import { PersonaVerificationModal } from '@/components/verification/PersonaVerificationModal';
import { useVideoPlayer, VideoView } from 'expo-video';
import { uploadToCloudinaryMobile, getCloudinaryVideoThumbnail } from '@/lib/cloudinaryUpload';
import { invalidateServerCache } from '@/lib/redis';

const CATEGORIES = [
  { label: 'Stays & Villas', value: 'stays' },
  { label: 'Tours & Excursions', value: 'tours' },
  { label: 'Food & Dining', value: 'food' },
  { label: 'Nightlife & Clubs', value: 'nightlife' },
  { label: 'Events & Festivals', value: 'events' },
  { label: 'Boats & Water Sports', value: 'boats' },
];

const LOCATIONS = ['Diani', 'Watamu', 'Lamu', 'Mombasa', 'Malindi', 'Kilifi'];

function InlineVideoPreview({ uri, onChangeVideo }: { uri: string; onChangeVideo: () => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });

  const [playing, setPlaying] = useState(false);

  const togglePlay = () => {
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.play();
      setPlaying(true);
    }
  };

  return (
    <View style={styles.videoPreviewWrap}>
      <VideoView
        player={player}
        style={styles.videoPreviewView}
        contentFit="cover"
        nativeControls={false}
      />
      <Pressable style={styles.videoPlayOverlay} onPress={togglePlay}>
        <View style={styles.videoPlayBtnCircle}>
          <Feather name={playing ? 'pause' : 'play'} size={22} color="#FFFFFF" />
        </View>
      </Pressable>

      <Pressable style={styles.videoChangeBadge} onPress={onChangeVideo}>
        <Feather name="refresh-cw" size={12} color="#FFFFFF" />
        <Text style={styles.videoChangeBadgeText}>Change Video</Text>
      </Pressable>
    </View>
  );
}

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
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showVideoSourceModal, setShowVideoSourceModal] = useState(false);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 20 : insets.bottom + 16;

  const recordVideoLive = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();

    if (cameraStatus !== 'granted') {
      showAlert({
        title: 'Permission Required',
        message: 'Please grant camera access to record live reels.',
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      videoMaxDuration: 60,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
    }
  };

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

    const isVerified = user.user_metadata?.verification_status === 'verified';
    if (!isVerified) {
      setShowVerificationModal(true);
      return;
    }

    if (!videoUri) {
      showAlert({
        title: 'Missing Reel Video',
        message: 'Please record a live reel or select a video from your gallery before publishing.',
      });
      return;
    }

    if (!category) {
      showAlert({
        title: 'Missing Category',
        message: 'Please select an experience category.',
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

    if (!location) {
      showAlert({
        title: 'Missing Location',
        message: 'Please select a location for your experience.',
      });
      return;
    }

    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      showAlert({
        title: 'Invalid Price',
        message: 'Please enter a valid numeric price (e.g. 5000).',
      });
      return;
    }

    setUploading(true);
    setUploadProgress(20);
    setUploadStatusText('Publishing Reel...');

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
      setUploadProgress(40);
      setUploadStatusText('Publishing Reel...');

      // 2. Video & Thumbnail Upload to Cloudinary
      let finalVideoUrl =
        'https://assets.mixkit.co/videos/preview/mixkit-beach-front-resort-with-palm-trees-41484-large.mp4';
      let finalThumbUrl =
        'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800';

      if (videoUri) {
        if (videoUri.startsWith('http://') || videoUri.startsWith('https://')) {
          finalVideoUrl = videoUri;
          finalThumbUrl = getCloudinaryVideoThumbnail(videoUri);
        } else {
          try {
            setUploadStatusText('Publishing Reel...');
            const cRes = await uploadToCloudinaryMobile(videoUri, {
              resourceType: 'video',
              folder: 'reels',
              onProgress: (percent) => setUploadProgress(40 + Math.round(percent * 0.4)),
            });
            finalVideoUrl = cRes.secure_url;
            finalThumbUrl = getCloudinaryVideoThumbnail(cRes.secure_url);
          } catch (cErr: any) {
            console.error('Cloudinary video upload error:', cErr);
            throw new Error(`Publishing failed: ${cErr?.message || cErr}`);
          }
        }
      }

      if (thumbnailUri) {
        if (thumbnailUri.startsWith('http://') || thumbnailUri.startsWith('https://')) {
          finalThumbUrl = thumbnailUri;
        } else {
          try {
            setUploadStatusText('Publishing Reel...');
            const cThumbRes = await uploadToCloudinaryMobile(thumbnailUri, {
              resourceType: 'image',
              folder: 'reels',
            });
            finalThumbUrl = cThumbRes.secure_url;
          } catch (cErr: any) {
            console.warn('Custom thumbnail upload warning, using generated frame:', cErr);
          }
        }
      }

      setUploadProgress(85);
      setUploadStatusText('Publishing Reel...');

      // 3. Create Reel Record (status: 'published' for Discover & Host Listings visibility)
      const { data: newReel, error: reelError } = await supabase
        .from('reels')
        .insert({
          user_id: user.id,
          experience_id: exp.id,
          category,
          video_url: finalVideoUrl,
          thumbnail_url: finalThumbUrl,
          duration: 20,
          status: 'published',
          processing_status: 'completed',
        })
        .select()
        .single();

      if (reelError) throw reelError;

      // Invalidate Redis reels feed cache via server-side Edge Function
      invalidateServerCache('invalidate_reels_feed').catch(() => null);

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

      // Trigger notification
      await notificationService.createNotification({
        userId: user.id,
        type: 'listing_approved',
        title: '🎬 Your reel is live!',
        message: `"${title.trim()}" is now live on Pulse & Discover!`,
        actionType: 'discover',
        actionId: newReel?.id ?? null,
      });

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
              {/* Pick/Record Video Action Card or Inline Player */}
              {videoUri ? (
                <InlineVideoPreview
                  uri={videoUri}
                  onChangeVideo={() => setShowVideoSourceModal(true)}
                />
              ) : (
                <Pressable
                  onPress={() => setShowVideoSourceModal(true)}
                  style={({ pressed }) => [
                    styles.mediaActionCard,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <View style={styles.mediaBadgeCircle}>
                    <Feather name="video" size={20} color="#717171" />
                  </View>
                  <Text style={styles.mediaCardTitle}>Select Reel Video</Text>
                  <Text style={styles.mediaCardSub}>Record or choose gallery</Text>
                </Pressable>
              )}

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

        {/* Video Source Selection Modal (Record vs Gallery) */}
        <Modal
          visible={showVideoSourceModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowVideoSourceModal(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowVideoSourceModal(false)}>
            <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>Choose Reel Source</Text>
              <Text style={styles.modalSubtitle}>Record a live video or choose an existing video file</Text>

              <Pressable
                style={styles.modalOptionBtn}
                onPress={() => {
                  setShowVideoSourceModal(false);
                  recordVideoLive();
                }}
              >
                <View style={[styles.modalIconWrap, { backgroundColor: '#FFF0ED' }]}>
                  <Feather name="video" size={22} color="#F26522" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalOptionTitle}>Record Reel (Live Camera)</Text>
                  <Text style={styles.modalOptionSub}>Record up to 60 seconds using camera</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#999" />
              </Pressable>

              <Pressable
                style={styles.modalOptionBtn}
                onPress={() => {
                  setShowVideoSourceModal(false);
                  pickVideo();
                }}
              >
                <View style={[styles.modalIconWrap, { backgroundColor: '#F3F4F6' }]}>
                  <Feather name="folder" size={22} color="#4B5563" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalOptionTitle}>Choose from Gallery</Text>
                  <Text style={styles.modalOptionSub}>Select an existing MP4 video from device</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#999" />
              </Pressable>

              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowVideoSourceModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        <PersonaVerificationModal
          visible={showVerificationModal}
          onClose={() => setShowVerificationModal(false)}
          onSuccess={() => handleSubmit()}
          title="Verification Required to List"
          subtitle="ZuruSasa requires hosts to verify their identity before publishing listings and reels."
        />
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

  /* Modal Styles */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    marginBottom: 20,
  },
  modalOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    gap: 12,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  modalOptionSub: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  modalCancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  modalCancelText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#6B7280',
  },

  /* Inline Video Preview Styles */
  videoPreviewWrap: {
    flex: 1,
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
  },
  videoPreviewView: {
    width: '100%',
    height: '100%',
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  videoPlayBtnCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(242, 101, 34, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  videoChangeBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  videoChangeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
  },
});
