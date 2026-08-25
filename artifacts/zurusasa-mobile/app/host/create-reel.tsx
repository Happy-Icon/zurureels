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
  Switch,
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
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { notificationService } from '@/services/notificationService';
import { GrowingInput } from '@/components/keyboard';
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

const POPULAR_AMENITIES = [
  'Fast Wi-Fi',
  'Air Conditioning',
  'Swimming Pool',
  'Ocean View',
  'Free Parking',
  'Fully Equipped Kitchen',
  'TV / Streaming',
  'Hot Water',
  '24/7 Security',
  'Dedicated Workspace',
  'Balcony / Terrace',
  'Beach Access',
];

const CANCELLATION_POLICIES = [
  {
    id: 'flexible',
    title: 'Flexible',
    desc: 'Full refund up to 24 hours before check-in',
  },
  {
    id: 'moderate',
    title: 'Moderate',
    desc: 'Full refund up to 5 days before check-in',
  },
  {
    id: 'strict',
    title: 'Strict',
    desc: 'Full refund up to 7 days before check-in, 50% thereafter',
  },
] as const;

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
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useCustomAlert();
  const scrollViewRef = useRef<ScrollView>(null);

  // 1. Basic Experience Info
  const [category, setCategory] = useState('stays');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('Diani');
  const [price, setPrice] = useState('');
  const [priceUnit, setPriceUnit] = useState('night');
  const [description, setDescription] = useState('');

  // 2. Capacity & Stay Settings
  const [maxGuests, setMaxGuests] = useState('2');
  const [minStayNights, setMinStayNights] = useState('1');
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutTime, setCheckOutTime] = useState('10:00');
  const [bookingMode, setBookingMode] = useState<'approval_required' | 'instant'>('approval_required');
  const [cancellationPolicy, setCancellationPolicy] = useState<'flexible' | 'moderate' | 'strict'>('flexible');

  // 3. Structured House Rules
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [partiesAllowed, setPartiesAllowed] = useState(false);
  const [childrenAllowed, setChildrenAllowed] = useState(true);
  const [additionalGuestsAllowed, setAdditionalGuestsAllowed] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00');
  const [customRules, setCustomRules] = useState('');

  // 4. Arrival & Checkout Instructions (Revealed only upon confirmed booking)
  const [checkInMethod, setCheckInMethod] = useState('Self check-in (Smart Lock)');
  const [directions, setDirections] = useState('');
  const [parkingInfo, setParkingInfo] = useState('');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [accessInstructions, setAccessInstructions] = useState('');
  const [keyReturnInstructions, setKeyReturnInstructions] = useState('Leave keys on dining table and lock door.');
  const [trashInstructions, setTrashInstructions] = useState('Dispose trash in bins outside gate.');
  const [cleaningExpectations, setCleaningExpectations] = useState('Please wash used cookware before departure.');

  // 5. Amenities
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    'Fast Wi-Fi',
    'Air Conditioning',
    'Swimming Pool',
    'Ocean View',
    'Free Parking',
  ]);

  // Media & Upload States
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showVideoSourceModal, setShowVideoSourceModal] = useState(false);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 20 : insets.bottom + 16;

  const toggleAmenity = (name: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  };

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
    setUploadProgress(15);
    setUploadStatusText('Preparing media assets...');

    try {
      // 1. Video & Thumbnail Upload to Cloudinary
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
            setUploadStatusText('Uploading high-res video...');
            const cRes = await uploadToCloudinaryMobile(videoUri, {
              resourceType: 'video',
              folder: 'reels',
              onProgress: (percent) => setUploadProgress(15 + Math.round(percent * 0.5)),
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
            setUploadStatusText('Uploading cover image...');
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

      setUploadProgress(70);
      setUploadStatusText('Saving listing details & rules...');

      // 2. Create Experience record with structured rules & arrival instructions
      const numPrice = parseFloat(price);
      const parsedMaxGuests = Math.max(1, parseInt(maxGuests, 10) || 2);
      const parsedMinStay = Math.max(1, parseInt(minStayNights, 10) || 1);

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
          max_guests: parsedMaxGuests,
          min_stay_nights: parsedMinStay,
          check_in_time: checkInTime.trim() || '14:00',
          check_out_time: checkOutTime.trim() || '10:00',
          booking_mode: bookingMode,
          cancellation_policy: cancellationPolicy,
          house_rules: {
            smoking_allowed: smokingAllowed,
            pets_allowed: petsAllowed,
            parties_allowed: partiesAllowed,
            children_allowed: childrenAllowed,
            additional_guests_allowed: additionalGuestsAllowed,
            quiet_hours_start: quietHoursStart.trim(),
            quiet_hours_end: quietHoursEnd.trim(),
            custom_rules: customRules.trim(),
          },
          arrival_instructions: {
            check_in_method: checkInMethod.trim(),
            directions: directions.trim(),
            parking_info: parkingInfo.trim(),
            wifi_ssid: wifiSsid.trim(),
            wifi_password: wifiPassword.trim(),
            access_instructions: accessInstructions.trim(),
          },
          checkout_instructions: {
            key_return_instructions: keyReturnInstructions.trim(),
            trash_instructions: trashInstructions.trim(),
            cleaning_expectations: cleaningExpectations.trim(),
            custom_notes: '',
          },
          amenities: selectedAmenities,
          image_url: finalThumbUrl,
        })
        .select()
        .single();

      if (expError) throw expError;

      setUploadProgress(90);
      setUploadStatusText('Publishing Reel...');

      // 3. Create Reel Record
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

      // Invalidate Redis reels feed cache
      invalidateServerCache('invalidate_reels_feed').catch(() => null);

      setUploadProgress(100);

      // Notify host of successful listing creation
      notificationService.createNotification({
        userId: user.id,
        type: 'booking_request',
        title: 'Listing Published Successfully! 🌟',
        message: `Your listing "${title}" is now live on ZuruSasa with instant booking & cancellation settings active.`,
        actionType: 'discover',
        actionId: exp.id,
      });

      showAlert({
        title: 'Listing & Reel Published! 🎉',
        message: 'Your experience is now live and ready to receive bookings from guests across ZuruSasa.',
        icon: 'check-circle',
        buttons: [
          {
            text: 'View Listings',
            onPress: () => router.replace('/(tabs)/listings' as any),
          },
          {
            text: 'Go to Feed',
            style: 'cancel',
            onPress: () => router.replace('/' as any),
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
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        {/* 1. Header Bar */}
        <View style={[styles.header, { paddingTop: topPad }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={10}
          >
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Create Listing & Reel</Text>
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
            <Text style={[styles.sectionHeading, { color: colors.text }]}>1. Media Assets</Text>
            <View style={styles.mediaRow}>
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
                    { backgroundColor: isDark ? '#27272A' : '#F7F7F7', borderColor: colors.border },
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <View style={[styles.mediaBadgeCircle, { backgroundColor: colors.card }]}>
                    <Feather name="video" size={20} color={colors.mutedForeground} />
                  </View>
                  <Text style={[styles.mediaCardTitle, { color: colors.text }]}>Select Reel Video</Text>
                  <Text style={[styles.mediaCardSub, { color: colors.mutedForeground }]}>Record or choose gallery</Text>
                </Pressable>
              )}

              {/* Pick Cover Action Card */}
              <Pressable
                onPress={pickThumbnail}
                style={({ pressed }) => [
                  styles.mediaActionCard,
                  { backgroundColor: isDark ? '#27272A' : '#F7F7F7', borderColor: colors.border },
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
                    <View style={[styles.mediaBadgeCircle, { backgroundColor: colors.card }]}>
                      <Feather name="image" size={20} color={colors.mutedForeground} />
                    </View>
                    <Text style={[styles.mediaCardTitle, { color: colors.text }]}>Pick Cover</Text>
                    <Text style={[styles.mediaCardSub, { color: colors.mutedForeground }]}>9:16 portrait image</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Step 2: Experience Category & Basic Info */}
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>2. Experience Category & Details</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {CATEGORIES.map((c) => {
                const selected = category === c.value;
                return (
                  <Pressable
                    key={c.value}
                    onPress={() => setCategory(c.value)}
                    style={[
                      styles.categoryChip,
                      { backgroundColor: isDark ? '#27272A' : '#F7F7F7' },
                      selected ? styles.categoryChipSelected : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: colors.mutedForeground },
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
            <Text style={[styles.inputLabel, { color: colors.text }]}>Listing Title *</Text>
            <TextInput
              placeholder="e.g. Diani Sunset Villa & Private Pool"
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
              style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
            />
          </View>

          {/* Location Selector */}
          <View style={styles.formGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Location *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {LOCATIONS.map((loc) => {
                const sel = location === loc;
                return (
                  <Pressable
                    key={loc}
                    onPress={() => setLocation(loc)}
                    style={[
                      styles.locChip,
                      { backgroundColor: isDark ? '#27272A' : '#F7F7F7' },
                      sel ? styles.locChipSelected : null,
                    ]}
                  >
                    <Text style={[styles.locChipText, { color: colors.mutedForeground }, sel ? styles.locChipTextSelected : null]}>
                      {loc}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Price & Price Unit */}
          <View style={styles.rowTwoCol}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Price (KES) *</Text>
              <TextInput
                placeholder="e.g. 15000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
                style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
              />
            </View>

            <View style={[styles.formGroup, { width: 130 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Price Unit</Text>
              <TextInput
                placeholder="night / trip"
                placeholderTextColor={colors.mutedForeground}
                value={priceUnit}
                onChangeText={setPriceUnit}
                style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Description (Optional)</Text>
            <GrowingInput
              placeholder="Describe what makes this experience special, nearby beaches, amenities..."
              placeholderTextColor={colors.mutedForeground}
              value={description}
              onChangeText={setDescription}
              minHeight={80}
              maxHeight={160}
              style={[styles.textInput, styles.textAreaInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Step 3: Capacity & Booking Settings */}
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>3. Capacity & Booking Settings</Text>

            <View style={styles.rowTwoCol}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Max Guests</Text>
                <TextInput
                  placeholder="2"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                  value={maxGuests}
                  onChangeText={setMaxGuests}
                  style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Min Stay (Nights)</Text>
                <TextInput
                  placeholder="1"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                  value={minStayNights}
                  onChangeText={setMinStayNights}
                  style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
                />
              </View>
            </View>

            <View style={styles.rowTwoCol}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Check-in Time</Text>
                <TextInput
                  placeholder="14:00"
                  placeholderTextColor={colors.mutedForeground}
                  value={checkInTime}
                  onChangeText={setCheckInTime}
                  style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Check-out Time</Text>
                <TextInput
                  placeholder="10:00"
                  placeholderTextColor={colors.mutedForeground}
                  value={checkOutTime}
                  onChangeText={setCheckOutTime}
                  style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
                />
              </View>
            </View>

            {/* Booking Mode */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Booking Mode</Text>
              <View style={styles.segmentContainer}>
                <Pressable
                  onPress={() => setBookingMode('approval_required')}
                  style={[
                    styles.segmentBtn,
                    { backgroundColor: bookingMode === 'approval_required' ? '#F26522' : isDark ? '#27272A' : '#F3F4F6' },
                  ]}
                >
                  <Feather
                    name="user-check"
                    size={14}
                    color={bookingMode === 'approval_required' ? '#FFFFFF' : colors.text}
                  />
                  <Text
                    style={[
                      styles.segmentBtnText,
                      { color: bookingMode === 'approval_required' ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    Host Approval Required
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setBookingMode('instant')}
                  style={[
                    styles.segmentBtn,
                    { backgroundColor: bookingMode === 'instant' ? '#F26522' : isDark ? '#27272A' : '#F3F4F6' },
                  ]}
                >
                  <Feather
                    name="zap"
                    size={14}
                    color={bookingMode === 'instant' ? '#FFFFFF' : colors.text}
                  />
                  <Text
                    style={[
                      styles.segmentBtnText,
                      { color: bookingMode === 'instant' ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    Instant Booking
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Cancellation Policy */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Cancellation Policy</Text>
              <View style={{ gap: 8 }}>
                {CANCELLATION_POLICIES.map((cp) => {
                  const sel = cancellationPolicy === cp.id;
                  return (
                    <Pressable
                      key={cp.id}
                      onPress={() => setCancellationPolicy(cp.id)}
                      style={[
                        styles.policyCard,
                        {
                          backgroundColor: sel ? (isDark ? '#3B2314' : '#FFF8F5') : (isDark ? '#27272A' : '#F9FAFB'),
                          borderColor: sel ? '#F26522' : colors.border,
                        },
                      ]}
                    >
                      <View style={styles.policyCardHeader}>
                        <Text style={[styles.policyCardTitle, { color: sel ? '#F26522' : colors.text }]}>
                          {cp.title}
                        </Text>
                        <View style={[styles.radioCircle, sel && styles.radioCircleActive]}>
                          {sel ? <View style={styles.radioDot} /> : null}
                        </View>
                      </View>
                      <Text style={[styles.policyCardDesc, { color: colors.mutedForeground }]}>{cp.desc}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Step 4: Structured House Rules */}
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>4. House Rules</Text>

            <View style={[styles.rulesListCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.ruleToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ruleToggleTitle, { color: colors.text }]}>Smoking Allowed</Text>
                  <Text style={[styles.ruleToggleSub, { color: colors.mutedForeground }]}>Allow smoking inside the property</Text>
                </View>
                <Switch
                  value={smokingAllowed}
                  onValueChange={setSmokingAllowed}
                  trackColor={{ false: '#767577', true: '#F26522' }}
                />
              </View>

              <View style={[styles.ruleDivider, { backgroundColor: colors.border }]} />

              <View style={styles.ruleToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ruleToggleTitle, { color: colors.text }]}>Pets Allowed</Text>
                  <Text style={[styles.ruleToggleSub, { color: colors.mutedForeground }]}>Welcome guests with pets</Text>
                </View>
                <Switch
                  value={petsAllowed}
                  onValueChange={setPetsAllowed}
                  trackColor={{ false: '#767577', true: '#F26522' }}
                />
              </View>

              <View style={[styles.ruleDivider, { backgroundColor: colors.border }]} />

              <View style={styles.ruleToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ruleToggleTitle, { color: colors.text }]}>Parties & Events</Text>
                  <Text style={[styles.ruleToggleSub, { color: colors.mutedForeground }]}>Allow gatherings or celebrations</Text>
                </View>
                <Switch
                  value={partiesAllowed}
                  onValueChange={setPartiesAllowed}
                  trackColor={{ false: '#767577', true: '#F26522' }}
                />
              </View>

              <View style={[styles.ruleDivider, { backgroundColor: colors.border }]} />

              <View style={styles.ruleToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ruleToggleTitle, { color: colors.text }]}>Children & Infants</Text>
                  <Text style={[styles.ruleToggleSub, { color: colors.mutedForeground }]}>Property suitable for kids</Text>
                </View>
                <Switch
                  value={childrenAllowed}
                  onValueChange={setChildrenAllowed}
                  trackColor={{ false: '#767577', true: '#F26522' }}
                />
              </View>

              <View style={[styles.ruleDivider, { backgroundColor: colors.border }]} />

              <View style={styles.ruleToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ruleToggleTitle, { color: colors.text }]}>Additional Unregistered Guests</Text>
                  <Text style={[styles.ruleToggleSub, { color: colors.mutedForeground }]}>Allow non-registered visitors</Text>
                </View>
                <Switch
                  value={additionalGuestsAllowed}
                  onValueChange={setAdditionalGuestsAllowed}
                  trackColor={{ false: '#767577', true: '#F26522' }}
                />
              </View>
            </View>

            {/* Quiet Hours Row */}
            <View style={styles.rowTwoCol}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Quiet Hours Start</Text>
                <TextInput
                  placeholder="22:00"
                  placeholderTextColor={colors.mutedForeground}
                  value={quietHoursStart}
                  onChangeText={setQuietHoursStart}
                  style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Quiet Hours End</Text>
                <TextInput
                  placeholder="07:00"
                  placeholderTextColor={colors.mutedForeground}
                  value={quietHoursEnd}
                  onChangeText={setQuietHoursEnd}
                  style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Custom House Rules (Optional)</Text>
              <TextInput
                placeholder="e.g. Please remove shoes at the door, no swimming after 10 PM..."
                placeholderTextColor={colors.mutedForeground}
                value={customRules}
                onChangeText={setCustomRules}
                style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
              />
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Step 5: Arrival & Checkout Instructions */}
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>5. Arrival & Departure Instructions</Text>
            <Text style={[styles.sectionSubText, { color: colors.mutedForeground }]}>
              Sensitive details (Wi-Fi password, access codes) are only shared with guests who have a confirmed reservation.
            </Text>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Check-in Method</Text>
              <TextInput
                placeholder="e.g. Self check-in (Smart Lock), Host greets in person"
                placeholderTextColor={colors.mutedForeground}
                value={checkInMethod}
                onChangeText={setCheckInMethod}
                style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
              />
            </View>

            <View style={styles.rowTwoCol}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Wi-Fi Network Name</Text>
                <TextInput
                  placeholder="e.g. ZuruSunset_Guest"
                  placeholderTextColor={colors.mutedForeground}
                  value={wifiSsid}
                  onChangeText={setWifiSsid}
                  style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Wi-Fi Password</Text>
                <TextInput
                  placeholder="e.g. SunsetVilla2026"
                  placeholderTextColor={colors.mutedForeground}
                  value={wifiPassword}
                  onChangeText={setWifiPassword}
                  style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Access / Gate Code Instructions</Text>
              <TextInput
                placeholder="e.g. Gate code #4492, smart lock code sent on arrival"
                placeholderTextColor={colors.mutedForeground}
                value={accessInstructions}
                onChangeText={setAccessInstructions}
                style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Directions & Parking Info</Text>
              <TextInput
                placeholder="e.g. Behind Diani Reef Resort, dedicated shaded parking slot #4"
                placeholderTextColor={colors.mutedForeground}
                value={directions}
                onChangeText={setDirections}
                style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Key Return & Checkout Instructions</Text>
              <TextInput
                placeholder="e.g. Leave keys on table, lock gate, switch off AC"
                placeholderTextColor={colors.mutedForeground}
                value={keyReturnInstructions}
                onChangeText={setKeyReturnInstructions}
                style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
              />
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Step 6: Amenities Checklist */}
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>6. Amenities</Text>
            <View style={styles.amenitiesWrap}>
              {POPULAR_AMENITIES.map((am) => {
                const selected = selectedAmenities.includes(am);
                return (
                  <Pressable
                    key={am}
                    onPress={() => toggleAmenity(am)}
                    style={[
                      styles.amenityChip,
                      {
                        backgroundColor: selected ? (isDark ? '#3B2314' : '#FFF8F5') : (isDark ? '#27272A' : '#F9FAFB'),
                        borderColor: selected ? '#F26522' : colors.border,
                      },
                    ]}
                  >
                    <Feather
                      name={selected ? 'check' : 'plus'}
                      size={13}
                      color={selected ? '#F26522' : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.amenityChipText,
                        { color: selected ? '#F26522' : colors.text },
                      ]}
                    >
                      {am}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Sticky Bottom Dock */}
        <View style={[styles.bottomDock, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomPad }]}>
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
              <Text style={styles.publishBtnText}>Publish Experience & Reel</Text>
            )}
          </Pressable>
        </View>

        {/* Video Source Selection Modal */}
        <Modal
          visible={showVideoSourceModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowVideoSourceModal(false)}
        >
          <Pressable style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]} onPress={() => setShowVideoSourceModal(false)}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]} onStartShouldSetResponder={() => true}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Choose Reel Source</Text>
              <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>Record a live video or choose an existing video file</Text>

              <Pressable
                style={[styles.modalOptionBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setShowVideoSourceModal(false);
                  recordVideoLive();
                }}
              >
                <View style={[styles.modalIconWrap, { backgroundColor: 'rgba(242, 101, 34, 0.12)' }]}>
                  <Feather name="video" size={22} color="#F26522" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalOptionTitle, { color: colors.text }]}>Record Reel (Live Camera)</Text>
                  <Text style={[styles.modalOptionSub, { color: colors.mutedForeground }]}>Record up to 60 seconds using camera</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </Pressable>

              <Pressable
                style={[styles.modalOptionBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setShowVideoSourceModal(false);
                  pickVideo();
                }}
              >
                <View style={[styles.modalIconWrap, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
                  <Feather name="folder" size={22} color={colors.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalOptionTitle, { color: colors.text }]}>Choose from Gallery</Text>
                  <Text style={[styles.modalOptionSub, { color: colors.mutedForeground }]}>Select an existing MP4 video from device</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </Pressable>

              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowVideoSourceModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
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
    gap: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  sectionSubText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'DMSans_400Regular',
  },
  divider: {
    height: 1,
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
    borderWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaCardTitle: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
  },
  mediaCardSub: {
    fontSize: 10.5,
    fontFamily: 'DMSans_400Regular',
  },

  /* Video & Thumb Previews */
  videoPreviewWrap: {
    flex: 1,
    height: 110,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  videoPreviewView: {
    width: '100%',
    height: '100%',
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayBtnCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoChangeBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  videoChangeBadgeText: {
    color: '#FFF',
    fontSize: 9.5,
    fontFamily: 'DMSans_700Bold',
  },
  thumbPreviewWrap: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  thumbPreviewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
  },
  thumbChangeOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  thumbChangeText: {
    color: '#FFF',
    fontSize: 9.5,
    fontFamily: 'DMSans_700Bold',
  },

  /* Categories & Locations */
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  categoryChipSelected: {
    backgroundColor: '#F26522',
  },
  categoryChipText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'DMSans_700Bold',
  },
  locChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  locChipSelected: {
    backgroundColor: '#F26522',
  },
  locChipText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_500Medium',
  },
  locChipTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'DMSans_700Bold',
  },

  /* Form Controls */
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12.5,
    fontFamily: 'DMSans_700Bold',
  },
  textInput: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
  },
  textAreaInput: {
    height: 'auto',
    paddingTop: 12,
    paddingBottom: 12,
  },
  rowTwoCol: {
    flexDirection: 'row',
    gap: 12,
  },

  /* Segments */
  segmentContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 12,
  },
  segmentBtnText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },

  /* Policies */
  policyCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  policyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  policyCardTitle: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
  },
  policyCardDesc: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#F26522',
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#F26522',
  },

  /* House Rules */
  rulesListCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  ruleToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  ruleToggleTitle: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
  },
  ruleToggleSub: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    marginTop: 1,
  },
  ruleDivider: {
    height: 1,
  },

  /* Amenities */
  amenitiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  amenityChipText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
  },

  /* Bottom Dock */
  bottomDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  publishBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F26522',
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

  /* Modals */
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    marginTop: -6,
  },
  modalOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionTitle: {
    fontSize: 14.5,
    fontFamily: 'DMSans_700Bold',
  },
  modalOptionSub: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
    marginTop: 2,
  },
  modalCancelBtn: {
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
});
