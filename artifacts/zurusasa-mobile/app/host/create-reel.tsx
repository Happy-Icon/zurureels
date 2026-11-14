import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { PersonaVerificationModal } from '@/components/verification/PersonaVerificationModal';
import { HostLocationPickerModal } from '@/components/map/HostLocationPickerModal';
import { useCreateReelForm } from '@/hooks/useCreateReelForm';
import {
  MediaAndBasicsSection,
  PublishingFormatChooser,
} from '@/components/host/create-reel/MediaAndBasicsSection';
import { BookingAndRulesSection } from '@/components/host/create-reel/BookingAndRulesSection';
import {
  ArrivalAndAmenitiesSection,
  CreateReelBottomDock,
  VideoSourceModal,
} from '@/components/host/create-reel/ArrivalAmenitiesAndModals';
import { createReelStyles as styles } from '@/components/host/create-reel/createReelStyles';

export default function CreateReelScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const form = useCreateReelForm();

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 20 : insets.bottom + 16;

  const headerTitle = !form.hasSelectedFormat
    ? 'Create New Listing'
    : form.isAttachingToExistingExp
    ? 'Add Reel to Listing'
    : form.contentType === 'event'
    ? 'New Event'
    : form.contentType === 'special_offer'
    ? 'New Special Offer'
    : 'New Experience';

  const totalSteps = form.stepMeta.length;
  const progressPercent = Math.round(((form.currentStep + 1) / Math.max(1, totalSteps)) * 100);
  const nextStepMeta = form.stepMeta[form.currentStep + 1];

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
            onPress={form.handlePrevStep}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>

          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {headerTitle}
          </Text>

          {form.hasSelectedFormat ? (
            <View
              style={[
                styles.stepCounterPill,
                {
                  backgroundColor: isDark ? '#27272A' : '#F3F4F6',
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.stepCounterText, { color: colors.text }]}>
                {form.currentStep + 1} / {totalSteps}
              </Text>
            </View>
          ) : (
            <View style={{ width: 38 }} />
          )}
        </View>

        {/* 2. Wizard Stepper & Progress Track */}
        {form.hasSelectedFormat ? (
          <View style={[styles.stepperContainer, { borderBottomColor: colors.border }]}>
            <View
              style={[
                styles.stepProgressBarTrack,
                { backgroundColor: isDark ? '#27272A' : '#F3F4F6' },
              ]}
            >
              <View style={[styles.stepProgressBarFill, { width: `${progressPercent}%` }]} />
            </View>

            <View style={styles.stepperPillsRow}>
              {form.stepMeta.map((step, idx) => {
                const isActive = idx === form.currentStep;
                const isCompleted = idx < form.currentStep;
                return (
                  <Pressable
                    key={step.id}
                    onPress={() => form.goToStep(idx)}
                    style={[
                      styles.stepPill,
                      {
                        backgroundColor: isActive
                          ? isDark
                            ? '#3B2314'
                            : '#FFF8F5'
                          : isDark
                          ? '#27272A'
                          : '#F7F7F7',
                        borderColor: isActive ? '#F26522' : colors.border,
                      },
                    ]}
                  >
                    {isCompleted ? (
                      <Ionicons name="checkmark-circle" size={14} color="#F26522" />
                    ) : (
                      <View
                        style={[
                          styles.stepPillNum,
                          {
                            backgroundColor: isActive
                              ? '#F26522'
                              : isDark
                              ? '#3F3F46'
                              : '#E5E7EB',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.stepPillNumText,
                            { color: isActive ? '#FFFFFF' : colors.mutedForeground },
                          ]}
                        >
                          {idx + 1}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={[
                        styles.stepPillText,
                        {
                          color: isActive
                            ? '#F26522'
                            : isCompleted
                            ? colors.text
                            : colors.mutedForeground,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {step.shortLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Upload Progress Bar */}
        {form.uploading ? (
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${form.uploadProgress}%` }]} />
          </View>
        ) : null}

        <ScrollView
          ref={form.scrollViewRef}
          style={styles.fill}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: form.hasSelectedFormat ? 120 : 40,
            gap: 18,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets={true}
        >
          {!form.hasSelectedFormat ? (
            <PublishingFormatChooser form={form} colors={colors} isDark={isDark} />
          ) : (
            <>
              <MediaAndBasicsSection form={form} colors={colors} isDark={isDark} />
              <BookingAndRulesSection form={form} colors={colors} isDark={isDark} />
              <ArrivalAndAmenitiesSection form={form} colors={colors} isDark={isDark} />
            </>
          )}
        </ScrollView>

        {form.hasSelectedFormat ? (
          <CreateReelBottomDock
            uploading={form.uploading}
            uploadStatusText={form.uploadStatusText}
            uploadProgress={form.uploadProgress}
            bottomPad={bottomPad}
            colors={colors}
            isDark={isDark}
            currentStep={form.currentStep}
            isLastStep={form.isLastStep}
            backLabel={
              form.currentStep === 0
                ? form.openedWithDirectFormat
                  ? 'Back'
                  : 'Formats'
                : 'Back'
            }
            nextStepLabel={nextStepMeta?.shortLabel}
            onBackStep={form.handlePrevStep}
            onNextStep={form.handleNextStep}
            onPublish={form.handleSubmit}
            contentType={form.contentType}
            isAttachingToExistingExp={form.isAttachingToExistingExp}
          />
        ) : null}

        <VideoSourceModal
          visible={form.showVideoSourceModal}
          colors={colors}
          isDark={isDark}
          onClose={() => form.setShowVideoSourceModal(false)}
          onRecordLive={form.recordVideoLive}
          onPickGallery={form.pickVideo}
        />

        <PersonaVerificationModal
          visible={form.showVerificationModal}
          onClose={() => form.setShowVerificationModal(false)}
          onSuccess={() => form.handleSubmit()}
          title="Verification Required to List"
          subtitle="ZuruSasa requires hosts to verify their identity before publishing listings and reels."
        />

        <HostLocationPickerModal
          visible={form.showLocationPicker}
          initialLocationText={form.pinnedLocation?.city || form.location}
          initialCoordinates={
            form.pinnedLocation
              ? {
                  latitude: form.pinnedLocation.latitude,
                  longitude: form.pinnedLocation.longitude,
                }
              : null
          }
          initialPrecision={form.pinnedLocation?.precision ?? 'exact'}
          onClose={() => form.setShowLocationPicker(false)}
          onConfirm={(picked) => {
            form.setPinnedLocation(picked);
            form.setLocation(picked.city);
            form.setShowLocationPicker(false);
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
