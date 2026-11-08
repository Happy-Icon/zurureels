import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { PersonalDataRequestRow } from '@/lib/supabase';
import { dataRequestService } from '@/services/dataRequestService';
import { DataRequestModal } from '@/components/privacy/DataRequestModal';
import { DataRequestStatusCard } from '@/components/privacy/DataRequestStatusCard';

export default function DataRequestScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeRequest, setActiveRequest] = useState<PersonalDataRequestRow | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 24;

  const fetchRequest = useCallback(async () => {
    if (!user?.id) return;
    try {
      const req = await dataRequestService.getActiveDataRequest(user.id);
      setActiveRequest(req);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequest();
  };

  const hasActiveRequest =
    activeRequest &&
    (activeRequest.status === 'pending_verification' ||
      activeRequest.status === 'processing' ||
      (activeRequest.status === 'completed' &&
        activeRequest.expires_at &&
        new Date(activeRequest.expires_at).getTime() > Date.now()));

  const exportCategories = [
    {
      icon: 'user' as const,
      title: 'Profile & Identity Verification',
      desc: 'Account credentials, personal details, contact info, and KYC verification records.',
    },
    {
      icon: 'calendar' as const,
      title: 'Stays, Bookings & Quotes',
      desc: 'Complete reservation history, dates, pricing breakdowns, quotes, and host inquiries.',
    },
    {
      icon: 'credit-card' as const,
      title: 'Financial & Payments',
      desc: 'Payment receipts, transaction IDs, payment methods, and host payout histories (masked).',
    },
    {
      icon: 'message-square' as const,
      title: 'Messages & Support',
      desc: 'Direct communications with hosts and customer support inquiries.',
    },
    {
      icon: 'film' as const,
      title: 'Reels, Reviews & Itineraries',
      desc: 'Saved reels, social interactions, published reviews, and ZuruPlan travel itineraries.',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── MINIMAL TOP BAR ─────────────────────────────────────────────────── */}
      <View style={[styles.navBar, { paddingTop: topPad }]}>
        <Pressable
          testID="data-request-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/profile/privacy');
          }}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* ── SCROLLABLE BODY ─────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F26522" />
        }
      >
        {/* Page Title & Subtitle */}
        <View style={styles.titleSection}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Your personal data</Text>
          <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
            Download a portable copy of your account activity, bookings, and content under the Kenya Data Protection Act 2019 and GDPR.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#F26522" />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Checking export status...
            </Text>
          </View>
        ) : (
          <>
            {/* Active Request Card (Prominently Placed When Active) */}
            {hasActiveRequest && activeRequest && (
              <View style={styles.activeRequestSection}>
                <DataRequestStatusCard
                  request={activeRequest}
                  onRefresh={fetchRequest}
                  onRequestVerification={() => setModalVisible(true)}
                />
              </View>
            )}

            {/* Privacy Rights Information Card */}
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.infoCardRow}>
                <View style={styles.infoIconWrap}>
                  <Feather name="shield" size={18} color="#F26522" />
                </View>
                <View style={styles.infoTextCol}>
                  <Text style={[styles.infoCardTitle, { color: colors.text }]}>
                    Data portability & rights
                  </Text>
                  <Text style={[styles.infoCardBody, { color: colors.mutedForeground }]}>
                    You have the right to access and export your data at any time at no charge. Exports are provided as a human-readable PDF summary and a machine-readable JSON archive.
                  </Text>
                </View>
              </View>
            </View>

            {/* Export Categories Section */}
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>
                What is included in your export
              </Text>

              <View style={[styles.categoryList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {exportCategories.map((item, index) => {
                  const isLast = index === exportCategories.length - 1;
                  return (
                    <View
                      key={item.title}
                      style={[
                        styles.categoryRow,
                        !isLast && [styles.categoryRowBorder, { borderBottomColor: colors.border }],
                      ]}
                    >
                      <View style={[styles.categoryIconWrap, { backgroundColor: colors.background }]}>
                        <Feather name={item.icon} size={16} color="#F26522" />
                      </View>
                      <View style={styles.categoryTextCol}>
                        <Text style={[styles.categoryTitle, { color: colors.text }]}>
                          {item.title}
                        </Text>
                        <Text style={[styles.categoryDesc, { color: colors.mutedForeground }]}>
                          {item.desc}
                        </Text>
                      </View>
                      <View style={styles.checkPill}>
                        <Feather name="check" size={12} color="#10B981" />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Security & Retention Notice */}
            <View style={[styles.vaultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.vaultRow}>
                <View style={[styles.vaultIconWrap, { backgroundColor: 'rgba(242, 101, 34, 0.08)' }]}>
                  <Feather name="lock" size={18} color="#F26522" />
                </View>
                <View style={styles.vaultTextCol}>
                  <Text style={[styles.vaultTitle, { color: colors.text }]}>
                    Encrypted vault & 7-day retention
                  </Text>
                  <Text style={[styles.vaultDesc, { color: colors.mutedForeground }]}>
                    Archives are generated securely and accessed only via short-lived signed links. To safeguard your privacy, all export files are automatically deleted after 7 days.
                  </Text>
                </View>
              </View>
            </View>

            {/* Primary Action Button (If No Active Pending/Processing Request) */}
            {!hasActiveRequest && (
              <View style={styles.actionContainer}>
                <Pressable
                  testID="request-personal-data-cta"
                  onPress={() => setModalVisible(true)}
                  style={({ pressed }) => [
                    styles.primaryCtaBtn,
                    pressed && styles.primaryCtaBtnPressed,
                  ]}
                >
                  <Feather name="download" size={17} color="#FFFFFF" />
                  <Text style={styles.primaryCtaText}>Request Personal Data</Text>
                </Pressable>
                <Text style={[styles.actionDisclaimer, { color: colors.mutedForeground }]}>
                  A 6-digit confirmation code will be sent to your verified email to authorize this export.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Verification & Format Modal */}
      <DataRequestModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={() => {
          fetchRequest();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.6,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 20,
  },
  titleSection: {
    gap: 8,
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  pageSubtitle: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 22,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
  },
  activeRequestSection: {
    marginBottom: 4,
  },
  infoCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  infoCardRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  infoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(242, 101, 34, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextCol: {
    flex: 1,
    gap: 4,
  },
  infoCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'DMSans_600SemiBold',
    letterSpacing: -0.2,
  },
  infoCardBody: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 19,
  },
  sectionContainer: {
    gap: 10,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'DMSans_600SemiBold',
    letterSpacing: -0.2,
  },
  categoryList: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  categoryRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTextCol: {
    flex: 1,
    gap: 3,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'DMSans_600SemiBold',
    letterSpacing: -0.1,
  },
  categoryDesc: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 16,
  },
  checkPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  vaultRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  vaultIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultTextCol: {
    flex: 1,
    gap: 4,
  },
  vaultTitle: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'DMSans_600SemiBold',
  },
  vaultDesc: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 17,
  },
  actionContainer: {
    marginTop: 6,
    gap: 10,
  },
  primaryCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F26522',
    height: 52,
    borderRadius: 14,
    shadowColor: '#F26522',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryCtaBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'DMSans_700Bold',
  },
  actionDisclaimer: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },
});
