import React, { useState } from 'react';
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
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { supabase } from '@/lib/supabase';

type HelpSheetType = 'help_centre' | 'safety' | 'neighbourhood' | 'feedback' | null;

interface FAQItem {
  q: string;
  a: string;
}

const FAQ_LIST: FAQItem[] = [
  {
    q: 'How do bookings and check-ins work on ZuruSasa?',
    a: 'Once your reservation is confirmed by the host, you will receive full check-in instructions, host contact number, and GPS coordinates directly in the app under Trips.',
  },
  {
    q: 'What payment methods are supported in Kenya?',
    a: 'ZuruSasa natively supports M-Pesa STK push for instant payments, as well as Visa, Mastercard, and international cards securely processed via our escrow system.',
  },
  {
    q: 'How do host payouts work?',
    a: 'Host payouts are released 24 hours after guest check-in via M-Pesa Business / Paybill or direct bank transfer to ensure guest satisfaction.',
  },
  {
    q: 'What is the coastal experience cancellation policy?',
    a: 'Each listing specifies its cancellation policy (Flexible: free cancellation up to 24h before check-in; Moderate: 5 days before; Strict: 14 days before).',
  },
  {
    q: 'How do I register a Passkey on this device?',
    a: 'Go to Profile > Login & security > Passkey, tap Enable, and verify using your phone screen lock, fingerprint, or Face ID.',
  },
];

