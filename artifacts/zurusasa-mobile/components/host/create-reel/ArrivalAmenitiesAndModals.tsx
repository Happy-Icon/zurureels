import React from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { useColors } from '@/hooks/useColors';
import type { CreateReelFormState } from '@/hooks/useCreateReelForm';
import type { PublishingContentType } from '@/constants/taxonomy';
import { createReelStyles as styles } from './createReelStyles';

export interface ArrivalAndAmenitiesSectionProps {
  form: CreateReelFormState;
  colors: ReturnType<typeof useColors>;
  isDark: boolean;
}

export function ArrivalAndAmenitiesSection({ form, colors, isDark }: ArrivalAndAmenitiesSectionProps) {
  if (
    form.contentType !== 'experience' ||
    form.isAttachingToExistingExp ||
    !form.isLastStep
  ) {
    return null;
  }

  const isAccommodation = form.category === 'accommodation';
  const inputStyle = [
    styles.textInput,
    { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text },
  ];

  const arrivalSummary = isAccommodation
    ? `${form.checkInMethod || 'Self check-in'} · Wi-Fi, codes & checkout`
    : form.meetingPoint.trim() || 'Optional meeting point, pickup & parking info';

  return (
    <View style={styles.sectionBlock}>
      {/* Collapsible Arrival / Meeting Point Accordion */}
      <View style={[styles.accordionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          onPress={() => form.setShowArrivalDetails(!form.showArrivalDetails)}
          style={({ pressed }) => [styles.accordionHeader, { opacity: pressed ? 0.85 : 1 }]}
        >
          <View
            style={[
              styles.accordionIconBox,
              { backgroundColor: isDark ? '#27272A' : '#FFF8F5' },
            ]}
          >
            <Ionicons
              name={isAccommodation ? 'key-outline' : 'navigate-outline'}
              size={20}
              color="#F26522"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.accordionTitle, { color: colors.text }]}>
              {isAccommodation
                ? 'Arrival & Checkout Info (Optional)'
                : 'Meeting Point & Directions (Optional)'}
            </Text>
            <Text style={[styles.accordionSummary, { color: colors.mutedForeground }]} numberOfLines={1}>
              {arrivalSummary}
            </Text>
          </View>
          <Ionicons
            name={form.showArrivalDetails ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.mutedForeground}
          />
        </Pressable>

        {form.showArrivalDetails ? (
          <View style={[styles.accordionBody, { borderTopColor: colors.border }]}>
            {isAccommodation ? (
              <>
                <Text style={[styles.sectionSubText, { color: colors.mutedForeground }]}>
                  Sensitive details (Wi-Fi password, access codes) are only revealed after a booking is confirmed.
                </Text>

                <View style={styles.formGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Check-in Method</Text>
                  <TextInput
                    placeholder="e.g. Self check-in (Smart Lock), Host greets in person"
                    placeholderTextColor={colors.mutedForeground}
                    value={form.checkInMethod}
                    onChangeText={form.setCheckInMethod}
                    style={inputStyle}
                  />
                </View>

                <View style={styles.rowTwoCol}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Wi-Fi Network Name</Text>
                    <TextInput
                      placeholder="e.g. ZuruSunset_Guest"
                      placeholderTextColor={colors.mutedForeground}
                      value={form.wifiSsid}
                      onChangeText={form.setWifiSsid}
                      style={inputStyle}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Wi-Fi Password</Text>
                    <TextInput
                      placeholder="e.g. SunsetVilla2026"
                      placeholderTextColor={colors.mutedForeground}
                      value={form.wifiPassword}
                      onChangeText={form.setWifiPassword}
                      style={inputStyle}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Access / Gate Code Instructions</Text>
                  <TextInput
                    placeholder="e.g. Gate code #4492, smart lock code sent on arrival"
                    placeholderTextColor={colors.mutedForeground}
                    value={form.accessInstructions}
                    onChangeText={form.setAccessInstructions}
                    style={inputStyle}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Directions & Parking Info</Text>
                  <TextInput
                    placeholder="e.g. Behind Diani Reef Resort, shaded parking slot #4"
                    placeholderTextColor={colors.mutedForeground}
                    value={form.directions}
                    onChangeText={form.setDirections}
                    style={inputStyle}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Parking Spot Details</Text>
                  <TextInput
                    placeholder="e.g. Private driveway fits 2 cars inside compound"
                    placeholderTextColor={colors.mutedForeground}
                    value={form.parkingInfo}
                    onChangeText={form.setParkingInfo}
                    style={inputStyle}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Key Return & Checkout</Text>
                  <TextInput
                    placeholder="e.g. Leave keys on table, lock gate, switch off AC"
                    placeholderTextColor={colors.mutedForeground}
                    value={form.keyReturnInstructions}
                    onChangeText={form.setKeyReturnInstructions}
                    style={inputStyle}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Trash & Cleaning Notes</Text>
                  <TextInput
                    placeholder="e.g. Dispose trash in bins outside gate; wash used cookware"
                    placeholderTextColor={colors.mutedForeground}
                    value={form.cleaningExpectations}
                    onChangeText={form.setCleaningExpectations}
                    style={inputStyle}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.formGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Meeting Point / Pickup Info</Text>
                  <TextInput
                    placeholder="e.g. Meet at Diani Marine jetty 15 mins before departure"
                    placeholderTextColor={colors.mutedForeground}
                    value={form.meetingPoint}
                    onChangeText={form.setMeetingPoint}
                    style={inputStyle}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Directions & Parking Info</Text>
                  <TextInput
                    placeholder="e.g. Opposite Baharini Plaza, free patron parking at gate"
                    placeholderTextColor={colors.mutedForeground}
                    value={form.directions}
                    onChangeText={form.setDirections}
                    style={inputStyle}
                  />
                </View>
              </>
            )}
          </View>
        ) : null}
      </View>

      {/* Category-Aware Amenities & Highlights */}
      <View style={[styles.sectionBlock, { marginTop: 4 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>
            {isAccommodation ? 'Amenities & Highlights' : "What's Offered / Highlights"}
          </Text>
          <View
            style={[
              styles.badgePill,
              { backgroundColor: isDark ? '#3B2314' : '#FFF8F5' },
            ]}
          >
            <Text style={[styles.badgePillText, { color: '#F26522' }]}>
              {form.selectedAmenities.length} selected
            </Text>
          </View>
        </View>

        <View style={styles.amenitiesWrap}>
          {form.availableAmenities.map((am) => {
            const selected = form.selectedAmenities.includes(am);
            return (
              <Pressable
                key={am}
                onPress={() => form.toggleAmenity(am)}
                style={[
                  styles.amenityChip,
                  {
                    backgroundColor: selected
                      ? isDark
                        ? '#3B2314'
                        : '#FFF8F5'
                      : isDark
                      ? '#27272A'
                      : '#F9FAFB',
                    borderColor: selected ? '#F26522' : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={selected ? 'checkmark-outline' : 'add-outline'}
                  size={14}
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
    </View>
  );
}

export interface CreateReelBottomDockProps {
  uploading: boolean;
  uploadStatusText: string;
  uploadProgress: number;
  bottomPad: number;
  colors: ReturnType<typeof useColors>;
  isDark: boolean;
  currentStep: number;
  isLastStep: boolean;
  backLabel?: string;
  nextStepLabel?: string;
  onBackStep: () => void;
  onNextStep: () => void;
  onPublish: () => void;
  contentType?: PublishingContentType;
  isAttachingToExistingExp?: boolean;
}

const PUBLISH_CTA_LABELS: Record<PublishingContentType, string> = {
  experience: 'Publish Experience & Reel',
  event: 'Publish Event & Reel',
  special_offer: 'Publish Special Offer & Reel',
};

export function CreateReelBottomDock({
  uploading,
  uploadStatusText,
  uploadProgress,
  bottomPad,
  colors,
  isDark,
  currentStep,
  isLastStep,
  backLabel,
  nextStepLabel,
  onBackStep,
  onNextStep,
  onPublish,
  contentType = 'experience',
  isAttachingToExistingExp = false,
}: CreateReelBottomDockProps) {
  const publishLabel = isAttachingToExistingExp
    ? 'Publish Reel to Listing'
    : PUBLISH_CTA_LABELS[contentType] ?? 'Publish Experience & Reel';

  const resolvedBackLabel = backLabel ?? (currentStep === 0 ? 'Formats' : 'Back');

  return (
    <View
      style={[
        styles.bottomDock,
        { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomPad },
      ]}
    >
      <View style={styles.bottomDockRow}>
        <Pressable
          disabled={uploading}
          onPress={onBackStep}
          style={({ pressed }) => [
            styles.backStepBtn,
            {
              borderColor: colors.border,
              backgroundColor: isDark ? '#27272A' : '#F9FAFB',
              opacity: pressed || uploading ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name="arrow-back" size={16} color={colors.text} />
          <Text style={[styles.backStepBtnText, { color: colors.text }]}>
            {resolvedBackLabel}
          </Text>
        </Pressable>

        {!isLastStep ? (
          <Pressable
            onPress={onNextStep}
            style={({ pressed }) => [
              styles.continueBtn,
              { opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <Text style={styles.continueBtnText}>
              Continue{nextStepLabel ? ` · ${nextStepLabel}` : ''}
            </Text>
            <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
          </Pressable>
        ) : (
          <Pressable
            disabled={uploading}
            onPress={onPublish}
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
              <Text style={styles.publishBtnText}>{publishLabel}</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

export interface VideoSourceModalProps {
  visible: boolean;
  colors: ReturnType<typeof useColors>;
  isDark: boolean;
  onClose: () => void;
  onRecordLive: () => void;
  onPickGallery: () => void;
}

export function VideoSourceModal({
  visible,
  colors,
  isDark,
  onClose,
  onRecordLive,
  onPickGallery,
}: VideoSourceModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]} onStartShouldSetResponder={() => true}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Choose Reel Source</Text>
          <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
            Record a live video or choose an existing video file
          </Text>

          <Pressable
            style={[styles.modalOptionBtn, { borderColor: colors.border }]}
            onPress={() => {
              onClose();
              onRecordLive();
            }}
          >
            <View style={[styles.modalIconWrap, { backgroundColor: 'rgba(242, 101, 34, 0.12)' }]}>
              <Ionicons name="videocam-outline" size={22} color="#F26522" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalOptionTitle, { color: colors.text }]}>Record Reel (Live Camera)</Text>
              <Text style={[styles.modalOptionSub, { color: colors.mutedForeground }]}>
                Record up to 60 seconds using camera
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
          </Pressable>

          <Pressable
            style={[styles.modalOptionBtn, { borderColor: colors.border }]}
            onPress={() => {
              onClose();
              onPickGallery();
            }}
          >
            <View style={[styles.modalIconWrap, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
              <Ionicons name="folder-outline" size={22} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalOptionTitle, { color: colors.text }]}>Choose from Gallery</Text>
              <Text style={[styles.modalOptionSub, { color: colors.mutedForeground }]}>
                Select an existing MP4 video from device
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
          </Pressable>

          <Pressable style={styles.modalCancelBtn} onPress={onClose}>
            <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
