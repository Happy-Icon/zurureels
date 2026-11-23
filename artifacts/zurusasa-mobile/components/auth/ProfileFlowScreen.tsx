import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { KeyboardScreen } from '@/components/keyboard';
import { PremiumLoader } from '@/components/PremiumLoader';
import { INK, ORANGE, type AuthStep } from './authConstants';
import { authStyles as styles } from './authStyles';

const LIGHT_PLACEHOLDER = '#9CA3AF';

interface ProfileFlowScreenProps {
  step: AuthStep;
  insets: EdgeInsets;
  firstName: string;
  setFirstName: (val: string) => void;
  lastName: string;
  setLastName: (val: string) => void;
  dob: string;
  setDob: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  error: string | null;
  loading: boolean;
  onCompleteProfile: () => void;
  onCommitment: () => void;
  onBack: () => void;
  goHome: () => void;
}

export function ProfileFlowScreen({
  step,
  insets,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  dob,
  setDob,
  email,
  setEmail,
  error,
  loading,
  onCompleteProfile,
  onCommitment,
  onBack,
  goHome,
}: ProfileFlowScreenProps) {
  const router = useRouter();
  const [activeField, setActiveField] = useState<
    'firstName' | 'lastName' | 'dob' | 'email' | null
  >(null);

  if (step === 'email_sent') {
    return (
      <View style={[styles.whiteScreen, { paddingTop: insets.top }]}>
        <View style={styles.emailSentWrap}>
          <View style={styles.emailSentIcon}>
            <Feather name="mail" size={36} color={ORANGE} />
          </View>
          <Text style={styles.emailSentTitle}>Check your email</Text>
          <Text style={styles.emailSentSub}>
            We sent a confirmation link to {email}. Once you confirm, you're all
            set.
          </Text>
          <Pressable
            onPress={goHome}
            style={({ pressed }) => [
              styles.whiteScreenCta,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.whiteScreenCtaText}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (step === 'commitment') {
    return (
      <View style={[styles.whiteScreen, { paddingTop: insets.top }]}>
        <View style={[styles.whiteHeader, { borderBottomColor: '#EBEBEB' }]}>
          <Pressable onPress={onBack} style={styles.whiteBackBtn}>
            <Feather name="arrow-left" size={20} color={INK} />
          </Pressable>
          <Text style={styles.whiteHeaderTitle}>Community standards</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView
          contentContainerStyle={styles.whiteContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.whiteH1}>Agree to our community standards</Text>
          <Text style={styles.whiteBody}>
            We ask everyone in ZuruSasa to commit to treating other users and
            hosts with respect and following our community guidelines.
          </Text>
          {error ? (
            <View style={styles.whiteErrorRow}>
              <Feather name="alert-circle" size={13} color="#EF4444" />
              <Text style={styles.whiteErrorText}>{error}</Text>
            </View>
          ) : null}
          <Pressable
            onPress={onCommitment}
            disabled={loading}
            style={({ pressed }) => [
              styles.whiteScreenCta,
              loading && { opacity: 0.6 },
              pressed && { opacity: 0.85 },
            ]}
          >
            {loading ? (
              <PremiumLoader />
            ) : (
              <Text style={styles.whiteScreenCtaText}>I agree — Continue</Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // Profile step
  return (
    <View style={[styles.whiteScreen, { paddingTop: insets.top }]}>
      <View style={[styles.whiteHeader, { borderBottomColor: '#EBEBEB' }]}>
        <View style={{ width: 40 }} />
        <Text style={styles.whiteHeaderTitle}>Finish signing up</Text>
        <View style={{ width: 40 }} />
      </View>
      <KeyboardScreen
        contentContainerStyle={[styles.whiteContent, { paddingBottom: 60 }]}
      >
        <Text style={styles.whiteH1}>Tell us about yourself</Text>
        <Text style={styles.whiteBodySub}>
          Make sure your name matches your ID — it helps with bookings.
        </Text>

        {/* Name */}
        <View style={styles.whiteSection}>
          <Text style={styles.whiteSectionTitle}>Legal name</Text>
          <View
            style={[
              styles.whiteFieldGroup,
              (activeField === 'firstName' || activeField === 'lastName') &&
                styles.whiteFieldGroupFocused,
            ]}
          >
            <View
              style={[
                styles.whiteField,
                activeField === 'firstName' && styles.whiteFieldFocused,
                { borderBottomWidth: 1, borderBottomColor: '#EFEFEF' },
              ]}
            >
              <View
                style={[
                  styles.whiteFieldIconWrap,
                  activeField === 'firstName' && styles.whiteFieldIconWrapFocused,
                ]}
              >
                <Feather
                  name="user"
                  size={15}
                  color={activeField === 'firstName' ? ORANGE : '#6B7280'}
                />
              </View>
              <View style={styles.whiteFieldBody}>
                <Text
                  style={[
                    styles.whiteFieldLabel,
                    activeField === 'firstName' && styles.whiteFieldLabelFocused,
                  ]}
                >
                  First name
                </Text>
                <TextInput
                  testID="first-name-input"
                  value={firstName}
                  onChangeText={setFirstName}
                  onFocus={() => setActiveField('firstName')}
                  onBlur={() => setActiveField(null)}
                  placeholder="e.g. Amina"
                  placeholderTextColor={LIGHT_PLACEHOLDER}
                  selectionColor={ORANGE}
                  autoCapitalize="words"
                  textContentType="givenName"
                  style={styles.whiteFieldInput}
                />
              </View>
            </View>
            <View
              style={[
                styles.whiteField,
                activeField === 'lastName' && styles.whiteFieldFocused,
              ]}
            >
              <View
                style={[
                  styles.whiteFieldIconWrap,
                  activeField === 'lastName' && styles.whiteFieldIconWrapFocused,
                ]}
              >
                <Feather
                  name="user-check"
                  size={15}
                  color={activeField === 'lastName' ? ORANGE : '#6B7280'}
                />
              </View>
              <View style={styles.whiteFieldBody}>
                <Text
                  style={[
                    styles.whiteFieldLabel,
                    activeField === 'lastName' && styles.whiteFieldLabelFocused,
                  ]}
                >
                  Last name
                </Text>
                <TextInput
                  testID="last-name-input"
                  value={lastName}
                  onChangeText={setLastName}
                  onFocus={() => setActiveField('lastName')}
                  onBlur={() => setActiveField(null)}
                  placeholder="e.g. Ochieng"
                  placeholderTextColor={LIGHT_PLACEHOLDER}
                  selectionColor={ORANGE}
                  autoCapitalize="words"
                  textContentType="familyName"
                  style={styles.whiteFieldInput}
                />
              </View>
            </View>
          </View>
        </View>

        {/* DOB */}
        <View style={styles.whiteSection}>
          <Text style={styles.whiteSectionTitle}>Date of birth</Text>
          <View
            style={[
              styles.whiteFieldGroup,
              activeField === 'dob' && styles.whiteFieldGroupFocused,
            ]}
          >
            <View
              style={[
                styles.whiteField,
                activeField === 'dob' && styles.whiteFieldFocused,
              ]}
            >
              <View
                style={[
                  styles.whiteFieldIconWrap,
                  activeField === 'dob' && styles.whiteFieldIconWrapFocused,
                ]}
              >
                <Feather
                  name="calendar"
                  size={15}
                  color={activeField === 'dob' ? ORANGE : '#6B7280'}
                />
              </View>
              <View style={styles.whiteFieldBody}>
                <Text
                  style={[
                    styles.whiteFieldLabel,
                    activeField === 'dob' && styles.whiteFieldLabelFocused,
                  ]}
                >
                  Birthdate
                </Text>
                <TextInput
                  testID="dob-input"
                  value={dob}
                  onChangeText={setDob}
                  onFocus={() => setActiveField('dob')}
                  onBlur={() => setActiveField(null)}
                  placeholder="YYYY-MM-DD (e.g. 1996-05-14)"
                  placeholderTextColor={LIGHT_PLACEHOLDER}
                  selectionColor={ORANGE}
                  keyboardType={
                    Platform.OS === 'web' ? undefined : 'numbers-and-punctuation'
                  }
                  style={styles.whiteFieldInput}
                />
              </View>
            </View>
          </View>
          <Text style={styles.whiteHelpText}>
            You must be at least 18. Your birthday won't be shared publicly.
          </Text>
        </View>

        {/* Email */}
        <View style={styles.whiteSection}>
          <Text style={styles.whiteSectionTitle}>Contact email</Text>
          <View
            style={[
              styles.whiteFieldGroup,
              activeField === 'email' && styles.whiteFieldGroupFocused,
            ]}
          >
            <View
              style={[
                styles.whiteField,
                activeField === 'email' && styles.whiteFieldFocused,
              ]}
            >
              <View
                style={[
                  styles.whiteFieldIconWrap,
                  activeField === 'email' && styles.whiteFieldIconWrapFocused,
                ]}
              >
                <Feather
                  name="mail"
                  size={15}
                  color={activeField === 'email' ? ORANGE : '#6B7280'}
                />
              </View>
              <View style={styles.whiteFieldBody}>
                <Text
                  style={[
                    styles.whiteFieldLabel,
                    activeField === 'email' && styles.whiteFieldLabelFocused,
                  ]}
                >
                  Email
                </Text>
                <TextInput
                  testID="profile-email-input"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setActiveField('email')}
                  onBlur={() => setActiveField(null)}
                  placeholder="amina@example.com"
                  placeholderTextColor={LIGHT_PLACEHOLDER}
                  selectionColor={ORANGE}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  style={styles.whiteFieldInput}
                />
              </View>
            </View>
          </View>
          <Text style={styles.whiteHelpText}>
            We'll send trip confirmations and receipts here.
          </Text>
        </View>

        {error ? (
          <View style={styles.whiteErrorRow}>
            <Feather name="alert-circle" size={13} color="#EF4444" />
            <Text style={styles.whiteErrorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.whiteLegal}>
          By selecting Agree and continue, you agree to ZuruSasa's{' '}
          <Text
            onPress={() => router.push('/profile/legal?doc=terms')}
            style={styles.whiteLegalLink}
            accessibilityRole="link"
            accessibilityLabel="Terms of Service"
          >
            Terms of Service
          </Text>
          {', '}
          <Text
            onPress={() => router.push('/profile/legal?doc=privacy')}
            style={styles.whiteLegalLink}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
          >
            Privacy Policy
          </Text>
          {', and '}
          <Text
            onPress={() => router.push('/profile/legal?doc=refunds')}
            style={styles.whiteLegalLink}
            accessibilityRole="link"
            accessibilityLabel="Cancellation and Refund Policy"
          >
            Cancellation & Refund Policy
          </Text>
          .
        </Text>

        <Pressable
          onPress={onCompleteProfile}
          disabled={loading}
          style={({ pressed }) => [
            styles.whiteScreenCta,
            loading && { opacity: 0.6 },
            pressed && { opacity: 0.85 },
          ]}
        >
          {loading ? (
            <PremiumLoader />
          ) : (
            <Text style={styles.whiteScreenCtaText}>Agree and continue</Text>
          )}
        </Pressable>
      </KeyboardScreen>
    </View>
  );
}
