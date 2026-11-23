import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { PremiumLoader } from '@/components/PremiumLoader';
import { ORANGE } from './authConstants';
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
  const [focused, setFocused] = useState(true);
  const trimmed = email.trim();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

  return (
    <>
      <Text style={styles.panelTitle}>Continue with email</Text>
      <Text style={styles.panelSub}>
        We'll send a 6-digit verification code to your inbox
      </Text>

      <View
        style={[
          styles.inputRow,
          focused && styles.inputRowFocused,
          Boolean(error) && !focused && styles.inputRowError,
        ]}
      >
        <View
          style={[
            styles.inputIconBadge,
            focused && styles.inputIconBadgeFocused,
          ]}
        >
          <Feather
            name="mail"
            size={16}
            color={focused ? ORANGE : 'rgba(255,255,255,0.65)'}
          />
        </View>
        <View style={styles.inputRowContent}>
          <Text
            style={[
              styles.inputRowLabel,
              focused && styles.inputRowLabelFocused,
            ]}
          >
            Email address
          </Text>
          <TextInput
            testID="email-input"
            value={email}
            onChangeText={setEmail}
            onFocus={() => {
              setFocused(true);
              onFocusInput();
            }}
            onBlur={() => setFocused(false)}
            placeholder="amina@example.com"
            placeholderTextColor="rgba(255,255,255,0.38)"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            selectionColor={ORANGE}
            autoFocus
            style={styles.glassInput}
            accessibilityLabel="Email address"
          />
        </View>
        {isEmailValid ? (
          <View style={styles.inputValidBadge}>
            <Feather name="check" size={13} color="#34D399" />
          </View>
        ) : email.length > 0 ? (
          <Pressable
            onPress={() => setEmail('')}
            hitSlop={8}
            style={styles.inputClearBtn}
            accessibilityRole="button"
            accessibilityLabel="Clear email address"
          >
            <Feather name="x" size={13} color="rgba(255,255,255,0.75)" />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.inputHelperText}>
        Passwordless sign-in · Instant 6-digit code
      </Text>

      {error ? (
        <View style={styles.errorRow}>
          <Feather name="alert-circle" size={13} color="#FF6B6B" />
          <Text selectable style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}

      <Pressable
        testID="send-code-button"
        onPress={onContinue}
        disabled={loading || !isEmailValid}
        style={({ pressed }) => [
          styles.primaryCta,
          (loading || !isEmailValid) && { opacity: 0.5 },
          pressed && { transform: [{ scale: 0.97 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Send verification code"
        accessibilityState={{ disabled: loading || !isEmailValid, busy: loading }}
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