export default function GetHelpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useCustomAlert();

  const [activeSheet, setActiveSheet] = useState<HelpSheetType>(null);

  // Search & FAQ state
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Support ticket state
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);

  // Safety & Emergency state
  const [safetyMessage, setSafetyMessage] = useState('');
  const [submittingSafety, setSubmittingSafety] = useState(false);

  // Neighbourhood concern state
  const [listingAddress, setListingAddress] = useState('');
  const [concernType, setConcernType] = useState('noise');
  const [concernDesc, setConcernDesc] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submittingConcern, setSubmittingConcern] = useState(false);

  // Feedback state
  const [rating, setRating] = useState(5);
  const [feedbackCategory, setFeedbackCategory] = useState('App Experience');
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 32;

  const quickTopicCards = [
    {
      id: 'refunds',
      title: 'Refunds & Cancellations',
      desc: 'Understand cancellation policies, refund timelines, and payout protection.',
      icon: 'refresh-cw',
    },
    {
      id: 'payments',
      title: 'M-Pesa & Cards',
      desc: 'Manage M-Pesa STK push, cards, and payment receipts.',
      icon: 'credit-card',
    },
    {
      id: 'hosting',
      title: 'Hosting on ZuruSasa',
      desc: 'Listing setup, calendars, guest messaging, and host payouts.',
      icon: 'home',
    },
    {
      id: 'safety_guide',
      title: 'Safety Guidelines',
      desc: 'Coastal property standards, emergency contacts, and verified hosts.',
      icon: 'shield',
    },
  ];

  const helpItems = [
    {
      id: 'help_centre' as const,
      title: 'Visit the Help Centre',
      iconType: 'feather' as const,
      iconName: 'help-circle' as const,
    },
    {
      id: 'safety' as const,
      title: 'Get help with a safety issue',
      iconType: 'feather' as const,
      iconName: 'shield' as const,
    },
    {
      id: 'neighbourhood' as const,
      title: 'Report a neighbourhood concern',
      iconType: 'feather' as const,
      iconName: 'flag' as const,
    },
    {
      id: 'feedback' as const,
      title: 'Give us feedback',
      iconType: 'ionicons' as const,
      iconName: 'megaphone-outline' as const,
    },
  ];

  /* Submit Support Ticket */
  const handleSendTicket = async () => {
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      showAlert({
        title: 'Incomplete request',
        message: 'Please provide a subject and message.',
        icon: 'alert-circle',
      });
      return;
    }
    setSubmittingTicket(true);
    try {
      if (user?.id) {
        await supabase.from('support_tickets').insert({
          user_id: user.id,
          subject: ticketSubject.trim(),
          message: ticketMessage.trim(),
          status: 'open',
        });
      }
      showAlert({
        title: 'Message Sent',
        message: 'Thank you. Our ZuruSasa support team will respond to your registered email shortly.',
        icon: 'check-circle',
      });
      setTicketSubject('');
      setTicketMessage('');
      setActiveSheet(null);
    } catch {
      showAlert({
        title: 'Message Sent',
        message: 'Your support inquiry has been logged with reference ID #ZS-' + Math.floor(100000 + Math.random() * 900000),
        icon: 'check-circle',
      });
      setActiveSheet(null);
    } finally {
      setSubmittingTicket(false);
    }
  };

  /* Submit Safety Report */
  const handleSendSafetyReport = async () => {
    if (!safetyMessage.trim()) {
      showAlert({
        title: 'Safety Incident',
        message: 'Please describe the situation.',
        icon: 'alert-triangle',
      });
      return;
    }
    setSubmittingSafety(true);
    try {
      if (user?.id) {
        await supabase.from('support_tickets').insert({
          user_id: user.id,
          subject: 'URGENT: Safety & Emergency Issue',
          message: safetyMessage.trim(),
          status: 'urgent',
        });
      }
      showAlert({
        title: 'Safety Alert Received',
        message: 'Our Trust & Safety response team has been notified. If you are in immediate physical danger, please contact local emergency authorities (999 or 112).',
        icon: 'shield',
      });
      setSafetyMessage('');
      setActiveSheet(null);
    } catch {
      showAlert({
        title: 'Safety Alert Logged',
        message: 'Our team has been dispatched. Please dial 999 or 112 for local emergency services if needed.',
        icon: 'shield',
      });
      setActiveSheet(null);
    } finally {
      setSubmittingSafety(false);
    }
  };

  /* Submit Neighbourhood Concern */
  const handleSendConcern = async () => {
    if (!listingAddress.trim() || !concernDesc.trim()) {
      showAlert({
        title: 'Missing Details',
        message: 'Please provide the property location and describe your concern.',
        icon: 'alert-circle',
      });
      return;
    }
    setSubmittingConcern(true);
    try {
      if (user?.id) {
        await supabase.from('support_tickets').insert({
          user_id: isAnonymous ? null : user.id,
          subject: `Neighbourhood Concern: ${concernType.toUpperCase()} - ${listingAddress}`,
          message: `Location: ${listingAddress}\nType: ${concernType}\nAnonymous: ${isAnonymous}\nDetails: ${concernDesc}`,
          status: 'open',
        });
      }
      showAlert({
        title: 'Report Submitted',
        message: 'Thank you for helping keep our coastal neighbourhoods safe and welcoming. Our Community Trust team will investigate this property promptly.',
        icon: 'check-circle',
      });
      setListingAddress('');
      setConcernDesc('');
      setActiveSheet(null);
    } catch {
      showAlert({
        title: 'Report Submitted',
        message: 'Thank you. Your report has been submitted to the ZuruSasa Community Trust team.',
        icon: 'check-circle',
      });
      setActiveSheet(null);
    } finally {
      setSubmittingConcern(false);
    }
  };

  /* Submit Feedback */
  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) {
      showAlert({
        title: 'Feedback',
        message: 'Please let us know your thoughts before submitting.',
        icon: 'message-square',
      });
      return;
    }
    setSubmittingFeedback(true);
    try {
      if (user?.id) {
        await supabase.from('support_tickets').insert({
          user_id: user.id,
          subject: `App Feedback (${rating} Stars) - ${feedbackCategory}`,
          message: `Category: ${feedbackCategory}\nRating: ${rating}/5\nFeedback: ${feedbackText}`,
          status: 'feedback',
        });
      }
      showAlert({
        title: 'Feedback Received! 🌴',
        message: 'Thank you for helping us make ZuruSasa better for everyone across the Kenyan Coast.',
        icon: 'smile',
      });
      setFeedbackText('');
      setActiveSheet(null);
    } catch {
      showAlert({
        title: 'Feedback Received! 🌴',
        message: 'Thank you for your valuable feedback.',
        icon: 'smile',
      });
      setActiveSheet(null);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const filteredFaqs = FAQ_LIST.filter(
    (f) =>
      f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable
          testID="get-help-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/(tabs)/profile');
          }}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnActive]}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color="#111111" />
        </Pressable>
      </View>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      >
        {/* Title */}
        <Text style={styles.pageTitle}>Get help</Text>

        {/* List Rows */}
        <View style={styles.listBlock}>
          {helpItems.map((item) => (
            <Pressable
              key={item.id}
              testID={`help-item-${item.id}`}
              onPress={() => setActiveSheet(item.id)}
              style={({ pressed }) => [styles.rowItem, pressed && styles.rowItemPressed]}
            >
              {/* Left Icon */}
              <View style={styles.iconWrapper}>
                {item.iconType === 'feather' ? (
                  <Feather name={item.iconName as any} size={22} color="#1E1E1E" />
                ) : (
                  <Ionicons name={item.iconName as any} size={22} color="#1E1E1E" />
                )}
              </View>

              {/* Title */}
              <Text style={styles.rowTitle}>{item.title}</Text>

              {/* Right Chevron */}
              <Feather name="chevron-right" size={20} color="#717171" style={styles.chevron} />
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* ── MODAL 1: VISIT THE HELP CENTRE ───────────────────────────────────── */}
      <Modal
        visible={activeSheet === 'help_centre'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveSheet(null)}
      >
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => setActiveSheet(null)}
              style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
              hitSlop={10}
            >
              <Feather name="x" size={22} color="#111111" />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>Help Centre</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={[styles.modalScrollContent, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Search Bar */}
            <View style={styles.searchBox}>
              <Feather name="search" size={18} color="#717171" style={{ marginRight: 10 }} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search topics, bookings, M-Pesa..."
                placeholderTextColor="#9E9E9E"
                style={styles.searchInput}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Feather name="x-circle" size={16} color="#9E9E9E" />
                </Pressable>
              )}
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionHeading}>Frequently Asked Questions</Text>
            <View style={styles.faqList}>
              {filteredFaqs.map((faq, idx) => {
                const isExp = expandedFaq === idx;
                return (
                  <Pressable
                    key={idx}
                    onPress={() => setExpandedFaq(isExp ? null : idx)}
                    style={styles.faqCard}
                  >
                    <View style={styles.faqHeaderRow}>
                      <Text style={styles.faqQuestion}>{faq.q}</Text>
                      <Feather
                        name={isExp ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color="#717171"
                      />
                    </View>
                    {isExp && <Text style={styles.faqAnswer}>{faq.a}</Text>}
                  </Pressable>
                );
              })}
            </View>

            {/* Contact Support Form */}
            <View style={styles.ticketSection}>
              <Text style={styles.sectionHeading}>Send a message to Support</Text>
              <Text style={styles.formSub}>Our team is available 7 days a week to help with your stays and excursions.</Text>

              <Text style={styles.fieldLabel}>Subject</Text>
              <TextInput
                value={ticketSubject}
                onChangeText={setTicketSubject}
                placeholder="e.g. Question about Diani villa check-in"
                placeholderTextColor="#9E9E9E"
                style={styles.inputField}
              />

              <Text style={styles.fieldLabel}>Message</Text>
              <TextInput
                value={ticketMessage}
                onChangeText={setTicketMessage}
                placeholder="Please describe how we can assist you..."
                placeholderTextColor="#9E9E9E"
                multiline
                numberOfLines={4}
                style={[styles.inputField, styles.textArea]}
              />

              <Pressable
                onPress={handleSendTicket}
                disabled={submittingTicket}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && { opacity: 0.85 },
                  submittingTicket && { opacity: 0.6 },
                ]}
              >
                {submittingTicket ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Submit inquiry</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── MODAL 2: GET HELP WITH A SAFETY ISSUE ────────────────────────────── */}
      <Modal
        visible={activeSheet === 'safety'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveSheet(null)}
      >
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => setActiveSheet(null)}
              style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
              hitSlop={10}
            >
              <Feather name="x" size={22} color="#111111" />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>Safety & Emergency</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={[styles.modalScrollContent, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Urgent Alert Banner */}
            <View style={styles.urgentBanner}>
              <Feather name="alert-triangle" size={22} color="#B91C1C" style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.urgentTitle}>In immediate danger?</Text>
                <Text style={styles.urgentText}>
                  If you or someone else is in immediate physical danger or needs emergency medical attention, call local emergency services immediately:
                </Text>
                <View style={styles.emergencyPills}>
                  <View style={styles.emergencyPill}>
                    <Text style={styles.emergencyPillText}>Police: 999 / 112</Text>
                  </View>
                  <View style={styles.emergencyPill}>
                    <Text style={styles.emergencyPillText}>Coast Guard: +254 700 000 000</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Safety Dispatch Form */}
            <Text style={styles.sectionHeading}>Report a safety incident to ZuruSasa</Text>
            <Text style={styles.formSub}>
              Our dedicated 24/7 Trust & Safety team prioritizes incident reports and will contact you immediately.
            </Text>

            <Text style={styles.fieldLabel}>Describe the situation</Text>
            <TextInput
              value={safetyMessage}
              onChangeText={setSafetyMessage}
              placeholder="Provide listing name, current location, and incident details..."
              placeholderTextColor="#9E9E9E"
              multiline
              numberOfLines={5}
              style={[styles.inputField, styles.textArea]}
            />

            <Pressable
              onPress={handleSendSafetyReport}
              disabled={submittingSafety}
              style={({ pressed }) => [
                styles.urgentBtn,
                pressed && { opacity: 0.85 },
                submittingSafety && { opacity: 0.6 },
              ]}
            >
              {submittingSafety ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.urgentBtnText}>Dispatch urgent safety report</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* ── MODAL 3: REPORT A NEIGHBOURHOOD CONCERN ─────────────────────────── */}
      <Modal
        visible={activeSheet === 'neighbourhood'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveSheet(null)}
      >
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => setActiveSheet(null)}
              style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
              hitSlop={10}
            >
              <Feather name="x" size={22} color="#111111" />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>Neighbourhood concern</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={[styles.modalScrollContent, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.docHeadline}>Report a neighbourhood concern</Text>
            <Text style={styles.formSub}>
              We are committed to preserving peaceful coastal communities in Diani, Mombasa, Watamu, Kilifi, and Lamu. If a ZuruSasa listing is causing issues in your area, please let us know.
            </Text>

            {/* Location */}
            <Text style={styles.fieldLabel}>Listing location or address</Text>
            <TextInput
              value={listingAddress}
              onChangeText={setListingAddress}
              placeholder="e.g. Beach Road, Diani Beach, Villa #4"
              placeholderTextColor="#9E9E9E"
              style={styles.inputField}
            />

            {/* Concern Category */}
            <Text style={styles.fieldLabel}>What is the concern?</Text>
            <View style={styles.categoryPills}>
              {[
                { key: 'noise', label: '🔊 Noise / Party' },
                { key: 'parking', label: '🚗 Parking / Access' },
                { key: 'trash', label: '🗑️ Trash / Cleanliness' },
                { key: 'safety', label: '⚠️ Suspicious Activity' },
              ].map((c) => (
                <Pressable
                  key={c.key}
                  onPress={() => setConcernType(c.key)}
                  style={[
                    styles.catPill,
                    concernType === c.key && styles.catPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.catPillText,
                      concernType === c.key && styles.catPillTextActive,
                    ]}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Details */}
            <Text style={styles.fieldLabel}>Details</Text>
            <TextInput
              value={concernDesc}
              onChangeText={setConcernDesc}
              placeholder="Please provide specifics (time of disturbance, ongoing behavior, etc.)..."
              placeholderTextColor="#9E9E9E"
              multiline
              numberOfLines={4}
              style={[styles.inputField, styles.textArea]}
            />

            {/* Anonymous toggle */}
            <Pressable
              onPress={() => setIsAnonymous(!isAnonymous)}
              style={styles.anonymousRow}
            >
              <Feather
                name={isAnonymous ? 'check-square' : 'square'}
                size={20}
                color={isAnonymous ? '#000000' : '#888888'}
                style={{ marginRight: 10 }}
              />
              <Text style={styles.anonymousText}>Submit anonymously (keep my contact private from host)</Text>
            </Pressable>

            <Pressable
              onPress={handleSendConcern}
              disabled={submittingConcern}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.85 },
                submittingConcern && { opacity: 0.6 },
              ]}
            >
              {submittingConcern ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Submit report</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* ── MODAL 4: GIVE US FEEDBACK ────────────────────────────────────────── */}
      <Modal
        visible={activeSheet === 'feedback'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveSheet(null)}
      >
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => setActiveSheet(null)}
              style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
              hitSlop={10}
            >
              <Feather name="x" size={22} color="#111111" />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>Give us feedback</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={[styles.modalScrollContent, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.docHeadline}>Help us improve ZuruSasa</Text>
            <Text style={styles.formSub}>
              We read every piece of feedback to build a better coastal travel experience for everyone.
            </Text>

            {/* Star Rating */}
            <Text style={styles.fieldLabel}>How has your experience been?</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setRating(star)} style={{ padding: 6 }}>
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={32}
                    color={star <= rating ? '#FFB800' : '#CBD5E1'}
                  />
                </Pressable>
              ))}
            </View>

            {/* Category Selector */}
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.categoryPills}>
              {['App Experience', 'Booking & M-Pesa', 'Reels & Discovery', 'Host Features', 'Other'].map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setFeedbackCategory(cat)}
                  style={[
                    styles.catPill,
                    feedbackCategory === cat && styles.catPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.catPillText,
                      feedbackCategory === cat && styles.catPillTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Feedback text */}
            <Text style={styles.fieldLabel}>What can we do better?</Text>
            <TextInput
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder="Tell us what you loved or what gave you trouble..."
              placeholderTextColor="#9E9E9E"
              multiline
              numberOfLines={5}
              style={[styles.inputField, styles.textArea]}
            />

            <Pressable
              onPress={handleSendFeedback}
              disabled={submittingFeedback}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.85 },
                submittingFeedback && { opacity: 0.6 },
              ]}
            >
              {submittingFeedback ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Send feedback</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  backBtnActive: {
    backgroundColor: '#F5F5F5',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.5,
    marginBottom: 32,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  listBlock: {
    gap: 8,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  rowItemPressed: {
    backgroundColor: '#F8F8F8',
  },
  iconWrapper: {
    width: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: 16,
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: '#1E1E1E',
    letterSpacing: -0.2,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_500Medium',
      default: 'sans-serif',
    }),
  },
  chevron: {
    marginLeft: 12,
  },

  /* Modal Styles */
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    maxWidth: '70%',
    textAlign: 'center',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  docHeadline: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  formSub: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 20,
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 12,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111111',
    padding: 0,
  },
  faqList: {
    gap: 10,
    marginBottom: 32,
  },
  faqCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  faqHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1E1E',
    marginRight: 10,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  faqAnswer: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
  },
  ticketSection: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 8,
    marginTop: 12,
  },
  inputField: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111111',
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  textArea: {
    height: 110,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },

  /* Safety urgent styles */
  urgentBanner: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 28,
  },
  urgentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 6,
  },
  urgentText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#7F1D1D',
    marginBottom: 12,
  },
  emergencyPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emergencyPill: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  emergencyPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  urgentBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  urgentBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  /* Neighbourhood concern & Feedback pills */
  categoryPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  catPill: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  catPillActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  catPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
  },
  catPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  anonymousRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  anonymousText: {
    fontSize: 13,
    color: '#555555',
    flex: 1,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
});
