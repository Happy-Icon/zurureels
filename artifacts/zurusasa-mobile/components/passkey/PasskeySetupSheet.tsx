import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface PasskeySetupSheetProps {
  visible: boolean;
  onClose: () => void;
  onRetry: () => void;
  errorMessage?: string | null;
  loading?: boolean;
  title?: string;
  description?: string;
}

export function PasskeySetupSheet({
  visible,
  onClose,
  onRetry,
  errorMessage,
  loading = false,
  title = 'Set up your passkey',
  description,
}: PasskeySetupSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const bottomPadding = Platform.OS === 'web' ? 24 : Math.max(insets.bottom, 20);

  const defaultDescription =
    'Sign in faster and more securely using your fingerprint, Face ID, or screen lock. Passkeys are safely stored on this device.';

  const displayDescription = description || (errorMessage ? errorMessage : defaultDescription);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card || '#FFFFFF',
              paddingBottom: bottomPadding,
            },
          ]}
        >
          {/* Top Drag Pill */}
          <View style={styles.pillHandle} />

          {/* Close X Button */}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.btnPressed]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close passkey setup"
          >
            <Feather name="x" size={20} color={colors.text || '#111827'} />
          </Pressable>

          {/* Icon Badge */}
          <View style={styles.iconWrapper}>
            <View style={styles.iconCircle}>
              <Ionicons name="finger-print-outline" size={36} color={colors.primary || '#EE7D30'} />
            </View>
            <View style={styles.keyBadge}>
              <Feather name="key" size={13} color="#FFFFFF" />
            </View>
          </View>

          {/* Title & Description */}
          <Text style={[styles.title, { color: colors.text || '#111827' }]}>
            {title}
          </Text>

          <Text style={[styles.description, { color: colors.mutedForeground || '#6B7280' }]}>
            {displayDescription}
          </Text>

          {/* Error Notice Pill if error is present */}
          {errorMessage && errorMessage !== displayDescription ? (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={15} color="#DC2626" style={{ marginTop: 2 }} />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Feature Highlights */}
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <View style={styles.featureIconBox}>
                <Feather name="check" size={14} color="#15803D" />
              </View>
              <Text style={[styles.featureText, { color: colors.text || '#1F2937' }]}>
                End-to-end encrypted on this phone
              </Text>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureIconBox}>
                <Feather name="check" size={14} color="#15803D" />
              </View>
              <Text style={[styles.featureText, { color: colors.text || '#1F2937' }]}>
                No passwords to type or remember
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <Pressable
              onPress={onRetry}
              disabled={loading}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.primary || '#EE7D30' },
                pressed && styles.primaryBtnPressed,
                loading && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Try again</Text>
              )}
            </Pressable>

            <Pressable
              onPress={onClose}
              disabled={loading}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Not now"
            >
              <Text style={[styles.secondaryBtnText, { color: colors.mutedForeground || '#6B7280' }]}>
                Not now
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  pillHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  btnPressed: {
    opacity: 0.7,
  },
  iconWrapper: {
    position: 'relative',
    marginTop: 8,
    marginBottom: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(238, 125, 48, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EE7D30',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  title: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    width: '100%',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#B91C1C',
    lineHeight: 18,
  },
  featureList: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureIconBox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
  },
  actionsContainer: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    width: '100%',
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EE7D30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
  },
});
