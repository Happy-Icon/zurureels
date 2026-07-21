import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ScreenHeader } from '@/components/profile/ScreenHeader';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/hooks/useColors';

const WHATSAPP_GREEN = '#25D366';
const SUPPORT_EMAIL = 'support@zurusasa.com';

interface TicketRow {
  id: string;
  subject: string;
  status: string;
  created_at: string;
}

const TOPICS = [
  { icon: 'calendar', label: 'Bookings', desc: 'Manage trips and reservations' },
  { icon: 'credit-card', label: 'Payments', desc: 'Refunds, taxes, and payouts' },
  { icon: 'user', label: 'Account', desc: 'Profile settings and security' },
  { icon: 'shield', label: 'Safety', desc: 'Trust and safety concerns' },
] as const;

function formatDate(d?: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ticketStatusColors(status: string): { bg: string; fg: string } {
  if (status === 'resolved') return { bg: '#d1fae5', fg: '#047857' };
  if (status === 'open') return { bg: '#dbeafe', fg: '#1d4ed8' };
  return { bg: '#e5e7eb', fg: '#4b5563' };
}

export default function SupportScreen() {
  const colors = useColors();
  const { user } = useAuth();

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchTickets = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setTickets(data as TicketRow[]);
      setLoading(false);
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
      Alert.alert('Submitted', "Ticket submitted! Our team will get back to you soon.");
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to submit ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const contactSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Live Support',
      `Our support team is available 24/7. Reach us at ${SUPPORT_EMAIL} — average response time is under 2 minutes on WhatsApp.`,
    );
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScreenHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Text style={[styles.heroTitle, { color: colors.foreground }]}>
          How can we help you today?
        </Text>
        <View
          style={[
            styles.searchBox,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            placeholder="Search for answers..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
        </View>

        {/* Topics */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Browse by Topic</Text>
        <View style={styles.topicGrid}>
          {TOPICS.map((t) => (
            <View
              key={t.label}
              style={[
                styles.topicCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={[styles.topicIcon, { backgroundColor: `${colors.primary}1A` }]}>
                <Feather name={t.icon} size={20} color={colors.primary} />
              </View>
              <Text style={[styles.topicLabel, { color: colors.foreground }]}>{t.label}</Text>
              <Text style={[styles.topicDesc, { color: colors.mutedForeground }]}>
                {t.desc}
              </Text>
            </View>
          ))}
        </View>

        {/* Live support */}
        <View
          style={[
            styles.liveCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.liveTitle, { color: colors.foreground }]}>
            Need to talk to someone?
          </Text>
          <Text style={[styles.mutedSmall, { color: colors.mutedForeground }]}>
            Our support team is available 24/7 to assist you.
          </Text>
          <Pressable
            testID="whatsapp-support"
            onPress={contactSupport}
            style={({ pressed }) => [
              styles.whatsappButton,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="whatsapp" size={19} color="#ffffff" />
            <Text style={styles.whatsappButtonText}>Chat on WhatsApp</Text>
          </Pressable>
          <Pressable
            testID="call-support"
            onPress={contactSupport}
            style={({ pressed }) => [
              styles.callButton,
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="phone" size={16} color={colors.foreground} />
            <Text style={[styles.callButtonText, { color: colors.foreground }]}>
              Call Support
            </Text>
          </Pressable>
        </View>

        {/* Tickets */}
        <View style={styles.ticketsHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
            Your Support Requests
          </Text>
          <Pressable
            testID="create-ticket"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsAdding(true);
            }}
            style={({ pressed }) => [
              styles.createButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Feather name="plus" size={15} color="#ffffff" />
            <Text style={styles.createButtonText}>Create Ticket</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : tickets.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No support tickets yet.
            </Text>
          </View>
        ) : (
          <View style={styles.ticketList}>
            {tickets.map((ticket) => {
              const sc = ticketStatusColors(ticket.status);
              return (
                <View
                  key={ticket.id}
                  style={[
                    styles.ticketCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.ticketId, { color: colors.mutedForeground }]}>
                      #{ticket.id.split('-')[0].toUpperCase()}
                    </Text>
                    <Text
                      style={[styles.ticketSubject, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {ticket.subject}
                    </Text>
                    <Text style={[styles.ticketDate, { color: colors.mutedForeground }]}>
                      {formatDate(ticket.created_at)}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusText, { color: sc.fg }]}>{ticket.status}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* New ticket modal */}
      <Modal visible={isAdding} transparent animationType="fade" onRequestClose={() => setIsAdding(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              New Support Request
            </Text>
            <Text style={[styles.mutedSmall, { color: colors.mutedForeground }]}>
              Describe your issue and we'll get back to you within 24 hours.
            </Text>
            <Text style={[styles.label, { color: colors.foreground }]}>Subject</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="What's the issue?"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  color: colors.foreground,
                  backgroundColor: colors.background,
                },
              ]}
            />
            <Text style={[styles.label, { color: colors.foreground }]}>Details</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Provide more information..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[
                styles.input,
                styles.textArea,
                {
                  borderColor: colors.border,
                  color: colors.foreground,
                  backgroundColor: colors.background,
                },
              ]}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setIsAdding(false)}
                style={({ pressed }) => [
                  styles.modalCancel,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.modalCancelText, { color: colors.foreground }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                testID="submit-ticket"
                onPress={handleSubmit}
                disabled={submitting || !subject || !message}
                style={({ pressed }) => [
                  styles.modalSubmit,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed || submitting || !subject || !message ? 0.7 : 1,
                  },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : null}
                <Text style={styles.modalSubmitText}>
                  {submitting ? 'Sending...' : 'Submit Ticket'}
                </Text>
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
  content: { padding: 16, paddingBottom: 48 },
  heroTitle: {
    fontSize: 28,
    fontFamily: 'InstrumentSerif_400Regular',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 28,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'DMSans_600SemiBold',
    marginBottom: 12,
  },
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  topicCard: {
    width: '47%',
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  topicIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  topicLabel: { fontSize: 14, fontFamily: 'DMSans_600SemiBold' },
  topicDesc: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
  liveCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    marginBottom: 28,
  },
  liveTitle: { fontSize: 16, fontFamily: 'DMSans_600SemiBold' },
  mutedSmall: { fontSize: 13, fontFamily: 'DMSans_400Regular' },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: WHATSAPP_GREEN,
    borderRadius: 999,
    paddingVertical: 12,
    marginTop: 6,
  },
  whatsappButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 12,
  },
  callButtonText: { fontSize: 14, fontFamily: 'DMSans_500Medium' },
  ticketsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
  },
  loadingBox: { paddingVertical: 32, alignItems: 'center' },
  emptyBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    fontStyle: 'italic',
  },
  ticketList: { gap: 10 },
  ticketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
  },
  ticketId: { fontSize: 10, fontFamily: 'DMSans_500Medium' },
  ticketSubject: { fontSize: 14, fontFamily: 'DMSans_600SemiBold', marginTop: 2 },
  ticketDate: { fontSize: 11, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    textTransform: 'capitalize',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    alignSelf: 'stretch',
    borderRadius: 18,
    padding: 20,
    gap: 8,
  },
  modalTitle: { fontSize: 18, fontFamily: 'DMSans_700Bold' },
  label: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    marginTop: 10,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalCancel: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  modalCancelText: { fontSize: 14, fontFamily: 'DMSans_500Medium' },
  modalSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  modalSubmitText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
  },
});
