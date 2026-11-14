import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { supabase, type ExperienceRow } from '@/lib/supabase';
import { useHostEstablishments } from '@/lib/queries';
import { notificationService } from '@/services/notificationService';
import { uploadToCloudinaryMobile, getCloudinaryVideoThumbnail } from '@/lib/cloudinaryUpload';
import { invalidateServerCache } from '@/lib/redis';
import {
  AMENITIES_BY_CATEGORY,
  EVENT_SUBCATEGORIES,
  OFFER_TYPES,
  PRIMARY_EXPERIENCE_CATEGORIES,
  getPrimaryCategoryMeta,
  normalizePrimaryCategory,
  type PrimaryCategoryId,
  type PublishingContentType,
} from '@/constants/taxonomy';
import type { PickedHostLocation } from '@/components/map/HostLocationPickerModal';
import type { BookingMode, CancellationPolicyId } from '@/components/host/create-reel/createReelConstants';

function getFutureDateInput(daysAhead: number): string {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function combineDateAndTimeIso(dateStr: string, timeStr?: string | null, defaultEndOfDay = false): string {
  const cleanDate = dateStr.trim();
  const cleanTime = (timeStr || '').trim();
  const match = cleanTime.match(/^(\d{1,2}):(\d{2})/);

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    const [y, m, d] = cleanDate.split('-').map(Number);
    const hours = match ? Math.min(23, Math.max(0, parseInt(match[1], 10))) : defaultEndOfDay ? 23 : 18;
    const mins = match ? Math.min(59, Math.max(0, parseInt(match[2], 10))) : defaultEndOfDay ? 59 : 0;
    const dt = new Date(y, m - 1, d, hours, mins, 0);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toISOString();
    }
  }

  const parsed = new Date(cleanDate);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  return new Date(Date.now() + 7 * 86_400_000).toISOString();
}

export interface WizardStepMeta {
  id: string;
  shortLabel: string;
  title: string;
}

