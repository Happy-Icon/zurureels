import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

type Step = 'email' | 'code';

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sendOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const onSendCode = async () => {
    if (!emailValid || busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true);
    setError(null);
    const { error: err } = await sendOtp(email.trim().toLowerCase());
    setBusy(false);
    if (err) {
      setError(err);
    } else {
      setStep('code');
    }
  };

  const onVerify = async () => {
    if (code.trim().length < 6 || busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true);
    setError(null);
    const { error: err } = await verifyOtp(
      email.trim().toLowerCase(),
      code.trim(),
    );
    setBusy(false);
    if (err) {
      setError(err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    }
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingTop: topPad + 12 }]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <Pressable
          testID="close-auth"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.closeButton,
            { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="x" size={18} color={colors.secondaryForeground} />
        </Pressable>

        <Text style={[styles.brand, { color: colors.primary }]}>ZuruSasa</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {step === 'email' ? 'Karibu back' : 'Check your inbox'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {step === 'email'
            ? "Enter your email and we'll send you a one-time sign-in code. No password needed."
            : `We sent a 6-digit code to ${email.trim()}.`}
        </Text>

        {step === 'email' ? (
          <>
            <TextInput
              testID="email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.input,
                  borderRadius: colors.radius,
                  color: colors.foreground,
                },
              ]}
            />
            <Pressable
              testID="send-code-button"
              onPress={onSendCode}
              disabled={!emailValid || busy}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: colors.primary,
                  opacity: !emailValid || busy ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Send code</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <TextInput
              testID="code-input"
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={6}
              style={[
                styles.input,
                styles.codeInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.input,
                  borderRadius: colors.radius,
                  color: colors.foreground,
                },
              ]}
            />
            <Pressable
              testID="verify-button"
              onPress={onVerify}
              disabled={code.trim().length < 6 || busy}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: colors.primary,
                  opacity:
                    code.trim().length < 6 || busy ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify & sign in</Text>
              )}
            </Pressable>
            <Pressable
              testID="back-to-email"
              onPress={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
                Use a different email
              </Text>
            </Pressable>
          </>
        )}

        {error ? (
          <View style={styles.errorRow}>
            <Feather name="alert-circle" size={14} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {error}
            </Text>
          </View>
        ) : null}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    gap: 14,
  },
  closeButton: {
    alignSelf: 'flex-end',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 20,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  title: {
    fontSize: 32,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'DMSans_400Regular',
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
  },
  codeInput: {
    letterSpacing: 8,
    fontSize: 22,
    textAlign: 'center',
    fontFamily: 'DMSans_700Bold',
  },
  primaryButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  linkText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    textAlign: 'center',
    paddingVertical: 6,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    flex: 1,
  },
});
