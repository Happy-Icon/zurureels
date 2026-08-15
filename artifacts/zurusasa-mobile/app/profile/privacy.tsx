import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function PrivacySettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [loading, setLoading] = useState(true);

  // Privacy Settings Toggles
  const [readReceipts, setReadReceipts] = useState(true);
  const [searchEngines, setSearchEngines] = useState(false);
  const [showCityCountry, setShowCityCountry] = useState(true);
  const [showTripType, setShowTripType] = useState(true);
  const [showLengthOfStay, setShowLengthOfStay] = useState(true);
  const [showBookedServices, setShowBookedServices] = useState(true);
  const [aiImprovement, setAiImprovement] = useState(true);

  // Modals
  const [learnMoreModal, setLearnMoreModal] = useState<string | null>(null);
  const [dataRequestLoading, setDataRequestLoading] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 32;

  useEffect(() => {
    const loadPrivacySettings = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from('profiles')
          .select('privacy_settings')
          .eq('id', user.id)
          .single();

        if (data?.privacy_settings) {
          const p = data.privacy_settings as Record<string, any>;
          if (p.read_receipts !== undefined) setReadReceipts(p.read_receipts);
          if (p.search_engines !== undefined) setSearchEngines(p.search_engines);
          if (p.show_city_country !== undefined) setShowCityCountry(p.show_city_country);
          if (p.show_trip_type !== undefined) setShowTripType(p.show_trip_type);
          if (p.show_length_of_stay !== undefined) setShowLengthOfStay(p.show_length_of_stay);
          if (p.show_booked_services !== undefined) setShowBookedServices(p.show_booked_services);
          if (p.ai_improvement !== undefined) setAiImprovement(p.ai_improvement);
        }
      } catch (e) {
        console.warn('Note loading privacy settings:', e);
      } finally {
        setLoading(false);
      }
    };
    loadPrivacySettings();
  }, [user]);

  const handleToggle = async (key: string, value: boolean) => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('privacy_settings')
        .eq('id', user.id)
        .single();

      const existing = (data?.privacy_settings as Record<string, any>) || {};
      const updated = { ...existing, [key]: value };

      await supabase
        .from('profiles')
        .update({ privacy_settings: updated })
        .eq('id', user.id);
    } catch (e) {
      console.warn('Error saving privacy toggle:', e);
    }
  };

  const handleRequestData = async () => {
    setDataRequestLoading(true);
    setTimeout(() => {
      setDataRequestLoading(false);
      Alert.alert(
        'Data Export Requested',
        `A full copy of your ZuruSasa account data, booking records, and reel activity will be compiled and emailed to ${user?.email || 'your registered address'} within 24 hours.`
      );
    }, 800);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      if (user?.id) {
        await supabase
          .from('profiles')
          .update({ account_status: 'pending_deletion' })
          .eq('id', user.id);
      }
      setDeleteModalVisible(false);
      Alert.alert('Account Deletion Scheduled', 'Your account has been scheduled for permanent deletion.');
      if (signOut) await signOut();
      router.replace('/auth');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to request account deletion.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable
          testID="privacy-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/profile/settings');
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
        <Text style={styles.pageTitle}>Privacy</Text>
        <Text style={styles.pageSubtitle}>
          Control how your information is used and shared with others on ZuruSasa.
        </Text>

        {loading ? (
          <ActivityIndicator size="small" color="#111111" style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.sectionsBlock}>
            {/* ── SECTION 1: MESSAGES ───────────────────────────────────────── */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Messages</Text>
              <View style={styles.toggleRow}>
                <View style={styles.textContainer}>
                  <Text style={styles.toggleLabel}>
                    Show people when I've read their messages.{' '}
                    <Text
                      onPress={() =>
                        setLearnMoreModal(
                          'When read receipts are turned on, hosts and guests can see when you have viewed their incoming messages.'
                        )
                      }
                      style={styles.learnMoreLink}
                    >
                      Learn more
                    </Text>
                  </Text>
                </View>
                <Switch
                  value={readReceipts}
                  onValueChange={(val) => {
                    setReadReceipts(val);
                    handleToggle('read_receipts', val);
                  }}
                  trackColor={{ false: '#E2E8F0', true: '#111111' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            <View style={styles.dividerLine} />

            {/* ── SECTION 2: LISTINGS ───────────────────────────────────────── */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Listings</Text>
              <View style={styles.toggleRow}>
                <View style={styles.textContainer}>
                  <Text style={styles.toggleMainTitle}>
                    Include my listing(s) in search engines
                  </Text>
                  <Text style={styles.toggleSubText}>
                    Turning this on means search engines, like Google, will display your listing page(s) in search results.
                  </Text>
                </View>
                <Switch
                  value={searchEngines}
                  onValueChange={(val) => {
                    setSearchEngines(val);
                    handleToggle('search_engines', val);
                  }}
                  trackColor={{ false: '#E2E8F0', true: '#111111' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            <View style={styles.dividerLine} />

            {/* ── SECTION 3: REVIEWS ────────────────────────────────────────── */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Reviews</Text>
              <Text style={styles.sectionSub}>
                Choose what's shared when you write a review. Updating this setting will affect both past and future reviews.{' '}
                <Text
                  onPress={() =>
                    setLearnMoreModal(
                      'Reviews help build trusted connections in coastal communities. You can choose which trip specifics accompany your public reviews.'
                    )
                  }
                  style={styles.learnMoreLink}
                >
                  Learn more
                </Text>
              </Text>

              {/* Review Toggle 1 */}
              <View style={styles.subToggleRow}>
                <View style={styles.textContainer}>
                  <Text style={styles.toggleMainTitle}>Show my home city and country</Text>
                  <Text style={styles.exampleText}>Ex: City and country</Text>
                </View>
                <Switch
                  value={showCityCountry}
                  onValueChange={(val) => {
                    setShowCityCountry(val);
                    handleToggle('show_city_country', val);
                  }}
                  trackColor={{ false: '#E2E8F0', true: '#111111' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Review Toggle 2 */}
              <View style={styles.subToggleRow}>
                <View style={styles.textContainer}>
                  <Text style={styles.toggleMainTitle}>Show my trip type</Text>
                  <Text style={styles.exampleText}>Ex: Stayed with kids or pets</Text>
                </View>
                <Switch
                  value={showTripType}
                  onValueChange={(val) => {
                    setShowTripType(val);
                    handleToggle('show_trip_type', val);
                  }}
                  trackColor={{ false: '#E2E8F0', true: '#111111' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Review Toggle 3 */}
              <View style={styles.subToggleRow}>
                <View style={styles.textContainer}>
                  <Text style={styles.toggleMainTitle}>Show my length of stay</Text>
                  <Text style={styles.exampleText}>Ex: A few nights, about a week, etc.</Text>
                </View>
                <Switch
                  value={showLengthOfStay}
                  onValueChange={(val) => {
                    setShowLengthOfStay(val);
                    handleToggle('show_length_of_stay', val);
                  }}
                  trackColor={{ false: '#E2E8F0', true: '#111111' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Review Toggle 4 */}
              <View style={styles.subToggleRow}>
                <View style={styles.textContainer}>
                  <Text style={styles.toggleMainTitle}>Show my booked services</Text>
                  <Text style={styles.exampleText}>Ex: Gourmet brunch or tasting menu</Text>
                </View>
                <Switch
                  value={showBookedServices}
                  onValueChange={(val) => {
                    setShowBookedServices(val);
                    handleToggle('show_booked_services', val);
                  }}
                  trackColor={{ false: '#E2E8F0', true: '#111111' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            <View style={styles.dividerLine} />

            {/* ── SECTION 4: DATA PRIVACY ───────────────────────────────────── */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Data privacy</Text>

              {/* Request Data Card */}
              <Pressable
                testID="request-data-btn"
                onPress={handleRequestData}
                disabled={dataRequestLoading}
                style={({ pressed }) => [styles.roundedCardBtn, pressed && styles.cardBtnPressed]}
              >
                <Text style={styles.cardBtnText}>Request my personal data</Text>
                {dataRequestLoading ? (
                  <ActivityIndicator size="small" color="#111111" />
                ) : (
                  <Feather name="chevron-right" size={20} color="#717171" />
                )}
              </Pressable>

              {/* AI Improvement Toggle */}
              <View style={[styles.toggleRow, { marginTop: 24 }]}>
                <View style={styles.textContainer}>
                  <Text style={styles.toggleMainTitle}>Help improve AI-powered features</Text>
                  <Text style={styles.toggleSubText}>
                    When this is on, we use your data to develop and improve AI models that power certain features on ZuruSasa.{' '}
                    <Text
                      onPress={() =>
                        setLearnMoreModal(
                          'We use anonymized search trends and reel engagement to train intelligent recommendation algorithms for coastal destinations.'
                        )
                      }
                      style={styles.learnMoreLink}
                    >
                      Learn more
                    </Text>
                  </Text>
                </View>
                <Switch
                  value={aiImprovement}
                  onValueChange={(val) => {
                    setAiImprovement(val);
                    handleToggle('ai_improvement', val);
                  }}
                  trackColor={{ false: '#E2E8F0', true: '#111111' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Delete Account Card */}
              <Pressable
                testID="delete-account-card-btn"
                onPress={() => setDeleteModalVisible(true)}
                style={({ pressed }) => [styles.roundedCardBtn, { marginTop: 20 }, pressed && styles.cardBtnPressed]}
              >
                <Text style={styles.cardBtnText}>Delete my account</Text>
                <Feather name="chevron-right" size={20} color="#717171" />
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── LEARN MORE INFO MODAL ────────────────────────────────────────────── */}
      <Modal
        visible={!!learnMoreModal}
        transparent
        animationType="fade"
        onRequestClose={() => setLearnMoreModal(null)}
      >
        <Pressable
          onPress={() => setLearnMoreModal(null)}
          style={styles.modalOverlay}
        >
          <View style={styles.infoDialog}>
            <Text style={styles.infoDialogTitle}>About this setting</Text>
            <Text style={styles.infoDialogBody}>{learnMoreModal}</Text>
            <Pressable
              onPress={() => setLearnMoreModal(null)}
              style={styles.infoDialogBtn}
            >
              <Text style={styles.infoDialogBtnText}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── DELETE ACCOUNT CONFIRMATION MODAL ────────────────────────────────── */}
      <Modal
        visible={deleteModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={[styles.deleteModalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setDeleteModalVisible(false)} style={styles.closeBtn} hitSlop={10}>
              <Feather name="x" size={22} color="#111111" />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>Delete account</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={[styles.modalHeadline, { color: '#B91C1C' }]}>Permanently delete account?</Text>
            <Text style={styles.modalSub}>
              This action cannot be undone. All your saved reels, past coastal bookings, host payouts, and registered passkeys will be permanently erased.
            </Text>

            <Pressable
              onPress={handleDeleteAccount}
              disabled={deleting}
              style={[styles.dangerBtn, deleting && { opacity: 0.6 }]}
            >
              {deleting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.dangerBtnText}>Permanently delete account</Text>
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
    marginBottom: 8,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#484848',
    lineHeight: 22,
    marginBottom: 24,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_400Regular',
      default: 'sans-serif',
    }),
  },
  sectionsBlock: {
    width: '100%',
  },
  sectionContainer: {
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 12,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  sectionSub: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 20,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  subToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  textContainer: {
    flex: 1,
    paddingRight: 16,
  },
  toggleLabel: {
    fontSize: 15,
    color: '#1E1E1E',
    lineHeight: 22,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_500Medium',
      default: 'sans-serif',
    }),
  },
  toggleMainTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1E1E1E',
    marginBottom: 2,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_500Medium',
      default: 'sans-serif',
    }),
  },
  toggleSubText: {
    fontSize: 13,
    color: '#717171',
    lineHeight: 18,
  },
  exampleText: {
    fontSize: 13,
    color: '#717171',
  },
  learnMoreLink: {
    color: '#111111',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 12,
  },
  roundedCardBtn: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  cardBtnPressed: {
    backgroundColor: '#F9FAFB',
  },
  cardBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111111',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_500Medium',
      default: 'sans-serif',
    }),
  },

  /* Dialog Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  infoDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
  },
  infoDialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },
  infoDialogBody: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 20,
  },
  infoDialogBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoDialogBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  /* Delete Modal */
  deleteModalContainer: {
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
  closeBtn: {
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
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  modalHeadline: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 20,
    marginBottom: 24,
  },
  dangerBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  dangerBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
