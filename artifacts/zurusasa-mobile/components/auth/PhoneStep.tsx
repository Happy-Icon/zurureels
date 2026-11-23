import React, { useState } from 'react';
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
  isPhoneValid: boolean;
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
  isPhoneValid,
  onContinue,
  loading,
  error,
  onFocusInput,
}: PhoneStepProps) {
  const [phoneFocused, setPhoneFocused] = useState(false);
  const selectedCountry =
    COUNTRY_OPTIONS.find((c) => c.code === countryCode) ?? COUNTRY_OPTIONS[0];

  return (
    <>
      <Text style={styles.panelTitle}>Enter your number</Text>
      <Text style={styles.panelSub}>
        We'll send a 6-digit SMS code to verify it's you
      </Text>

      {/* Country selector */}
      <Pressable
        testID="country-code-select"
        onPress={() => setCountryPickerOpen(true)}
        style={({ pressed }) => [
          styles.inputRow,
          pressed && { opacity: 0.85 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Country code ${selectedCountry.label}`}
      >
        <View style={styles.inputIconBadge}>
          <Text style={styles.flagEmoji}>{selectedCountry.flag}</Text>
        </View>
        <View style={styles.inputRowContent}>
          <Text style={styles.inputRowLabel}>Country / Region</Text>
          <Text style={styles.inputRowValue}>{selectedCountry.label}</Text>
        </View>
        <Feather name="chevron-down" size={16} color="rgba(255,255,255,0.55)" />
      </Pressable>

      {/* Phone number — focus-aware luxury glass field */}
      <View
        style={[
          styles.inputRow,
          phoneFocused && styles.inputRowFocused,
          Boolean(error) && !phoneFocused && styles.inputRowError,
        ]}
      >
        <View
          style={[
            styles.inputIconBadge,
            phoneFocused && styles.inputIconBadgeFocused,
          ]}
        >
          <Feather
            name="phone"
            size={16}
            color={phoneFocused ? ORANGE : 'rgba(255,255,255,0.65)'}
          />
        </View>
        <View style={styles.inputRowContent}>
          <Text
            style={[
              styles.inputRowLabel,
              phoneFocused && styles.inputRowLabelFocused,
            ]}
          >
            Mobile number
          </Text>
          <View style={styles.phoneInputLine}>
            <View style={styles.phoneCodePill}>
              <Text style={styles.phoneCodeInline}>{countryCode}</Text>
            </View>
            <TextInput
              testID="phone-input"
              value={phone}
              onChangeText={setPhone}
              onFocus={() => {
                setPhoneFocused(true);
                onFocusInput();
              }}
              onBlur={() => setPhoneFocused(false)}
              placeholder={selectedCountry.placeholder}
              placeholderTextColor="rgba(255,255,255,0.38)"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              selectionColor={ORANGE}
              style={styles.glassInput}
              accessibilityLabel="Mobile phone number"
            />
          </View>
        </View>
        {isPhoneValid ? (
          <View style={styles.inputValidBadge}>
            <Feather name="check" size={13} color="#34D399" />
          </View>
        ) : phone.length > 0 ? (
          <Pressable
            onPress={() => setPhone('')}
            hitSlop={8}
            style={styles.inputClearBtn}
            accessibilityRole="button"
            accessibilityLabel="Clear phone number"
          >
            <Feather name="x" size={13} color="rgba(255,255,255,0.75)" />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.inputHelperText}>{selectedCountry.hint}</Text>

      {error ? (
        <View style={styles.errorRow}>
          <Feather name="alert-circle" size={13} color="#FF6B6B" />
          <Text selectable style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}

      <Pressable
        testID="continue-button"
        onPress={onContinue}
        disabled={loading || !isPhoneValid}
        style={({ pressed }) => [
          styles.primaryCta,
          (loading || !isPhoneValid) && { opacity: 0.5 },
          pressed && { transform: [{ scale: 0.97 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Send verification code"
        accessibilityState={{ disabled: loading || !isPhoneValid, busy: loading }}
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
