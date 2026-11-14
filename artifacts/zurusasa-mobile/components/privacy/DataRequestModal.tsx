import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { PersonalDataExportFormat } from '@/lib/supabase';
import { dataRequestService } from '@/services/dataRequestService';

interface DataRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (requestId: string) => void;
}

export function DataRequestModal({ visible, onClose, onSuccess }: DataRequestModalProps) {
  const colors = useColors();

  const [step, setStep] = useState<'format' | 'otp'>('format');
  const [format, setFormat] = useState<PersonalDataExportFormat>('both');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [requestId, setRequestId] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(60);

  useEffect(() => {
    if (!visible) {
      setStep('format');
      setOtpCode('');
      setError(null);
      setLoading(false);
      setResendCooldown(60);
    }
  }, [visible]);

  useEffect(() => {
    let timer: any;
    if (step === 'otp' && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  const handleInitiate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await dataRequestService.initiateDataRequest(format);
      if (!result.success || !result.request_id) {
        setError(result.error || 'Failed to initiate data export');
        setLoading(false);
        return;
      }
      setRequestId(result.request_id);
      setRecipientEmail(result.recipient_email || null);
      setStep('otp');
      setResendCooldown(60);
    } catch (e: any) {
      setError(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!requestId || otpCode.trim().length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await dataRequestService.verifyDataRequestOtp(requestId, otpCode);
      if (!result.success) {
        const remaining =
          result.remaining_attempts !== undefined
            ? ` (${result.remaining_attempts} attempts left)`
            : '';
        setError((result.error || 'Verification failed') + remaining);
        setLoading(false);
        return;
      }
      onSuccess(requestId);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Verification error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await dataRequestService.initiateDataRequest(format);
      if (result.success && result.request_id) {
        setRequestId(result.request_id);
        setResendCooldown(60);
        setError(null);
      } else {
        setError(result.error || 'Failed to resend code');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to resend');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(242, 101, 34, 0.08)' }]}>
                <Feather name="shield" size={17} color="#F26522" />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {step === 'format' ? 'Choose export format' : 'Verify your identity'}
              </Text>
            </View>
            <Pressable
              testID="close-data-request-modal"
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.btnPressed]}
            >
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Body */}
          {step === 'format' ? (
            <View style={styles.bodyContent}>
              <Text style={[styles.description, { color: colors.mutedForeground }]}>
                Select how you would like your archive packaged. You will receive an email verification code on the next step.
              </Text>

              {/* Format Option: Both */}
              <Pressable
                testID="format-both-btn"
                onPress={() => setFormat('both')}
                style={[
                  styles.optionCard,
                  {
                    borderColor: format === 'both' ? '#F26522' : colors.border,
                    backgroundColor: format === 'both' ? 'rgba(242, 101, 34, 0.04)' : colors.card,
                  },
                ]}
              >
                <View style={styles.optionTextCol}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>
                    PDF & JSON Bundle (Recommended)
                  </Text>
                  <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>
                    Human-readable summary document plus structured data archive.
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    { borderColor: format === 'both' ? '#F26522' : colors.border },
                    format === 'both' && styles.radioCircleActive,
                  ]}
                >
                  {format === 'both' && <View style={styles.radioDot} />}
                </View>
              </Pressable>

              {/* Format Option: PDF */}
              <Pressable
                testID="format-pdf-btn"
                onPress={() => setFormat('pdf')}
                style={[
                  styles.optionCard,
                  {
                    borderColor: format === 'pdf' ? '#F26522' : colors.border,
                    backgroundColor: format === 'pdf' ? 'rgba(242, 101, 34, 0.04)' : colors.card,
                  },
                ]}
              >
                <View style={styles.optionTextCol}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>
                    PDF Summary Document Only
                  </Text>
                  <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>
                    Clean, styled multi-page document formatted for reading.
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    { borderColor: format === 'pdf' ? '#F26522' : colors.border },
                    format === 'pdf' && styles.radioCircleActive,
                  ]}
                >
                  {format === 'pdf' && <View style={styles.radioDot} />}
                </View>
              </Pressable>

              {/* Format Option: JSON */}
              <Pressable
                testID="format-json-btn"
                onPress={() => setFormat('json')}
                style={[
                  styles.optionCard,
                  {
                    borderColor: format === 'json' ? '#F26522' : colors.border,
                    backgroundColor: format === 'json' ? 'rgba(242, 101, 34, 0.04)' : colors.card,
                  },
                ]}
              >
                <View style={styles.optionTextCol}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>
                    Machine-Readable JSON
                  </Text>
                  <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>
                    Raw data portability archive conforming to GDPR Art. 20.
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    { borderColor: format === 'json' ? '#F26522' : colors.border },
                    format === 'json' && styles.radioCircleActive,
                  ]}
                >
                  {format === 'json' && <View style={styles.radioDot} />}
                </View>
              </Pressable>

              {error && (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={14} color="#EF4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Pressable
                testID="continue-to-verification-btn"
                onPress={handleInitiate}
                disabled={loading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  loading && styles.btnDisabled,
                  pressed && styles.btnPressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Continue to Verification</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.bodyContent}>
              <Text style={[styles.description, { color: colors.mutedForeground }]}>
                We sent a 6-digit verification code to{' '}
                <Text style={{ color: colors.text, fontFamily: 'DMSans_600SemiBold' }}>
                  {recipientEmail || 'your verified email'}
                </Text>
                . Enter the code to authorize the export.
              </Text>

              <TextInput
                testID="data-request-otp-input"
                value={otpCode}
                onChangeText={(val) => setOtpCode(val.replace(/[^0-9]/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor="rgba(156,163,175,0.4)"
                autoFocus
                style={[
                  styles.otpInput,
                  {
                    color: colors.text,
                    borderColor: error ? '#EF4444' : colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              />

              {error && (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={14} color="#EF4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.resendRow}>
                {resendCooldown > 0 ? (
                  <Text style={[styles.cooldownText, { color: colors.mutedForeground }]}>
                    Resend code in {resendCooldown}s
                  </Text>
                ) : (
                  <Pressable testID="resend-otp-btn" onPress={handleResend} disabled={loading}>
                    <Text style={styles.resendLink}>Resend verification code</Text>
                  </Pressable>
                )}
              </View>

              <Pressable
                testID="verify-otp-submit-btn"
                onPress={handleVerify}
                disabled={loading || otpCode.trim().length !== 6}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  (loading || otpCode.trim().length !== 6) && styles.btnDisabled,
                  pressed && styles.btnPressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Verify & Authorize Export</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'DMSans_600SemiBold',
    letterSpacing: -0.2,
  },
  closeBtn: {
    padding: 4,
  },
  bodyContent: {
    gap: 12,
  },
  description: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 18,
    marginBottom: 2,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  optionTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  optionTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 16,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#F26522',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F26522',
  },
  otpInput: {
    fontSize: 24,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginVertical: 4,
  },
  resendRow: {
    alignItems: 'center',
    marginVertical: 2,
  },
  cooldownText: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  resendLink: {
    fontSize: 13,
    color: '#F26522',
    fontFamily: 'DMSans_600SemiBold',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    padding: 10,
    borderRadius: 10,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    flex: 1,
  },
  primaryBtn: {
    backgroundColor: '#F26522',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnPressed: {
    opacity: 0.9,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
