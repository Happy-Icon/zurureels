import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { RatingStars } from '@/components/reviews/RatingStars';
import { reviewService } from '@/services/reviewService';
import { useAuth } from '@/context/AuthContext';

interface LeaveReviewModalProps {
  visible: boolean;
  bookingId: string;
  hostId: string;
  listingId?: string | null;
  listingTitle?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function LeaveReviewModal({
  visible,
  bookingId,
  hostId,
  listingId,
  listingTitle = 'Experience',
  onClose,
  onSuccess,
}: LeaveReviewModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Ratings State
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

  const handlePickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (!result.canceled && result.assets) {
      const uris = result.assets.map((a) => a.uri);
      setPhotos((prev) => [...prev, ...uris]);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!comment.trim()) {
      Alert.alert('Review text required', 'Please share a few words about your experience.');
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
        setStep(5); // Success step
      } else {
        Alert.alert('Error', 'Failed to submit review. Please try again.');
      }
    } catch (err) {
      console.warn('Submit review error:', err);
      Alert.alert('Error', 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setOverallRating(5);
    setCleanliness(5);
    setAccuracy(5);
    setCommunication(5);
    setCheckIn(5);
    setLocation(5);
    setValue(5);
    setComment('');
    setPhotos([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.modalSheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Review {listingTitle}</Text>
            <Pressable onPress={handleClose} hitSlop={10}>
              <Feather name="x" size={22} color="#222222" />
            </Pressable>
          </View>

          {/* Progress Indicator Bar */}
          {step < 5 ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` }]} />
            </View>
          ) : null}

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* STEP 1: OVERALL RATING */}
            {step === 1 ? (
              <View style={styles.stepBlock}>
                <Text style={styles.stepHeading}>How was your overall stay?</Text>
                <Text style={styles.stepSub}>Rate your overall experience with {listingTitle}</Text>

                <View style={styles.starWrapLarge}>
                  <RatingStars
                    rating={overallRating}
                    size={36}
                    interactive
                    onRatingChange={setOverallRating}
                  />
                  <Text style={styles.ratingNumberLarge}>{overallRating}.0 / 5.0</Text>
                </View>

                <Pressable
                  onPress={() => setStep(2)}
                  style={({ pressed }) => [styles.nextBtn, { opacity: pressed ? 0.88 : 1 }]}
                >
                  <Text style={styles.nextBtnText}>Next: Category Ratings</Text>
                  <Feather name="arrow-right" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : null}

            {/* STEP 2: CATEGORY RATINGS */}
            {step === 2 ? (
              <View style={styles.stepBlock}>
                <Text style={styles.stepHeading}>Category Ratings</Text>
                <Text style={styles.stepSub}>Help future guests by rating key details</Text>

                <View style={styles.categoryStack}>
                  <CategoryRatingRow label="Cleanliness" value={cleanliness} onChange={setCleanliness} />
                  <CategoryRatingRow label="Accuracy" value={accuracy} onChange={setAccuracy} />
                  <CategoryRatingRow label="Communication" value={communication} onChange={setCommunication} />
                  <CategoryRatingRow label="Check-in" value={checkIn} onChange={setCheckIn} />
                  <CategoryRatingRow label="Location" value={location} onChange={setLocation} />
                  <CategoryRatingRow label="Value" value={value} onChange={setValue} />
                </View>

                <View style={styles.dualBtnRow}>
                  <Pressable onPress={() => setStep(1)} style={styles.backStepBtn}>
                    <Text style={styles.backStepBtnText}>Back</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setStep(3)}
                    style={({ pressed }) => [styles.nextBtn, { flex: 1, opacity: pressed ? 0.88 : 1 }]}
                  >
                    <Text style={styles.nextBtnText}>Next: Write Review</Text>
                    <Feather name="arrow-right" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* STEP 3: WRITTEN REVIEW & PHOTOS */}
            {step === 3 ? (
              <View style={styles.stepBlock}>
                <Text style={styles.stepHeading}>Write your review</Text>
                <Text style={styles.stepSub}>Tell future travelers what you enjoyed most</Text>

                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Describe your stay, the location, amenities, and host communication..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  style={styles.commentInput}
                />

                <View style={styles.photoUploadBlock}>
                  <Text style={styles.photoBlockLabel}>Add Photos (Optional)</Text>
                  <Pressable onPress={handlePickPhotos} style={styles.addPhotoBtn}>
                    <Feather name="camera" size={18} color="#F26522" />
                    <Text style={styles.addPhotoText}>Upload Trip Photos</Text>
                  </Pressable>
                  {photos.length > 0 ? (
                    <Text style={styles.photoCountText}>{photos.length} photos attached</Text>
                  ) : null}
                </View>

                <View style={styles.dualBtnRow}>
                  <Pressable onPress={() => setStep(2)} style={styles.backStepBtn}>
                    <Text style={styles.backStepBtnText}>Back</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleSubmit}
                    disabled={submitting}
                    style={({ pressed }) => [styles.nextBtn, { flex: 1, opacity: pressed ? 0.88 : 1 }]}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Text style={styles.nextBtnText}>Submit Review</Text>
                        <Feather name="check-circle" size={16} color="#FFFFFF" />
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* STEP 5: SUCCESS STATE */}
            {step === 5 ? (
              <View style={styles.successBlock}>
                <View style={styles.successCircle}>
                  <Feather name="check" size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.successTitle}>Thank You!</Text>
                <Text style={styles.successSub}>
                  Your review has been published. You're helping build a trusted coastal community on ZuruSasa.
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
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CategoryRatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <View style={styles.catRow}>
      <Text style={styles.catLabelText}>{label}</Text>
      <RatingStars rating={value} size={22} interactive onRatingChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#EBEBEB',
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F26522',
    borderRadius: 2,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 10,
  },
  stepBlock: {
    gap: 16,
  },
  stepHeading: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  stepSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    marginTop: -8,
  },
  starWrapLarge: {
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
    paddingVertical: 20,
    backgroundColor: '#FFFBF8',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FCE3D6',
  },
  ratingNumberLarge: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  nextBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F26522',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  categoryStack: {
    gap: 12,
    marginVertical: 8,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F7F7F7',
  },
  catLabelText: {
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  dualBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  backStepBtn: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backStepBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#717171',
  },
  commentInput: {
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    padding: 14,
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: '#222222',
    textAlignVertical: 'top',
    minHeight: 110,
  },
  photoUploadBlock: {
    gap: 8,
  },
  photoBlockLabel: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFBF8',
    borderWidth: 1,
    borderColor: '#FCE3D6',
  },
  addPhotoText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
  photoCountText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#10B981',
  },
  successBlock: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 24,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  successSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  doneBtn: {
    height: 48,
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
