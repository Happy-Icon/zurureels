import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { PremiumLoader } from '@/components/PremiumLoader';
import { ORANGE, OTP_RESEND_COOLDOWN_SECONDS } from './authConstants';
import { authStyles as styles } from './authStyles';

interface OtpStepProps {
  title: string;
  subtitlePrefix: string;
  destination: string;
  value: string;
  onChange: (val: string) => void;
  onVerify: () => void;
  onResend: () => void;
  loading: boolean;
  error: string | null;
  notice?: string | null;
  resendCountdown: number;
  resendTotalSeconds?: number;
  testID: string;
  verifyTestID: string;
  onFocusInput: () => void;
  autoCompleteMode?: 'sms-otp' | 'one-time-code';
}

const OTP_LENGTH = 6;

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function OtpStep({
  title,
  subtitlePrefix,
  destination,
  value,
  onChange,
  onVerify,
  onResend,
  loading,
  error,
  notice,
  resendCountdown,
  resendTotalSeconds = OTP_RESEND_COOLDOWN_SECONDS,
  testID,
  verifyTestID,
  onFocusInput,
  autoCompleteMode = 'sms-otp',
}: OtpStepProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(true);
  const caretOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(caretOpacity, {
          toValue: 0.15,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(caretOpacity, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
        }),
      ]),
    );
    blink.start();
    return () => blink.stop();
  }, [caretOpacity]);

  const handleCodeChange = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (cleaned.length > value.length && Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    onChange(cleaned);
  };

  const handleResendPress = () => {
    if (loading || resendCountdown > 0) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onResend();
  };

  const activeIndex = Math.min(value.length, OTP_LENGTH - 1);
  const progressPercent = Math.max(
    0,
    Math.min(100, (resendCountdown / Math.max(1, resendTotalSeconds)) * 100),
  );

  const renderCell = (idx: number) => {
    const digit = value[idx] ?? '';
    const isFilled = digit.length > 0;
    const isActive =
      focused &&
      ((value.length < OTP_LENGTH && idx === activeIndex) ||
        (value.length === OTP_LENGTH && idx === OTP_LENGTH - 1));

    return (
      <View
        key={idx}
        style={[
          styles.otpCell,
          isFilled && styles.otpCellFilled,
          isActive && styles.otpCellActive,
          Boolean(error) && styles.otpCellError,
        ]}
      >
        {isFilled ? (
          <Text style={styles.otpCellDigit}>{digit}</Text>
        ) : isActive ? (
          <Animated.View style={[styles.otpCaret, { opacity: caretOpacity }]} />
        ) : (
          <View style={styles.otpCellDotPlaceholder} />
        )}
      </View>
    );
  };

  return (
    <>
      <Text style={styles.panelTitle}>{title}</Text>
      <Text style={styles.panelSub}>
        {subtitlePrefix}{' '}
        <Text selectable style={styles.otpDestinationHighlight}>
          {destination}
        </Text>
      </Text>

      {/* 6-cell segmented glass OTP input */}
      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={styles.otpGridWrapper}
        accessibilityRole="none"
      >
        <View style={styles.otpCellsRow} pointerEvents="none">
          {renderCell(0)}
          {renderCell(1)}
          {renderCell(2)}
          <View style={styles.otpGroupDivider} />
          {renderCell(3)}
          {renderCell(4)}
          {renderCell(5)}
        </View>

        <TextInput
          ref={inputRef}
          testID={testID}
          value={value}
          onChangeText={handleCodeChange}
          onFocus={() => {
            setFocused(true);
            onFocusInput();
          }}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={autoCompleteMode}
          maxLength={OTP_LENGTH}
          caretHidden
          autoFocus
          style={styles.otpHiddenInput}
          accessibilityLabel="6-digit verification code"
        />
      </Pressable>

      {notice ? (
        <View style={styles.noticeRow}>
          <Feather name="check-circle" size={14} color="#34D399" />
          <Text selectable style={styles.noticeText}>
            {notice}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorRow}>
          <Feather name="alert-circle" size={13} color="#FF6B6B" />
          <Text selectable style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}

      <Pressable
        testID={verifyTestID}
        onPress={onVerify}
        disabled={loading || value.length < OTP_LENGTH}
        style={({ pressed }) => [
          styles.primaryCta,
          (loading || value.length < OTP_LENGTH) && { opacity: 0.5 },
          pressed && { transform: [{ scale: 0.97 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Verify and continue"
        accessibilityState={{
          disabled: loading || value.length < OTP_LENGTH,
          busy: loading,
        }}
      >
        {loading ? (
          <PremiumLoader />
        ) : (
          <Text style={styles.primaryCtaText}>Verify & Continue</Text>
        )}
      </Pressable>

      {/* Countdown during cooldown -> Resend button only after timer expires */}
      <View style={styles.otpFooterSection}>
        {resendCountdown > 0 ? (
          <View
            style={styles.countdownCard}
            accessibilityRole="text"
            accessibilityLabel={`You can resend a new code in ${resendCountdown} seconds`}
          >
            <View style={styles.countdownHeaderRow}>
              <View style={styles.countdownLabelRow}>
                <Feather name="clock" size={14} color={ORANGE} />
                <Text style={styles.countdownLabelText}>
                  Wait to request a new code
                </Text>
              </View>
              <View style={styles.countdownTimerBadge}>
                <Text style={styles.countdownTimerText}>
                  {formatCountdown(resendCountdown)}
                </Text>
              </View>
            </View>
            <View style={styles.countdownProgressTrack}>
              <View
                style={[
                  styles.countdownProgressFill,
                  { width: `${progressPercent}%` },
                ]}
              />
            </View>
          </View>
        ) : (
          <Pressable
            testID="resend-code-button"
            onPress={handleResendPress}
            disabled={loading}
            style={({ pressed }) => [
              styles.resendButton,
              loading && { opacity: 0.5 },
              pressed && { transform: [{ scale: 0.98 }], opacity: 0.88 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Resend verification code"
            accessibilityState={{ disabled: loading }}
          >
            <Feather name="rotate-cw" size={14} color={ORANGE} />
            <Text style={styles.resendButtonText}>Resend code</Text>
          </Pressable>
        )}
      </View>
    </>
  );
}
