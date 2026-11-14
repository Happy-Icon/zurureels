import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { EnquireModal } from '@/components/EnquireModal';
import {
  formatExpiryCountdown,
  getSubcategoryLabel,
} from '@/constants/taxonomy';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import type { ReelRow, SpecialOfferRow } from '@/lib/supabase';

export interface OfferDetailSheetProps {
  visible: boolean;
  offer: SpecialOfferRow | null;
  reel?: ReelRow | null;
  onClose: () => void;
  onClaimOffer?: () => void;
  onOpenEstablishment?: (experienceId: string, hostId?: string | null) => void;
}

const ORANGE = '#F26522';

export function OfferDetailSheet({
  visible,
  offer,
  reel,
  onClose,
  onClaimOffer,
  onOpenEstablishment,
}: OfferDetailSheetProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [enquireOpen, setEnquireOpen] = useState(false);

  const resolved = useMemo(() => {
    const meta = ((reel?.experience?.metadata || {}) as Record<string, any>);
    const offMeta = (meta.offer_details || {}) as Record<string, any>;

    const title = offer?.title || reel?.experience?.title || 'Special Offer';
    const description = offer?.description || reel?.experience?.description || '';
    const imageUrl =
      offer?.image_url || reel?.thumbnail_url || reel?.experience?.image_url || null;
    const discountLabel =
      offer?.discount_label || offMeta.discount_label || 'Limited Deal';
    const offerTypeLabel =
      getSubcategoryLabel(offer?.offer_type || meta.subcategory || reel?.subcategory) ||
      'Special Offer';
    const originalPrice =
      typeof offer?.original_price === 'number'
        ? offer.original_price
        : typeof offMeta.original_price === 'number'
        ? offMeta.original_price
        : null;
    const offerPrice =
      typeof offer?.offer_price === 'number'
        ? offer.offer_price
        : typeof offMeta.offer_price === 'number'
        ? offMeta.offer_price
        : reel?.experience?.current_price ?? null;
    const applicableSchedule =
      offer?.applicable_schedule || offMeta.applicable_schedule || null;
    const redemptionInstructions =
      offer?.redemption_instructions || offMeta.redemption_instructions || null;
    const termsConditions =
      offer?.terms_conditions || offMeta.terms_conditions || null;
    const expiresAt = offer?.expires_at || offMeta.expires_at || reel?.expires_at || null;
    const location =
      offer?.location ||
      reel?.experience?.city ||
      reel?.experience?.location ||
      'Kenya Coast';
    const linkedExperienceId =
      offer?.experience_id ||
      offer?.experience?.id ||
      meta.linked_experience_id ||
      null;
    const linkedExperienceTitle =
      offer?.experience?.title ||
      meta.linked_experience_title ||
      reel?.experience?.entity_name ||
      null;
    const hostId = offer?.user_id || reel?.user_id || reel?.host?.id || null;
    const hostName =
      linkedExperienceTitle ||
      reel?.host?.full_name ||
      reel?.experience?.entity_name ||
      'ZuruSasa Host';
    const hostAvatarUrl = reel?.host?.avatar_url || null;

    return {
      title,
      description,
      imageUrl,
      discountLabel,
      offerTypeLabel,
      originalPrice,
      offerPrice,
      applicableSchedule,
      redemptionInstructions,
      termsConditions,
      expiryCountdown: formatExpiryCountdown(expiresAt),
      location,
      linkedExperienceId,
      linkedExperienceTitle,
      hostId,
      hostName,
      hostAvatarUrl,
    };
  }, [offer, reel]);

  if (!offer && !reel) return null;

  const bottomPad = Platform.OS === 'web' ? 20 : Math.max(insets.bottom, 16);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          {/* Top Bar */}
          <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
            <View style={[styles.typeBadge, { backgroundColor: isDark ? '#3B2314' : '#FFF8F5' }]}>
              <Ionicons name="pricetag-outline" size={14} color={ORANGE} />
              <Text style={[styles.typeBadgeText, { color: ORANGE }]}>
                {resolved.offerTypeLabel.toUpperCase()}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={[styles.closeBtn, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
              <Ionicons name="close-outline" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Hero */}
            {resolved.imageUrl ? (
              <Image source={{ uri: resolved.imageUrl }} style={styles.heroImage} contentFit="cover" />
            ) : (
              <View style={[styles.heroPlaceholder, { backgroundColor: isDark ? '#27272A' : '#F7F7F7' }]}>
                <Ionicons name="pricetag-outline" size={44} color={ORANGE} />
              </View>
            )}

            {/* Badges & Title */}
            <View style={styles.titleBlock}>
              <View style={styles.badgeRow}>
                <View style={[styles.discountBadge, { backgroundColor: ORANGE }]}>
                  <Ionicons name="pricetag" size={12} color="#FFFFFF" />
                  <Text style={styles.discountBadgeText}>{resolved.discountLabel}</Text>
                </View>

                <View style={[styles.expiryChip, { backgroundColor: isDark ? '#27272A' : '#FFF7ED', borderColor: isDark ? '#3F3F46' : '#FED7AA' }]}>
                  <Ionicons name="alarm-outline" size={13} color={ORANGE} />
                  <Text style={[styles.expiryChipText, { color: ORANGE }]}>
                    {resolved.expiryCountdown}
                  </Text>
                </View>
              </View>

              <Text style={[styles.title, { color: colors.text }]}>{resolved.title}</Text>

              {/* Price Comparison */}
              {(resolved.offerPrice != null || resolved.originalPrice != null) ? (
                <View style={styles.priceComparisonRow}>
                  {resolved.originalPrice != null && resolved.originalPrice > 0 ? (
                    <Text style={[styles.originalPriceText, { color: colors.mutedForeground }]}>
                      KES {resolved.originalPrice.toLocaleString()}
                    </Text>
                  ) : null}
                  {resolved.offerPrice != null && resolved.offerPrice > 0 ? (
                    <Text style={[styles.offerPriceText, { color: colors.text }]}>
                      KES {resolved.offerPrice.toLocaleString()}
                    </Text>
                  ) : null}
                  <View style={[styles.locationBadge, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
                    <Ionicons name="location-outline" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.locationBadgeText, { color: colors.mutedForeground }]}>
                      {resolved.location}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            {/* Applicable Schedule Card */}
            {resolved.applicableSchedule ? (
              <View style={[styles.infoCard, { backgroundColor: isDark ? '#18181B' : '#F8FAFC', borderColor: colors.border }]}>
                <View style={[styles.infoIconWrap, { backgroundColor: isDark ? '#27272A' : '#FFFFFF' }]}>
                  <Ionicons name="time-outline" size={18} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Valid Hours / Days</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {resolved.applicableSchedule}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Linked Host Establishment */}
            {resolved.linkedExperienceId && resolved.linkedExperienceTitle ? (
              <Pressable
                onPress={() => {
                  onClose();
                  onOpenEstablishment?.(resolved.linkedExperienceId!, resolved.hostId);
                }}
                style={({ pressed }) => [
                  styles.linkedCard,
                  {
                    backgroundColor: isDark ? '#27272A' : '#FFFBF8',
                    borderColor: isDark ? '#3F3F46' : '#FED7AA',
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={[styles.linkedIcon, { backgroundColor: 'rgba(242, 101, 34, 0.12)' }]}>
                  <Ionicons name="business-outline" size={18} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.linkedEyebrow, { color: ORANGE }]}>Offered By</Text>
                  <Text style={[styles.linkedTitle, { color: colors.text }]} numberOfLines={1}>
                    {resolved.linkedExperienceTitle}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </Pressable>
            ) : null}

            {/* Description */}
            {resolved.description ? (
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Deal Details</Text>
                <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>
                  {resolved.description}
                </Text>
              </View>
            ) : null}

            {/* Redemption Instructions */}
            {resolved.redemptionInstructions ? (
              <View style={[styles.noteCard, { backgroundColor: isDark ? '#18181B' : '#F9FAFB', borderColor: colors.border }]}>
                <View style={styles.noteHeader}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={ORANGE} />
                  <Text style={[styles.noteTitle, { color: colors.text }]}>How to Redeem</Text>
                </View>
                <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
                  {resolved.redemptionInstructions}
                </Text>
              </View>
            ) : null}

            {/* Terms & Conditions */}
            {resolved.termsConditions ? (
              <View style={[styles.noteCard, { backgroundColor: isDark ? '#18181B' : '#F9FAFB', borderColor: colors.border }]}>
                <View style={styles.noteHeader}>
                  <Ionicons name="document-text-outline" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.noteTitle, { color: colors.text }]}>Terms & Conditions</Text>
                </View>
                <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
                  {resolved.termsConditions}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer CTAs */}
          <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: bottomPad }]}>
            {resolved.hostId ? (
              <Pressable
                onPress={() => setEnquireOpen(true)}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  {
                    backgroundColor: isDark ? '#27272A' : '#F3F4F6',
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Ionicons name="chatbubble-outline" size={17} color={colors.text} />
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Message Host</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => {
                if (onClaimOffer) {
                  onClose();
                  onClaimOffer();
                } else if (resolved.hostId) {
                  setEnquireOpen(true);
                } else {
                  onClose();
                }
              }}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: ORANGE, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Ionicons name="gift-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>
                {onClaimOffer ? 'Claim & Book' : 'Claim Deal'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {resolved.hostId ? (
        <EnquireModal
          visible={enquireOpen}
          onClose={() => setEnquireOpen(false)}
          hostId={resolved.hostId}
          hostName={resolved.hostName}
          hostAvatarUrl={resolved.hostAvatarUrl}
          experienceTitle={resolved.title}
          experienceLocation={resolved.location}
          experiencePrice={resolved.offerPrice ?? undefined}
          experiencePriceUnit="offer"
          reelThumbnailUrl={resolved.imageUrl}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '92%',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.4,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  heroImage: {
    width: '100%',
    height: 210,
    borderRadius: 18,
  },
  heroPlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    gap: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  expiryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  expiryChipText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  title: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.3,
  },
  priceComparisonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  originalPriceText: {
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    textDecorationLine: 'line-through',
  },
  offerPriceText: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  locationBadgeText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 11.5,
    fontFamily: 'DMSans_500Medium',
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    marginTop: 1,
  },
  linkedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  linkedIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedEyebrow: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  linkedTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    marginTop: 1,
  },
  sectionBlock: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15.5,
    fontFamily: 'DMSans_700Bold',
  },
  bodyText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 21,
  },
  noteCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    gap: 6,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteTitle: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
  },
  noteText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 19,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
