import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeRequest, setActiveRequest] = useState<PersonalDataRequestRow | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleCol}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Your Personal Data</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
            Data Access & Portability
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F26522" />}
      >
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#F26522" />
          </View>
        ) : (
          <>
            {/* Active Request Card if present */}
            {hasActiveRequest && activeRequest && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Current Request</Text>
                <DataRequestStatusCard
                  request={activeRequest}
                  onRefresh={fetchRequest}
                  onRequestVerification={() => setModalVisible(true)}
                />
              </View>
            )}

            {/* Explanation & Rights */}
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.infoCardHeader}>
                <View style={[styles.iconWrap, { backgroundColor: 'rgba(242,101,34,0.12)' }]}>
                  <Feather name="shield" size={18} color="#F26522" />
                </View>
                <Text style={[styles.infoCardTitle, { color: colors.text }]}>Data Privacy Rights</Text>
              </View>
              <Text style={[styles.infoCardText, { color: colors.mutedForeground }]}>
                Under the Kenya Data Protection Act 2019 (Sections 25, 26, 40) and General Data Protection Regulation (GDPR), you have the right to receive an export of the personal data you have provided to ZuruSasa in a structured, machine-readable format.
              </Text>
            </View>

            {/* What's Included */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>What is included in the export?</Text>
              <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {[
                  { icon: 'user' as const, label: 'Profile & Identity Verification', desc: 'Name, email, contact details, account status, and KYC verification records.' },
                  { icon: 'calendar' as const, label: 'Stays, Bookings & Quotes', desc: 'Complete reservation history, dates, quotes, and stay details.' },
                  { icon: 'credit-card' as const, label: 'Financial & Payments', desc: 'Transaction receipts, payment statuses, and host payout histories (masked).' },
                  { icon: 'message-circle' as const, label: 'Messages & Support', desc: 'Communications with hosts and customer support.' },
                  { icon: 'film' as const, label: 'Reels, Reviews & Itineraries', desc: 'Saved reels, reviews authored, and ZuruPlan travel itineraries.' },
                ].map((item, idx) => (
                  <View
                    key={item.label}
                    style={[
                      styles.listItem,
                      idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                    ]}
                  >
                    <View style={[styles.listIconCircle, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                      <Feather name={item.icon} size={15} color="#F26522" />
                    </View>
                    <View style={styles.listItemText}>
                      <Text style={[styles.listItemTitle, { color: colors.text }]}>{item.label}</Text>
                      <Text style={[styles.listItemDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Storage & Retention Note */}
            <View style={[styles.noteBox, { borderColor: colors.border }]}>
              <Feather name="info" size={15} color={colors.mutedForeground} />
              <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
                To protect your privacy, generated exports are stored in an encrypted private vault and automatically purged after 7 days. Only you can download your archive.
              </Text>
            </View>

            {/* Action Button: Only if no active pending/processing request */}
            {!hasActiveRequest && (
              <Pressable onPress={() => setModalVisible(true)} style={styles.requestBtn}>
                <Feather name="download" size={16} color="#FFFFFF" />
                <Text style={styles.requestBtnText}>Request My Personal Data</Text>
              </Pressable>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: {
    padding: 6,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  scrollContent: {
    padding: 18,
    gap: 18,
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  infoCardText: {
    fontSize: 13,
    lineHeight: 19,
  },
  listCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  listIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  listItemText: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  listItemDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  noteText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F26522',
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 8,
  },
  requestBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
