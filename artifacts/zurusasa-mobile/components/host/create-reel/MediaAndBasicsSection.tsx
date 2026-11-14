import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { GrowingInput } from '@/components/keyboard';
import type { useColors } from '@/hooks/useColors';
import type { CreateReelFormState } from '@/hooks/useCreateReelForm';
import { getPrimaryCategoryMeta } from '@/constants/taxonomy';
import {
  EVENT_SUBCATEGORIES,
  LOCATIONS,
  OFFER_TYPES,
  PRIMARY_EXPERIENCE_CATEGORIES,
  PUBLISHING_FORMATS,
} from './createReelConstants';
import { InlineVideoPreview } from './InlineVideoPreview';
import { createReelStyles as styles } from './createReelStyles';

export interface MediaAndBasicsSectionProps {
  form: CreateReelFormState;
  colors: ReturnType<typeof useColors>;
  isDark: boolean;
}

const STAY_PRICE_UNITS = ['night', 'stay', 'week'] as const;
const EXPERIENCE_PRICE_UNITS = ['person', 'group', 'table', 'session'] as const;
const OFFER_BADGE_PRESETS = ['20% OFF', '2-for-1', 'Happy Hour', 'Flash Deal'] as const;

export function PublishingFormatChooser({ form, colors, isDark }: MediaAndBasicsSectionProps) {
  return (
    <View style={{ gap: 18 }}>
      <View style={styles.chooserHeroWrap}>
        <Text style={styles.chooserEyebrow}>STEP 1 · PICK A FORMAT</Text>
        <Text style={[styles.chooserHeroTitle, { color: colors.text }]}>
          What would you like to publish?
        </Text>
        <Text style={[styles.chooserHeroSub, { color: colors.mutedForeground }]}>
          Select one option below to open its guided step-by-step creation workspace.
        </Text>
      </View>

      <View style={styles.chooserCardsStack}>
        {PUBLISHING_FORMATS.map((fmt) => {
          const isCurrent = form.contentType === fmt.id;
          return (
            <Pressable
              key={fmt.id}
              testID={`publish-format-${fmt.id}`}
              onPress={() => form.selectPublishingFormat(fmt.id)}
              style={({ pressed }) => [
                styles.chooserCard,
                {
                  backgroundColor: isCurrent
                    ? isDark
                      ? '#272220'
                      : '#FFFFFF'
                    : colors.card,
                  borderColor: pressed || isCurrent ? '#F26522' : colors.border,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
            >
              <View
                style={[
                  styles.chooserIconBox,
                  {
                    backgroundColor: isCurrent
                      ? isDark
                        ? '#3B2314'
                        : '#FFF8F5'
                      : isDark
                      ? '#27272A'
                      : '#F7F7F7',
                  },
                ]}
              >
                <Ionicons name={fmt.icon} size={25} color={isCurrent ? '#F26522' : colors.text} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.chooserCardTitle, { color: colors.text }]}>{fmt.title}</Text>
                <Text style={[styles.chooserCardSub, { color: colors.mutedForeground }]}>
                  {fmt.subtitle}
                </Text>
              </View>

              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: isDark ? '#27272A' : '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.text} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.infoCalloutCard,
          {
            backgroundColor: isDark ? '#27272A' : '#F7F7F7',
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons name="sparkles-outline" size={18} color="#F26522" />
        <Text style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 12.5, lineHeight: 18, color: colors.text }}>
          Every format publishes a high-converting Reel to ZuruFlow and keeps Events and Special Offers linked cleanly to your establishments.
        </Text>
      </View>
    </View>
  );
}

function EstablishmentLinkBar({ form, colors, isDark }: MediaAndBasicsSectionProps) {
  if (form.hostEstablishments.length === 0) return null;

  return (
    <View style={[styles.formGroup, { marginTop: 4 }]}>
      <Text style={[styles.inputLabel, { color: colors.text }]}>
        {form.contentType === 'experience'
          ? 'Establishment Record'
          : form.contentType === 'event'
          ? 'Host Establishment (Optional — or Standalone Venue)'
          : 'Link Special Offer to Establishment'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Pressable
          onPress={() => form.setLinkedExperienceId('new')}
          style={[
            styles.estChip,
            {
              backgroundColor:
                form.linkedExperienceId === 'new'
                  ? isDark
                    ? '#3B2314'
                    : '#FFF8F5'
                  : isDark
                  ? '#27272A'
                  : '#F7F7F7',
              borderColor: form.linkedExperienceId === 'new' ? '#F26522' : colors.border,
            },
          ]}
        >
          <Ionicons
            name="add-circle-outline"
            size={16}
            color={form.linkedExperienceId === 'new' ? '#F26522' : colors.mutedForeground}
          />
          <Text
            style={[
              styles.estChipText,
              { color: form.linkedExperienceId === 'new' ? '#F26522' : colors.text },
            ]}
          >
            {form.contentType === 'experience'
              ? 'New Establishment'
              : form.contentType === 'event'
              ? 'Independent Venue'
              : 'Standalone Offer'}
          </Text>
        </Pressable>

        {form.hostEstablishments.map((est) => {
          const isSelected = form.linkedExperienceId === est.id;
          const estMeta = getPrimaryCategoryMeta(est.category);
          return (
            <Pressable
              key={est.id}
              onPress={() => form.setLinkedExperienceId(est.id)}
              style={[
                styles.estChip,
                {
                  backgroundColor: isSelected
                    ? isDark
                      ? '#3B2314'
                      : '#FFF8F5'
                    : isDark
                    ? '#27272A'
                    : '#F7F7F7',
                  borderColor: isSelected ? '#F26522' : colors.border,
                },
              ]}
            >
              <Ionicons
                name={estMeta.icon}
                size={15}
                color={isSelected ? '#F26522' : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.estChipText,
                  { color: isSelected ? '#F26522' : colors.text },
                ]}
                numberOfLines={1}
              >
                {est.title || est.entity_name || 'Saved Establishment'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {form.selectedEstablishment ? (
        <View
          style={[
            styles.infoCalloutCard,
            {
              marginTop: 6,
              backgroundColor: isDark ? '#3B2314' : '#FFF8F5',
              borderColor: isDark ? '#7C2D12' : '#FED7AA',
            },
          ]}
        >
          <Ionicons name="link-outline" size={18} color="#F26522" />
          <Text style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 12.5, lineHeight: 17, color: colors.text }}>
            {form.contentType === 'event' ? (
              <>
                This Event uploads its own promo Reel video to ZuruFlow while linking attendees directly to{' '}
                <Text style={{ fontFamily: 'DMSans_700Bold' }}>
                  {form.selectedEstablishment.title}
                </Text>
                .
              </>
            ) : form.contentType === 'special_offer' ? (
              <>
                This Special Offer uploads its own promo Reel video to ZuruFlow while linking guests directly to{' '}
                <Text style={{ fontFamily: 'DMSans_700Bold' }}>
                  {form.selectedEstablishment.title}
                </Text>
                .
              </>
            ) : (
              <>
                Your new Reel will attach directly to{' '}
                <Text style={{ fontFamily: 'DMSans_700Bold' }}>
                  {form.selectedEstablishment.title}
                </Text>{' '}
                without duplicating your establishment profile. Tap Continue to upload your video.
              </>
            )}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function MediaUploadRow({ form, colors, isDark }: MediaAndBasicsSectionProps) {
  return (
    <View style={styles.formGroup}>
      <Text style={[styles.inputLabel, { color: colors.text }]}>Reel Video & Cover Image *</Text>
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
              <Ionicons name="videocam-outline" size={20} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.mediaCardTitle, { color: colors.text }]}>Select Reel Video</Text>
            <Text style={[styles.mediaCardSub, { color: colors.mutedForeground }]}>
              Record or choose gallery
            </Text>
          </Pressable>
        )}

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
              <Image
                source={{ uri: form.thumbnailUri }}
                style={styles.thumbPreviewImage}
                contentFit="cover"
              />
              <View style={styles.thumbChangeOverlay}>
                <Ionicons name="camera-outline" size={14} color="#FFFFFF" />
                <Text style={styles.thumbChangeText}>Change</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={[styles.mediaBadgeCircle, { backgroundColor: colors.card }]}>
                <Ionicons name="image-outline" size={20} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.mediaCardTitle, { color: colors.text }]}>Pick Cover</Text>
              <Text style={[styles.mediaCardSub, { color: colors.mutedForeground }]}>
                9:16 portrait (optional)
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function LocationAndPinPicker({ form, colors, isDark }: MediaAndBasicsSectionProps) {
  return (
    <View style={styles.formGroup}>
      <Text style={[styles.inputLabel, { color: colors.text }]}>Location & Map Pin *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {LOCATIONS.map((loc) => {
          const sel = form.location.toLowerCase() === loc.toLowerCase();
          return (
            <Pressable
              key={loc}
              onPress={() => {
                form.setLocation(loc);
                if (
                  form.pinnedLocation &&
                  form.pinnedLocation.city.toLowerCase() !== loc.toLowerCase()
                ) {
                  form.setPinnedLocation(null);
                }
              }}
              style={[
                styles.locChip,
                { backgroundColor: isDark ? '#27272A' : '#F7F7F7' },
                sel ? styles.locChipSelected : null,
              ]}
            >
              <Text
                style={[
                  styles.locChipText,
                  { color: colors.mutedForeground },
                  sel ? styles.locChipTextSelected : null,
                ]}
              >
                {loc}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={() => form.setShowLocationPicker(true)}
        style={({ pressed }) => [
          {
            marginTop: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: form.pinnedLocation ? '#F26522' : colors.border,
            backgroundColor: form.pinnedLocation
              ? 'rgba(242,101,34,0.08)'
              : isDark
              ? '#27272A'
              : '#F9FAFB',
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Ionicons
          name="location-outline"
          size={18}
          color={form.pinnedLocation ? '#F26522' : colors.mutedForeground}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 13.5,
              fontFamily: 'DMSans_700Bold',
              color: colors.text,
            }}
            numberOfLines={1}
          >
            {form.pinnedLocation
              ? `${form.pinnedLocation.city} (${form.pinnedLocation.precision === 'approximate' ? '~500m privacy circle' : 'Exact pin'})`
              : 'Drop location pin on map (Recommended)'}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'DMSans_400Regular',
              color: colors.mutedForeground,
              marginTop: 1,
            }}
            numberOfLines={1}
          >
            {form.pinnedLocation
              ? form.pinnedLocation.formattedAddress
              : 'Search any address across Kenya & Africa or use GPS'}
          </Text>
        </View>
        <Ionicons name="chevron-forward-outline" size={16} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

function TitleField({ form, colors }: { form: CreateReelFormState; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.formGroup}>
      <Text style={[styles.inputLabel, { color: colors.text }]}>
        {form.contentType === 'event'
          ? 'Event Title *'
          : form.contentType === 'special_offer'
          ? 'Offer Headline *'
          : 'Listing Title *'}
      </Text>
      <TextInput
        placeholder={
          form.contentType === 'event'
            ? 'e.g. Diani Sunset Beach Party Live DJ'
            : form.contentType === 'special_offer'
            ? 'e.g. 2-for-1 Sunset Cocktails & Tapas'
            : form.category === 'food_dining'
            ? 'e.g. Nomad Beach Bar & Grill'
            : form.category === 'water_experience'
            ? 'e.g. Wasini Island Dolphin Dhow Sail'
            : form.category === 'land_experience'
            ? 'e.g. Shimba Hills Sunset Safari'
            : 'e.g. Diani Sunset Villa & Private Pool'
        }
        placeholderTextColor={colors.mutedForeground}
        value={form.title}
        onChangeText={form.setTitle}
        style={[
          styles.textInput,
          { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text },
        ]}
      />
    </View>
  );
}

function DescriptionField({ form, colors }: { form: CreateReelFormState; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.formGroup}>
      <Text style={[styles.inputLabel, { color: colors.text }]}>Description & Highlights</Text>
      <GrowingInput
        placeholder={
          form.contentType === 'event'
            ? 'Describe the music lineup, atmosphere, venue highlights...'
            : form.contentType === 'special_offer'
            ? 'Describe what makes this deal unmissable...'
            : 'Describe what guests will experience...'
        }
        placeholderTextColor={colors.mutedForeground}
        value={form.description}
        onChangeText={form.setDescription}
        minHeight={84}
        maxHeight={160}
        style={[
          styles.textInput,
          styles.textAreaInput,
          { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text },
        ]}
      />
    </View>
  );
}

export function MediaAndBasicsSection({ form, colors, isDark }: MediaAndBasicsSectionProps) {
  const activePrimaryCat = getPrimaryCategoryMeta(form.category);
  const inputStyle = [
    styles.textInput,
    { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, color: colors.text },
  ];

  // =========================================================================
  // 1. ATTACH REEL TO EXISTING ESTABLISHMENT (2-Step Fast Flow)
  // =========================================================================
  if (form.isAttachingToExistingExp) {
    if (form.currentStep === 0) {
      return (
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            Choose Target Establishment
          </Text>
          <Text style={[styles.sectionSubText, { color: colors.mutedForeground }]}>
            Attach a new ZuruFlow reel directly to an existing listing, or switch to New Establishment.
          </Text>
          <EstablishmentLinkBar form={form} colors={colors} isDark={isDark} />
        </View>
      );
    }

    return (
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>
          Add Reel Video & Cover
        </Text>
        <Text style={[styles.sectionSubText, { color: colors.mutedForeground }]}>
          This video reel will promote your selected establishment on ZuruFlow.
        </Text>
        <MediaUploadRow form={form} colors={colors} isDark={isDark} />

        {form.selectedEstablishment ? (
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryCardTitle, { color: colors.text }]}>
              Attached Listing Details
            </Text>
            <View style={styles.summaryCardRow}>
              <Text style={[styles.summaryCardLabel, { color: colors.mutedForeground }]}>Listing</Text>
              <Text style={[styles.summaryCardValue, { color: colors.text }]} numberOfLines={1}>
                {form.selectedEstablishment.title}
              </Text>
            </View>
            <View style={styles.summaryCardRow}>
              <Text style={[styles.summaryCardLabel, { color: colors.mutedForeground }]}>Location</Text>
              <Text style={[styles.summaryCardValue, { color: colors.text }]}>
                {form.selectedEstablishment.city || form.selectedEstablishment.location}
              </Text>
            </View>
            <View style={styles.summaryCardRow}>
              <Text style={[styles.summaryCardLabel, { color: colors.mutedForeground }]}>Category</Text>
              <Text style={[styles.summaryCardValue, { color: colors.text }]}>
                {getPrimaryCategoryMeta(form.selectedEstablishment.category).label}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  // =========================================================================
  // 2. NEW EXPERIENCE / ESTABLISHMENT FLOW (Steps 0, 1, 2)
  // =========================================================================
  if (form.contentType === 'experience') {
    if (form.currentStep === 0) {
      return (
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            Experience Category & Type
          </Text>
          <Text style={[styles.sectionSubText, { color: colors.mutedForeground }]}>
            Choose the category that best fits your establishment or activity.
          </Text>

          <EstablishmentLinkBar form={form} colors={colors} isDark={isDark} />

          <View style={styles.primaryCatGrid}>
            {PRIMARY_EXPERIENCE_CATEGORIES.map((cat) => {
              const selected = form.category === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  testID={`primary-category-${cat.id}`}
                  onPress={() => form.setCategory(cat.id)}
                  style={({ pressed }) => [
                    styles.primaryCatCard,
                    {
                      backgroundColor: selected
                        ? isDark
                          ? '#2A1F1A'
                          : '#FFFBF8'
                        : colors.card,
                      borderColor: selected ? '#F26522' : colors.border,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.primaryCatIconCircle,
                      {
                        backgroundColor: selected
                          ? 'rgba(242, 101, 34, 0.14)'
                          : isDark
                          ? '#27272A'
                          : '#F7F7F7',
                      },
                    ]}
                  >
                    <Ionicons
                      name={selected ? cat.activeIcon : cat.icon}
                      size={21}
                      color={selected ? '#F26522' : colors.text}
                    />
                  </View>
                  <Text style={[styles.primaryCatTitle, { color: colors.text }]}>
                    {cat.label}
                  </Text>
                  <Text
                    style={[styles.primaryCatSub, { color: colors.mutedForeground }]}
                    numberOfLines={2}
                  >
                    {cat.subtitle}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.formGroup, { marginTop: 4 }]}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              Secondary Category ({activePrimaryCat.label})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {activePrimaryCat.subcategories.map((sub) => {
                const sel = form.subcategory === sub.id;
                return (
                  <Pressable
                    key={sub.id}
                    onPress={() => form.setSubcategory(sub.id)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: sel
                          ? '#F26522'
                          : isDark
                          ? '#27272A'
                          : '#F7F7F7',
                        borderColor: sel ? '#F26522' : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={sub.icon}
                      size={15}
                      color={sel ? '#FFFFFF' : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: sel ? '#FFFFFF' : colors.text },
                        sel ? styles.categoryChipTextSelected : null,
                      ]}
                    >
                      {sub.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      );
    }

    if (form.currentStep === 1) {
      return (
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            Reel Video & Core Info
          </Text>
          <Text style={[styles.sectionSubText, { color: colors.mutedForeground }]}>
            Add your ZuruFlow video and tell travelers what & where your experience is.
          </Text>

          <MediaUploadRow form={form} colors={colors} isDark={isDark} />
          <TitleField form={form} colors={colors} />
          <LocationAndPinPicker form={form} colors={colors} isDark={isDark} />
          <DescriptionField form={form} colors={colors} />
        </View>
      );
    }

    if (form.currentStep === 2) {
      const isStay = form.category === 'accommodation';
      const unitOptions = isStay ? STAY_PRICE_UNITS : EXPERIENCE_PRICE_UNITS;

      return (
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            {isStay ? 'Pricing, Capacity & Check-In' : 'Pricing & Experience Schedule'}
          </Text>
          <Text style={[styles.sectionSubText, { color: colors.mutedForeground }]}>
            {isStay
              ? 'Set nightly pricing, guest capacity, and standard check-in hours.'
              : 'Set pricing, group size, duration, and what guests receive.'}
          </Text>

          <View style={styles.rowTwoCol}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Price (KES) *</Text>
              <TextInput
                placeholder="e.g. 15000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={form.price}
                onChangeText={form.setPrice}
                style={inputStyle}
              />
            </View>

            <View style={[styles.formGroup, { width: 130 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Price Unit</Text>
              <TextInput
                placeholder={isStay ? 'night' : 'person'}
                placeholderTextColor={colors.mutedForeground}
                value={form.priceUnit}
                onChangeText={form.setPriceUnit}
                style={inputStyle}
              />
            </View>
          </View>

          <View style={styles.presetChipsRow}>
            {unitOptions.map((unit) => {
              const sel = form.priceUnit.toLowerCase() === unit;
              return (
                <Pressable
                  key={unit}
                  onPress={() => form.setPriceUnit(unit)}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: sel ? '#F26522' : isDark ? '#27272A' : '#F3F4F6',
                      borderColor: sel ? '#F26522' : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.presetChipText, { color: sel ? '#FFFFFF' : colors.text }]}>
                    per {unit}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {isStay ? (
            <>
              <View style={styles.rowTwoCol}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Max Guests</Text>
                  <TextInput
                    placeholder="2"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    value={form.maxGuests}
                    onChangeText={form.setMaxGuests}
                    style={inputStyle}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Min Stay (Nights)</Text>
                  <TextInput
                    placeholder="1"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    value={form.minStayNights}
                    onChangeText={form.setMinStayNights}
                    style={inputStyle}
                  />
                </View>
              </View>

              <View style={styles.rowTwoCol}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Check-in Time</Text>
                  <TextInput
                    placeholder="14:00"
                    placeholderTextColor={colors.mutedForeground}
                    value={form.checkInTime}
                    onChangeText={form.setCheckInTime}
                    style={inputStyle}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Check-out Time</Text>
                  <TextInput
                    placeholder="10:00"
                    placeholderTextColor={colors.mutedForeground}
                    value={form.checkOutTime}
                    onChangeText={form.setCheckOutTime}
                    style={inputStyle}
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.rowTwoCol}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Max Guests / Group</Text>
                  <TextInput
                    placeholder="e.g. 8"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    value={form.maxGuests}
                    onChangeText={form.setMaxGuests}
                    style={inputStyle}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Duration</Text>
                  <TextInput
                    placeholder="e.g. 3 hours"
                    placeholderTextColor={colors.mutedForeground}
                    value={form.durationInfo}
                    onChangeText={form.setDurationInfo}
                    style={inputStyle}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Operating Hours</Text>
                <TextInput
                  placeholder="e.g. 8:00 AM – 6:00 PM"
                  placeholderTextColor={colors.mutedForeground}
                  value={form.operatingHours}
                  onChangeText={form.setOperatingHours}
                  style={inputStyle}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>What's Included</Text>
                <TextInput
                  placeholder="e.g. Guide, refreshments, snorkeling gear, transfers"
                  placeholderTextColor={colors.mutedForeground}
                  value={form.whatsIncluded}
                  onChangeText={form.setWhatsIncluded}
                  style={inputStyle}
                />
              </View>
            </>
          )}
        </View>
      );
    }

    return null;
  }

  // =========================================================================
  // 3. EVENT DEDICATED FLOW (Steps 0, 1; Step 2 in BookingAndRulesSection)
  // =========================================================================
  if (form.contentType === 'event') {
    if (form.currentStep === 0) {
      return (
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            Event Type, Venue & Reel
          </Text>
          <Text style={[styles.sectionSubText, { color: colors.mutedForeground }]}>
            Pick the vibe, link a host venue if applicable, and attach your event reel.
          </Text>

          <View style={styles.formGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Event Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {EVENT_SUBCATEGORIES.map((sub) => {
                const sel = form.eventSubcategory === sub.id;
                return (
                  <Pressable
                    key={sub.id}
                    onPress={() => form.setEventSubcategory(sub.id)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: sel ? '#F26522' : isDark ? '#27272A' : '#F7F7F7',
                        borderColor: sel ? '#F26522' : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={sub.icon}
                      size={15}
                      color={sel ? '#FFFFFF' : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: sel ? '#FFFFFF' : colors.text },
                      ]}
                    >
                      {sub.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <EstablishmentLinkBar form={form} colors={colors} isDark={isDark} />
          <MediaUploadRow form={form} colors={colors} isDark={isDark} />
          <TitleField form={form} colors={colors} />
        </View>
      );
    }

    if (form.currentStep === 1) {
      return (
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            Date, Tickets & Location
          </Text>
          <Text style={[styles.sectionSubText, { color: colors.mutedForeground }]}>
            Events automatically expire once finished so ZuruFlow stays fresh.
          </Text>

          <View style={styles.rowTwoCol}>
            <View style={[styles.formGroup, { flex: 1.2 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Event Date *</Text>
              <TextInput
                placeholder="2026-11-28"
                placeholderTextColor={colors.mutedForeground}
                value={form.eventDate}
                onChangeText={form.setEventDate}
                style={inputStyle}
              />
            </View>
            <View style={[styles.formGroup, { flex: 0.9 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Start</Text>
              <TextInput
                placeholder="18:00"
                placeholderTextColor={colors.mutedForeground}
                value={form.eventStartTime}
                onChangeText={form.setEventStartTime}
                style={inputStyle}
              />
            </View>
            <View style={[styles.formGroup, { flex: 0.9 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>End</Text>
              <TextInput
                placeholder="23:30"
                placeholderTextColor={colors.mutedForeground}
                value={form.eventEndTime}
                onChangeText={form.setEventEndTime}
                style={inputStyle}
              />
            </View>
          </View>

          <View style={styles.rowTwoCol}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Ticket Price (KES, 0 = Free)</Text>
              <TextInput
                placeholder="e.g. 1500"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={form.price}
                onChangeText={form.setPrice}
                style={inputStyle}
              />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Venue / Organizer Name</Text>
              <TextInput
                placeholder={form.selectedEstablishment?.title || 'e.g. Forty Thieves Beach Bar'}
                placeholderTextColor={colors.mutedForeground}
                value={form.organizerName}
                onChangeText={form.setOrganizerName}
                style={inputStyle}
              />
            </View>
          </View>

          <LocationAndPinPicker form={form} colors={colors} isDark={isDark} />
          <DescriptionField form={form} colors={colors} />
        </View>
      );
    }

    return null;
  }

  // =========================================================================
  // 4. SPECIAL OFFER DEDICATED FLOW (Steps 0, 1; Step 2 in BookingAndRulesSection)
  // =========================================================================
  if (form.currentStep === 0) {
    return (
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>
          Offer Type, Establishment & Reel
        </Text>
        <Text style={[styles.sectionSubText, { color: colors.mutedForeground }]}>
          Select a promotion style, link an establishment, and add your promo reel.
        </Text>

        <View style={styles.formGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Offer Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {OFFER_TYPES.map((ot) => {
              const sel = form.offerType === ot.id;
              return (
                <Pressable
                  key={ot.id}
                  onPress={() => form.setOfferType(ot.id)}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: sel ? '#F26522' : isDark ? '#27272A' : '#F7F7F7',
                      borderColor: sel ? '#F26522' : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={ot.icon}
                    size={15}
                    color={sel ? '#FFFFFF' : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: sel ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {ot.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <EstablishmentLinkBar form={form} colors={colors} isDark={isDark} />
        <MediaUploadRow form={form} colors={colors} isDark={isDark} />
        <TitleField form={form} colors={colors} />
      </View>
    );
  }

  if (form.currentStep === 1) {
    return (
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>
          Discount, Validity & Location
        </Text>
        <Text style={[styles.sectionSubText, { color: colors.mutedForeground }]}>
          Set the promotional badge, expiry date, pricing, and location.
        </Text>

        <View style={styles.rowTwoCol}>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Discount / Deal Badge *</Text>
            <TextInput
              placeholder="e.g. 20% OFF or 2-for-1"
              placeholderTextColor={colors.mutedForeground}
              value={form.discountLabel}
              onChangeText={form.setDiscountLabel}
              style={inputStyle}
            />
          </View>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Offer Expires *</Text>
            <TextInput
              placeholder="2026-12-05"
              placeholderTextColor={colors.mutedForeground}
              value={form.offerExpiryDate}
              onChangeText={form.setOfferExpiryDate}
              style={inputStyle}
            />
          </View>
        </View>

        <View style={styles.presetChipsRow}>
          {OFFER_BADGE_PRESETS.map((preset) => {
            const sel = form.discountLabel.trim() === preset;
            return (
              <Pressable
                key={preset}
                onPress={() => form.setDiscountLabel(preset)}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: sel ? '#F26522' : isDark ? '#27272A' : '#F3F4F6',
                    borderColor: sel ? '#F26522' : colors.border,
                  },
                ]}
              >
                <Text style={[styles.presetChipText, { color: sel ? '#FFFFFF' : colors.text }]}>
                  {preset}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.rowTwoCol}>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Original Price (KES)</Text>
            <TextInput
              placeholder="e.g. 3000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={form.originalPrice}
              onChangeText={form.setOriginalPrice}
              style={inputStyle}
            />
          </View>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Offer Price (KES)</Text>
            <TextInput
              placeholder="e.g. 2400"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={form.offerPrice}
              onChangeText={form.setOfferPrice}
              style={inputStyle}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Applicable Days & Hours</Text>
          <TextInput
            placeholder="e.g. Thu–Sun · 5:00 PM – 8:00 PM"
            placeholderTextColor={colors.mutedForeground}
            value={form.applicableSchedule}
            onChangeText={form.setApplicableSchedule}
            style={inputStyle}
          />
        </View>

        <LocationAndPinPicker form={form} colors={colors} isDark={isDark} />
        <DescriptionField form={form} colors={colors} />
      </View>
    );
  }

  return null;
}
