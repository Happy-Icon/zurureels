import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { GrowingInput } from '@/components/keyboard';
import type { useColors } from '@/hooks/useColors';
import type { CreateReelFormState } from '@/hooks/useCreateReelForm';
import { CATEGORIES, LOCATIONS } from './createReelConstants';
import { InlineVideoPreview } from './InlineVideoPreview';
import { createReelStyles as styles } from './createReelStyles';

export interface MediaAndBasicsSectionProps {
  form: CreateReelFormState;
  colors: ReturnType<typeof useColors>;
  isDark: boolean;
}

export function MediaAndBasicsSection({ form, colors, isDark }: MediaAndBasicsSectionProps) {
  return (
    <>
      {/* Step 1: Media Action Cards (Video & Cover) */}
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>1. Media Assets</Text>
        <View style={styles.mediaRow}>
          {form.videoUri ? (
            <InlineVideoPreview
              uri={form.videoUri}
              onChangeVideo={() => form.setShowVideoSourceModal(true)}
            />
          ) : (
            <Pressable
              onPress={() => form.setShowVideoSourceModal(true)}
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
            onPress={form.pickThumbnail}
            style={({ pressed }) => [
              styles.mediaActionCard,
              { backgroundColor: isDark ? '#27272A' : '#F7F7F7', borderColor: colors.border },
              form.thumbnailUri ? styles.mediaActionCardSelected : null,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            {form.thumbnailUri ? (
              <View style={styles.thumbPreviewWrap}>
                <Image source={{ uri: form.thumbnailUri }} style={styles.thumbPreviewImage} contentFit="cover" />
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
            const selected = form.category === c.value;
            return (
              <Pressable
                key={c.value}
                onPress={() => form.setCategory(c.value)}
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
          value={form.title}
          onChangeText={form.setTitle}
          style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
        />
      </View>

      {/* Location Selector */}
      <View style={styles.formGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Location *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {LOCATIONS.map((loc) => {
            const sel = form.location === loc;
            return (
              <Pressable
                key={loc}
                onPress={() => form.setLocation(loc)}
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
            value={form.price}
            onChangeText={form.setPrice}
            style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
          />
        </View>

        <View style={[styles.formGroup, { width: 130 }]}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Price Unit</Text>
          <TextInput
            placeholder="night / trip"
            placeholderTextColor={colors.mutedForeground}
            value={form.priceUnit}
            onChangeText={form.setPriceUnit}
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
          value={form.description}
          onChangeText={form.setDescription}
          minHeight={80}
          maxHeight={160}
          style={[styles.textInput, styles.textAreaInput, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text }]}
        />
      </View>
    </>
  );
}
