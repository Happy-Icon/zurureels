import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import * as WebBrowser from 'expo-web-browser';
import { signInWithGoogleNatively } from '@/lib/googleNative';
import * as Linking from 'expo-linking';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { supabase } from '@/lib/supabase';
import { KeyboardScreen, KeyboardModal } from '@/components/keyboard';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Brand colours ─────────────────────────────────────────────────────────────
const ORANGE = '#F47C20';
const ORANGE_DARK = '#D96518';
const INK = '#1A1A1A';
const CHARCOAL = '#2D2D2D';
const MUTED = '#888888';
const HAIR = '#CCCCCC';

// ── Destinations ──────────────────────────────────────────────────────────────
const DESTINATIONS = [
  {
    name: 'Diani Beach',
    tagline: 'Kenya',
    image: require('../assets/images/hero_diani.jpg'),
  },
  {
    name: 'Lamu Island',
    tagline: 'Kenya',
    image: require('../assets/images/hero_lamu.jpg'),
  },
  {
    name: 'Watamu',
    tagline: 'Kenya',
    image: require('../assets/images/hero_watamu.jpg'),
  },
  {
    name: 'Zanzibar',
    tagline: 'Tanzania',
    image: require('../assets/images/hero_zanzibar.jpg'),
  },
  {
    name: 'Kilifi Creek',
    tagline: 'Kenya',
    image: require('../assets/images/hero_kilifi.jpg'),
  },
];

// ── Auth flow steps ────────────────────────────────────────────────────────────
type Step =
  | 'landing'
  | 'phone'
  | 'otp'
  | 'profile'
  | 'commitment'
  | 'email_sent'
  | 'email'
  | 'email_otp';

// ── Google SVG Logo ───────────────────────────────────────────────────────────
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

// ── Premium Loading Indicator ──────────────────────────────────────────────────
function PremiumLoader({ color = '#FFFFFF', size = 8 }: { color?: string; size?: number }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const wave = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 380,
            easing: Easing.in(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.delay(260),
        ]),
      );

    const a1 = wave(dot1, 0);
    const a2 = wave(dot2, 140);
    const a3 = wave(dot3, 280);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, []);

  const lift = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [0, -(size + 4)] });
  const fade = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const scl = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.15] });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.9 }}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: fade(d),
            transform: [{ translateY: lift(d) }, { scale: scl(d) }],
          }}
        />
      ))}
    </View>
  );
}


const COUNTRY_OPTIONS = [
  { code: '+254', label: 'Kenya (+254)', flag: '🇰🇪' },
  { code: '+255', label: 'Tanzania (+255)', flag: '🇹🇿' },
  { code: '+256', label: 'Uganda (+256)', flag: '🇺🇬' },
  { code: '+1', label: 'United States (+1)', flag: '🇺🇸' },
  { code: '+44', label: 'United Kingdom (+44)', flag: '🇬🇧' },
] as const;

// ── Premium Auth Button ────────────────────────────────────────────────────────
interface AuthButtonProps {
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  disabled?: boolean;
  delay?: number;
  animValue: Animated.Value;
}

