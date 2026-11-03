import React from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { useColors } from '@/hooks/useColors';
import type { CreateReelFormState } from '@/hooks/useCreateReelForm';
import { POPULAR_AMENITIES } from './createReelConstants';
import { createReelStyles as styles } from './createReelStyles';

export interface ArrivalAndAmenitiesSectionProps {
  form: CreateReelFormState;
  colors: ReturnType<typeof useColors>;
  isDark: boolean;
}

export function ArrivalAndAmenitiesSection({ form, colors, isDark }: ArrivalAndAmenitiesSectionProps) {
  return (
    <>
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
            value={form.checkInMethod}
            onChangeText={form.setCheckInMethod}
            style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
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
              style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
            />
          </View>

          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Wi-Fi Password</Text>
            <TextInput
              placeholder="e.g. SunsetVilla2026"
              placeholderTextColor={colors.mutedForeground}
              value={form.wifiPassword}
              onChangeText={form.setWifiPassword}
              style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
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
            style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Directions & Parking Info</Text>
          <TextInput
            placeholder="e.g. Behind Diani Reef Resort, dedicated shaded parking slot #4"
            placeholderTextColor={colors.mutedForeground}
            value={form.directions}
            onChangeText={form.setDirections}
            style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Key Return & Checkout Instructions</Text>
          <TextInput
            placeholder="e.g. Leave keys on table, lock gate, switch off AC"
            placeholderTextColor={colors.mutedForeground}
            value={form.keyReturnInstructions}
            onChangeText={form.setKeyReturnInstructions}
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
            const selected = form.selectedAmenities.includes(am);
            return (
              <Pressable
                key={am}
                onPress={() => form.toggleAmenity(am)}
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
    </>
  );
}

export interface CreateReelBottomDockProps {
  uploading: boolean;
  uploadStatusText: string;
  uploadProgress: number;
  bottomPad: number;
  colors: ReturnType<typeof useColors>;
  onPublish: () => void;
}

export function CreateReelBottomDock({
  uploading,
  uploadStatusText,
  uploadProgress,
  bottomPad,
  colors,
  onPublish,
}: CreateReelBottomDockProps) {
  return (
    <View style={[styles.bottomDock, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomPad }]}>
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
          <Text style={styles.publishBtnText}>Publish Experience & Reel</Text>
        )}
      </Pressable>
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
          <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>Record a live video or choose an existing video file</Text>

          <Pressable
            style={[styles.modalOptionBtn, { borderColor: colors.border }]}
            onPress={() => {
              onClose();
              onRecordLive();
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
              onClose();
              onPickGallery();
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
            onPress={onClose}
          >
            <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
