import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Platform, type ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { useAuth } from '@/context/AuthContext';
import { preconfigureGoogleSignIn, signInWithGoogleNatively } from '@/lib/googleNative';
import { supabase } from '@/lib/supabase';
import { passkeyService } from '@/services/passkeyService';
import { queryClient } from '@/lib/queryClient';
import { invalidateServerCache } from '@/lib/redis';
import { extractAvatarFromUser } from '@/lib/avatar';
import { DESTINATIONS, type AuthStep } from '@/components/auth/authConstants';

export function useAuthScreenFlow() {
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

  const [step, setStep] = useState<AuthStep>('landing');
  const [loading, setLoading] = useState(false);
  const [activeAuthProvider, setActiveAuthProvider] = useState<'google' | 'passkey' | null>(null);
  const [authStatusMessage, setAuthStatusMessage] = useState<string | null>(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

  const authInFlightRef = useRef(false);
  const hasNavigatedHomeRef = useRef(false);

  useEffect(() => {
    preconfigureGoogleSignIn();
  }, []);

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
  const heroScale = useRef(new Animated.Value(1.08)).current;
  const cardSlide = useRef(new Animated.Value(80)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const destLabelOpacity = useRef(new Animated.Value(0)).current;

  const btn1Anim = useRef(new Animated.Value(0)).current;
  const btn2Anim = useRef(new Animated.Value(0)).current;
  const btn3Anim = useRef(new Animated.Value(0)).current;
  const btn4Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(heroScale, {
      toValue: 1,
      duration: 3500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    Animated.timing(heroOpacity, {
      toValue: 1,
      duration: 900,
      delay: 300,
      useNativeDriver: true,
    }).start();

    Animated.timing(destLabelOpacity, {
      toValue: 1,
      duration: 700,
      delay: 600,
      useNativeDriver: true,
    }).start();

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

    const btnAnims = [btn1Anim, btn2Anim, btn3Anim, btn4Anim];
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
  }, [heroScale, heroOpacity, destLabelOpacity, cardSlide, cardOpacity, btn1Anim, btn2Anim, btn3Anim, btn4Anim]);

  // ── Auth logic ──────────────────────────────────────────────────────────────
  const goHome = useCallback(() => {
    if (hasNavigatedHomeRef.current) return;
    hasNavigatedHomeRef.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  useEffect(() => {
    const checkRedirect = async () => {
      if (
        authInFlightRef.current ||
        hasNavigatedHomeRef.current ||
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
        .maybeSingle();
      if (authInFlightRef.current || hasNavigatedHomeRef.current) return;
      const profileData = data as { full_name: string | null } | null;
      if (!profileData?.full_name) {
        setStep('profile');
      } else {
        goHome();
      }
    };
    checkRedirect();
  }, [user, step, goHome]);

  const resetMessages = () => {
    setError(null);
    setNotice(null);
  };

  const syncUserGoogleAvatar = async (
    authUser: any,
    existingProfile?: { metadata?: Record<string, any> | null } | null,
  ) => {
    try {
      const gAvatar = extractAvatarFromUser(authUser);
      if (!gAvatar) return;

      const pRow =
        existingProfile !== undefined
          ? existingProfile
          : (
              await supabase
                .from('profiles')
                .select('metadata')
                .eq('id', authUser.id)
                .maybeSingle()
            ).data;

      if (pRow) {
        const pMeta = ((pRow as any)?.metadata ?? {}) as Record<string, any>;
        if (!pMeta.avatar_url || pMeta.avatar_url !== gAvatar || !pMeta.picture) {
          await (supabase.from('profiles').update as any)({
            metadata: {
              ...pMeta,
              avatar_url: gAvatar,
              picture: gAvatar,
            },
          }).eq('id', authUser.id);
          queryClient.invalidateQueries({ queryKey: ['reels'] });
          queryClient.invalidateQueries({ queryKey: ['host-profile', authUser.id] });
          invalidateServerCache('invalidate_reels_feed').catch(() => {});
        }
      } else {
        const uMeta = (authUser.user_metadata ?? {}) as Record<string, any>;
        const fullName =
          uMeta.full_name ||
          uMeta.name ||
          authUser.email?.split('@')[0] ||
          'Traveler';
        await (supabase.from('profiles').insert as any)([
          {
            id: authUser.id,
            full_name: fullName,
            email: authUser.email || null,
            role: 'guest',
            metadata: {
              avatar_url: gAvatar,
              picture: gAvatar,
            },
          },
        ]);
        queryClient.invalidateQueries({ queryKey: ['reels'] });
        queryClient.invalidateQueries({ queryKey: ['host-profile', authUser.id] });
        invalidateServerCache('invalidate_reels_feed').catch(() => {});
      }
    } catch (e) {
      console.warn('Sync avatar note:', e);
    }
  };

  const routeAfterLogin = async (userId: string, knownAuthUser?: any): Promise<'home' | 'profile'> => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, metadata')
      .eq('id', userId)
      .maybeSingle();

    const pData = data as { full_name: string | null; metadata?: Record<string, any> | null } | null;

    // Sync Google avatar in the background so navigation is never stalled
    if (knownAuthUser) {
      void syncUserGoogleAvatar(knownAuthUser, pData);
    } else {
      supabase.auth
        .getUser()
        .then(({ data: authData }) => {
          if (authData?.user) {
            void syncUserGoogleAvatar(authData.user, pData);
          }
        })
        .catch(() => {});
    }

    const metaName =
      (knownAuthUser?.user_metadata?.full_name as string | undefined) ||
      (knownAuthUser?.user_metadata?.name as string | undefined);

    if (!pData?.full_name && !metaName) {
      setStep('profile');
      return 'profile';
    }
    goHome();
    return 'home';
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

  const clearProviderLoading = () => {
    authInFlightRef.current = false;
    setLoading(false);
    setActiveAuthProvider(null);
    setAuthStatusMessage(null);
  };

  const handleOAuth = async (provider: 'google' | 'facebook') => {
    if (authInFlightRef.current) return;
    authInFlightRef.current = true;
    resetMessages();
    setLoading(true);
    if (provider === 'google') {
      setActiveAuthProvider('google');
      setAuthStatusMessage('Opening Google...');
    }

    let navigatedHome = false;
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
          setAuthStatusMessage('Signing you in...');
          const { data, error: err } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: native.idToken,
          });
          if (err) throw err;
          if (data.user) {
            const dest = await routeAfterLogin(data.user.id, data.user);
            navigatedHome = dest === 'home';
          }
          return;
        }
        if (native.status === 'cancelled') return;
        if (native.status === 'unavailable') {
          setError(native.reason);
          return;
        }
      }
      setAuthStatusMessage('Opening browser...');
      const redirectTo = Linking.createURL('/auth');
      const { data, error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (err) throw err;
      if (!data?.url) throw new Error('Could not start sign-in.');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success' && result.url) {
        setAuthStatusMessage('Signing you in...');
        const fragment = result.url.split('#')[1];
        const query = result.url.split('?')[1]?.split('#')[0];
        const hashParams = new URLSearchParams(fragment || '');
        const queryParams = new URLSearchParams(query || '');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const code = queryParams.get('code');
        if (accessToken && refreshToken) {
          const { data: sData, error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionErr) throw sessionErr;
          if (sData?.user) {
            const dest = await routeAfterLogin(sData.user.id, sData.user);
            navigatedHome = dest === 'home';
          }
        } else if (code) {
          const { data: exData, error: exchangeErr } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) throw exchangeErr;
          if (exData?.user) {
            const dest = await routeAfterLogin(exData.user.id, exData.user);
            navigatedHome = dest === 'home';
          }
        } else {
          throw new Error('Sign-in was not completed.');
        }
      }
    } catch (e: any) {
      setError(
        e.message ||
          `Couldn't complete ${provider === 'google' ? 'Google' : 'Facebook'} sign-in. Try the email option.`,
      );
    } finally {
      if (!navigatedHome) {
        clearProviderLoading();
      }
    }
  };

  const handlePasskeyLogin = async () => {
    if (authInFlightRef.current) return;
    authInFlightRef.current = true;
    resetMessages();
    setLoading(true);
    setActiveAuthProvider('passkey');
    setAuthStatusMessage('Verifying passkey...');

    let navigatedHome = false;
    try {
      const result = await passkeyService.signIn();

      if (result.cancelled) {
        return;
      }

      if (!result.success) {
        setError(result.error || 'Failed to authenticate with passkey.');
        return;
      }

      if (result.user) {
        setAuthStatusMessage('Signing you in...');
        const dest = await routeAfterLogin(result.user.id, result.user);
        navigatedHome = dest === 'home';
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to log in with passkey.');
    } finally {
      if (!navigatedHome) {
        clearProviderLoading();
      }
    }
  };

  const onBack = () => {
    resetMessages();
    if (step === 'otp') setStep('phone');
    else if (step === 'email') setStep('landing');
    else if (step === 'email_otp') setStep('email');
    else if (step === 'commitment') setStep('profile');
    else if (step === 'phone') setStep('landing');
    else setStep('landing');
  };

  const scrollPanelToEnd = useCallback(() => {
    setTimeout(() => {
      panelScrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }, []);

  const showBack =
    step !== 'landing' &&
    step !== 'profile' &&
    step !== 'email_sent' &&
    step !== 'commitment';

  const isSubStep =
    step !== 'landing' &&
    step !== 'profile' &&
    step !== 'commitment' &&
    step !== 'email_sent';

  return {
    router,
    panelScrollRef,
    keyboardHeight,
    destIndex,
    setDestIndex,
    dest,
    step,
    setStep,
    loading,
    activeAuthProvider,
    authStatusMessage,
    showMoreOptions,
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
    notice,
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
  };
}
