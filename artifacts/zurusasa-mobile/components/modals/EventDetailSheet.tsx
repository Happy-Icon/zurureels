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
  formatEventScheduleBadge,
  getSubcategoryLabel,
} from '@/constants/taxonomy';
import { useColors } from '@/hooks/useColors';
import { extractEventTiming, useEventLifecycle } from '@/hooks/useEventLifecycle';
import { useTheme } from '@/context/ThemeContext';
import type { EventRow, ReelRow } from '@/lib/supabase';

export interface EventDetailSheetProps {
  visible: boolean;
  event: EventRow | null;
  reel?: ReelRow | null;
  onClose: () => void;
  onBookTicket?: () => void;
  onOpenEstablishment?: (experienceId: string, hostId?: string | null) => void;
}

const ORANGE = '#F26522';

export function EventDetailSheet({
  visible,
  event,
  reel,
  onClose,
  onBookTicket,
  onOpenEstablishment,
}: EventDetailSheetProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [enquireOpen, setEnquireOpen] = useState(false);

  const timingInput = useMemo(() => extractEventTiming(event, reel), [event, reel]);
  const lifecycle = useEventLifecycle(timingInput, {
    enabled: visible && Boolean(event || reel),
    intervalMs: 1000,
  });

  const resolved = useMemo(() => {
    const meta = ((reel?.experience?.metadata || {}) as Record<string, any>);
    const evMeta = (meta.event_details || {}) as Record<string, any>;

    const title =
      event?.title || reel?.experience?.title || 'Upcoming Event';
    const description =
      event?.description || reel?.experience?.description || '';
    const imageUrl =
      event?.image_url || reel?.thumbnail_url || reel?.experience?.image_url || null;
    const eventDate = event?.event_date || evMeta.event_date || null;
    const endDate = event?.end_date || evMeta.end_date || null;
    const startTime = event?.start_time || evMeta.start_time || null;
    const endTime = event?.end_time || evMeta.end_time || null;
    const categoryLabel =
      getSubcategoryLabel(event?.category || meta.subcategory || reel?.subcategory) ||
      'Upcoming Event';
    const location =
      event?.location ||
      reel?.experience?.city ||
      reel?.experience?.location ||
      'Kenya Coast';
    const organizerName =
      event?.organizer_name ||
      evMeta.organizer_name ||
      reel?.host?.full_name ||
      reel?.experience?.entity_name ||
      'Event Organizer';
    const entryConditions =
      event?.entry_conditions || evMeta.entry_conditions || null;
    const bookingInstructions =
      event?.booking_instructions || evMeta.booking_instructions || null;
    const price =
      typeof event?.price === 'number'
        ? event.price
        : reel?.experience?.current_price ?? 0;
    const linkedExperienceId =
      event?.experience_id ||
      event?.experience?.id ||
      meta.linked_experience_id ||
      null;
    const linkedExperienceTitle =
      event?.experience?.title ||
      meta.linked_experience_title ||
      null;
    const hostId = event?.user_id || reel?.user_id || reel?.host?.id || null;
    const hostAvatarUrl = reel?.host?.avatar_url || null;

    return {
      title,
      description,
      imageUrl,
      eventDate,
      endDate,
      startTime,
      endTime,
      scheduleBadge: formatEventScheduleBadge(eventDate, startTime),
      categoryLabel,
      location,
      organizerName,
      entryConditions,
      bookingInstructions,
      price,
      linkedExperienceId,
      linkedExperienceTitle,
      hostId,
      hostAvatarUrl,
    };
  }, [event, reel]);

  const formattedDateLine = useMemo(() => {
    const windowStr = lifecycle?.timeWindowLabel;
    if (!resolved.eventDate) return windowStr || resolved.scheduleBadge;
    const dt = new Date(resolved.eventDate);
    if (Number.isNaN(dt.getTime())) return windowStr || resolved.scheduleBadge;
    const datePart = dt.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    if (windowStr) {
      return `${datePart} · ${windowStr}`;
    }
    if (resolved.startTime) {
      return `${datePart} · ${resolved.startTime}`;
    }
    return datePart;
  }, [resolved.eventDate, resolved.startTime, resolved.scheduleBadge, lifecycle?.timeWindowLabel]);

  if (!event && !reel) return null;

  const isLive = Boolean(lifecycle?.isLive);
  const isEnded = Boolean(lifecycle?.isEnded);
  const ticketBookingDisabled = Boolean(onBookTicket && (isLive || isEnded));
  const bottomPad = Platform.OS === 'web' ? 20 : Math.max(insets.bottom, 16);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          {/* Top Bar */}
          <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
              {isLive ? (
                <View style={styles.liveBadgeTop}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeTopText}>LIVE NOW</Text>
                </View>
              ) : null}
              <View style={[styles.typeBadge, { backgroundColor: isDark ? '#3B2314' : '#FFF8F5' }]}>
                <Ionicons name="calendar-outline" size={14} color={ORANGE} />
                <Text style={[styles.typeBadgeText, { color: ORANGE }]}>
                  {resolved.categoryLabel.toUpperCase()}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={[styles.closeBtn, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
              <Ionicons name="close-outline" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Hero */}
            {resolved.imageUrl ? (
              <View style={{ position: 'relative' }}>
                <Image source={{ uri: resolved.imageUrl }} style={styles.heroImage} contentFit="cover" />
                {isLive ? (
                  <View style={styles.heroLiveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.heroLiveText}>HAPPENING LIVE</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={[styles.heroPlaceholder, { backgroundColor: isDark ? '#27272A' : '#F7F7F7' }]}>
                <Ionicons name="calendar-outline" size={44} color={ORANGE} />
              </View>
            )}

            {/* Schedule & Price Strip */}
            <View style={styles.titleBlock}>
              <Text style={[styles.title, { color: colors.text }]}>{resolved.title}</Text>
              <View style={styles.schedulePillRow}>
                {isLive ? (
                  <View style={styles.liveChip}>
                    <View style={styles.liveDotRed} />
                    <Text style={styles.liveChipText}>
                      Live · {lifecycle?.timeWindowLabel || resolved.scheduleBadge}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.scheduleChip, { backgroundColor: isDark ? '#3B2314' : '#FFF8F5' }]}>
                    <Ionicons name="time-outline" size={14} color={ORANGE} />
                    <Text style={[styles.scheduleChipText, { color: ORANGE }]}>
                      {lifecycle?.timeWindowLabel || resolved.scheduleBadge}
                    </Text>
                  </View>
                )}
                <View style={[styles.pricePill, { backgroundColor: isDark ? '#27272A' : '#F8FAFC', borderColor: colors.border }]}>
                  <Ionicons name="ticket-outline" size={14} color={ORANGE} />
                  <Text style={[styles.pricePillText, { color: colors.text }]}>
                    {resolved.price === 0 ? 'Free Entry' : `KES ${resolved.price.toLocaleString()} / ticket`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Live Window & Real-Time Countdown Banner */}
            {lifecycle && lifecycle.countdownLabel ? (
              <View
                style={[
                  styles.countdownBanner,
                  {
                    backgroundColor: isLive
                      ? isDark
                        ? 'rgba(220, 38, 38, 0.16)'
                        : '#FEF2F2'
                      : isEnded
                      ? isDark
                        ? '#27272A'
                        : '#F3F4F6'
                      : isDark
                      ? '#3B2314'
                      : '#FFF8F5',
                    borderColor: isLive
                      ? isDark
                        ? 'rgba(248, 113, 113, 0.35)'
                        : '#FECACA'
                      : isEnded
                      ? colors.border
                      : isDark
                      ? '#7C2D12'
                      : '#FED7AA',
                  },
                ]}
              >
                <View style={styles.countdownRowTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons
                      name={isLive ? 'radio-outline' : isEnded ? 'time-outline' : 'hourglass-outline'}
                      size={16}
                      color={isLive ? '#DC2626' : isEnded ? colors.mutedForeground : ORANGE}
                    />
                    <Text
                      style={[
                        styles.countdownStatusTitle,
                        { color: isLive ? '#DC2626' : isEnded ? colors.mutedForeground : ORANGE },
                      ]}
                    >
                      {isLive ? 'EVENT IS LIVE' : isEnded ? 'EVENT ENDED' : 'COUNTDOWN TO START'}
                    </Text>
                  </View>
                  {lifecycle.timeWindowLabel ? (
                    <Text style={[styles.countdownWindowText, { color: colors.text }]}>
                      {lifecycle.timeWindowLabel}
                    </Text>
                  ) : null}
                </View>

                <Text style={[styles.countdownTimerText, { color: colors.text }]}>
                  {lifecycle.countdownLabel}
                </Text>

                {isLive ? (
                  <Text style={[styles.countdownSubNote, { color: colors.mutedForeground }]}>
                    Advance ticket reservations close once an event goes live. Enquire with the organizer for door availability.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* Key Event Info */}
            <View style={[styles.infoCard, { backgroundColor: isDark ? '#18181B' : '#F8FAFC', borderColor: colors.border }]}>
              <View style={styles.infoRow}>
                <View style={[styles.infoIconWrap, { backgroundColor: isDark ? '#27272A' : '#FFFFFF' }]}>
                  <Ionicons name="calendar-clear-outline" size={17} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Date & Schedule</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{formattedDateLine}</Text>
                </View>
              </View>

              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

              <View style={styles.infoRow}>
                <View style={[styles.infoIconWrap, { backgroundColor: isDark ? '#27272A' : '#FFFFFF' }]}>
                  <Ionicons name="location-outline" size={17} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Venue / Area</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{resolved.location}</Text>
                </View>
              </View>

              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

              <View style={styles.infoRow}>
                <View style={[styles.infoIconWrap, { backgroundColor: isDark ? '#27272A' : '#FFFFFF' }]}>
                  <Ionicons name="person-outline" size={17} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Organized By</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{resolved.organizerName}</Text>
                </View>
              </View>
            </View>

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
                  <Text style={[styles.linkedEyebrow, { color: ORANGE }]}>Hosted Establishment</Text>
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
                <Text style={[styles.sectionTitle, { color: colors.text }]}>About This Event</Text>
                <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>
                  {resolved.description}
                </Text>
              </View>
            ) : null}

            {/* Entry Conditions */}
            {resolved.entryConditions ? (
              <View style={[styles.noteCard, { backgroundColor: isDark ? '#18181B' : '#F9FAFB', borderColor: colors.border }]}>
                <View style={styles.noteHeader}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={ORANGE} />
                  <Text style={[styles.noteTitle, { color: colors.text }]}>Entry Conditions</Text>
                </View>
                <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
                  {resolved.entryConditions}
                </Text>
              </View>
            ) : null}

            {/* Booking Instructions */}
            {resolved.bookingInstructions ? (
              <View style={[styles.noteCard, { backgroundColor: isDark ? '#18181B' : '#F9FAFB', borderColor: colors.border }]}>
                <View style={styles.noteHeader}>
                  <Ionicons name="information-circle-outline" size={16} color={ORANGE} />
                  <Text style={[styles.noteTitle, { color: colors.text }]}>Ticket & Arrival Info</Text>
                </View>
                <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
                  {resolved.bookingInstructions}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Action Dock */}
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
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Enquire</Text>
              </Pressable>
            ) : null}

            <Pressable
              disabled={ticketBookingDisabled}
              onPress={() => {
                if (ticketBookingDisabled) return;
                if (onBookTicket) {
                  onClose();
                  onBookTicket();
                } else if (resolved.hostId) {
                  setEnquireOpen(true);
                } else {
                  onClose();
                }
              }}
              style={({ pressed }) => [
                styles.primaryBtn,
                ticketBookingDisabled
                  ? {
                      backgroundColor: isDark ? 'rgba(63, 63, 70, 0.55)' : 'rgba(209, 213, 219, 0.72)',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(156,163,175,0.45)',
                      opacity: 0.52,
                    }
                  : { backgroundColor: ORANGE, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Ionicons
                name={ticketBookingDisabled ? 'lock-closed-outline' : 'ticket-outline'}
                size={18}
                color={ticketBookingDisabled ? colors.mutedForeground : '#FFFFFF'}
              />
              <Text
                style={[
                  styles.primaryBtnText,
                  ticketBookingDisabled ? { color: colors.mutedForeground } : null,
                ]}
              >
                {ticketBookingDisabled
                  ? isLive
                    ? 'Event Live · Tickets Closed'
                    : 'Event Ended'
                  : onBookTicket
                  ? 'Reserve / Get Tickets'
                  : 'Contact Organizer'}
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
          hostName={resolved.organizerName}
          hostAvatarUrl={resolved.hostAvatarUrl}
          experienceTitle={resolved.title}
          experienceLocation={resolved.location}
          experiencePrice={resolved.price}
          experiencePriceUnit="ticket"
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
  title: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.3,
  },
  schedulePillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scheduleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
  },
  scheduleChipText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_700Bold',
  },
  pricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  pricePillText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_700Bold',
  },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIconWrap: {
    width: 34,
    height: 34,
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
  rowDivider: {
    height: 1,
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
    paddingHorizontal: 18,
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
  liveBadgeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DC2626',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveBadgeTopText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.6,
  },
  heroLiveBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(220, 38, 38, 0.92)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroLiveText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.5,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
  },
  liveDotRed: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#DC2626',
  },
  liveChipText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_700Bold',
    color: '#DC2626',
  },
  countdownBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 5,
  },
  countdownRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  countdownStatusTitle: {
    fontSize: 11.5,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.5,
  },
  countdownWindowText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_700Bold',
  },
  countdownTimerText: {
    fontSize: 19,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.3,
  },
  countdownSubNote: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 17,
    marginTop: 2,
  },
});
