import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { PremiumLoader } from '@/components/PremiumLoader';
import { authStyles as styles } from './authStyles';

interface EmailStepProps {
  email: string;
  setEmail: (val: string) => void;
  onContinue: () => void;
  loading: boolean;
  error: string | null;
  onFocusInput: () => void;
}

export function EmailStep({
  email,
  setEmail,
  onContinue,
  loading,
  error,
  onFocusInput,
}: EmailStepProps) {
  return (
    <>
      <Text style={styles.panelTitle}>Continue with email</Text>
      <Text style={styles.panelSub}>
        We'll send a 6-digit code to your inbox
      </Text>

      <View style={styles.inputRow}>
        <Feather name="mail" size={18} color="rgba(255,255,255,0.5)" style={{ marginRight: 4 }} />
        <View style={styles.inputRowContent}>
          <Text style={styles.inputRowLabel}>Email address</Text>
          <TextInput
            testID="email-input"
            value={email}
            onChangeText={setEmail}
            onFocus={onFocusInput}
            placeholder="hello@example.com"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            autoFocus
            style={styles.glassInput}
            accessibilityLabel="Email address"
          />
        </View>
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Feather name="alert-circle" size={13} color="#FF6B6B" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        testID="send-code-button"
        onPress={onContinue}
        disabled={loading || !email}
        style={({ pressed }) => [
          styles.primaryCta,
          (loading || !email) && { opacity: 0.5 },
          pressed && { transform: [{ scale: 0.97 }] },
        ]}
      >
        {loading ? (
          <PremiumLoader />
        ) : (
          <Text style={styles.primaryCtaText}>Send Code</Text>
        )}
      </Pressable>
    </>
  );
}
