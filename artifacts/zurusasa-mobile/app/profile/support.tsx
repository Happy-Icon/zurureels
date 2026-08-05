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
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

interface TicketRow {
  id: string;
  subject: string;
  status: string;
  created_at: string;
}

const BROWSE_TOPICS = [
  {
    icon: 'briefcase',
    title: 'Bookings & stays',
    desc: 'Reservations, check-in, host rules & cancellation',
  },
  {
    icon: 'credit-card',
    title: 'Payments & refunds',
    desc: 'M-Pesa, receipts, pricing & refund policies',
  },
  {
    icon: 'user',
    title: 'Account & profile',
    desc: 'Login credentials, verification & privacy',
  },
  {
    icon: 'shield',
    title: 'Safety & trust',
    desc: 'Emergency assistance & community standards',
  },
] as const;

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

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 12;
  const bottomPad = Platform.OS === 'web' ? 110 : insets.bottom + 40;

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
      Alert.alert('Ticket submitted', 'Our support team will get back to you shortly.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to submit ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          testID="support-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/profile');
          }}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnActive]}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={20} color="#000000" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Get help</Text>
        </View>

        {/* ── BROWSE HELP TOPICS ───────────────────────────────────────────── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Browse topics</Text>
          {BROWSE_TOPICS.map((topic, idx) => (
            <React.Fragment key={topic.title}>
              <Pressable
                onPress={() => {}}
                style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              >
                <Feather name={topic.icon as any} size={22} color="#000000" style={styles.menuIcon} />
                <View style={styles.menuTextStack}>
                  <Text style={styles.menuRowTitle}>{topic.title}</Text>
                  <Text style={styles.menuRowSub}>{topic.desc}</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#94A3B8" />
              </Pressable>
              {idx < BROWSE_TOPICS.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── CONTACT SUPPORT ──────────────────────────────────────────────── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Contact us</Text>
          <Pressable
            onPress={() => setIsAdding(true)}
            style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
          >
            <Feather name="message-square" size={22} color="#000000" style={styles.menuIcon} />
            <View style={styles.menuTextStack}>
              <Text style={styles.menuRowTitle}>Submit a support ticket</Text>
              <Text style={styles.menuRowSub}>Get 24/7 assistance from the Zuru team</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </Pressable>
        </View>

        {/* ── YOUR TICKETS ─────────────────────────────────────────────────── */}
        {tickets.length > 0 && (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Your support tickets</Text>
            {tickets.map((t, idx) => (
              <React.Fragment key={t.id}>
                <View style={styles.menuRow}>
                  <Feather name="file-text" size={22} color="#000000" style={styles.menuIcon} />
                  <View style={styles.menuTextStack}>
                    <Text style={styles.menuRowTitle}>{t.subject}</Text>
                    <Text style={styles.menuRowSub}>Status: {t.status}</Text>
                  </View>
                </View>
                {idx < tickets.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── SUBMIT TICKET MODAL ──────────────────────────────────────────────── */}
      <Modal visible={isAdding} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Submit support ticket</Text>
              <Pressable onPress={() => setIsAdding(false)}>
                <Feather name="x" size={20} color="#000000" />
              </Pressable>
            </View>

            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="Subject"
              placeholderTextColor="#9CA3AF"
              style={styles.modalInput}
            />

            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Describe your issue..."
              placeholderTextColor="#9CA3AF"
              multiline
              style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]}
            />

            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={({ pressed }) => [styles.modalCtaBtn, pressed && { opacity: 0.9 }]}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalCtaBtnText}>Submit ticket</Text>
              )}
            </Pressable>
          </View>
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
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnActive: {
    backgroundColor: '#E5E7EB',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  titleSection: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.8,
  },
  sectionBlock: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  menuRowPressed: {
    opacity: 0.6,
  },
  menuIcon: {
    marginRight: 16,
  },
  menuTextStack: {
    flex: 1,
    paddingRight: 8,
  },
  menuRowTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  menuRowSub: {
    fontSize: 13,
    color: '#717171',
    marginTop: 2,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 2,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#000000',
  },
  modalCtaBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCtaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
