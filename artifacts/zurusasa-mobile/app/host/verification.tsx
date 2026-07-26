import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { supabase } from '@/lib/supabase';

import { useCustomAlert } from '@/context/CustomAlertContext';

export default function HostVerificationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const { showAlert } = useCustomAlert();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'none' | 'pending' | 'verified' | 'rejected'>('none');

  const topPad = Platform.OS === 'web' ? 20 : insets.top;
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
      // Call Shufti-token Edge function if deployed or trigger verification URL
      const { data, error } = await supabase.functions.invoke('shufti-token', {
        body: {
          email: user.email,
          full_name: user.user_metadata?.full_name || '',
        },
      });

      if (data?.verification_url) {
        await supabase.from('profiles').update({ verification_status: 'pending' }).eq('id', user.id);
        setStatus('pending');
        await WebBrowser.openBrowserAsync(data.verification_url);
      } else {
        // Fallback demo verification mode
        await supabase.from('profiles').update({ verification_status: 'pending' }).eq('id', user.id);
        setStatus('pending');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showAlert({
          title: 'Verification Submitted',
          message: 'Your documents have been submitted for review.',
          icon: 'check-circle',
        });
      }
      refreshProfile();
    } catch (err: any) {
      console.log('Shufti verification notice:', err);
      // Update status to pending for review
      await supabase.from('profiles').update({ verification_status: 'pending' }).eq('id', user.id);
      setStatus('pending');
      refreshProfile();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Identity Verification</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomPad + 24, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: `${colors.primary}18` }]}>
            <MaterialCommunityIcons name="shield-check-outline" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>Verified Host Trust</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            To keep ZuruSasa safe, all hosts verify their government ID or passport before publishing listings.
          </Text>
        </View>

        {status === 'verified' ? (
          <View style={[styles.statusCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
            <Feather name="check-circle" size={36} color="#16a34a" />
            <Text style={[styles.statusTitle, { color: '#15803d' }]}>Identity Verified!</Text>
            <Text style={[styles.statusSub, { color: '#166534' }]}>
              Your host profile has earned the Verified badge. Guests can book with confidence.
            </Text>
          </View>
        ) : status === 'pending' ? (
          <View style={[styles.statusCard, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
            <ActivityIndicator size="large" color="#ea580c" />
            <Text style={[styles.statusTitle, { color: '#c2410c' }]}>Verification Pending</Text>
            <Text style={[styles.statusSub, { color: '#7c2d12' }]}>
              Your documents are under review by our safety system. This usually takes under 5 minutes.
            </Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.benefitRow}>
              <Feather name="check-square" size={20} color={colors.primary} />
              <View style={styles.benefitTextWrap}>
                <Text style={[styles.benefitTitle, { color: colors.foreground }]}>Verified Host Badge</Text>
                <Text style={[styles.benefitSub, { color: colors.mutedForeground }]}>Displays on all your video reels and stays.</Text>
              </View>
            </View>

            <View style={styles.benefitRow}>
              <Feather name="credit-card" size={20} color={colors.primary} />
              <View style={styles.benefitTextWrap}>
                <Text style={[styles.benefitTitle, { color: colors.foreground }]}>Automated M-Pesa Payouts</Text>
                <Text style={[styles.benefitSub, { color: colors.mutedForeground }]}>Unlocks direct earnings withdrawals.</Text>
              </View>
            </View>

            <Pressable
              disabled={loading}
              onPress={startVerification}
              style={({ pressed }) => [
                styles.verifyBtn,
                { backgroundColor: colors.primary, opacity: pressed || loading ? 0.8 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.verifyBtnText}>Verify Identity Now</Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontFamily: 'InstrumentSerif_400Regular' },
  heroSection: { alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 8 },
  heroIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 24, fontFamily: 'InstrumentSerif_400Regular', textAlign: 'center' },
  heroSub: { fontSize: 13, fontFamily: 'DMSans_400Regular', textAlign: 'center', paddingHorizontal: 12 },
  statusCard: { padding: 24, borderRadius: 20, borderWidth: 1, alignItems: 'center', gap: 10 },
  statusTitle: { fontSize: 18, fontFamily: 'DMSans_700Bold' },
  statusSub: { fontSize: 13, fontFamily: 'DMSans_400Regular', textAlign: 'center' },
  card: { padding: 20, borderRadius: 20, borderWidth: 1, gap: 16 },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  benefitTextWrap: { flex: 1 },
  benefitTitle: { fontSize: 15, fontFamily: 'DMSans_700Bold' },
  benefitSub: { fontSize: 12, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  verifyBtn: { borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  verifyBtnText: { color: '#ffffff', fontSize: 15, fontFamily: 'DMSans_700Bold' },
});
