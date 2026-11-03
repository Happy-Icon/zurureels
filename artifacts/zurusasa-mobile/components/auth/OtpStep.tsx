import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { PremiumLoader } from '@/components/PremiumLoader';
import { authStyles as styles } from './authStyles';

interface OtpStepProps {
  title: string;
  subtitle: string;
  value: string;
  onChange: (val: string) => void;
  onVerify: () => void;
  onResend: () => void;
  loading: boolean;
  error: string | null;
  testID: string;
  verifyTestID: string;
  onFocusInput: () => void;
}

export function OtpStep({
  title,
  subtitle,
  value,
  onChange,
  onVerify,
  onResend,
  loading,
  error,
  testID,
  verifyTestID,
  onFocusInput,
}: OtpStepProps) {
  return (
    <>
      <Text style={styles.panelTitle}>{title}</Text>
      <Text style={styles.panelSub}>{subtitle}</Text>

      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        onFocus={onFocusInput}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="– – – – – –"
        placeholderTextColor="rgba(255,255,255,0.25)"
        autoFocus
        style={styles.otpInput}
        accessibilityLabel="Verification code"
      />

      {error ? (
        <View style={styles.errorRow}>
          <Feather name="alert-circle" size={13} color="#FF6B6B" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        testID={verifyTestID}
        onPress={onVerify}
        disabled={loading || value.length < 6}
        style={({ pressed }) => [
          styles.primaryCta,
          (loading || value.length < 6) && { opacity: 0.5 },
          pressed && { transform: [{ scale: 0.97 }] },
        ]}
      >
        {loading ? (
          <PremiumLoader />
        ) : (
          <Text style={styles.primaryCtaText}>Verify & Continue</Text>
        )}
      </Pressable>

      <Pressable onPress={onResend} disabled={loading} style={styles.resendRow}>
        <Text style={styles.resendText}>
          Didn't receive a code?{' '}
          <Text style={styles.resendLink}>Resend</Text>
        </Text>
      </Pressable>
    </>
  );
}
