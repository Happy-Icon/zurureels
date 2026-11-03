import React from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';

import {
  AuthButton,
  DestinationDot,
  GoogleLogo,
} from '@/components/auth/AuthPrimitives';
import { EmailStep } from '@/components/auth/EmailStep';
import { OtpStep } from '@/components/auth/OtpStep';
import { PhoneStep } from '@/components/auth/PhoneStep';
import { ProfileFlowScreen } from '@/components/auth/ProfileFlowScreen';
import { DESTINATIONS, INK } from '@/components/auth/authConstants';
import { authStyles as styles } from '@/components/auth/authStyles';
import { useAuthScreenFlow } from '@/hooks/useAuthScreenFlow';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const flow = useAuthScreenFlow();

  const {
    router,
    panelScrollRef,
    destIndex,
    setDestIndex,
    dest,
    step,
    setStep,
    loading,
    countryPickerOpen,
    setCountryPickerOpen,
    phone,
    setPhone,
    countryCode,
    setCountryCode,
    otp,
    setOtp,
    emailOtp,
    setEmailOtp,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    dob,
    setDob,
    email,
    setEmail,
    error,
    fullPhoneNumber,
    heroScale,
    cardSlide,
    cardOpacity,
    heroOpacity,
    destLabelOpacity,
    btn1Anim,
    btn2Anim,
    btn3Anim,
    btn4Anim,
    showBack,
    isSubStep,
    goHome,
    resetMessages,
    handleSendOtp,
    handleResendOtp,
    handleVerifyOtp,
    handleSendEmailOtp,
    handleVerifyEmailOtp,
    handleCompleteProfile,
    handleCommitment,
    handleOAuth,
    handlePasskeyLogin,
    onBack,
    scrollPanelToEnd,
  } = flow;

  // ── PROFILE / COMMITMENT / EMAIL_SENT — full white screens ─────────────────
  if (step === 'profile' || step === 'commitment' || step === 'email_sent') {
    return (
      <ProfileFlowScreen
        step={step}
        insets={insets}
        firstName={firstName}
        setFirstName={setFirstName}
        lastName={lastName}
        setLastName={setLastName}
        dob={dob}
        setDob={setDob}
        email={email}
        setEmail={setEmail}
        error={error}
        loading={loading}
        onCompleteProfile={handleCompleteProfile}
        onCommitment={handleCommitment}
        onBack={onBack}
        goHome={goHome}
      />
    );
  }

  // ── MAIN IMMERSIVE SCREEN ─────────────────────────────────────────────────
  return (
    <View style={styles.fill}>
      {/* ── HERO IMAGE ──────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.heroContainer,
          { transform: [{ scale: heroScale }] },
        ]}
      >
        <Image
          source={dest.image}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={600}
          priority="high"
        />
      </Animated.View>

      {/* ── GRADIENT OVERLAY ──────────────────────────────────────────────── */}
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.08)',
          'rgba(0,0,0,0.25)',
          'rgba(0,0,0,0.55)',
          'rgba(10,6,3,0.88)',
        ]}
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── TOP HEADER AREA ────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.topHeader,
          { paddingTop: insets.top + 16, opacity: heroOpacity },
        ]}
      >
        {/* Logo wordmark */}
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>Z</Text>
          </View>
          <View>
            <Text style={styles.logoWordmark}>ZuruSasa</Text>
            <Text style={styles.logoTagline}>Explore East Africa</Text>
          </View>
        </View>

        {/* Back button for sub-steps */}
        {showBack && (
          <Pressable onPress={onBack} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </Pressable>
        )}
      </Animated.View>

      {/* ── HERO HEADLINE ───────────────────────────────────────────────────── */}
      {step === 'landing' && (
        <Animated.View
          style={[styles.heroTextArea, { opacity: heroOpacity }]}
        >
          <Text style={styles.heroHeadline}>
            Discover your next{'\n'}
            <Text style={styles.heroHeadlineAccent}>unforgettable</Text>
            {'\n'}stay
          </Text>
          <Text style={styles.heroSubheadline}>
            Luxury stays, tours and experiences{'\n'}across East Africa.
          </Text>

          {/* Destination indicators */}
          <Animated.View
            style={[styles.dotsRow, { opacity: destLabelOpacity }]}
          >
            {DESTINATIONS.map((d, i) => (
              <Pressable
                key={d.name}
                onPress={() => setDestIndex(i)}
                hitSlop={8}
              >
                <DestinationDot
                  active={i === destIndex}
                  index={i}
                  current={destIndex}
                />
              </Pressable>
            ))}
          </Animated.View>
          <Animated.Text style={[styles.destLabel, { opacity: destLabelOpacity }]}>
            {dest.name} · {dest.tagline}
          </Animated.Text>
        </Animated.View>
      )}

      {/* ── GLASS AUTH PANEL ────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.glassPanel,
          {
            opacity: cardOpacity,
            transform: [{ translateY: cardSlide }],
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <BlurView intensity={Platform.OS === 'ios' ? 70 : 40} tint="dark" style={styles.blurFill}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView
              ref={panelScrollRef}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.panelContent,
                { paddingBottom: Math.max(insets.bottom + 80, 100) },
              ]}
            >
              {/* ── LANDING: Auth buttons ─────────────────────────────── */}
              {step === 'landing' && (
                <>
                  <View style={styles.buttonsStack}>
                    <AuthButton
                      onPress={() => handleOAuth('google')}
                      icon={<GoogleLogo />}
                      label="Continue with Google"
                      animValue={btn1Anim}
                    />
                    <AuthButton
                      onPress={handlePasskeyLogin}
                      icon={
                        <Ionicons
                          name="finger-print"
                          size={20}
                          color={INK}
                        />
                      }
                      label="Continue with Passkey"
                      sublabel="Face ID · Touch ID"
                      animValue={btn2Anim}
                    />
                    <AuthButton
                      onPress={() => {
                        resetMessages();
                        setStep('email');
                      }}
                      icon={<Feather name="mail" size={20} color={INK} />}
                      label="Continue with Email"
                      animValue={btn3Anim}
                    />
                    <AuthButton
                      onPress={() => {
                        resetMessages();
                        setStep('phone');
                      }}
                      icon={<Feather name="phone" size={20} color={INK} />}
                      label="Continue with Phone"
                      sublabel="SMS verification"
                      animValue={btn4Anim}
                    />
                  </View>

                  {/* Error message */}
                  {error ? (
                    <View style={styles.errorRow}>
                      <Feather
                        name="alert-circle"
                        size={13}
                        color="#FF6B6B"
                      />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  {/* Footer */}
                  <View style={styles.footer}>
                    <Feather
                      name="shield"
                      size={12}
                      color="rgba(255,255,255,0.6)"
                    />
                    <Text style={styles.footerText}>
                      By signing in, you agree to our{' '}
                      <Text
                        onPress={() => router.push('/profile/legal?doc=privacy')}
                        style={styles.footerLink}
                        accessibilityRole="link"
                        accessibilityLabel="Privacy Policy"
                      >
                        Privacy
                      </Text>
                      {' · '}
                      <Text
                        onPress={() => router.push('/profile/legal?doc=terms')}
                        style={styles.footerLink}
                        accessibilityRole="link"
                        accessibilityLabel="Terms of Service"
                      >
                        Terms
                      </Text>
                      {' · '}
                      <Text
                        onPress={() => router.push('/profile/legal?doc=cookies')}
                        style={styles.footerLink}
                        accessibilityRole="link"
                        accessibilityLabel="Cookie Policy"
                      >
                        Cookies
                      </Text>
                      {' · '}
                      <Text
                        onPress={() => router.push('/profile/legal?doc=refunds')}
                        style={styles.footerLink}
                        accessibilityRole="link"
                        accessibilityLabel="Cancellation and Refund Policy"
                      >
                        Refunds
                      </Text>
                    </Text>
                  </View>
                </>
              )}

              {/* ── PHONE STEP ──────────────────────────────────────────────── */}
              {step === 'phone' && (
                <PhoneStep
                  phone={phone}
                  setPhone={setPhone}
                  countryCode={countryCode}
                  setCountryCode={setCountryCode}
                  countryPickerOpen={countryPickerOpen}
                  setCountryPickerOpen={setCountryPickerOpen}
                  onContinue={handleSendOtp}
                  loading={loading}
                  error={error}
                  onFocusInput={scrollPanelToEnd}
                />
              )}

              {/* ── OTP STEP ────────────────────────────────────────────────── */}
              {step === 'otp' && (
                <OtpStep
                  title="Verify your number"
                  subtitle={`We sent a 6-digit code to ${fullPhoneNumber}`}
                  value={otp}
                  onChange={(t: string) => setOtp(t.replace(/\D/g, ''))}
                  onVerify={handleVerifyOtp}
                  onResend={() => handleResendOtp('sms')}
                  loading={loading}
                  error={error}
                  testID="phone-code-input"
                  verifyTestID="verify-phone-button"
                  onFocusInput={scrollPanelToEnd}
                />
              )}

              {/* ── EMAIL STEP ──────────────────────────────────────────────── */}
              {step === 'email' && (
                <EmailStep
                  email={email}
                  setEmail={setEmail}
                  onContinue={handleSendEmailOtp}
                  loading={loading}
                  error={error}
                  onFocusInput={scrollPanelToEnd}
                />
              )}

              {/* ── EMAIL OTP STEP ──────────────────────────────────────────── */}
              {step === 'email_otp' && (
                <OtpStep
                  title="Check your email"
                  subtitle={`We sent a 6-digit code to ${email.trim()}`}
                  value={emailOtp}
                  onChange={(t: string) => setEmailOtp(t.replace(/\D/g, ''))}
                  onVerify={handleVerifyEmailOtp}
                  onResend={handleSendEmailOtp}
                  loading={loading}
                  error={error}
                  testID="code-input"
                  verifyTestID="verify-button"
                  onFocusInput={scrollPanelToEnd}
                />
              )}

              {/* Footer for sub-steps */}
              {isSubStep && (
                <View style={[styles.footer, { marginTop: 20 }]}>
                  <Feather
                    name="shield"
                    size={12}
                    color="rgba(255,255,255,0.5)"
                  />
                  <Text style={styles.footerText}>
                    Your information is protected.{' '}
                    <Text
                      onPress={() => router.push('/profile/legal?doc=privacy')}
                      style={styles.footerLink}
                      accessibilityRole="link"
                      accessibilityLabel="Privacy Policy"
                    >
                      Privacy Policy
                    </Text>
                    {' · '}
                    <Text
                      onPress={() => router.push('/profile/legal?doc=terms')}
                      style={styles.footerLink}
                      accessibilityRole="link"
                      accessibilityLabel="Terms of Service"
                    >
                      Terms
                    </Text>
                  </Text>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </BlurView>
      </Animated.View>
    </View>
  );
}
