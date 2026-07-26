import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const SUPPORT_EMAIL = 'support@zurusasa.com';

interface TicketRow {
  id: string;
  subject: string;
  status: string;
  created_at: string;
}

const BROWSE_TOPICS = [
  {
    icon: 'calendar',
    title: 'Bookings & Stays',
    desc: 'Manage reservations, check-in details, and host rules',
  },
  {
    icon: 'credit-card',
    title: 'Payments & Refunds',
    desc: 'Payment methods, receipts, M-Pesa, and refund policies',
  },
  {
    icon: 'user',
    title: 'Account & Profile',
    desc: 'Login credentials, verification badges, and privacy',
  },
  {
    icon: 'shield',
    title: 'Safety & Security',
    desc: 'Emergency assistance, trust scores, and community rules',
  },
] as const;

function formatDate(d?: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ticketStatusStyle(status: string): { bg: string; fg: string } {
  if (status === 'resolved') return { bg: '#10B98118', fg: '#047857' };
  if (status === 'open' || status === 'in_progress') return { bg: '#3B82F618', fg: '#1D4ED8' };
  return { bg: '#F3F4F6', fg: '#4B5563' };
}

export default function HelpCenterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 40;

  useEffect(() => {
    const fetchTickets = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from('support_tickets')
          .select('*')
          .order('created_at', { ascending: false });
        if (data) setTickets(data as TicketRow[]);
      } catch (e) {
        console.error('Error fetching tickets:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, [user]);

  const handleSubmit = async () => {
    if (!subject || !message) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user?.id,
          subject,
          message,
          status: 'open',
        })
        .select()
        .single();
      if (error) throw error;
      setTickets((prev) => [data as TicketRow, ...prev]);
      setIsAdding(false);
      setSubject('');
      setMessage('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Submitted', "Ticket submitted! Our support team will get back to you soon.");
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to submit ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const contactWhatsApp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      '24/7 WhatsApp Support',
      'Our team is active on WhatsApp to assist with active bookings and emergencies. Average response time is under 2 minutes.',
    );
  };

  const contactPhone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Support Hotline', 'Calling ZuruSasa Support Line: +254 700 000 000');
  };

  return (
    <View style={[styles.fill, { backgroundColor: '#FFFFFF' }]}>
      {/* 1. Header Bar & Navigation */}
      <View style={[styles.topNavBar, { paddingTop: topPad }]}>
        <Pressable
          testID="support-back-btn"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (router.canGoBack()) router.back();
            else router.replace('/profile');
          }}
          style={({ pressed }) => [styles.backIconBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color="#222222" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPad }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>How can we help?</Text>
        </View>

        {/* Search Bar Refinement */}
        <View style={styles.searchPillBox}>
          <Feather name="search" size={18} color="#717171" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search help articles, policies & more..."
            placeholderTextColor="#717171"
            style={styles.searchInputText}
          />
        </View>

        {/* 2. Browse Topics Section Architecture (Vertical Native Rows) */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Browse by Topic</Text>

          {BROWSE_TOPICS.map((topic, index) => {
            const isLast = index === BROWSE_TOPICS.length - 1;
            return (
              <View key={topic.title}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Alert.alert(topic.title, `Showing help articles for ${topic.title}.`);
                  }}
                  style={({ pressed }) => [
                    styles.topicRow,
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <View style={styles.topicIconCircle}>
                    <Feather name={topic.icon as any} size={18} color="#222222" />
                  </View>
                  <View style={styles.topicTextStack}>
                    <Text style={styles.topicTitleText}>{topic.title}</Text>
                    <Text style={styles.topicDescText}>{topic.desc}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#717171" />
                </Pressable>
                {!isLast ? <View style={styles.rowDivider} /> : null}
              </View>
            );
          })}
        </View>

        <View style={styles.sectionDivider} />

        {/* 3. Direct Support Section (Low-Contrast Soft Card) */}
        <View style={styles.directSupportCard}>
          <Text style={styles.supportCardTitle}>Contact Customer Support</Text>
          <Text style={styles.supportCardSub}>
            Our team is available 24/7 to assist with active reservations or emergencies.
          </Text>

          <View style={styles.supportButtonsStack}>
            {/* WhatsApp Soft Green Button */}
            <Pressable
              testID="whatsapp-support"
              onPress={contactWhatsApp}
              style={({ pressed }) => [
                styles.whatsappBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <MaterialCommunityIcons name="whatsapp" size={18} color="#008A05" />
              <Text style={styles.whatsappBtnText}>24/7 WhatsApp Chat</Text>
            </Pressable>

            {/* Phone Support Outlined Button */}
            <Pressable
              testID="call-support"
              onPress={contactPhone}
              style={({ pressed }) => [
                styles.phoneBtn,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Feather name="phone" size={16} color="#222222" />
              <Text style={styles.phoneBtnText}>Call Support Hotline</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionDivider} />

        {/* 4. "Your Support Requests" (Tickets Section) */}
        <View style={styles.sectionBlock}>
          <View style={styles.ticketsHeaderRow}>
            <Text style={styles.sectionHeading}>Active Requests</Text>
            <Pressable
              testID="create-ticket"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsAdding(true);
              }}
              hitSlop={8}
            >
              <Text style={styles.createTicketLink}>+ Create Ticket</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#EE7D30" />
            </View>
          ) : tickets.length === 0 ? (
            /* Clean Flat Empty State */
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Feather name="headphones" size={28} color="#717171" />
              </View>
              <Text style={styles.emptyHeadline}>No support tickets yet</Text>
              <Text style={styles.emptyBody}>
                Tap "+ Create Ticket" above if you need help with a reservation or account issue.
              </Text>
            </View>
          ) : (
            /* Populated Ticket List */
            <View style={styles.ticketListWrap}>
              {tickets.map((ticket) => {
                const sc = ticketStatusStyle(ticket.status);
                return (
                  <View key={ticket.id} style={styles.ticketRowCard}>
                    <View style={styles.ticketCardLeft}>
                      <Text style={styles.ticketSubjectText} numberOfLines={1}>
                        {ticket.subject}
                      </Text>
                      <Text style={styles.ticketDateText}>
                        Updated {formatDate(ticket.created_at)}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: sc.fg }]}>
                        {ticket.status === 'open' ? 'In Progress' : ticket.status}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* New Ticket Modal Sheet */}
      <Modal
        visible={isAdding}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAdding(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheetCard}>
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>New Support Request</Text>
              <Pressable
                onPress={() => setIsAdding(false)}
                style={styles.modalSheetCloseBtn}
                hitSlop={8}
              >
                <Feather name="x" size={20} color="#222222" />
              </Pressable>
            </View>

            <View style={styles.modalFormStack}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Subject</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    value={subject}
                    onChangeText={setSubject}
                    placeholder="Brief summary of your issue"
                    placeholderTextColor="#9CA3AF"
                    style={styles.inputText}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Details</Text>
                <View style={[styles.inputBox, styles.textAreaBox]}>
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Provide more information..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    style={[styles.inputText, styles.textAreaText]}
                  />
                </View>
              </View>

              <Pressable
                testID="submit-ticket"
                onPress={handleSubmit}
                disabled={submitting || !subject || !message}
                style={({ pressed }) => [
                  styles.submitBtn,
                  {
                    opacity: pressed || submitting || !subject || !message ? 0.75 : 1,
                  },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Ticket</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topNavBar: {
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    letterSpacing: -0.4,
  },
  searchPillBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F7F7F7',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
  },
  searchInputText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: '#222222',
  },
  sectionBlock: {
    gap: 4,
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    marginBottom: 12,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 12,
  },
  topicIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicTextStack: {
    flex: 1,
    gap: 2,
  },
  topicTitleText: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  topicDescText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginVertical: 24,
  },
  directSupportCard: {
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  supportCardTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  supportCardSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    lineHeight: 18,
  },
  supportButtonsStack: {
    gap: 10,
    marginTop: 4,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E6F7ED',
    borderRadius: 12,
    height: 46,
  },
  whatsappBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#008A05',
  },
  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 12,
    height: 46,
  },
  phoneBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  ticketsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  createTicketLink: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#EE7D30',
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyHeadline: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  ticketListWrap: {
    gap: 10,
  },
  ticketRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  ticketCardLeft: {
    flex: 1,
    gap: 4,
    paddingRight: 10,
  },
  ticketSubjectText: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  ticketDateText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    textTransform: 'capitalize',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalSheetTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  modalSheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFormStack: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  inputBox: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  inputText: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: '#222222',
  },
  textAreaBox: {
    minHeight: 110,
  },
  textAreaText: {
    textAlignVertical: 'top',
  },
  submitBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#EE7D30',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
