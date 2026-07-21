import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Svg, { Path } from 'react-native-svg';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { supabase } from '@/lib/supabase';

type Step =
  | 'phone'
  | 'otp'
  | 'profile'
  | 'commitment'
  | 'email_sent'
  | 'email'
  | 'email_otp';

const INK = '#222222';
const HAIR = '#B0B0B0';
const MUTED = '#717171';
const ORANGE = '#EE7D30';

// Web styles all h1-h6 with the display serif (see web src/index.css);
// browsers synthesize the semibold weight, so mirror that on RN web only.
const SERIF = 'InstrumentSerif_400Regular';
const serifWeight =
  Platform.OS === 'web' ? ({ fontWeight: '600' } as const) : null;

const COUNTRY_OPTIONS = [
  { code: '+254', label: 'Kenya (+254)' },
  { code: '+1', label: 'United States (+1)' },
  { code: '+44', label: 'United Kingdom (+44)' },
] as const;

function GoogleLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

function FacebookLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
        fill="#1877F2"
      />
    </Svg>
  );
}

const HEADER_TITLES: Record<Step, string> = {
  phone: 'Log in or sign up',
  otp: 'Confirm your number',
  email: 'Continue with email',
  email_otp: 'Confirm your email',
  profile: 'Finish signing up',
  commitment: 'Community commitment',
  email_sent: 'Finish signing up',
};

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, sendOtp, verifyOtp, refreshProfile } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [loading, setLoading] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+254');
  const [otp, setOtp] = useState('');
  const [emailOtp, setEmailOtp] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fullPhoneNumber = `${countryCode}${phone.replace(/^0+/, '')}`;

  const goHome = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  // Centralized routing: mirrors web — if signed in and not mid profile
  // completion, either finish signup or leave the auth screen.
  useEffect(() => {
    const checkRedirect = async () => {
      if (
        step === 'profile' ||
        step === 'commitment' ||
        step === 'email_sent' ||
        step === 'email'
      )
        return;
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      const profileData = data as { full_name: string | null } | null;

      if (!profileData?.full_name) {
        setStep('profile');
      } else {
        goHome();
      }
    };
    checkRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const resetMessages = () => {
    setError(null);
    setNotice(null);
  };

  // STEP 1: send phone OTP (same call as web)
  const handleSendOtp = async () => {
    if (!phone) {
      setError('Please enter a valid phone number');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    resetMessages();
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        phone: fullPhoneNumber,
      });
      if (err) throw err;
      setStep('otp');
      setShowMoreOptions(false);
    } catch (e: any) {
      setError(e.message || 'Failed to send code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async (channel: 'sms' | 'whatsapp') => {
    setLoading(true);
    resetMessages();
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        phone: fullPhoneNumber,
        options: { channel },
      });
      if (err) throw err;
      setNotice(`Code sent via ${channel === 'whatsapp' ? 'WhatsApp' : 'call'}`);
      setShowMoreOptions(false);
      setOtp('');
    } catch (e: any) {
      setError(e.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  const routeAfterLogin = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();
    const pData = data as { full_name: string | null } | null;
    if (!pData?.full_name) {
      setStep('profile');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goHome();
    }
  };

  // STEP 2: verify phone OTP
  const handleVerifyOtp = async () => {
    if (otp.length < 6) return;
    setLoading(true);
    resetMessages();
    try {
      const { data, error: err } = await supabase.auth.verifyOtp({
        phone: fullPhoneNumber,
        token: otp,
        type: 'sms',
      });
      if (err) throw err;
      if (data.user) await routeAfterLogin(data.user.id);
    } catch {
      setError('Invalid or expired code. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  // Email OTP flow (Continue with email)
  const handleSendEmailOtp = async () => {
    if (!email) {
      setError('Please enter a valid email address');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    resetMessages();
    const { error: err } = await sendOtp(email.trim().toLowerCase());
    setLoading(false);
    if (err) {
      // Supabase's mailer can 500 with a raw "{}" body (e.g. rate limits);
      // don't surface unreadable provider junk to the user.
      const readable = err.trim();
      setError(
        !readable || readable === '{}' || readable.startsWith('{')
          ? 'Failed to send code. Please try again.'
          : err,
      );
    } else {
      setEmailOtp('');
      setStep('email_otp');
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (emailOtp.length < 6) return;
    setLoading(true);
    resetMessages();
    const { error: err } = await verifyOtp(
      email.trim().toLowerCase(),
      emailOtp.trim(),
    );
    if (err) {
      setLoading(false);
      setError('Invalid or expired code. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const { data } = await supabase.auth.getUser();
    setLoading(false);
    if (data.user) await routeAfterLogin(data.user.id);
  };

  // STEP 3: profile form → commitment
  const handleCompleteProfile = () => {
    if (!firstName || !lastName || !dob || !email) {
      setError('Please fill in all fields to continue.');
      return;
    }
    resetMessages();
    setStep('commitment');
  };

  // STEP 4: commitment → save profile
  const handleCommitment = async () => {
    setLoading(true);
    resetMessages();
    try {
      const { error: profileError } = await (supabase
        .from('profiles')
        .update as any)({
        full_name: `${firstName} ${lastName}`.trim(),
      }).eq('id', user?.id);
      if (profileError) throw profileError;
      await refreshProfile();

      // Trigger a confirmation email only when the email actually changes
      // (web always calls updateUser; email-OTP users already own the email).
      if (email && email.trim().toLowerCase() !== user?.email?.toLowerCase()) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: email.trim().toLowerCase(),
        });
        if (emailError) throw emailError;
        setStep('email_sent');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        goHome();
      }
    } catch (e: any) {
      setError(e.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  // Social logins — same Supabase calls as web; native opens an in-app browser.
  const handleOAuth = async (provider: 'google' | 'facebook') => {
    resetMessages();
    try {
      if (Platform.OS === 'web') {
        const { error: err } = await supabase.auth.signInWithOAuth({
          provider,
          options:
            provider === 'facebook'
              ? { queryParams: { display: 'touch' } }
              : undefined,
        });
        if (err) throw err;
        return;
      }
      const redirectTo = Linking.createURL('/auth');
      const { data, error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (err) throw err;
      if (!data?.url) throw new Error('Could not start sign-in.');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success' && result.url) {
        const fragment = result.url.split('#')[1];
        const query = result.url.split('?')[1]?.split('#')[0];
        const hashParams = new URLSearchParams(fragment || '');
        const queryParams = new URLSearchParams(query || '');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const code = queryParams.get('code');
        if (accessToken && refreshToken) {
          const { error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionErr) throw sessionErr;
        } else if (code) {
          const { error: exchangeErr } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) throw exchangeErr;
        } else {
          throw new Error('Sign-in was not completed.');
        }
      }
    } catch (e: any) {
      setError(
        e.message ||
          `Couldn't complete ${provider === 'google' ? 'Google' : 'Facebook'} sign-in. Try the email option.`,
      );
    }
  };

  const handlePasskeyLogin = async () => {
    resetMessages();
    try {
      const { error: err } = await (supabase.auth as any).signInWithPasskey();
      if (err) throw err;
    } catch (e: any) {
      setError(e.message || 'Failed to log in with passkey.');
    }
  };

  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const showBack =
    step === 'otp' || step === 'email' || step === 'email_otp' || step === 'commitment';

  const onBack = () => {
    resetMessages();
    if (step === 'otp') setStep('phone');
    else if (step === 'email') setStep('phone');
    else if (step === 'email_otp') setStep('email');
    else if (step === 'commitment') setStep('profile');
  };

  const messages = (
    <>
      {error ? (
        <View style={styles.messageRow}>
          <Feather name="alert-circle" size={14} color={colors.destructive} />
          <Text
            testID="auth-error"
            style={[styles.messageText, { color: colors.destructive }]}
          >
            {error}
          </Text>
        </View>
      ) : null}
      {notice ? (
        <View style={styles.messageRow}>
          <Feather name="check-circle" size={14} color={ORANGE} />
          <Text style={[styles.messageText, { color: INK }]}>{notice}</Text>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: topPad + 16 }]}>
      {/* Header — matches the web modal header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          {showBack ? (
            <Pressable
              testID="auth-back"
              onPress={onBack}
              hitSlop={8}
              style={({ pressed }) => [
                styles.headerIconButton,
                pressed && { backgroundColor: colors.secondary },
              ]}
            >
              <Feather name="chevron-left" size={20} color={colors.foreground} />
            </Pressable>
          ) : step === 'profile' ? (
            <View style={[styles.headerIconButton, { opacity: 0.5 }]}>
              <Feather name="chevron-left" size={20} color={colors.foreground} />
            </View>
          ) : null}
        </View>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {HEADER_TITLES[step]}
        </Text>
        <View style={styles.headerRight}>
          {step === 'phone' ? (
            <Pressable
              testID="close-auth"
              onPress={goHome}
              hitSlop={8}
              style={({ pressed }) => [
                styles.headerIconButton,
                pressed && { backgroundColor: colors.secondary },
              ]}
            >
              <Feather name="x" size={20} color={colors.foreground} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        {/* STEP 1: PHONE */}
        {step === 'phone' && (
          <View>
            <Text style={[styles.h1, { color: colors.foreground }]}>
              Welcome to ZuruSasa
            </Text>

            <View style={styles.joinedBox}>
              <Pressable
                testID="country-code-select"
                onPress={() => setCountryPickerOpen(true)}
                style={styles.joinedRowTop}
              >
                <Text style={styles.fieldLabel}>Country code</Text>
                <Text style={styles.fieldValue}>
                  {COUNTRY_OPTIONS.find((c) => c.code === countryCode)?.label}
                </Text>
                <View style={styles.selectChevron}>
                  <Feather name="chevron-down" size={18} color={INK} />
                </View>
              </Pressable>
              <View style={styles.joinedRowBottom}>
                <Text style={styles.fieldLabel}>Phone number</Text>
                <View style={styles.phoneRow}>
                  <Text style={styles.phonePrefix}>{countryCode}</Text>
                  <TextInput
                    testID="phone-input"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="0700000000"
                    placeholderTextColor={HAIR}
                    keyboardType="phone-pad"
                    style={[
                      styles.phoneInput,
                      { backgroundColor: colors.background, borderRadius: 6 },
                    ]}
                  />
                </View>
              </View>
            </View>

            <Text style={styles.legalText}>
              We'll call or text you to confirm your number. Standard message
              and data rates apply.{' '}
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </Text>

            <Pressable
              testID="continue-button"
              onPress={handleSendOtp}
              disabled={loading || phone.length < 8}
              style={({ pressed }) => [
                styles.primaryButton,
                { height: 48, marginTop: 16 },
                (loading || phone.length < 8) && { opacity: 0.5 },
                pressed && !loading && phone.length >= 8 && { backgroundColor: '#D96B23' },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue</Text>
              )}
            </Pressable>

            {messages}

            <View>
              <Pressable
                testID="passkey-button"
                onPress={handlePasskeyLogin}
                disabled={loading}
                style={({ pressed }) => [styles.outlineButton, pressed && styles.outlinePressed]}
              >
                <View style={styles.outlineIcon}>
                  <Ionicons name="finger-print" size={20} color={INK} />
                </View>
                <Text style={styles.outlineButtonText}>Continue with Passkey</Text>
              </Pressable>
              <Pressable
                testID="google-button"
                onPress={() => handleOAuth('google')}
                style={({ pressed }) => [
                  styles.outlineButton,
                  { marginTop: 16 },
                  pressed && styles.outlinePressed,
                ]}
              >
                <View style={styles.outlineIcon}>
                  <GoogleLogo />
                </View>
                <Text style={styles.outlineButtonText}>Continue with Google</Text>
              </Pressable>
              <Pressable
                testID="facebook-button"
                onPress={() => handleOAuth('facebook')}
                disabled={loading}
                style={({ pressed }) => [
                  styles.outlineButton,
                  { marginTop: 16 },
                  pressed && styles.outlinePressed,
                ]}
              >
                <View style={styles.outlineIcon}>
                  <FacebookLogo />
                </View>
                <Text style={styles.outlineButtonText}>Continue with Facebook</Text>
              </Pressable>
              <Pressable
                testID="email-option-button"
                onPress={() => {
                  resetMessages();
                  setStep('email');
                }}
                disabled={loading}
                style={({ pressed }) => [
                  styles.outlineButton,
                  { marginTop: 16 },
                  pressed && styles.outlinePressed,
                ]}
              >
                <View style={styles.outlineIcon}>
                  <Feather name="mail" size={20} color={INK} />
                </View>
                <Text style={styles.outlineButtonText}>Continue with email</Text>
              </Pressable>
            </View>

            <View style={styles.needHelpWrap}>
              <Text style={styles.needHelpText}>Need help?</Text>
            </View>
          </View>
        )}

        {/* STEP: EMAIL */}
        {step === 'email' && (
          <View>
            <Text style={[styles.h1, { color: colors.foreground }]}>
              Continue with email
            </Text>

            <View style={styles.joinedBox}>
              <View style={[styles.joinedRowBottom, { paddingVertical: 12 }]}>
                <Text style={styles.fieldLabel}>Email address</Text>
                <TextInput
                  testID="email-input"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  placeholderTextColor={HAIR}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  autoFocus
                  style={[
                    styles.bareInput,
                    { backgroundColor: colors.background, borderRadius: 6 },
                  ]}
                />
              </View>
            </View>

            <Text style={styles.legalText}>
              We'll send a 6-digit code to your email address.
            </Text>

            <Pressable
              testID="send-code-button"
              onPress={handleSendEmailOtp}
              disabled={loading || !email}
              style={({ pressed }) => [
                styles.primaryButton,
                { height: 48, marginTop: 16 },
                (loading || !email) && { opacity: 0.5 },
                pressed && !loading && !!email && { backgroundColor: '#D96B23' },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Send code</Text>
              )}
            </Pressable>

            {messages}

            <Pressable
              testID="back-to-phone"
              onPress={() => {
                resetMessages();
                setStep('phone');
              }}
              disabled={loading}
              style={styles.inlineLinkWrap}
            >
              <Text style={styles.inlineLink}>Back to phone login</Text>
            </Pressable>
          </View>
        )}

        {/* STEP: EMAIL OTP */}
        {step === 'email_otp' && (
          <View style={{ gap: 24 }}>
            <Text style={styles.bodyText}>
              Enter the 6-digit code we sent to{' '}
              <Text style={styles.bodyStrong}>{email.trim()}</Text>:
            </Text>

            <TextInput
              testID="code-input"
              value={emailOtp}
              onChangeText={(t) => setEmailOtp(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="------"
              placeholderTextColor={HAIR}
              autoFocus
              style={[
                styles.otpInput,
                { borderColor: colors.input, backgroundColor: colors.background },
              ]}
            />

            <Text style={styles.resendText}>
              Didn't get a code?{' '}
              <Text
                testID="resend-email-code"
                style={styles.resendLink}
                onPress={() => {
                  if (!loading) handleSendEmailOtp();
                }}
              >
                Resend
              </Text>
            </Text>

            <Pressable
              testID="verify-button"
              onPress={handleVerifyEmailOtp}
              disabled={loading || emailOtp.length < 6}
              style={({ pressed }) => [
                styles.primaryButton,
                { height: 52 },
                (loading || emailOtp.length < 6) && { opacity: 0.5 },
                pressed && !loading && emailOtp.length >= 6 && { backgroundColor: '#D96B23' },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue</Text>
              )}
            </Pressable>

            {messages}
          </View>
        )}

        {/* STEP 2: PHONE OTP */}
        {step === 'otp' && (
          <View style={{ gap: 24 }}>
            {!showMoreOptions ? (
              <>
                <Text style={styles.bodyText}>
                  Enter the code we sent over SMS to{' '}
                  <Text style={styles.bodyStrong}>{fullPhoneNumber}</Text>:
                </Text>

                <TextInput
                  testID="phone-code-input"
                  value={otp}
                  onChangeText={(t) => setOtp(t.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="------"
                  placeholderTextColor={HAIR}
                  autoFocus
                  style={[
                    styles.otpInput,
                    { borderColor: colors.input, backgroundColor: colors.background },
                  ]}
                />

                <Text style={styles.resendText}>
                  Didn't get a code?{' '}
                  <Text
                    testID="more-options"
                    style={styles.resendLink}
                    onPress={() => setShowMoreOptions(true)}
                  >
                    More options
                  </Text>
                </Text>

                <Pressable
                  testID="verify-phone-button"
                  onPress={handleVerifyOtp}
                  disabled={loading || otp.length < 6}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { height: 52 },
                    (loading || otp.length < 6) && { opacity: 0.5 },
                    pressed && !loading && otp.length >= 6 && { backgroundColor: '#D96B23' },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Continue</Text>
                  )}
                </Pressable>

                {messages}
              </>
            ) : (
              <View>
                <Text style={[styles.bodyStrongBlock]}>
                  Choose another way to get a code:
                </Text>
                <View style={{ gap: 16, marginTop: 24 }}>
                  <Pressable
                    testID="resend-whatsapp"
                    onPress={() => handleResendOtp('whatsapp')}
                    disabled={loading}
                    style={({ pressed }) => [
                      styles.altChannelButton,
                      pressed && styles.outlinePressed,
                    ]}
                  >
                    <Feather name="message-square" size={20} color={INK} />
                    <Text style={styles.altChannelText}>Get a code via WhatsApp</Text>
                  </Pressable>
                  <Pressable
                    testID="resend-call"
                    onPress={() => handleResendOtp('sms')}
                    disabled={loading}
                    style={({ pressed }) => [
                      styles.altChannelButton,
                      pressed && styles.outlinePressed,
                    ]}
                  >
                    <Feather name="phone" size={20} color={INK} />
                    <Text style={styles.altChannelText}>Get a call instead</Text>
                  </Pressable>
                </View>
                {messages}
                <Pressable
                  testID="back-from-options"
                  onPress={() => setShowMoreOptions(false)}
                  disabled={loading}
                  style={styles.inlineLinkWrap}
                >
                  <Text style={styles.inlineLink}>Back</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* STEP 3: PROFILE COMPLETION */}
        {step === 'profile' && (
          <View style={{ gap: 32 }}>
            <View style={{ gap: 12 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Legal name
              </Text>
              <View style={[styles.joinedBox, { borderColor: colors.input, marginBottom: 0 }]}>
                <View style={[styles.profileRow, { borderBottomWidth: 1, borderBottomColor: colors.input }]}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                    First name on ID
                  </Text>
                  <TextInput
                    testID="first-name-input"
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="John"
                    placeholderTextColor={HAIR}
                    style={[styles.bareInput, { color: colors.foreground }]}
                  />
                </View>
                <View style={styles.profileRow}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                    Last name on ID
                  </Text>
                  <TextInput
                    testID="last-name-input"
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Doe"
                    placeholderTextColor={HAIR}
                    style={[styles.bareInput, { color: colors.foreground }]}
                  />
                </View>
              </View>
              <Text style={styles.helpText}>
                Make sure this matches the name on your government ID. If you go
                by another name, you can{' '}
                <Text style={styles.helpLink}>add a preferred first name</Text>.
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Date of birth
              </Text>
              <View style={[styles.joinedBox, { borderColor: colors.input, marginBottom: 0 }]}>
                <View style={styles.profileRow}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                    Birthdate
                  </Text>
                  <TextInput
                    testID="dob-input"
                    value={dob}
                    onChangeText={setDob}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={HAIR}
                    keyboardType={Platform.OS === 'web' ? undefined : 'numbers-and-punctuation'}
                    style={[styles.bareInput, { color: colors.foreground }]}
                  />
                </View>
              </View>
              <Text style={styles.helpText}>
                To sign up, you need to be at least 18. Your birthday won't be
                shared with other people who use ZuruSasa.
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Contact info
              </Text>
              <View style={[styles.joinedBox, { borderColor: colors.input, marginBottom: 0 }]}>
                <View style={styles.profileRow}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                    Email
                  </Text>
                  <TextInput
                    testID="profile-email-input"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="hello@example.com"
                    placeholderTextColor={HAIR}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={[styles.bareInput, { color: colors.foreground }]}
                  />
                </View>
              </View>
              <Text style={styles.helpText}>
                We'll email you trip confirmations and receipts.
              </Text>
            </View>

            <View style={{ gap: 16, paddingTop: 8 }}>
              <Text style={[styles.helpText, { color: colors.foreground }]}>
                By selecting <Text style={{ fontFamily: 'DMSans_700Bold' }}>Agree and continue</Text>, I
                agree to ZuruSasa's{' '}
                <Text style={styles.termsLink}>Terms of Service</Text>,{' '}
                <Text style={styles.termsLink}>Payments Terms of Service</Text>, and{' '}
                <Text style={styles.termsLink}>Nondiscrimination Policy</Text> and
                acknowledge the <Text style={styles.termsLink}>Privacy Policy</Text>.
              </Text>

              <Pressable
                testID="agree-continue-button"
                onPress={handleCompleteProfile}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { height: 52 },
                  pressed && { backgroundColor: '#D96B23' },
                ]}
              >
                <Text style={styles.primaryButtonText}>Agree and continue</Text>
              </Pressable>

              {messages}
            </View>
          </View>
        )}

        {/* STEP 4: COMMITMENT */}
        {step === 'commitment' && (
          <View style={{ paddingBottom: 24 }}>
            <Text style={[styles.commitTitle, { color: colors.foreground }]}>
              ZuruSasa is a community where anyone can belong
            </Text>

            <View style={{ gap: 16, marginTop: 24 }}>
              <Text style={[styles.commitBody, { color: colors.foreground }]}>
                To ensure this, we're asking you to commit to the following:
              </Text>
              <Text style={[styles.commitBody, { color: colors.foreground, lineHeight: 26 }]}>
                I agree to treat everyone in the ZuruSasa community—regardless of
                their race, religion, national origin, ethnicity, skin color,
                disability, sex, gender identity, sexual orientation or age—with
                respect, and without judgment or bias.
              </Text>
              <Text style={styles.learnMore}>Learn more</Text>
            </View>

            <View style={{ gap: 16, paddingTop: 32 }}>
              <Pressable
                testID="commitment-agree"
                onPress={handleCommitment}
                disabled={loading}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { height: 52 },
                  loading && { opacity: 0.5 },
                  pressed && !loading && { backgroundColor: '#D96B23' },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Agree and continue</Text>
                )}
              </Pressable>
              <Pressable
                testID="commitment-decline"
                onPress={goHome}
                style={({ pressed }) => [
                  styles.declineButton,
                  { borderColor: colors.border },
                  pressed && styles.outlinePressed,
                ]}
              >
                <Text style={[styles.declineText, { color: colors.foreground }]}>
                  Decline
                </Text>
              </Pressable>
              {messages}
            </View>
          </View>
        )}

        {/* FINAL STEP: EMAIL SENT */}
        {step === 'email_sent' && (
          <View style={styles.emailSentWrap}>
            <View style={styles.mailCircle}>
              <Feather name="mail" size={32} color={ORANGE} />
            </View>
            <Text style={[styles.emailSentTitle, { color: colors.foreground }]}>
              Please confirm your email address
            </Text>

            <View style={{ gap: 8, marginTop: 8, maxWidth: 384 }}>
              <Text style={styles.emailSentBody}>
                Welcome to ZuruSasa! In order to get started, you need to confirm
                your email address.
              </Text>
              <Text style={[styles.emailSentEmail, { color: colors.foreground }]}>
                {email.trim()}
              </Text>
            </View>

            <View style={{ paddingTop: 24, width: '100%', gap: 16 }}>
              <Pressable
                testID="go-dashboard"
                onPress={() => router.replace('/')}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { height: 52 },
                  pressed && { backgroundColor: '#D96B23' },
                ]}
              >
                <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
              </Pressable>
              <Text style={styles.emailSentFootnote}>
                You can confirm your email at any time from your inbox.
              </Text>
            </View>
          </View>
        )}
      </KeyboardAwareScrollViewCompat>

      {/* Country code picker (web renders a native <select>) */}
      <Modal
        visible={countryPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCountryPickerOpen(false)}
      >
        <Pressable
          style={styles.pickerBackdrop}
          onPress={() => setCountryPickerOpen(false)}
        >
          <View style={[styles.pickerSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.pickerTitle, { color: colors.foreground }]}>
              Country code
            </Text>
            {COUNTRY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.code}
                testID={`country-${opt.code}`}
                onPress={() => {
                  setCountryCode(opt.code);
                  setCountryPickerOpen(false);
                }}
                style={({ pressed }) => [
                  styles.pickerRow,
                  pressed && { backgroundColor: colors.secondary },
                ]}
              >
                <Text style={[styles.pickerRowText, { color: colors.foreground }]}>
                  {opt.label}
                </Text>
                {countryCode === opt.code ? (
                  <Feather name="check" size={18} color={ORANGE} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    height: 64,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerLeft: { width: 36, alignItems: 'flex-start' },
  headerRight: { width: 36, alignItems: 'flex-end' },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: SERIF,
    ...serifWeight,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  h1: {
    fontSize: 22,
    fontFamily: SERIF,
    ...serifWeight,
    marginBottom: 24,
  },
  joinedBox: {
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  joinedRowTop: {
    borderBottomWidth: 1,
    borderBottomColor: HAIR,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  joinedRowBottom: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  profileRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  fieldLabel: {
    fontSize: 12,
    color: MUTED,
    fontFamily: 'DMSans_400Regular',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    color: INK,
    fontFamily: 'DMSans_400Regular',
  },
  selectChevron: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -1,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phonePrefix: {
    fontSize: 16,
    color: INK,
    marginRight: 8,
    fontFamily: 'DMSans_400Regular',
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: INK,
    padding: 0,
    fontFamily: 'DMSans_400Regular',
  },
  bareInput: {
    fontSize: 16,
    color: INK,
    padding: 0,
    fontFamily: 'DMSans_400Regular',
  },
  legalText: {
    fontSize: 12,
    lineHeight: 16,
    color: INK,
    paddingTop: 4,
    fontFamily: 'DMSans_400Regular',
  },
  legalLink: {
    textDecorationLine: 'underline',
    fontFamily: 'DMSans_600SemiBold',
  },
  primaryButton: {
    backgroundColor: ORANGE,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
  },
  outlineButton: {
    height: 48,
    borderWidth: 1,
    borderColor: INK,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlinePressed: { opacity: 0.7 },
  outlineIcon: {
    position: 'absolute',
    left: 20,
  },
  outlineButtonText: {
    fontSize: 15,
    color: INK,
    fontFamily: 'DMSans_500Medium',
  },
  needHelpWrap: {
    marginTop: 32,
    paddingBottom: 32,
    alignItems: 'center',
  },
  needHelpText: {
    fontSize: 15,
    color: INK,
    fontFamily: 'DMSans_600SemiBold',
    textDecorationLine: 'underline',
  },
  inlineLinkWrap: {
    marginTop: 32,
    paddingTop: 16,
    alignSelf: 'flex-start',
  },
  inlineLink: {
    fontSize: 15,
    color: INK,
    fontFamily: 'DMSans_600SemiBold',
    textDecorationLine: 'underline',
  },
  bodyText: {
    fontSize: 15,
    color: INK,
    fontFamily: 'DMSans_400Regular',
  },
  bodyStrong: {
    fontFamily: 'DMSans_600SemiBold',
  },
  bodyStrongBlock: {
    fontSize: 15,
    color: INK,
    fontFamily: 'DMSans_600SemiBold',
  },
  otpInput: {
    height: 52,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 20,
    letterSpacing: 10,
    color: INK,
    fontFamily: 'DMSans_500Medium',
    backgroundColor: '#ffffff',
  },
  resendText: {
    fontSize: 14,
    color: INK,
    fontFamily: 'DMSans_500Medium',
  },
  resendLink: {
    textDecorationLine: 'underline',
    fontFamily: 'DMSans_600SemiBold',
  },
  altChannelButton: {
    height: 52,
    borderWidth: 1,
    borderColor: HAIR,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 16,
  },
  altChannelText: {
    fontSize: 15,
    color: INK,
    fontFamily: 'DMSans_500Medium',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: SERIF,
    ...serifWeight,
  },
  helpText: {
    fontSize: 12,
    lineHeight: 18,
    color: MUTED,
    fontFamily: 'DMSans_400Regular',
  },
  helpLink: {
    textDecorationLine: 'underline',
    fontFamily: 'DMSans_500Medium',
  },
  termsLink: {
    textDecorationLine: 'underline',
    color: ORANGE,
  },
  commitTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: SERIF,
    ...serifWeight,
  },
  commitBody: {
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
  },
  learnMore: {
    fontSize: 16,
    color: INK,
    fontFamily: 'DMSans_600SemiBold',
    textDecorationLine: 'underline',
  },
  declineButton: {
    height: 52,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  declineText: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
  },
  emailSentWrap: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  mailCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(238, 125, 48, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emailSentTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: SERIF,
    ...serifWeight,
    textAlign: 'center',
  },
  emailSentBody: {
    fontSize: 15,
    color: MUTED,
    textAlign: 'center',
    fontFamily: 'DMSans_400Regular',
  },
  emailSentEmail: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    textAlign: 'center',
    paddingTop: 8,
  },
  emailSentFootnote: {
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
    fontFamily: 'DMSans_400Regular',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  messageText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    flex: 1,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 8,
  },
  pickerTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    textAlign: 'center',
    marginBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
  },
  pickerRowText: {
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
  },
});
