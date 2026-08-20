import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { personaVerificationService } from '@/services/personaVerificationService';
import { useColors, useTheme } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';

interface PersonaVerificationModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  subtitle?: string;
}

export function PersonaVerificationModal({
  visible,
  onClose,
  onSuccess,
  title = 'Identity Verification Required',
  subtitle = 'To publish listings or add payout methods on ZuruSasa, please verify your identity with Persona.',
}: PersonaVerificationModalProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const { user, refreshProfile } = useAuth();
  const [verifying, setVerifying] = useState(false);

  const handleStartPersona = async () => {
    if (!user) return;
    try {
      setVerifying(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await personaVerificationService.launchVerification({
        userId: user.id,
        onSuccess: async () => {
          await refreshProfile();
          setVerifying(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onSuccess?.();
          onClose();
        },
        onCanceled: () => {
          setVerifying(false);
        },
        onError: (errorMessage) => {
          setVerifying(false);
          Alert.alert('Identity Verification', errorMessage);
        },
      });
    } catch (err: any) {
      console.error('Verification launch failed:', err);
      setVerifying(false);
      Alert.alert('Verification Error', err?.message || 'Could not start identity verification.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.sheetContainer, { backgroundColor: colors.card }]}>
          {/* Top handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Close button */}
          <Pressable
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}
            hitSlop={10}
          >
            <Feather name="x" size={20} color={colors.text} />
          </Pressable>

          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="shield-account" size={36} color="#F26522" />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>

          {/* Requirement Checklist */}
          <View style={[styles.checklist, { backgroundColor: isDark ? '#27272A' : '#F9FAFB', borderColor: colors.border }]}>
            <View style={styles.checkItem}>
              <View style={styles.checkIconWrap}>
                <Feather name="credit-card" size={16} color="#F26522" />
              </View>
              <View style={styles.checkTextWrap}>
                <Text style={[styles.checkTitle, { color: colors.text }]}>Government Issued ID</Text>
                <Text style={[styles.checkSub, { color: colors.mutedForeground }]}>Passport, National ID or Driver's License</Text>
              </View>
            </View>

            <View style={styles.checkItem}>
              <View style={styles.checkIconWrap}>
                <Feather name="camera" size={16} color="#F26522" />
              </View>
              <View style={styles.checkTextWrap}>
                <Text style={[styles.checkTitle, { color: colors.text }]}>Quick Selfie Check</Text>
                <Text style={[styles.checkSub, { color: colors.mutedForeground }]}>3D liveness match for host security</Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={handleStartPersona}
            disabled={verifying}
            style={({ pressed }) => [
              styles.primaryCta,
              { opacity: pressed || verifying ? 0.85 : 1 },
            ]}
          >
            {verifying ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.primaryCtaText}>Verify with Persona</Text>
                <Feather name="arrow-right" size={16} color="#FFFFFF" />
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 14,
    paddingHorizontal: 24,
    paddingBottom: 36,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 18,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F2652215',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  checklist: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    gap: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2652210',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkTextWrap: {
    flex: 1,
  },
  checkTitle: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: '#111827',
  },
  checkSub: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },
  primaryCta: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F26522',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
});
