import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { PersonaVerificationModal } from '@/components/verification/PersonaVerificationModal';
import { personaVerificationService } from '@/services/personaVerificationService';
import { useColors, useTheme } from '@/hooks/useColors';

export default function HostVerificationScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const { showAlert } = useCustomAlert();

  const [loading, setLoading] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [status, setStatus] = useState<'none' | 'pending' | 'verified' | 'rejected'>('none');

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 20;

  useEffect(() => {
    if (profile?.verification_status) {
      setStatus(profile.verification_status as any);
    }
  }, [profile]);

  const startVerification = async () => {
    if (!user) {
      showAlert({
        title: 'Sign in Required',
        message: 'Please sign in to verify your identity.',
      });
      return;
    }

    setLoading(true);
    try {
      await personaVerificationService.launchVerification({
        userId: user.id,
        onSuccess: async () => {
          setLoading(false);
          setStatus('verified');
          if (refreshProfile) await refreshProfile();
          showAlert({
            title: 'Identity Verified',
            message: 'Your host identity has been successfully verified with Persona.',
          });
        },
        onCanceled: () => {
          setLoading(false);
        },
        onError: (errorMessage) => {
          setLoading(false);
          showAlert({
            title: 'Verification Notice',
            message: errorMessage,
          });
        },
      });
    } catch (err: any) {
      setLoading(false);
      showAlert({
        title: 'Verification Error',
        message: err?.message || 'Could not start identity verification.',
      });
    }
  };

  const handleResetVerification = async () => {
    if (!user) return;
    setLoading(true);
    await personaVerificationService.resetVerification(user.id);
    await refreshProfile();
    setStatus('none');
    setLoading(false);
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      {/* 1. Header Bar */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Identity Verification</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomPad + 24, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroIconCircle}>
            <MaterialCommunityIcons name="shield-check-outline" size={32} color="#F26522" />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Verified Host Trust</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            To keep ZuruSasa safe and secure for guests, all hosts verify their official government ID or passport before publishing listings.
          </Text>
        </View>

        {/* 3. Status or Benefits Cards */}
        {status === 'verified' ? (
          <View style={[styles.statusCardVerified, { backgroundColor: isDark ? '#064E3B20' : '#F0FDF4', borderColor: isDark ? '#05966940' : '#BBF7D0' }]}>
            <Feather name="check-circle" size={36} color="#16A34A" />
            <Text style={[styles.statusTitleVerified, { color: isDark ? '#A7F3D0' : '#166534' }]}>Identity Verified!</Text>
            <Text style={[styles.statusSubVerified, { color: isDark ? '#A7F3D0' : '#166534' }]}>
              Your host profile has earned the Verified badge. Guests can now book your stays and tours with total confidence.
            </Text>
            <Pressable
              onPress={handleResetVerification}
              disabled={loading}
              style={({ pressed }) => [
                styles.resetBtn,
                { opacity: pressed || loading ? 0.8 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#64748B" />
              ) : (
                <Text style={styles.resetBtnText}>Re-verify / Test Again</Text>
              )}
            </Pressable>
          </View>
        ) : status === 'pending' ? (
          <View style={[styles.statusCardPending, { backgroundColor: isDark ? '#2A1810' : '#FFF7ED', borderColor: isDark ? '#5C2D16' : '#FFEDD5' }]}>
            <MaterialCommunityIcons name="clock-outline" size={36} color="#F26522" />
            <Text style={[styles.statusTitlePending, { color: isDark ? '#FED7AA' : '#9A3412' }]}>Verification Pending</Text>
            <Text style={[styles.statusSubPending, { color: isDark ? '#FED7AA' : '#9A3412' }]}>
              Your identity verification is in progress. Tap below to complete your Persona 3D selfie & ID verification.
            </Text>
            <Pressable
              onPress={startVerification}
              style={({ pressed }) => [
                styles.verifyBtn,
                { marginTop: 12, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Text style={styles.verifyBtnText}>Complete Persona Verification</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.benefitsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.benefitRow}>
              <View style={styles.benefitIconWrap}>
                <Feather name="check-square" size={18} color="#F26522" />
              </View>
              <View style={styles.benefitTextWrap}>
                <Text style={[styles.benefitTitle, { color: colors.text }]}>Verified Host Badge</Text>
                <Text style={[styles.benefitSub, { color: colors.mutedForeground }]}>Displays prominently on all your video reels and stay listings.</Text>
              </View>
            </View>

            <View style={styles.benefitRow}>
              <View style={styles.benefitIconWrap}>
                <Feather name="credit-card" size={18} color="#F26522" />
              </View>
              <View style={styles.benefitTextWrap}>
                <Text style={[styles.benefitTitle, { color: colors.text }]}>Automated Escrow Payouts</Text>
                <Text style={[styles.benefitSub, { color: colors.mutedForeground }]}>Unlocks direct earnings withdrawals to M-Pesa or Kenyan bank.</Text>
              </View>
            </View>

            <View style={styles.benefitRow}>
              <View style={styles.benefitIconWrap}>
                <Feather name="star" size={18} color="#F26522" />
              </View>
              <View style={styles.benefitTextWrap}>
                <Text style={[styles.benefitTitle, { color: colors.text }]}>Enhanced Guest Trust</Text>
                <Text style={[styles.benefitSub, { color: colors.mutedForeground }]}>Verified hosts get up to 3x more booking inquiries and reservations.</Text>
              </View>
            </View>

            {/* Verification Action Button */}
            <Pressable
              disabled={loading}
              onPress={startVerification}
              style={({ pressed }) => [
                styles.verifyBtn,
                { opacity: pressed || loading ? 0.88 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.verifyBtnText}>Verify Identity Now</Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>

      <PersonaVerificationModal
        visible={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        onSuccess={() => {
          setShowVerificationModal(false);
          setStatus('verified');
          refreshProfile();
        }}
        title="Host Identity Verification"
        subtitle="Verify your identity with Persona using a government ID and a quick 3D liveness scan."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  heroSection: {
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  heroIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(242, 101, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  statusCardVerified: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    gap: 10,
  },
  statusTitleVerified: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#15803D',
  },
  statusSubVerified: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#166534',
    textAlign: 'center',
    lineHeight: 18,
  },
  resetBtn: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  resetBtnText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#15803D',
  },
  statusCardPending: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FCE3D6',
    backgroundColor: '#FFF8F5',
    alignItems: 'center',
    gap: 10,
  },
  statusTitlePending: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  statusSubPending: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
    textAlign: 'center',
    lineHeight: 18,
  },
  benefitsCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    gap: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(242, 101, 34, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  benefitTextWrap: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  benefitSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    marginTop: 2,
    lineHeight: 18,
  },
  verifyBtn: {
    backgroundColor: '#F26522',
    borderRadius: 24,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#F26522',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