export function useCreateReelForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ format?: string; experienceId?: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showAlert } = useCustomAlert();
  const scrollViewRef = useRef<ScrollView>(null);

  const openedWithDirectFormat = Boolean(params.format || params.experienceId);
  const initialFormat: PublishingContentType =
    params.format === 'event' || params.format === 'special_offer'
      ? params.format
      : 'experience';

  const { data: hostEstablishments = [] } = useHostEstablishments(user?.id);

  // Full-Page Format Chooser vs Format-Dedicated Wizard State
  const [hasSelectedFormat, setHasSelectedFormat] = useState<boolean>(openedWithDirectFormat);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [showHouseRules, setShowHouseRules] = useState<boolean>(false);
  const [showArrivalDetails, setShowArrivalDetails] = useState<boolean>(false);

  // Step 1: What the host wants to publish + Establishment Link
  const [contentType, setContentTypeState] = useState<PublishingContentType>(initialFormat);
  const [linkedExperienceId, setLinkedExperienceId] = useState<string>(
    params.experienceId ? String(params.experienceId) : 'new',
  );

  // Step 2: Primary Experience Category & Secondary Subcategory
  const [category, setCategoryState] = useState<PrimaryCategoryId>('accommodation');
  const [subcategory, setSubcategory] = useState<string>('hotel_resort');

  // Basic Info
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('Diani');
  const [pinnedLocation, setPinnedLocation] = useState<PickedHostLocation | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [price, setPrice] = useState('');
  const [priceUnit, setPriceUnit] = useState('night');
  const [description, setDescription] = useState('');

  // Non-Accommodation Experience Fields (Land, Water, Food & Dining)
  const [durationInfo, setDurationInfo] = useState('');
  const [operatingHours, setOperatingHours] = useState('');
  const [whatsIncluded, setWhatsIncluded] = useState('');
  const [meetingPoint, setMeetingPoint] = useState('');

  // Event-Specific Fields
  const [eventSubcategory, setEventSubcategory] = useState<string>(EVENT_SUBCATEGORIES[0].id);
  const [eventDate, setEventDate] = useState<string>(() => getFutureDateInput(3));
  const [eventStartTime, setEventStartTime] = useState('18:00');
  const [eventEndTime, setEventEndTime] = useState('23:30');
  const [organizerName, setOrganizerName] = useState('');
  const [entryConditions, setEntryConditions] = useState('');
  const [bookingInstructions, setBookingInstructions] = useState('');

  // Special Offer Fields
  const [offerType, setOfferType] = useState<string>(OFFER_TYPES[0].id);
  const [discountLabel, setDiscountLabel] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [applicableSchedule, setApplicableSchedule] = useState('');
  const [offerExpiryDate, setOfferExpiryDate] = useState<string>(() => getFutureDateInput(14));
  const [termsConditions, setTermsConditions] = useState('');
  const [redemptionInstructions, setRedemptionInstructions] = useState('');

  // Accommodation & Capacity Settings
  const [maxGuests, setMaxGuests] = useState('2');
  const [minStayNights, setMinStayNights] = useState('1');
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutTime, setCheckOutTime] = useState('10:00');
  const [bookingMode, setBookingMode] = useState<BookingMode>('approval_required');
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicyId>('flexible');

  // Structured House Rules (Accommodation)
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [partiesAllowed, setPartiesAllowed] = useState(false);
  const [childrenAllowed, setChildrenAllowed] = useState(true);
  const [additionalGuestsAllowed, setAdditionalGuestsAllowed] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00');
  const [customRules, setCustomRules] = useState('');

  // Arrival & Checkout Instructions (Accommodation)
  const [checkInMethod, setCheckInMethod] = useState('Self check-in (Smart Lock)');
  const [directions, setDirections] = useState('');
  const [parkingInfo, setParkingInfo] = useState('');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [accessInstructions, setAccessInstructions] = useState('');
  const [keyReturnInstructions, setKeyReturnInstructions] = useState('Leave keys on dining table and lock door.');
  const [trashInstructions, setTrashInstructions] = useState('Dispose trash in bins outside gate.');
  const [cleaningExpectations, setCleaningExpectations] = useState('Please wash used cookware before departure.');

  // Category-Appropriate Amenities / Highlights
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

  const selectedEstablishment: ExperienceRow | null = useMemo(
    () => hostEstablishments.find((e) => e.id === linkedExperienceId) ?? null,
    [hostEstablishments, linkedExperienceId],
  );

  const isAttachingToExistingExp =
    contentType === 'experience' && linkedExperienceId !== 'new';

  const stepMeta: WizardStepMeta[] = useMemo(() => {
    if (isAttachingToExistingExp) {
      return [
        { id: 'venue', shortLabel: 'Venue', title: 'Select Existing Establishment' },
        { id: 'media', shortLabel: 'Reel & Publish', title: 'Add Reel Video & Cover' },
      ];
    }

    if (contentType === 'event') {
      return [
        { id: 'event_reel', shortLabel: 'Event & Reel', title: 'Event Type, Venue & Reel' },
        { id: 'schedule', shortLabel: 'Schedule', title: 'Date, Tickets & Location' },
        { id: 'access', shortLabel: 'Publish', title: 'Entry Rules & Booking Policy' },
      ];
    }

    if (contentType === 'special_offer') {
      return [
        { id: 'offer_reel', shortLabel: 'Offer & Reel', title: 'Offer Type, Venue & Reel' },
        { id: 'deal', shortLabel: 'Deal Terms', title: 'Discount, Validity & Location' },
        { id: 'terms', shortLabel: 'Publish', title: 'Redemption & Booking Policy' },
      ];
    }

    return [
      { id: 'category', shortLabel: 'Category', title: 'Experience Category & Setup' },
      { id: 'basics', shortLabel: 'Reel & Info', title: 'Reel Video & Core Info' },
      { id: 'pricing', shortLabel: 'Pricing', title: 'Pricing, Capacity & Timings' },
      { id: 'policies', shortLabel: 'Policies', title: 'Policies, Rules & Highlights' },
    ];
  }, [contentType, isAttachingToExistingExp]);

  const isLastStep = currentStep >= stepMeta.length - 1;

  // Apply defaults when route query params change
  useEffect(() => {
    if (params.format === 'event' || params.format === 'special_offer' || params.format === 'experience') {
      setContentTypeState(params.format);
      setHasSelectedFormat(true);
    }
    if (params.experienceId) {
      setLinkedExperienceId(String(params.experienceId));
      setHasSelectedFormat(true);
    }
  }, [params.format, params.experienceId]);

  // Clamp step index cleanly if switching link mode changes total steps
  useEffect(() => {
    if (currentStep > stepMeta.length - 1) {
      setCurrentStep(Math.max(0, stepMeta.length - 1));
    }
  }, [currentStep, stepMeta.length]);

  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const setContentType = (nextType: PublishingContentType) => {
    setContentTypeState(nextType);
    if (nextType === 'event') {
      setPriceUnit('ticket');
    } else if (nextType === 'special_offer') {
      setPriceUnit('offer');
    } else {
      const catMeta = getPrimaryCategoryMeta(category);
      setPriceUnit(catMeta.defaultPriceUnit);
    }
  };

  const selectPublishingFormat = (nextType: PublishingContentType) => {
    Keyboard.dismiss();
    setContentType(nextType);
    setCurrentStep(0);
    setHasSelectedFormat(true);
    scrollToTop();
  };

  const validateStep = (stepIndex: number): boolean => {
    if (isAttachingToExistingExp) {
      if (stepIndex === 1 && !videoUri) {
        showAlert({
          title: 'Missing Reel Video',
          message: 'Please record a live reel or select a video from your gallery before publishing.',
        });
        return false;
      }
      return true;
    }

    if (contentType === 'experience') {
      if (stepIndex === 1) {
        if (!videoUri) {
          showAlert({
            title: 'Missing Reel Video',
            message: 'Please record a live reel or select a video from your gallery to continue.',
          });
          return false;
        }
        if (!title.trim()) {
          showAlert({
            title: 'Missing Title',
            message: 'Please enter a title for your listing.',
          });
          return false;
        }
        if (!location.trim()) {
          showAlert({
            title: 'Missing Location',
            message: 'Please select a location.',
          });
          return false;
        }
      } else if (stepIndex === 2) {
        if (!price || isNaN(Number(price)) || Number(price) <= 0) {
          showAlert({
            title: 'Invalid Price',
            message: 'Please enter a valid numeric price (e.g. 5000).',
          });
          return false;
        }
      }
      return true;
    }

    if (contentType === 'event') {
      if (stepIndex === 0) {
        if (!videoUri) {
          showAlert({
            title: 'Missing Reel Video',
            message: 'Please record a live reel or select a video from your gallery to continue.',
          });
          return false;
        }
        if (!title.trim()) {
          showAlert({
            title: 'Missing Title',
            message: 'Please enter the event title.',
          });
          return false;
        }
      } else if (stepIndex === 1) {
        if (!eventDate.trim()) {
          showAlert({
            title: 'Missing Event Date',
            message: 'Please enter the event date (e.g. YYYY-MM-DD).',
          });
          return false;
        }
        if (price.trim() && (isNaN(Number(price)) || Number(price) < 0)) {
          showAlert({
            title: 'Invalid Ticket Price',
            message: 'Enter 0 for free entry or a valid numeric ticket price.',
          });
          return false;
        }
        if (!location.trim()) {
          showAlert({
            title: 'Missing Location',
            message: 'Please select a location.',
          });
          return false;
        }
      }
      return true;
    }

    // special_offer
    if (stepIndex === 0) {
      if (!videoUri) {
        showAlert({
          title: 'Missing Reel Video',
          message: 'Please record a live reel or select a video from your gallery to continue.',
        });
        return false;
      }
      if (!title.trim()) {
        showAlert({
          title: 'Missing Title',
          message: 'Please enter the special offer title.',
        });
        return false;
      }
    } else if (stepIndex === 1) {
      if (!discountLabel.trim()) {
        showAlert({
          title: 'Missing Offer Discount / Highlight',
          message: 'Enter the promotional highlight (e.g. "20% OFF" or "2-for-1 Cocktails").',
        });
        return false;
      }
      if (!offerExpiryDate.trim()) {
        showAlert({
          title: 'Missing Expiry Date',
          message: 'Please specify when this special offer expires (YYYY-MM-DD).',
        });
        return false;
      }
      if (!location.trim()) {
        showAlert({
          title: 'Missing Location',
          message: 'Please select a location.',
        });
        return false;
      }
    }

    return true;
  };

  const handleNextStep = () => {
    Keyboard.dismiss();
    if (!validateStep(currentStep)) return;
    if (currentStep < stepMeta.length - 1) {
      setCurrentStep((prev) => prev + 1);
      scrollToTop();
    }
  };

  const handlePrevStep = () => {
    Keyboard.dismiss();
    if (!hasSelectedFormat) {
      router.back();
      return;
    }
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      scrollToTop();
      return;
    }
    if (!openedWithDirectFormat) {
      setHasSelectedFormat(false);
      scrollToTop();
      return;
    }
    router.back();
  };

  const goToStep = (targetStep: number) => {
    if (targetStep < 0 || targetStep >= stepMeta.length || targetStep === currentStep) return;
    Keyboard.dismiss();
    if (targetStep < currentStep) {
      setCurrentStep(targetStep);
      scrollToTop();
      return;
    }
    if (targetStep === currentStep + 1 && validateStep(currentStep)) {
      setCurrentStep(targetStep);
      scrollToTop();
    }
  };

  const setCategory = (rawId: string) => {
    const nextCat = normalizePrimaryCategory(rawId);
    setCategoryState(nextCat);
    const catMeta = getPrimaryCategoryMeta(nextCat);
    if (catMeta.subcategories.length > 0) {
      setSubcategory(catMeta.subcategories[0].id);
    }
    if (contentType === 'experience') {
      setPriceUnit(catMeta.defaultPriceUnit);
    }
    // Reset default amenity chips cleanly to match the chosen primary category
    const defaults = AMENITIES_BY_CATEGORY[nextCat] ?? [];
    setSelectedAmenities(defaults.slice(0, 4));
  };

  const handleSelectEstablishment = (expId: string) => {
    setLinkedExperienceId(expId);
    if (expId === 'new') return;
    const found = hostEstablishments.find((e) => e.id === expId);
    if (found) {
      if (found.city || found.location) {
        const rawLoc = found.city || found.location || 'Diani';
        setLocation(rawLoc.charAt(0).toUpperCase() + rawLoc.slice(1));
      }
      if (found.category && contentType === 'experience') {
        const primary = normalizePrimaryCategory(found.category);
        setCategoryState(primary);
        const subFromExp =
          found.subcategory ||
          ((found.metadata as Record<string, unknown> | null)?.subcategory as string | undefined);
        if (subFromExp) setSubcategory(subFromExp);
      }
    }
  };

  const availableAmenities = useMemo(
    () => AMENITIES_BY_CATEGORY[category] ?? AMENITIES_BY_CATEGORY.accommodation,
    [category],
  );

  const toggleAmenity = (name: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name],
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

  const insertExperienceSafely = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('experiences')
      .insert(payload)
      .select()
      .single();

    if (!error) return data;

    // Fallback when remote DB doesn't have new optional columns yet
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('column') || msg.includes('schema cache')) {
      const { subcategory: _s, promotional_tags: _p, operating_hours: _o, ...legacyPayload } = payload;
      const retry = await supabase
        .from('experiences')
        .insert(legacyPayload)
        .select()
        .single();
      if (retry.error) throw retry.error;
      return retry.data;
    }
    throw error;
  };

  const insertReelSafely = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('reels')
      .insert(payload)
      .select()
      .single();

    if (!error) return data;

    const msg = (error.message || '').toLowerCase();
    if (msg.includes('column') || msg.includes('schema cache')) {
      const {
        content_type: _ct,
        subcategory: _sc,
        event_id: _eid,
        offer_id: _oid,
        ...legacyPayload
      } = payload;
      const retry = await supabase
        .from('reels')
        .insert(legacyPayload)
        .select()
        .single();
      if (retry.error) throw retry.error;
      return retry.data;
    }
    throw error;
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();

    if (!user) {
      showAlert({
        title: 'Sign In Required',
        message: 'Please sign in to publish.',
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

    if (!isAttachingToExistingExp) {
      if (!title.trim()) {
        showAlert({
          title: 'Missing Title',
          message:
            contentType === 'event'
              ? 'Please enter the event title.'
              : contentType === 'special_offer'
              ? 'Please enter the special offer title.'
              : 'Please enter a title for your listing.',
        });
        return;
      }

      if (!location) {
        showAlert({
          title: 'Missing Location',
          message: 'Please select a location.',
        });
        return;
      }
    }

    if (contentType === 'experience' && !isAttachingToExistingExp) {
      if (!price || isNaN(Number(price)) || Number(price) <= 0) {
        showAlert({
          title: 'Invalid Price',
          message: 'Please enter a valid numeric price (e.g. 5000).',
        });
        return;
      }
    } else if (contentType === 'event') {
      if (!eventDate.trim()) {
        showAlert({
          title: 'Missing Event Date',
          message: 'Please enter the event date (e.g. YYYY-MM-DD).',
        });
        return;
      }
      if (price.trim() && (isNaN(Number(price)) || Number(price) < 0)) {
        showAlert({
          title: 'Invalid Ticket Price',
          message: 'Enter 0 for free entry or a valid numeric ticket price.',
        });
        return;
      }
    } else if (contentType === 'special_offer') {
      if (!discountLabel.trim()) {
        showAlert({
          title: 'Missing Offer Discount / Highlight',
          message: 'Enter the promotional highlight (e.g. "20% OFF" or "2-for-1 Cocktails").',
        });
        return;
      }
      if (!offerExpiryDate.trim()) {
        showAlert({
          title: 'Missing Expiry Date',
          message: 'Please specify when this special offer expires (YYYY-MM-DD).',
        });
        return;
      }
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
      setUploadStatusText(
        contentType === 'event'
          ? 'Creating Event listing...'
          : contentType === 'special_offer'
          ? 'Creating Special Offer...'
          : 'Saving experience details...',
      );

      const isStay = category === 'accommodation' && contentType === 'experience';
      const parsedMaxGuests = Math.max(1, parseInt(maxGuests, 10) || 2);
      const parsedMinStay = isStay ? Math.max(1, parseInt(minStayNights, 10) || 1) : 1;
      const numericPrice =
        contentType === 'special_offer'
          ? parseFloat(offerPrice || price || originalPrice || '0') || 0
          : parseFloat(price || '0') || 0;

      const resolvedCity = pinnedLocation?.city || location;
      const resolvedLat = pinnedLocation?.latitude ?? selectedEstablishment?.display_latitude ?? null;
      const resolvedLng = pinnedLocation?.longitude ?? selectedEstablishment?.display_longitude ?? null;

      let targetExperienceId: string;
      let targetLat: number | null = resolvedLat ?? null;
      let targetLng: number | null = resolvedLng ?? null;
      let createdEventId: string | null = null;
      let createdOfferId: string | null = null;
      let reelExpiresAtIso = new Date(Date.now() + 15 * 86_400_000).toISOString();
      let reelCategory = category as string;
      let reelSubcategory: string = subcategory;

      if (contentType === 'experience') {
        if (linkedExperienceId !== 'new' && selectedEstablishment) {
          // Attach new Reel directly to existing host establishment without duplicating it
          targetExperienceId = selectedEstablishment.id;
          reelCategory = normalizePrimaryCategory(selectedEstablishment.category);
          reelSubcategory =
            selectedEstablishment.subcategory ||
            ((selectedEstablishment.metadata as any)?.subcategory as string) ||
            subcategory;
        } else {
          const expMetadata: Record<string, unknown> = {
            content_type: 'experience',
            primary_category: category,
            subcategory,
            duration_info: !isStay ? durationInfo.trim() || null : null,
            operating_hours: !isStay ? operatingHours.trim() || null : null,
            whats_included: !isStay ? whatsIncluded.trim() || null : null,
            meeting_point: !isStay ? meetingPoint.trim() || null : null,
          };

          const expPayload: Record<string, unknown> = {
            user_id: user.id,
            category,
            subcategory,
            operating_hours: !isStay ? operatingHours.trim() || null : null,
            entity_name: user.user_metadata?.full_name || 'ZuruSasa Host',
            title: title.trim(),
            location: resolvedCity.toLowerCase(),
            city: resolvedCity,
            formatted_address: pinnedLocation?.formattedAddress || null,
            country_code: pinnedLocation?.countryCode || 'KE',
            latitude: resolvedLat,
            longitude: resolvedLng,
            location_precision: pinnedLocation ? pinnedLocation.precision : 'city_only',
            current_price: numericPrice,
            price_unit: priceUnit.trim() || getPrimaryCategoryMeta(category).defaultPriceUnit,
            description: description.trim(),
            max_guests: parsedMaxGuests,
            min_stay_nights: parsedMinStay,
            check_in_time: isStay ? checkInTime.trim() || '14:00' : operatingHours.trim() || null,
            check_out_time: isStay ? checkOutTime.trim() || '10:00' : null,
            booking_mode: bookingMode,
            cancellation_policy: cancellationPolicy,
            house_rules: isStay
              ? {
                  smoking_allowed: smokingAllowed,
                  pets_allowed: petsAllowed,
                  parties_allowed: partiesAllowed,
                  children_allowed: childrenAllowed,
                  additional_guests_allowed: additionalGuestsAllowed,
                  quiet_hours_start: quietHoursStart.trim(),
                  quiet_hours_end: quietHoursEnd.trim(),
                  custom_rules: customRules.trim(),
                }
              : null,
            arrival_instructions: isStay
              ? {
                  check_in_method: checkInMethod.trim(),
                  directions: directions.trim(),
                  parking_info: parkingInfo.trim(),
                  wifi_ssid: wifiSsid.trim(),
                  wifi_password: wifiPassword.trim(),
                  access_instructions: accessInstructions.trim(),
                }
              : meetingPoint.trim()
              ? { check_in_method: 'Meeting Point', directions: meetingPoint.trim() }
              : null,
            checkout_instructions: isStay
              ? {
                  key_return_instructions: keyReturnInstructions.trim(),
                  trash_instructions: trashInstructions.trim(),
                  cleaning_expectations: cleaningExpectations.trim(),
                  custom_notes: '',
                }
              : null,
            amenities: selectedAmenities,
            image_url: finalThumbUrl,
            metadata: expMetadata,
          };

          const createdExp = await insertExperienceSafely(expPayload);
          targetExperienceId = createdExp.id;
          targetLat = createdExp.display_latitude ?? targetLat;
          targetLng = createdExp.display_longitude ?? targetLng;
        }
      } else if (contentType === 'event') {
        reelCategory = 'events';
        reelSubcategory = eventSubcategory;
        const startIso = combineDateAndTimeIso(eventDate, eventStartTime, false);
        const endIso = combineDateAndTimeIso(eventDate, eventEndTime, true);
        reelExpiresAtIso = endIso;

        const linkedEst = linkedExperienceId !== 'new' ? selectedEstablishment : null;
        const orgDisplayName =
          organizerName.trim() ||
          linkedEst?.title ||
          linkedEst?.entity_name ||
          user.user_metadata?.full_name ||
          'Event Organizer';

        // Insert into normalized events table (with graceful column fallback)
        const baseEventPayload: Record<string, unknown> = {
          user_id: user.id,
          title: title.trim(),
          description: description.trim(),
          category: eventSubcategory,
          location: resolvedCity,
          event_date: startIso,
          end_date: endIso,
          price: numericPrice,
          image_url: finalThumbUrl,
          status: 'active',
        };
        const extendedEventPayload: Record<string, unknown> = {
          ...baseEventPayload,
          experience_id: linkedEst?.id ?? null,
          organizer_name: orgDisplayName,
          start_time: eventStartTime.trim(),
          entry_conditions: entryConditions.trim() || null,
          booking_instructions: bookingInstructions.trim() || null,
          expires_at: endIso,
        };

        try {
          const evRes = await supabase.from('events').insert(extendedEventPayload).select().single();
          if (!evRes.error && evRes.data) {
            createdEventId = evRes.data.id;
          } else if (evRes.error) {
            const msg = (evRes.error.message || '').toLowerCase();
            if (msg.includes('column') || msg.includes('schema cache')) {
              const evFallback = await supabase.from('events').insert(baseEventPayload).select().single();
              if (!evFallback.error && evFallback.data) {
                createdEventId = evFallback.data.id;
              }
            }
          }
        } catch {
          // Non-fatal: reel + backing experience metadata still carries full event_details
        }

        const eventBackerPayload: Record<string, unknown> = {
          user_id: user.id,
          category: 'events',
          subcategory: eventSubcategory,
          entity_name: orgDisplayName,
          title: title.trim(),
          location: resolvedCity.toLowerCase(),
          city: resolvedCity,
          formatted_address: pinnedLocation?.formattedAddress || linkedEst?.formatted_address || null,
          country_code: pinnedLocation?.countryCode || 'KE',
          latitude: resolvedLat,
          longitude: resolvedLng,
          location_precision: pinnedLocation ? pinnedLocation.precision : 'city_only',
          current_price: numericPrice,
          price_unit: numericPrice === 0 ? 'entry' : 'ticket',
          description: description.trim(),
          max_guests: parsedMaxGuests,
          booking_mode: bookingMode,
          cancellation_policy: cancellationPolicy,
          image_url: finalThumbUrl,
          metadata: {
            content_type: 'event',
            subcategory: eventSubcategory,
            linked_experience_id: linkedEst?.id ?? null,
            linked_experience_title: linkedEst?.title ?? null,
            event_details: {
              event_id: createdEventId,
              event_date: startIso,
              end_date: endIso,
              start_time: eventStartTime.trim(),
              end_time: eventEndTime.trim(),
              organizer_name: orgDisplayName,
              entry_conditions: entryConditions.trim() || null,
              booking_instructions: bookingInstructions.trim() || null,
              linked_experience_id: linkedEst?.id ?? null,
              linked_experience_title: linkedEst?.title ?? null,
              expires_at: endIso,
              status: 'active',
            },
          },
        };

        const expBacker = await insertExperienceSafely(eventBackerPayload);
        targetExperienceId = expBacker.id;
        targetLat = expBacker.display_latitude ?? targetLat;
        targetLng = expBacker.display_longitude ?? targetLng;
      } else {
        // Special Offer
        reelCategory = 'special_offer';
        reelSubcategory = offerType;
        const expiryIso = combineDateAndTimeIso(offerExpiryDate, '23:59', true);
        reelExpiresAtIso = expiryIso;

        const linkedEst = linkedExperienceId !== 'new' ? selectedEstablishment : null;
        const hostDisplay =
          linkedEst?.title ||
          linkedEst?.entity_name ||
          user.user_metadata?.full_name ||
          'ZuruSasa Host';

        const parsedOriginal = originalPrice.trim() ? parseFloat(originalPrice) : null;
        const parsedOffer = offerPrice.trim() ? parseFloat(offerPrice) : numericPrice;

        // Insert into special_offers table (graceful if remote DB not migrated yet)
        try {
          const offerInsertPayload: Record<string, unknown> = {
            user_id: user.id,
            experience_id: linkedEst?.id ?? null,
            title: title.trim(),
            description: description.trim(),
            offer_type: offerType,
            discount_label: discountLabel.trim(),
            original_price: Number.isFinite(parsedOriginal) ? parsedOriginal : null,
            offer_price: Number.isFinite(parsedOffer) ? parsedOffer : null,
            applicable_schedule: applicableSchedule.trim() || null,
            terms_conditions: termsConditions.trim() || null,
            redemption_instructions: redemptionInstructions.trim() || null,
            image_url: finalThumbUrl,
            expires_at: expiryIso,
            status: 'active',
          };
          const offRes = await supabase
            .from('special_offers')
            .insert(offerInsertPayload)
            .select()
            .single();
          if (!offRes.error && offRes.data) {
            createdOfferId = offRes.data.id;
          }
        } catch {
          // Non-fatal fallback via experiences.metadata below
        }

        const offerBackerPayload: Record<string, unknown> = {
          user_id: user.id,
          category: linkedEst?.category ? normalizePrimaryCategory(linkedEst.category) : category,
          subcategory: offerType,
          promotional_tags: [discountLabel.trim(), offerType],
          entity_name: hostDisplay,
          title: title.trim(),
          location: resolvedCity.toLowerCase(),
          city: resolvedCity,
          formatted_address: pinnedLocation?.formattedAddress || linkedEst?.formatted_address || null,
          country_code: pinnedLocation?.countryCode || 'KE',
          latitude: resolvedLat,
          longitude: resolvedLng,
          location_precision: pinnedLocation ? pinnedLocation.precision : 'city_only',
          current_price: Number.isFinite(parsedOffer) ? parsedOffer : 0,
          price_unit: 'offer',
          description: description.trim(),
          max_guests: parsedMaxGuests,
          booking_mode: bookingMode,
          cancellation_policy: cancellationPolicy,
          image_url: finalThumbUrl,
          metadata: {
            content_type: 'special_offer',
            subcategory: offerType,
            linked_experience_id: linkedEst?.id ?? null,
            linked_experience_title: linkedEst?.title ?? null,
            offer_details: {
              offer_id: createdOfferId,
              offer_type: offerType,
              discount_label: discountLabel.trim(),
              original_price: Number.isFinite(parsedOriginal) ? parsedOriginal : null,
              offer_price: Number.isFinite(parsedOffer) ? parsedOffer : null,
              applicable_schedule: applicableSchedule.trim() || null,
              terms_conditions: termsConditions.trim() || null,
              redemption_instructions: redemptionInstructions.trim() || null,
              linked_experience_id: linkedEst?.id ?? null,
              linked_experience_title: linkedEst?.title ?? null,
              expires_at: expiryIso,
              status: 'active',
            },
          },
        };

        const offerBacker = await insertExperienceSafely(offerBackerPayload);
        targetExperienceId = offerBacker.id;
        targetLat = offerBacker.display_latitude ?? targetLat;
        targetLng = offerBacker.display_longitude ?? targetLng;
      }

      setUploadProgress(90);
      setUploadStatusText('Publishing Reel to ZuruFlow...');

      await insertReelSafely({
        user_id: user.id,
        experience_id: targetExperienceId,
        category: reelCategory,
        subcategory: reelSubcategory,
        content_type: contentType,
        event_id: createdEventId,
        offer_id: createdOfferId,
        video_url: finalVideoUrl,
        thumbnail_url: finalThumbUrl,
        lat: targetLat,
        lng: targetLng,
        duration: 20,
        status: 'published',
        processing_status: 'completed',
        expires_at: reelExpiresAtIso,
      });

      invalidateServerCache('invalidate_reels_feed').catch(() => null);
      queryClient.invalidateQueries({ queryKey: ['reels'] }).catch(() => null);
      queryClient.invalidateQueries({ queryKey: ['upcoming-events'] }).catch(() => null);
      queryClient.invalidateQueries({ queryKey: ['active-special-offers'] }).catch(() => null);
      queryClient.invalidateQueries({ queryKey: ['host-establishments'] }).catch(() => null);

      setUploadProgress(100);

      const notifHeading =
        contentType === 'event'
          ? 'Event Published to ZuruFlow!'
          : contentType === 'special_offer'
          ? 'Special Offer Live Now!'
          : 'Listing Published Successfully!';

      const notifLabel =
        title.trim() || selectedEstablishment?.title || 'Your new reel';

      notificationService.createNotification({
        userId: user.id,
        type: 'booking_request',
        title: notifHeading,
        message: `"${notifLabel}" is now live on ZuruFlow and Discover.`,
        actionType: 'discover',
        actionId: targetExperienceId,
      });

      showAlert({
        title:
          contentType === 'event'
            ? 'Event & Reel Published!'
            : contentType === 'special_offer'
            ? 'Special Offer & Reel Live!'
            : 'Listing & Reel Published!',
        message:
          contentType === 'event'
            ? 'Travelers can now discover your event in ZuruFlow and Happening Around You.'
            : contentType === 'special_offer'
            ? 'Your promotional deal is live under Deals Worth Exploring and ZuruFlow.'
            : 'Your experience is now live and ready to receive bookings across ZuruSasa.',
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
    openedWithDirectFormat,
    hasSelectedFormat,
    setHasSelectedFormat,
    selectPublishingFormat,
    currentStep,
    setCurrentStep,
    stepMeta,
    isLastStep,
    isAttachingToExistingExp,
    handleNextStep,
    handlePrevStep,
    goToStep,
    showHouseRules,
    setShowHouseRules,
    showArrivalDetails,
    setShowArrivalDetails,
    contentType,
    setContentType,
    hostEstablishments,
    linkedExperienceId,
    setLinkedExperienceId: handleSelectEstablishment,
    selectedEstablishment,
    category,
    setCategory,
    subcategory,
    setSubcategory,
    title,
    setTitle,
    location,
    setLocation,
    pinnedLocation,
    setPinnedLocation,
    showLocationPicker,
    setShowLocationPicker,
    price,
    setPrice,
    priceUnit,
    setPriceUnit,
    description,
    setDescription,
    durationInfo,
    setDurationInfo,
    operatingHours,
    setOperatingHours,
    whatsIncluded,
    setWhatsIncluded,
    meetingPoint,
    setMeetingPoint,
    eventSubcategory,
    setEventSubcategory,
    eventDate,
    setEventDate,
    eventStartTime,
    setEventStartTime,
    eventEndTime,
    setEventEndTime,
    organizerName,
    setOrganizerName,
    entryConditions,
    setEntryConditions,
    bookingInstructions,
    setBookingInstructions,
    offerType,
    setOfferType,
    discountLabel,
    setDiscountLabel,
    originalPrice,
    setOriginalPrice,
    offerPrice,
    setOfferPrice,
    applicableSchedule,
    setApplicableSchedule,
    offerExpiryDate,
    setOfferExpiryDate,
    termsConditions,
    setTermsConditions,
    redemptionInstructions,
    setRedemptionInstructions,
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
    availableAmenities,
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
