import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { PersonaVerificationModal } from '@/components/verification/PersonaVerificationModal';
import { useCreateReelForm } from '@/hooks/useCreateReelForm';
import { MediaAndBasicsSection } from '@/components/host/create-reel/MediaAndBasicsSection';
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
            onPress={() => form.router.back()}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={10}
          >
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Create Listing & Reel</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Upload Progress Bar */}
        {form.uploading ? (
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${form.uploadProgress}%` }]} />
          </View>
        ) : null}

        <ScrollView
          ref={form.scrollViewRef}
          style={styles.fill}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140, gap: 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets={true}
        >
          <MediaAndBasicsSection form={form} colors={colors} isDark={isDark} />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <BookingAndRulesSection form={form} colors={colors} isDark={isDark} />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <ArrivalAndAmenitiesSection form={form} colors={colors} isDark={isDark} />
        </ScrollView>

        <CreateReelBottomDock
          uploading={form.uploading}
          uploadStatusText={form.uploadStatusText}
          uploadProgress={form.uploadProgress}
          bottomPad={bottomPad}
          colors={colors}
          onPublish={form.handleSubmit}
        />

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
      </View>
    </KeyboardAvoidingView>
  );
}
