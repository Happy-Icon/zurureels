import React from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { PremiumLoader } from '@/components/PremiumLoader';
import { COUNTRY_OPTIONS, ORANGE } from './authConstants';
import { authStyles as styles } from './authStyles';

interface PhoneStepProps {
  phone: string;
  setPhone: (val: string) => void;
  countryCode: string;
  setCountryCode: (val: string) => void;
  countryPickerOpen: boolean;
  setCountryPickerOpen: (open: boolean) => void;
  onContinue: () => void;
  loading: boolean;
  error: string | null;
  onFocusInput: () => void;
}

export function PhoneStep({
  phone,
  setPhone,
  countryCode,
  setCountryCode,
  countryPickerOpen,
  setCountryPickerOpen,
  onContinue,
  loading,
  error,
  onFocusInput,
}: PhoneStepProps) {
  const selectedCountry = COUNTRY_OPTIONS.find((c) => c.code === countryCode)!;
  return (
    <>
      <Text style={styles.panelTitle}>Enter your number</Text>
      <Text style={styles.panelSub}>
        We'll send a verification code to confirm
      </Text>

      {/* Country selector */}
      <Pressable
        testID="country-code-select"
        onPress={() => setCountryPickerOpen(true)}
        style={styles.inputRow}
      >
        <Text style={styles.flagEmoji}>{selectedCountry.flag}</Text>
        <View style={styles.inputRowContent}>
          <Text style={styles.inputRowLabel}>Country</Text>
          <Text style={styles.inputRowValue}>{selectedCountry.label}</Text>
        </View>
        <Feather name="chevron-down" size={16} color="rgba(255,255,255,0.5)" />
      </Pressable>

      {/* Phone number */}
      <View style={styles.inputRow}>
        <Feather name="phone" size={18} color="rgba(255,255,255,0.5)" style={{ marginRight: 4 }} />
        <View style={styles.inputRowContent}>
          <Text style={styles.inputRowLabel}>Phone number</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.phoneCodeInline}>{countryCode}</Text>
            <TextInput
              testID="phone-input"
              value={phone}
              onChangeText={setPhone}
              onFocus={onFocusInput}
              placeholder="700 000 000"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="phone-pad"
              style={styles.glassInput}
              accessibilityLabel="Phone number"
            />
          </View>
        </View>
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Feather name="alert-circle" size={13} color="#FF6B6B" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        testID="continue-button"
        onPress={onContinue}
        disabled={loading || phone.length < 8}
        style={({ pressed }) => [
          styles.primaryCta,
          (loading || phone.length < 8) && { opacity: 0.5 },
          pressed && { transform: [{ scale: 0.97 }] },
        ]}
      >
        {loading ? (
          <PremiumLoader />
        ) : (
          <Text style={styles.primaryCtaText}>Send Code</Text>
        )}
      </Pressable>

      {/* Country picker modal */}
      <Modal
        visible={countryPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCountryPickerOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setCountryPickerOpen(false)}
        >
          <View style={[styles.pickerSheet, { backgroundColor: '#FFFFFF' }]}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>Select Country</Text>
            {COUNTRY_OPTIONS.map((c) => (
              <Pressable
                key={c.code}
                onPress={() => {
                  setCountryCode(c.code);
                  setCountryPickerOpen(false);
                }}
                style={({ pressed }) => [
                  styles.pickerRow,
                  pressed && { backgroundColor: '#F5F5F5' },
                  c.code === countryCode && styles.pickerRowActive,
                ]}
              >
                <Text style={styles.pickerFlag}>{c.flag}</Text>
                <Text style={styles.pickerLabel}>{c.label}</Text>
                {c.code === countryCode && (
                  <Feather name="check" size={16} color={ORANGE} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
