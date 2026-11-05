import { useRef, useState } from 'react';
import { Keyboard, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { supabase } from '@/lib/supabase';
import { notificationService } from '@/services/notificationService';
import { uploadToCloudinaryMobile, getCloudinaryVideoThumbnail } from '@/lib/cloudinaryUpload';
import { invalidateServerCache } from '@/lib/redis';
import type { BookingMode, CancellationPolicyId } from '@/components/host/create-reel/createReelConstants';

export function useCreateReelForm() {
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
  const [bookingMode, setBookingMode] = useState<BookingMode>('approval_required');
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicyId>('flexible');

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
          processing_status: 'completed',
          expires_at: new Date(Date.now() + 15 * 86_400_000).toISOString(),
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

  return {
    router,
    scrollViewRef,
    category,
    setCategory,
    title,
    setTitle,
    location,
    setLocation,
    price,
    setPrice,
    priceUnit,
    setPriceUnit,
    description,
    setDescription,
    maxGuests,
    setMaxGuests,
    minStayNights,
    setMinStayNights,
    checkInTime,
    setCheckInTime,
    checkOutTime,
    setCheckOutTime,
    bookingMode,
    setBookingMode,
    cancellationPolicy,
    setCancellationPolicy,
    smokingAllowed,
    setSmokingAllowed,
    petsAllowed,
    setPetsAllowed,
    partiesAllowed,
    setPartiesAllowed,
    childrenAllowed,
    setChildrenAllowed,
    additionalGuestsAllowed,
    setAdditionalGuestsAllowed,
    quietHoursStart,
    setQuietHoursStart,
    quietHoursEnd,
    setQuietHoursEnd,
    customRules,
    setCustomRules,
    checkInMethod,
    setCheckInMethod,
    directions,
    setDirections,
    parkingInfo,
    setParkingInfo,
    wifiSsid,
    setWifiSsid,
    wifiPassword,
    setWifiPassword,
    accessInstructions,
    setAccessInstructions,
    keyReturnInstructions,
    setKeyReturnInstructions,
    trashInstructions,
    setTrashInstructions,
    cleaningExpectations,
    setCleaningExpectations,
    selectedAmenities,
    toggleAmenity,
    videoUri,
    thumbnailUri,
    uploading,
    uploadProgress,
    uploadStatusText,
    showVerificationModal,
    setShowVerificationModal,
    showVideoSourceModal,
    setShowVideoSourceModal,
    recordVideoLive,
    pickVideo,
    pickThumbnail,
    handleSubmit,
  };
}

export type CreateReelFormState = ReturnType<typeof useCreateReelForm>;
