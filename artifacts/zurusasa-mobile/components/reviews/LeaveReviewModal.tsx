import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { RatingStars } from '@/components/reviews/RatingStars';
import { reviewService } from '@/services/reviewService';
import { useAuth } from '@/context/AuthContext';
import { uploadToCloudinaryMobile } from '@/lib/cloudinaryUpload';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = Math.min(SCREEN_HEIGHT * 0.88, 760);

interface LeaveReviewModalProps {
  visible: boolean;
  bookingId: string;
  hostId: string;
  listingId?: string | null;
  listingTitle?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const RATING_DESCRIPTIONS: Record<number, string> = {
  5: 'Exceptional (5.0)',
  4: 'Very Good (4.0)',
  3: 'Average (3.0)',
  2: 'Below Average (2.0)',
  1: 'Poor (1.0)',
};

export function LeaveReviewModal({
  visible,
  bookingId,
  hostId,
  listingId,
  listingTitle = 'Coastal Experience',
  onClose,
  onSuccess,
}: LeaveReviewModalProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Overall & Category Ratings
  const [overallRating, setOverallRating] = useState<number>(5);
  const [cleanliness, setCleanliness] = useState<number>(5);
  const [accuracy, setAccuracy] = useState<number>(5);
  const [communication, setCommunication] = useState<number>(5);
  const [checkIn, setCheckIn] = useState<number>(5);
  const [location, setLocation] = useState<number>(5);
  const [value, setValue] = useState<number>(5);

  // Comment & Photos
  const [comment, setComment] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState<boolean>(false);
  const [certifiedGenuine, setCertifiedGenuine] = useState<boolean>(false);

  const handlePickPhotos = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingPhotos(true);
        const newUris: string[] = [];
        for (const asset of result.assets) {
          try {
            const uploadRes = await uploadToCloudinaryMobile(asset.uri, {
              resourceType: 'image',
              folder: 'reviews',
            });
            if (uploadRes?.secure_url) {
              newUris.push(uploadRes.secure_url);
            } else {
              newUris.push(asset.uri);
            }
          } catch {
            newUris.push(asset.uri);
          }
        }
        setPhotos((prev) => [...prev, ...newUris]);
      }
    } catch (e) {
      console.warn('Photo selection error:', e);
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to submit a review.');
      return;
    }
    if (!comment.trim()) {
      Alert.alert('Review Text Required', 'Please share a few words about your experience in the review field.');
      return;
    }
    if (!certifiedGenuine) {
      Alert.alert('Verification Required', 'Please check the box certifying that this review is based on your genuine stay and experience.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await reviewService.createReview({
        bookingId,
        reviewerId: user.id,
        revieweeId: hostId,
        listingId: listingId ?? null,
        rating: overallRating,
        cleanliness,
        communication,
        accuracy,
        location,
        value,
        checkIn,
        comment: comment.trim(),
        photos,
        isHostReview: false,
      });

      if (res) {
        setIsSuccess(true);
      } else {
        Alert.alert('Error', 'Failed to submit review. Please try again.');
      }
    } catch (err) {
      console.warn('Submit review error:', err);
      Alert.alert('Error', 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setIsSuccess(false);
    setOverallRating(5);
    setCleanliness(5);
    setAccuracy(5);
    setCommunication(5);
    setCheckIn(5);
    setLocation(5);
    setValue(5);
    setComment('');
    setPhotos([]);
    setCertifiedGenuine(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdropPressable} onPress={handleClose} />

        <View
          style={[
            styles.modalSheet,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {/* Top Drag Handle Bar */}
          <View style={styles.dragHandleArea}>
            <View style={[styles.dragHandle, { backgroundColor: isDark ? '#3F3F46' : '#D1D5DB' }]} />
          </View>

          {/* Sheet Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Write a Review</Text>
              <Text style={[styles.sheetSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                {listingTitle}
              </Text>
            </View>
            <Pressable onPress={handleClose} style={styles.circleCloseBtn} hitSlop={10}>
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>

          {/* Success Screen */}
          {isSuccess ? (
            <View style={styles.successBlock}>
              <View style={styles.successCircle}>
                <Feather name="check" size={36} color="#FFFFFF" />
              </View>
              <Text style={[styles.successTitle, { color: colors.text }]}>Review Published!</Text>
              <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
                Thank you for reviewing {listingTitle}. Your feedback helps other coastal travelers make great choices and helps hosts improve.
              </Text>
              <Pressable
                onPress={() => {
                  handleClose();
                  onSuccess();
                }}
                style={styles.doneBtn}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            /* Main All-In-One Review Form */
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1 }}
            >
              <ScrollView
                contentContainerStyle={[
                  styles.scrollContent,
                  { paddingBottom: Math.max(insets.bottom, 24) + 20 },
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* 1. OVERALL RATING */}
                <View style={[styles.cardSection, { backgroundColor: isDark ? '#1C1C1E' : '#F9FAFB', borderColor: colors.border }]}>
                  <Text style={[styles.sectionHeading, { color: colors.text }]}>How was your overall stay?</Text>
                  <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
                    Tap a star to set your overall rating
                  </Text>

                  <View style={styles.starRowWrap}>
                    <RatingStars
                      rating={overallRating}
                      size={36}
                      interactive
                      onRatingChange={setOverallRating}
                    />
                    <View style={styles.ratingBadgePill}>
                      <Text style={styles.ratingBadgeText}>
                        {RATING_DESCRIPTIONS[overallRating] || `${overallRating}.0`}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 2. WRITTEN REVIEW (PROMINENT INPUT FIELD) */}
                <View style={styles.inputSection}>
                  <View style={styles.inputLabelRow}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Your Review</Text>
                    <Text style={[styles.requiredBadge, { color: '#F26522' }]}>* Required</Text>
                  </View>
                  <Text style={[styles.sectionHint, { color: colors.mutedForeground, marginBottom: 8 }]}>
                    Tell future travelers what you loved about the stay, location, amenities, and host hospitality.
                  </Text>

                  <TextInput
                    value={comment}
                    onChangeText={setComment}
                    placeholder="Describe your stay, the host, cleanliness, comfort, view, and any helpful tips for future guests..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                    style={[
                      styles.commentTextInput,
                      {
                        backgroundColor: isDark ? '#18181B' : '#FFFFFF',
                        borderColor: comment.trim() ? '#F26522' : colors.border,
                        color: colors.text,
                      },
                    ]}
                  />
                  <Text style={[styles.charCountText, { color: colors.mutedForeground }]}>
                    {comment.trim().length} characters
                  </Text>
                </View>

                {/* 3. CATEGORY RATINGS */}
                <View style={[styles.cardSection, { backgroundColor: isDark ? '#1C1C1E' : '#F9FAFB', borderColor: colors.border }]}>
                  <Text style={[styles.sectionHeading, { color: colors.text }]}>Detailed Ratings</Text>
                  <Text style={[styles.sectionHint, { color: colors.mutedForeground, marginBottom: 12 }]}>
                    Help future guests by rating specific highlights
                  </Text>

                  <View style={styles.categoryStack}>
                    <CategoryRatingRow label="Cleanliness" value={cleanliness} onChange={setCleanliness} textColor={colors.text} />
                    <CategoryRatingRow label="Accuracy" value={accuracy} onChange={setAccuracy} textColor={colors.text} />
                    <CategoryRatingRow label="Communication" value={communication} onChange={setCommunication} textColor={colors.text} />
                    <CategoryRatingRow label="Check-in" value={checkIn} onChange={setCheckIn} textColor={colors.text} />
                    <CategoryRatingRow label="Location" value={location} onChange={setLocation} textColor={colors.text} />
                    <CategoryRatingRow label="Value for Money" value={value} onChange={setValue} textColor={colors.text} />
                  </View>
                </View>

                {/* 4. PHOTO ATTACHMENTS */}
                <View style={styles.photosSection}>
                  <Text style={[styles.sectionHeading, { color: colors.text }]}>Photos (Optional)</Text>
                  <Text style={[styles.sectionHint, { color: colors.mutedForeground, marginBottom: 10 }]}>
                    Upload real photos from your trip
                  </Text>

                  {photos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoThumbList}>
                      {photos.map((uri, index) => (
                        <View key={`${uri}-${index}`} style={styles.photoThumbWrapper}>
                          <Image source={{ uri }} style={styles.photoThumb} contentFit="cover" />
                          <Pressable onPress={() => handleRemovePhoto(index)} style={styles.removePhotoBtn} hitSlop={6}>
                            <Feather name="x" size={12} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  <Pressable
                    onPress={handlePickPhotos}
                    disabled={uploadingPhotos}
                    style={[
                      styles.addPhotoBtn,
                      {
                        backgroundColor: isDark ? '#2A1810' : '#FFFBF8',
                        borderColor: isDark ? '#5C2D16' : '#FCE3D6',
                      },
                    ]}
                  >
                    {uploadingPhotos ? (
                      <ActivityIndicator size="small" color="#F26522" />
                    ) : (
                      <>
                        <Feather name="camera" size={18} color="#F26522" />
                        <Text style={styles.addPhotoBtnText}>
                          {photos.length > 0 ? 'Add more photos' : 'Attach Trip Photos'}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>

                {/* 5. ANTI-FRAUD & GENUINE REVIEW CERTIFICATION */}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: certifiedGenuine }}
                  accessibilityLabel="Certify genuine stay and compliance with review integrity policy"
                  onPress={() => setCertifiedGenuine((prev) => !prev)}
                  style={({ pressed }) => [
                    styles.certifyCard,
                    {
                      backgroundColor: isDark ? '#1C1C1E' : '#F9FAFB',
                      borderColor: certifiedGenuine ? '#F26522' : colors.border,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View
                    style={[
                      styles.certifyCheckbox,
                      certifiedGenuine && styles.certifyCheckboxChecked,
                      { borderColor: certifiedGenuine ? '#F26522' : colors.border },
                    ]}
                  >
                    {certifiedGenuine && <Feather name="check" size={13} color="#FFFFFF" />}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.certifyTitle, { color: colors.text }]}>
                        Verified Stay Certification
                      </Text>
                      <View style={styles.verifiedPolicyBadge}>
                        <Text style={styles.verifiedPolicyBadgeText}>Anti-Fraud</Text>
                      </View>
                    </View>
                    <Text style={[styles.certifyBody, { color: colors.mutedForeground }]}>
                      I certify that this review reflects my genuine personal experience at this listing. I have not received payment, discounts, or incentives to post this review, and all uploaded photos are my original copyrighted media.
                    </Text>
                  </View>
                </Pressable>

                {/* 6. SUBMIT BUTTON */}
                <Pressable
                  onPress={handleSubmit}
                  disabled={submitting || !certifiedGenuine}
                  accessibilityRole="button"
                  accessibilityLabel="Submit Verified Review"
                  style={({ pressed }) => [
                    styles.submitBtn,
                    (!certifiedGenuine || submitting) && { opacity: 0.5 },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  {submitting ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text style={styles.submitBtnText}>Submitting Verified Review...</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.submitBtnText}>Submit Verified Review</Text>
                      <Feather name="shield" size={18} color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>
              </ScrollView>
            </KeyboardAvoidingView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function CategoryRatingRow({
  label,
  value,
  onChange,
  textColor,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  textColor?: string;
}) {
  return (
    <View style={styles.catRow}>
      <Text style={[styles.catLabelText, textColor ? { color: textColor } : null]}>{label}</Text>
      <RatingStars rating={value} size={22} interactive onRatingChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  backdropPressable: {
    ...StyleSheet.absoluteFill,
  },
  modalSheet: {
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 24,
  },
  dragHandleArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
  },
  sheetSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    marginTop: 2,
  },
  circleCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 18,
  },
  cardSection: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  sectionHeading: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  sectionHint: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    marginTop: 2,
  },
  starRowWrap: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingBadgePill: {
    backgroundColor: '#FFF5EF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FCE3D6',
  },
  ratingBadgeText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  inputSection: {
    gap: 6,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  requiredBadge: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
  },
  commentTextInput: {
    minHeight: 120,
    maxHeight: 220,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 22,
  },
  charCountText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'right',
    marginTop: 4,
  },
  categoryStack: {
    gap: 12,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catLabelText: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
  },
  photosSection: {
    gap: 6,
  },
  photoThumbList: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 8,
  },
  photoThumbWrapper: {
    width: 76,
    height: 76,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addPhotoBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  certifyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  certifyCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  certifyCheckboxChecked: {
    backgroundColor: '#F26522',
  },
  certifyTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  verifiedPolicyBadge: {
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  verifiedPolicyBadgeText: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: '#03543F',
  },
  certifyBody: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'DMSans_400Regular',
  },
  submitBtn: {
    backgroundColor: '#F26522',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#F26522',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  submitBtnText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  successBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
  },
  successSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  doneBtn: {
    backgroundColor: '#F26522',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
    marginTop: 16,
  },
  doneBtnText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
});
