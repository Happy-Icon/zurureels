import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AI_COLORS,
  AI_FONTS,
  AI_RADIUS,
  AI_SHADOW,
  SUGGESTION_CHIPS,
  type AIMessage,
  type AICard,
} from '@/components/ai/tokens';
import { AIMessageBubble } from '@/components/ai/AIMessageBubble';
import { AITypingIndicator } from '@/components/ai/AITypingIndicator';
import { AIInputBar } from '@/components/ai/AIInputBar';
import { AIEmptyState } from '@/components/ai/AIEmptyState';
import { AISuggestionChips } from '@/components/ai/AISuggestionChip';
import { BookingSheet } from '@/components/BookingSheet';
import { ReelCard } from '@/components/ReelCard';
import { useZuruAI } from '@/lib/zuruAI';
import { useNetworkStatus } from '@/lib/networkManager';
import { useAuth } from '@/context/AuthContext';
import { useToggleSave } from '@/lib/queries';
import type { ReelRow } from '@/lib/supabase';

export default function AIChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { initialPrompt } = useLocalSearchParams<{ initialPrompt?: string }>();
  const { isOnline } = useNetworkStatus();
  const { user } = useAuth();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const {
    messages,
    isLoading,
    stageStatus,
    error,
    sendMessage,
    clearMessages,
    retryLastMessage,
  } = useZuruAI();

  const [inputText, setInputText] = useState('');
  const [userLocation, setUserLocation] = useState<{
    city?: string;
    latitude?: number;
    longitude?: number;
  } | null>(null);
  const listRef = useRef<FlatList>(null);

  // BookingSheet & Viewer State for Real Listing Actions
  const [selectedBookingCard, setSelectedBookingCard] = useState<AICard | null>(null);
  const [selectedViewerCard, setSelectedViewerCard] = useState<AICard | null>(null);

  const toggleSaveMutation = useToggleSave();

  // Detect user location for 'nearby' queries
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        let finalStatus = status;
        if (finalStatus !== 'granted') {
          const req = await Location.requestForegroundPermissionsAsync();
          finalStatus = req.status;
        }
        if (finalStatus === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          let city = 'Diani';
          try {
            const [geo] = await Location.reverseGeocodeAsync({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
            if (geo?.city || geo?.subregion || geo?.region) {
              city = geo.city || geo.subregion || geo.region || 'Diani';
            }
          } catch {}

          setUserLocation({
            city,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        }
      } catch {
        setUserLocation({ city: 'Diani' });
      }
    })();
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // Auto-send initial prompt if navigated with one
  const initialSentRef = useRef(false);
  useEffect(() => {
    if (initialPrompt && !initialSentRef.current) {
      initialSentRef.current = true;
      sendMessage(initialPrompt, { userLocation: userLocation ?? undefined });
    }
  }, [initialPrompt, sendMessage, userLocation]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText.trim(), { userLocation: userLocation ?? undefined });
    setInputText('');
    scrollToBottom();
  };

  const handleSuggestion = (chip: string) => {
    sendMessage(chip, { userLocation: userLocation ?? undefined });
    scrollToBottom();
  };

  // Convert AICard into ReelRow with REAL video, thumbnail, experience, and host data
  const createReelRowFromCard = useCallback((card: AICard): ReelRow => {
    const rawExp = card.experience;
    return {
      id: card.reelId || `reel-${card.id}`,
      video_url: card.videoUrl || null,
      thumbnail_url: card.thumbnailUrl || card.imageUrl || null,
      experience_id: card.experienceId || card.id,
      user_id: card.host?.id || rawExp?.user_id || null,
      category: card.category || rawExp?.category || 'stay',
      duration: null,
      is_live: false,
      status: 'active',
      experience: rawExp ? {
        ...rawExp,
        id: rawExp.id || card.id,
        title: rawExp.title || card.title,
        description: rawExp.description || card.subtitle || null,
        location: rawExp.location || card.location || null,
        current_price: rawExp.current_price != null ? Number(rawExp.current_price) : (card.price ?? null),
        price_unit: rawExp.price_unit || card.priceUnit || 'night',
        availability_status: rawExp.availability_status || 'available',
        image_url: rawExp.image_url || card.thumbnailUrl || card.imageUrl || null,
        amenities: Array.isArray(rawExp.amenities) && rawExp.amenities.length > 0 ? rawExp.amenities : (card.tags || null),
        metadata: {
          ...(rawExp.metadata || {}),
          rating: card.rating,
          review_count: card.reviewCount,
        },
      } : {
        id: card.id,
        title: card.title,
        description: card.subtitle || null,
        location: card.location || null,
        current_price: card.price || null,
        price_unit: card.priceUnit || 'night',
        availability_status: 'available',
        image_url: card.thumbnailUrl || card.imageUrl || null,
        amenities: card.tags || null,
        metadata: { rating: card.rating, review_count: card.reviewCount },
      } as any,
      host: card.host || null,
    };
  }, []);

  // Card interaction handlers
  const handleOpenCard = useCallback((id: string, card: AICard) => {
    setSelectedViewerCard(card);
  }, []);

  const handleBookCard = useCallback((id: string, card: AICard) => {
    setSelectedBookingCard(card);
  }, []);

  const handleSaveCard = useCallback((id: string, card: AICard) => {
    if (!user) {
      router.push('/auth' as any);
      return;
    }
    const reelId = card.reelId || id;
    toggleSaveMutation.mutate({ reelId, userId: user.id, saved: false });
  }, [user, router, toggleSaveMutation]);

  // Contextual follow-up suggestions from latest AI message or default
  const latestAiMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'ai') return messages[i];
    }
    return null;
  }, [messages]);

  const activeFollowUps = useMemo(() => {
    if (latestAiMessage?.followUps && latestAiMessage.followUps.length > 0) {
      return latestAiMessage.followUps;
    }
    return SUGGESTION_CHIPS.slice(0, 4);
  }, [latestAiMessage]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={AI_COLORS.textPrimary} />
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={styles.logoMini}>
            <Text style={styles.logoMiniEmoji}>✦</Text>
          </View>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>Zuru Agent</Text>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>FABLE 5.1</Text>
              </View>
            </View>
            <View style={styles.onlineRow}>
              <View style={[styles.onlineDot, !isOnline && { backgroundColor: '#EF4444' }]} />
              <Text style={styles.onlineText}>
                {!isOnline ? 'Offline' : 'Connected to Supabase'}
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={clearMessages}
          style={styles.moreBtn}
          hitSlop={8}
          accessibilityLabel="Clear chat"
        >
          <Feather name="trash-2" size={18} color={AI_COLORS.textSecondary} />
        </Pressable>
      </View>

      {/* ── Offline Banner State ─────────────────────────────────────────── */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Feather name="wifi-off" size={14} color="#B45309" />
          <Text style={styles.offlineText}>
            You are offline. Connect to internet to search ZuruSasa listings.
          </Text>
        </View>
      )}

      {/* ── Messages Container ───────────────────────────────────────────── */}
      {messages.length === 0 && !isLoading ? (
        <View style={styles.emptyContainer}>
          <AIEmptyState onSuggestionSelect={handleSuggestion} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <AIMessageBubble
              message={item}
              isLatest={index === messages.length - 1}
              onOpen={handleOpenCard}
              onBook={handleBookCard}
              onSave={handleSaveCard}
            />
          )}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            isLoading ? (
              <View style={styles.loadingFooter}>
                <View style={styles.statusPill}>
                  <Feather name="loader" size={12} color={AI_COLORS.orange} />
                  <Text style={styles.statusText}>
                    {stageStatus.text || 'Zuru Agent is thinking…'}
                  </Text>
                </View>
                <AITypingIndicator />
              </View>
            ) : null
          }
          onContentSizeChange={scrollToBottom}
        />
      )}

      {/* ── Error Banner State ───────────────────────────────────────────── */}
      {error && !isLoading && (
        <View style={styles.errorCard}>
          <View style={styles.errorContent}>
            <Feather name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.errorText} numberOfLines={2}>
              {error}
            </Text>
          </View>
          <Pressable onPress={retryLastMessage} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
            <Feather name="rotate-cw" size={12} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      {/* ── Contextual Follow-up Chips ───────────────────────────────────── */}
      {messages.length > 0 && !isLoading && isOnline ? (
        <View style={styles.chipsBar}>
          <AISuggestionChips
            chips={activeFollowUps}
            onSelect={handleSuggestion}
          />
        </View>
      ) : null}

      {/* ── Input Bar ────────────────────────────────────────────────────── */}
      <AIInputBar
        value={inputText}
        onChangeText={setInputText}
        onSend={handleSend}
        disabled={isLoading || !isOnline}
        placeholder={
          !isOnline
            ? 'Connect to internet to chat…'
            : isLoading
              ? stageStatus.text || 'Zuru Agent is thinking…'
              : 'Ask Zuru Agent anything…'
        }
      />

      {/* ── Booking Sheet Modal ──────────────────────────────────────────── */}
      {selectedBookingCard ? (
        <BookingSheet
          visible={Boolean(selectedBookingCard)}
          reel={createReelRowFromCard(selectedBookingCard)}
          onClose={() => setSelectedBookingCard(null)}
          onSuccess={() => setSelectedBookingCard(null)}
        />
      ) : null}

      {/* ── Experience Preview Modal ─────────────────────────────────────── */}
      {selectedViewerCard ? (
        <Modal
          visible={Boolean(selectedViewerCard)}
          animationType="slide"
          onRequestClose={() => setSelectedViewerCard(null)}
        >
          <View style={styles.viewerContainer}>
            <Pressable
              onPress={() => setSelectedViewerCard(null)}
              style={[styles.closeViewerBtn, { top: insets.top + 10 }]}
              hitSlop={12}
            >
              <Feather name="x" size={24} color="#FFFFFF" />
            </Pressable>
            <ReelCard
              reel={createReelRowFromCard(selectedViewerCard)}
              isActive={true}
              height={winHeight}
            />
          </View>
        </Modal>
      ) : null}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AI_COLORS.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: AI_COLORS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: AI_COLORS.border,
    zIndex: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AI_COLORS.bgCardAlt,
    borderWidth: 1,
    borderColor: AI_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoMini: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: AI_COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    ...AI_SHADOW.orange,
  },
  logoMiniEmoji: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.textPrimary,
  },
  aiBadge: {
    backgroundColor: AI_COLORS.orangeSoft,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  aiBadgeText: {
    fontSize: 8,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.orange,
    letterSpacing: 0.5,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AI_COLORS.success,
  },
  onlineText: {
    fontSize: 11,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textSecondary,
  },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Offline Banner
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  offlineText: {
    fontSize: 12,
    fontFamily: AI_FONTS.medium,
    color: '#92400E',
    flex: 1,
  },

  // Messages
  emptyContainer: {
    flex: 1,
  },
  messagesList: {
    paddingVertical: 16,
    paddingBottom: 20,
  },

  // Loading Footer
  loadingFooter: {
    gap: 8,
    marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: AI_COLORS.orangeSoft,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: AI_RADIUS.full,
    marginLeft: 16,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: AI_FONTS.medium,
    color: AI_COLORS.orange,
  },

  // Error Card
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: AI_RADIUS.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 10,
  },
  errorText: {
    fontSize: 12,
    fontFamily: AI_FONTS.regular,
    color: '#B91C1C',
    flex: 1,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: AI_RADIUS.sm,
  },
  retryText: {
    fontSize: 12,
    fontFamily: AI_FONTS.bold,
    color: '#FFFFFF',
  },

  // Chips bar
  chipsBar: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: AI_COLORS.border,
    backgroundColor: AI_COLORS.bgCard,
  },

  // Viewer Modal
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  closeViewerBtn: {
    position: 'absolute',
    right: 18,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
