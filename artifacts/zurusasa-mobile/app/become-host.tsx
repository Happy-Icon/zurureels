import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useColors } from '@/hooks/useColors';
import { supabase } from '@/lib/supabase';

import { useCustomAlert } from '@/context/CustomAlertContext';

export default function BecomeHostScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshProfile, switchViewMode } = useAuth();
  const { showAlert } = useCustomAlert();

  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === 'web' ? 20 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 20;

  const handleSubmit = async () => {
    if (!user) {
      showAlert({
        title: 'Sign in Required',
        message: 'Please sign in to complete your host application.',
        buttons: [{ text: 'Sign In', onPress: () => router.push('/auth') }],
      });
      return;
    }

    if (!phone.trim() || phone.length < 9) {
      showAlert({
        title: 'Phone Required',
        message: 'Please enter a valid phone number (+254...).',
      });
      return;
    }

    if (!businessName.trim()) {
      showAlert({
        title: 'Business Name Required',
        message: 'Please enter your business or property name.',
      });
      return;
    }

    if (!idNumber.trim()) {
      showAlert({
        title: 'ID Required',
        message: 'National ID or Passport number is required for verification.',
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Update Profile table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          phone,
          role: 'host',
          verification_status: 'none',
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 2. Update Auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          role: 'host',
          phone,
          business_name: businessName,
          id_number: idNumber,
          verification_status: 'none',
        },
      });

      if (authError) throw authError;

      // 3. Trigger send-email Edge Function
      supabase.functions.invoke('send-email', {
        body: {
          type: 'host_application',
          email: user.email,
          data: {
            name: user.user_metadata?.full_name || user.email?.split('@')[0],
          },
        },
      }).catch((e) => console.log('Email edge function invoke silent info:', e));

      await refreshProfile();
      switchViewMode('host');

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({
        title: 'Application Received! 🎉',
        message: 'Welcome to ZuruSasa Hosting! You can now create reels, manage listings, and receive bookings.',
        icon: 'check-circle',
        buttons: [
          {
            text: 'Go to Host Dashboard',
            style: 'default',
            onPress: () => router.replace('/'),
          },
        ],
      });
    } catch (err: any) {
      console.error('Become host error:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert({
        title: 'Submission Error',
        message: err.message || 'Failed to upgrade account to Host.',
        icon: 'alert-circle',
      });
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Become a Host</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomPad + 24, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: `${colors.primary}18` }]}>
            <MaterialCommunityIcons name="home-city-outline" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>Start Hosting on ZuruSasa</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Showcase your stay, dhow boat, or coastal tour through immersive short video reels and welcome global travelers.
          </Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Phone Number (M-Pesa Connected) *</Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="phone" size={18} color={colors.mutedForeground} />
            <TextInput
              placeholder="+254 7..."
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              style={[styles.input, { color: colors.foreground }]}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Business / Property Name *</Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="home" size={18} color={colors.mutedForeground} />
            <TextInput
              placeholder="e.g. Oceanfront Diani Villa"
              placeholderTextColor={colors.mutedForeground}
              value={businessName}
              onChangeText={setBusinessName}
              style={[styles.input, { color: colors.foreground }]}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>National ID / Passport Number *</Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="shield" size={18} color={colors.mutedForeground} />
            <TextInput
              placeholder="For identity check"
              placeholderTextColor={colors.mutedForeground}
              value={idNumber}
              onChangeText={setIdNumber}
              style={[styles.input, { color: colors.foreground }]}
            />
          </View>
        </View>

        <Pressable
          disabled={loading}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitBtn,
            { backgroundColor: colors.primary, opacity: pressed || loading ? 0.8 : 1 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Host Application</Text>
          )}
        </Pressable>
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
  headerTitle: { fontSize: 20, fontFamily: 'DMSans_700Bold' },
  heroSection: { alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 8 },
  heroIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 22, fontFamily: 'DMSans_700Bold', textAlign: 'center' },
  heroSub: { fontSize: 13, fontFamily: 'DMSans_400Regular', textAlign: 'center', paddingHorizontal: 12 },
  formGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: 'DMSans_600SemiBold' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14, fontFamily: 'DMSans_400Regular' },
  submitBtn: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  submitBtnText: { color: '#ffffff', fontSize: 15, fontFamily: 'DMSans_700Bold' },
});
