import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
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
import { AIStatusCapsule } from '@/components/ai/AIStatusCapsule';
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
  const { initialPrompt, conversationId } = useLocalSearchParams<{
    initialPrompt?: string;
    conversationId?: string;
  }>();
  const { isOnline } = useNetworkStatus();
  const { user } = useAuth();
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const {
    messages,
    isLoading,
    isStreaming,
    stageStatus,
    error,
    lastMeta,
    sendMessage,
    stopGeneration,
    clearMessages,
    retryLastMessage,
    resumeInterruptedMessage,
  } = useZuruAI(conversationId);

  const [inputText, setInputText] = useState('');
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    city?: string;
    latitude?: number;
    longitude?: number;
  } | null>(null);
  const listRef = useRef<FlatList>(null);

  // BookingSheet & Immersive ReelCard Viewer State
  const [selectedBookingCard, setSelectedBookingCard] = useState<AICard | null>(null);
  const [selectedViewerCard, setSelectedViewerCard] = useState<AICard | null>(null);

  const toggleSaveMutation = useToggleSave();

  // Detect user location for location-grounded queries
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

  // Convert AICard into ReelRow strictly with real listing data
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
      experience: rawExp
        ? {
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
          }
        : ({
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
          } as any),
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

  const handleSaveCard = useCallback(
    (id: string, card: AICard) => {
      if (!user) {
        router.push('/auth' as any);
        return;
      }
      const reelId = card.reelId || id;
      toggleSaveMutation.mutate({ reelId, userId: user.id, saved: false });
    },
    [user, router, toggleSaveMutation]
  );

  // Filter messages to avoid displaying empty placeholder bubbles while loading
  const visibleMessages = useMemo(() => {
    return messages.filter((m) => {
      if (m.role === 'ai' && !m.text.trim() && (!m.cards || m.cards.length === 0)) {
        return false;
      }
      return true;
    });
  }, [messages]);

  // Contextual follow-up suggestions from latest AI message or search criteria
  const latestAiMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'ai') return messages[i];
    }
    return null;
  }, [messages]);

  const activeFollowUps = useMemo(() => {
    if (latestAiMessage?.followUps && latestAiMessage.followUps.length > 0) {
      return latestAiMessage.followUps.slice(0, 4);
    }
    const criteria = latestAiMessage?.criteria;
    const list: string[] = [];
    if (criteria?.budget_max) {
      list.push(`Cheaper options under KES ${Math.round(criteria.budget_max * 0.8).toLocaleString()}`);
    } else {
      list.push('Cheaper options');
    }
    if (!criteria?.amenities?.some((a: string) => a.toLowerCase().includes('beach'))) {
      list.push('Near the beach');
    }
    if (!criteria?.amenities?.some((a: string) => a.toLowerCase().includes('pool'))) {
      list.push('With a pool');
    }
    if (!criteria?.guests || criteria.guests <= 2) {
      list.push('For more people');
    } else {
      list.push('For 4+ guests');
    }
    return list.slice(0, 4);
  }, [latestAiMessage]);

  const handleClearWithConfirm = () => {
    setShowOptionsMenu(false);
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to clear your current conversation with Zuru Agent?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: clearMessages,
        },
      ]
    );
  };

  const handleNewInquiry = () => {
    setShowOptionsMenu(false);
    clearMessages();
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Refined Minimal Header ────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.headerIconButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={20} color={AI_COLORS.textPrimary} />
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={styles.identityIcon}>
            <MaterialCommunityIcons name="compass-outline" size={18} color="#FFFFFF" />
          </View>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerTitle}>Zuru Agent</Text>
            <View style={styles.subtitleRow}>
              <Text style={styles.headerSubtitle}>Your personal travel concierge</Text>
              {!isOnline ? (
                <View style={styles.offlineDotWrap}>
                  <View style={styles.offlineDot} />
                  <Text style={styles.offlineBadgeText}>Offline</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <Pressable
            onPress={() => router.push('/ai/history' as any)}
            style={styles.headerIconButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="View history"
          >
            <Feather name="clock" size={18} color={AI_COLORS.textSecondary} />
          </Pressable>

          <Pressable
            onPress={() => setShowOptionsMenu(true)}
            style={styles.headerIconButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <Feather name="more-vertical" size={18} color={AI_COLORS.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* ── Offline Banner ─────────────────────────────────────────────────── */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Feather name="wifi-off" size={14} color="#B45309" />
          <Text style={styles.offlineText}>
            You are offline. Connect to internet to search ZuruSasa listings.
          </Text>
        </View>
      )}

      {/* ── Degraded AI Mode Notice ────────────────────────────────────────── */}
      {lastMeta?.degraded && isOnline && (
        <View style={styles.degradedBanner}>
          <Feather name="info" size={13} color="#B45309" />
          <Text style={styles.degradedBannerText}>
            Direct catalog matching active. Results are filtered from verified listings.
          </Text>
        </View>
      )}

      {/* ── Conversation Message Stream ────────────────────────────────────── */}
      {visibleMessages.length === 0 && !isLoading ? (
        <View style={styles.emptyContainer}>
          <AIEmptyState onSuggestionSelect={handleSuggestion} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={visibleMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <View>
              <AIMessageBubble
                message={item}
                isLatest={index === visibleMessages.length - 1}
                onOpen={handleOpenCard}
                onBook={handleBookCard}
                onSave={handleSaveCard}
              />
              {item.interrupted && (
                <Pressable
                  onPress={() => item.clientMessageId && resumeInterruptedMessage(item.clientMessageId)}
                  style={styles.interruptedPill}
                  accessibilityRole="button"
                  accessibilityLabel="Connection interrupted. Tap to complete."
                >
                  <Feather name="rotate-cw" size={12} color="#B45309" />
                  <Text style={styles.interruptedPillText}>
                    Connection interrupted — tap to complete
                  </Text>
                </Pressable>
              )}
            </View>
          )}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            isLoading ? (
              <AIStatusCapsule
                stage={stageStatus.stage as any}
                text={stageStatus.text}
                onStop={stopGeneration}
              />
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
      {visibleMessages.length > 0 && !isLoading && isOnline ? (
        <View style={styles.chipsBar}>
          <AISuggestionChips
            chips={activeFollowUps}
            onSelect={handleSuggestion}
          />
        </View>
      ) : null}

      {/* ── Bottom Message Composer ──────────────────────────────────────── */}
      <AIInputBar
        value={inputText}
        onChangeText={setInputText}
        onSend={handleSend}
        disabled={isLoading || !isOnline}
        placeholder={!isOnline ? 'Connect to internet to chat…' : 'Ask me anything about your trip...'}
      />

      {/* ── More Options Modal Action Sheet ──────────────────────────────── */}
      <Modal
        visible={showOptionsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsMenu(false)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setShowOptionsMenu(false)}
        >
          <View
            style={[
              styles.menuSheet,
              { paddingBottom: Math.max(insets.bottom, 16) + 8 },
            ]}
          >
            <View style={styles.menuDragHandle} />

            <Pressable
              style={styles.menuItem}
              onPress={handleNewInquiry}
            >
              <Feather name="plus-circle" size={18} color={AI_COLORS.textPrimary} />
              <Text style={styles.menuItemText}>Start new trip inquiry</Text>
            </Pressable>

            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setShowOptionsMenu(false);
                router.push('/ai/history' as any);
              }}
            >
              <Feather name="clock" size={18} color={AI_COLORS.textPrimary} />
              <Text style={styles.menuItemText}>View conversation history</Text>
            </Pressable>

            <Pressable
              style={[styles.menuItem, styles.menuItemDestructive]}
              onPress={handleClearWithConfirm}
            >
              <Feather name="trash-2" size={18} color="#DC2626" />
              <Text style={[styles.menuItemText, { color: '#DC2626' }]}>
                Clear conversation
              </Text>
            </Pressable>

            <Pressable
              style={styles.menuCancelBtn}
              onPress={() => setShowOptionsMenu(false)}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── Booking Sheet Modal (Real Booking Flow) ──────────────────────── */}
      {selectedBookingCard ? (
        <BookingSheet
          visible={Boolean(selectedBookingCard)}
          reel={createReelRowFromCard(selectedBookingCard)}
          onClose={() => setSelectedBookingCard(null)}
          onSuccess={() => setSelectedBookingCard(null)}
        />
      ) : null}

      {/* ── Immersive Reel Viewer Modal (Real View Flow) ─────────────────── */}
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
    backgroundColor: '#FAFAFA',
  },

  // Minimal Refined Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    zIndex: 10,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 10,
  },
  identityIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: AI_COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    ...AI_SHADOW.subtle,
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerSubtitle: {
    fontSize: 11.5,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textSecondary,
  },
  offlineDotWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  offlineDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#EF4444',
  },
  offlineBadgeText: {
    fontSize: 10,
    fontFamily: AI_FONTS.medium,
    color: '#EF4444',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  // Messages list
  messagesList: {
    paddingVertical: 14,
  },
  emptyContainer: {
    flex: 1,
  },

  // Offline banner
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
    flex: 1,
    fontSize: 12,
    fontFamily: AI_FONTS.medium,
    color: '#92400E',
  },

  // Degraded mode notice
  degradedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#FEE3A2',
  },
  degradedBannerText: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: AI_FONTS.regular,
    color: '#B45309',
  },

  // Interrupted pill
  interruptedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: 52,
    marginTop: 4,
    marginBottom: 8,
    gap: 5,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  interruptedPillText: {
    fontSize: 11,
    fontFamily: AI_FONTS.medium,
    color: '#92400E',
  },

  // Error Card
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    gap: 8,
  },
  errorContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: AI_FONTS.regular,
    color: '#B91C1C',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AI_COLORS.orange,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retryText: {
    fontSize: 11.5,
    fontFamily: AI_FONTS.semibold,
    color: '#FFFFFF',
  },

  // Follow-up chips bar
  chipsBar: {
    paddingVertical: 6,
    backgroundColor: '#FAFAFA',
  },

  // Options Menu Action Sheet Modal
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 6,
  },
  menuDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemDestructive: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 14.5,
    fontFamily: AI_FONTS.medium,
    color: AI_COLORS.textPrimary,
  },
  menuCancelBtn: {
    marginTop: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCancelText: {
    fontSize: 14,
    fontFamily: AI_FONTS.semibold,
    color: AI_COLORS.textPrimary,
  },

  // Viewer Modal
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  closeViewerBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 50,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