function AuthButton({
  onPress,
  icon,
  label,
  sublabel,
  disabled,
  animValue,
}: AuthButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const opacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      <Pressable
        onPress={() => {
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={styles.authButton}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {/* Left icon */}
        <View style={styles.authButtonIcon}>{icon}</View>

        {/* Labels */}
        <View style={styles.authButtonLabels}>
          <Text style={styles.authButtonLabel}>{label}</Text>
          {sublabel ? (
            <Text style={styles.authButtonSublabel}>{sublabel}</Text>
          ) : null}
        </View>

        {/* Right chevron */}
        <Feather name="chevron-right" size={18} color={MUTED} />
      </Pressable>
    </Animated.View>
  );
}

// ── Animated Destination Indicator ────────────────────────────────────────────
function DestinationDot({
  active,
  index,
  current,
}: {
  active: boolean;
  index: number;
  current: number;
}) {
  const width = useRef(new Animated.Value(active ? 24 : 6)).current;
  useEffect(() => {
    Animated.spring(width, {
      toValue: active ? 24 : 6,
      useNativeDriver: false,
      tension: 200,
      friction: 15,
    }).start();
  }, [active]);
  return (
    <Animated.View
      style={[
        styles.dot,
        { width, backgroundColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.4)' },
      ]}
    />
  );
}

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, sendOtp, verifyOtp, refreshProfile } = useAuth();
  const panelScrollRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      },
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      },
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Pick a random destination on mount (simulates "different every day")
  const [destIndex, setDestIndex] = useState(() =>
    Math.floor(Math.random() * DESTINATIONS.length),
  );
  const dest = DESTINATIONS[destIndex];

  const [step, setStep] = useState<Step>('landing');
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

  // ── Animations ──────────────────────────────────────────────────────────────

  // Hero zoom-in
  const heroScale = useRef(new Animated.Value(1.08)).current;
  // Card slide-up
  const cardSlide = useRef(new Animated.Value(80)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  // Headline fade
  const heroOpacity = useRef(new Animated.Value(0)).current;
  // Destination label fade
  const destLabelOpacity = useRef(new Animated.Value(0)).current;

  // Per-button stagger anims (4 buttons)
  const btn1Anim = useRef(new Animated.Value(0)).current;
  const btn2Anim = useRef(new Animated.Value(0)).current;
  const btn3Anim = useRef(new Animated.Value(0)).current;
  const btn4Anim = useRef(new Animated.Value(0)).current;
  const btnAnims = [btn1Anim, btn2Anim, btn3Anim, btn4Anim];

  useEffect(() => {
    // Hero zoom
    Animated.timing(heroScale, {
      toValue: 1,
      duration: 3500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    // Hero text fade
    Animated.timing(heroOpacity, {
      toValue: 1,
      duration: 900,
      delay: 300,
      useNativeDriver: true,
    }).start();

    // Destination label
    Animated.timing(destLabelOpacity, {
      toValue: 1,
      duration: 700,
      delay: 600,
      useNativeDriver: true,
    }).start();

    // Card slide up
    Animated.parallel([
      Animated.spring(cardSlide, {
        toValue: 0,
        damping: 22,
        stiffness: 200,
        useNativeDriver: true,
        delay: 400,
      } as any),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 500,
        delay: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Button stagger
    const delays = [700, 850, 1000, 1150];
    btnAnims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: delays[i],
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, []);

  // ── Auth logic ────────────────────────────────────────────────────────────────
  const goHome = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

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
  }, [user]);

  const resetMessages = () => {
    setError(null);
    setNotice(null);
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
      goHome();
    }
  };

  const handleSendOtp = async () => {
    if (!phone) {
      setError('Please enter a valid phone number');
      return;
    }
    setLoading(true);
    resetMessages();
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        phone: fullPhoneNumber,
      });
      if (err) throw err;
      setStep('otp');
    } catch (e: any) {
      const msg = e?.message || '';
      if (/maximum time|Failed to reach hook/i.test(msg)) {
        setError('SMS gateway response timed out (Supabase Auth Hook). Please try Email OTP or try again.');
      } else {
        setError(msg || 'Failed to send code. Please try again.');
      }
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
      setNotice(`Code sent via ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}`);
      setShowMoreOptions(false);
      setOtp('');
    } catch (e: any) {
      const msg = e?.message || '';
      if (/maximum time|Failed to reach hook/i.test(msg)) {
        setError('SMS gateway response timed out (Supabase Auth Hook). Please try Email OTP or try again.');
      } else {
        setError(msg || 'Failed to resend code.');
      }
    } finally {
      setLoading(false);
    }
  };

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

    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailOtp = async () => {
    if (!email) {
      setError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    resetMessages();
    const { error: err } = await sendOtp(email.trim().toLowerCase());
    setLoading(false);
    if (err) {
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

      return;
    }
    const { data } = await supabase.auth.getUser();
    setLoading(false);
    if (data.user) await routeAfterLogin(data.user.id);
  };

  const handleCompleteProfile = () => {
    if (!firstName || !lastName || !dob || !email) {
      setError('Please fill in all fields to continue.');
      return;
    }
    resetMessages();
    setStep('commitment');
  };

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
      if (email && email.trim().toLowerCase() !== user?.email?.toLowerCase()) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: email.trim().toLowerCase(),
        });
        if (emailError) throw emailError;
        setStep('email_sent');
      } else {

        goHome();
      }
    } catch (e: any) {
      setError(e.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

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
      if (provider === 'google') {
        const native = await signInWithGoogleNatively();
        if (native.status === 'success') {
          const { data, error: err } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: native.idToken,
          });
          if (err) throw err;
          if (data.user) await routeAfterLogin(data.user.id);
          return;
        }
        if (native.status === 'cancelled') return;
        if (native.status === 'unavailable') {
          setError(native.reason);
          return;
        }
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

  // Back nav
  const onBack = () => {
    resetMessages();
    if (step === 'otp') setStep('phone');
    else if (step === 'email') setStep('landing');
    else if (step === 'email_otp') setStep('email');
    else if (step === 'commitment') setStep('profile');
    else if (step === 'phone') setStep('landing');
    else setStep('landing');
  };

  const showBack =
    step !== 'landing' &&
    step !== 'profile' &&
    step !== 'email_sent' &&
    step !== 'commitment';

  const isSubStep =
    step !== 'landing' && step !== 'profile' && step !== 'commitment' && step !== 'email_sent';

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
          style={StyleSheet.absoluteFillObject}
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
        style={StyleSheet.absoluteFillObject}
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
                      icon={
                        <Feather name="mail" size={20} color={INK} />
                      }
                      label="Continue with Email"
                      animValue={btn3Anim}
                    />
                    <AuthButton
                      onPress={() => {
                        resetMessages();
                        setStep('phone');
                      }}
                      icon={
                        <Feather name="phone" size={20} color={INK} />
                      }
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
                      color="rgba(255,255,255,0.5)"
                    />
                    <Text style={styles.footerText}>
                      Your information is protected.{' '}
                      <Text style={styles.footerLink}>Privacy</Text>
                      {' · '}
                      <Text style={styles.footerLink}>Terms</Text>
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
                  onFocusInput={() => {
                    setTimeout(() => {
                      panelScrollRef.current?.scrollToEnd({ animated: true });
                    }, 120);
                  }}
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
                  onFocusInput={() => {
                    setTimeout(() => {
                      panelScrollRef.current?.scrollToEnd({ animated: true });
                    }, 120);
                  }}
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
                  onFocusInput={() => {
                    setTimeout(() => {
                      panelScrollRef.current?.scrollToEnd({ animated: true });
                    }, 120);
                  }}
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
                  onFocusInput={() => {
                    setTimeout(() => {
                      panelScrollRef.current?.scrollToEnd({ animated: true });
                    }, 120);
                  }}
                />
              )}

              {/* Footer for sub-steps */}
              {isSubStep && (
                <View style={[styles.footer, { marginTop: 20 }]}>
                  <Feather
                    name="shield"
                    size={12}
                    color="rgba(255,255,255,0.4)"
                  />
                  <Text style={styles.footerText}>
                    Your information is protected.{' '}
                    <Text style={styles.footerLink}>Privacy Policy</Text>
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

// ── PHONE STEP COMPONENT ──────────────────────────────────────────────────────
function PhoneStep({
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
}: any) {
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
          <View style={styles.pickerSheet}>
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

// ── EMAIL STEP COMPONENT ──────────────────────────────────────────────────────
function EmailStep({ email, setEmail, onContinue, loading, error, onFocusInput }: any) {
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

// ── OTP STEP COMPONENT ────────────────────────────────────────────────────────
function OtpStep({
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
}: any) {
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

// ── PROFILE FLOW SCREEN (white background) ────────────────────────────────────
function ProfileFlowScreen({
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
}: any) {
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
          <View style={styles.whiteFieldGroup}>
            <View
              style={[
                styles.whiteField,
                { borderBottomWidth: 1, borderBottomColor: '#EBEBEB' },
              ]}
            >
              <Text style={styles.whiteFieldLabel}>First name</Text>
              <TextInput
                testID="first-name-input"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="John"
                placeholderTextColor={HAIR}
                style={styles.whiteFieldInput}
              />
            </View>
            <View style={styles.whiteField}>
              <Text style={styles.whiteFieldLabel}>Last name</Text>
              <TextInput
                testID="last-name-input"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Doe"
                placeholderTextColor={HAIR}
                style={styles.whiteFieldInput}
              />
            </View>
          </View>
        </View>

        {/* DOB */}
        <View style={styles.whiteSection}>
          <Text style={styles.whiteSectionTitle}>Date of birth</Text>
          <View style={styles.whiteFieldGroup}>
            <View style={styles.whiteField}>
              <Text style={styles.whiteFieldLabel}>Birthdate</Text>
              <TextInput
                testID="dob-input"
                value={dob}
                onChangeText={setDob}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={HAIR}
                keyboardType={
                  Platform.OS === 'web' ? undefined : 'numbers-and-punctuation'
                }
                style={styles.whiteFieldInput}
              />
            </View>
          </View>
          <Text style={styles.whiteHelpText}>
            You must be at least 18. Your birthday won't be shared publicly.
          </Text>
        </View>

        {/* Email */}
        <View style={styles.whiteSection}>
          <Text style={styles.whiteSectionTitle}>Contact email</Text>
          <View style={styles.whiteFieldGroup}>
            <View style={styles.whiteField}>
              <Text style={styles.whiteFieldLabel}>Email</Text>
              <TextInput
                testID="profile-email-input"
                value={email}
                onChangeText={setEmail}
                placeholder="hello@example.com"
                placeholderTextColor={HAIR}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.whiteFieldInput}
              />
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
          <Text style={styles.whiteLegalLink}>Terms of Service</Text>,{' '}
          <Text style={styles.whiteLegalLink}>Payments Terms</Text>, and{' '}
          <Text style={styles.whiteLegalLink}>Privacy Policy</Text>.
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

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#0A0602',
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },

  // ── Top header ────────────────────────────────────────────────────────────
  topHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  logoMarkText: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
  logoWordmark: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  logoTagline: {
    fontSize: 10,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  skipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  skipText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: 'rgba(255,255,255,0.9)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  // ── Hero text ────────────────────────────────────────────────────────────
  heroTextArea: {
    position: 'absolute',
    bottom: SH * 0.42,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
  },
  heroHeadline: {
    fontSize: 40,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
    lineHeight: 48,
    letterSpacing: -0.8,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroHeadlineAccent: {
    color: ORANGE,
  },
  heroSubheadline: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
    marginTop: 14,
    letterSpacing: 0.1,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 22,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
  destLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_500Medium',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 8,
  },

  // ── Glass auth panel ──────────────────────────────────────────────────────
  glassPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: SH * 0.44,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    // Fallback background for Android (BlurView may be faint)
    backgroundColor: 'rgba(18, 12, 6, 0.92)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  blurFill: {
    flex: 1,
  },
  panelContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
    gap: 0,
  },

  // Panel title + sub
  panelTitle: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  panelSub: {
    fontSize: 13.5,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 20,
    lineHeight: 20,
  },

  // Auth buttons
  buttonsStack: {
    gap: 10,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  authButtonIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authButtonLabels: {
    flex: 1,
  },
  authButtonLabel: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: INK,
    letterSpacing: -0.2,
  },
  authButtonSublabel: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: MUTED,
    marginTop: 1,
  },

  // Input rows (glass style)
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    marginBottom: 10,
  },
  inputRowContent: {
    flex: 1,
  },
  inputRowLabel: {
    fontSize: 10.5,
    fontFamily: 'DMSans_500Medium',
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  inputRowValue: {
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    color: '#FFFFFF',
  },
  flagEmoji: {
    fontSize: 22,
    marginRight: 2,
  },
  phoneCodeInline: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: 'rgba(255,255,255,0.6)',
  },
  glassInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    color: '#FFFFFF',
    padding: 0,
    margin: 0,
  },

  // OTP input
  otpInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 28,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 12,
    marginBottom: 16,
  },

  // Primary CTA
  primaryCta: {
    backgroundColor: ORANGE,
    borderRadius: 16,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    marginTop: 4,
  },
  primaryCtaText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Resend row
  resendRow: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  resendText: {
    fontSize: 13.5,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.5)',
  },
  resendLink: {
    fontFamily: 'DMSans_700Bold',
    color: ORANGE,
  },

  // Error
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.2)',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#FF9494',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 16,
  },
  footerText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.38)',
  },
  footerLink: {
    fontFamily: 'DMSans_600SemiBold',
    color: 'rgba(255,255,255,0.55)',
  },

  // ── Country Picker modal ───────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    paddingTop: 12,
  },
  pickerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDDDDD',
    alignSelf: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: INK,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 14,
  },
  pickerRowActive: {
    backgroundColor: '#FFF7F0',
  },
  pickerFlag: {
    fontSize: 22,
  },
  pickerLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    color: INK,
  },

  // ── White screen (profile / commitment / email_sent) ───────────────────────
  whiteScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  whiteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  whiteBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whiteHeaderTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: INK,
    letterSpacing: -0.2,
  },
  whiteContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 0,
  },
  whiteH1: {
    fontSize: 26,
    fontFamily: 'DMSans_700Bold',
    color: INK,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  whiteBodySub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    lineHeight: 21,
    marginBottom: 24,
  },
  whiteBody: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: '#444444',
    lineHeight: 23,
    marginBottom: 32,
  },
  whiteSection: {
    marginBottom: 28,
  },
  whiteSectionTitle: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  whiteFieldGroup: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    overflow: 'hidden',
    backgroundColor: '#FAFAFA',
  },
  whiteField: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  whiteFieldLabel: {
    fontSize: 10.5,
    fontFamily: 'DMSans_500Medium',
    color: '#999999',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  whiteFieldInput: {
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: INK,
    padding: 0,
  },
  whiteHelpText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
    lineHeight: 18,
    marginTop: 8,
  },
  whiteLegal: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
    lineHeight: 18,
    marginBottom: 24,
    marginTop: 8,
  },
  whiteLegalLink: {
    fontFamily: 'DMSans_600SemiBold',
    color: INK,
    textDecorationLine: 'underline',
  },
  whiteScreenCta: {
    backgroundColor: ORANGE,
    borderRadius: 16,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  whiteScreenCtaText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  whiteErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  whiteErrorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#DC2626',
  },
  // Email sent
  emailSentWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 16,
  },
  emailSentIcon: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: '#FFF7F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: ORANGE,
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 4,
  },
  emailSentTitle: {
    fontSize: 26,
    fontFamily: 'DMSans_700Bold',
    color: INK,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  emailSentSub: {
    fontSize: 14.5,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
    lineHeight: 22,
  },
});
