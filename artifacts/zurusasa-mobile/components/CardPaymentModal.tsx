import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export interface CardPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  amount?: number;
  experienceTitle?: string;
  onConfirmPay: () => Promise<void> | void;
}

export function CardPaymentModal({
  visible,
  onClose,
  amount,
  experienceTitle,
  onConfirmPay,
}: CardPaymentModalProps) {
  const insets = useSafeAreaInsets();

  const handleConfirmMethod = async () => {
    await onConfirmPay();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* ── TOP HEADER NAV ── */}
        <View style={[styles.headerNav, { paddingTop: Platform.OS === 'ios' ? insets.top + 6 : 16 }]}>
          <View style={styles.headerLeftSpacer} />
          <Text style={styles.headerTitle}>Secure card checkout</Text>
          <Pressable onPress={onClose} style={styles.headerCloseBtn} hitSlop={12}>
            <Feather name="x" size={22} color="#111111" />
          </Pressable>
        </View>

        {/* ── PCI-DSS SAQ-A HOSTED CHECKOUT SUMMARY ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 96 },
          ]}
        >
          {/* 1. ORDER & NETWORKS SUMMARY CARD */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeaderRow}>
              <View style={styles.lockIconWrap}>
                <Feather name="lock" size={20} color="#059669" />
              </View>
              <View style={styles.summaryHeaderTextCol}>
                <Text style={styles.summaryTitle}>Paystack Hosted Card Checkout</Text>
                <Text style={styles.summarySub}>
                  PCI-DSS Level 1 encrypted payment window
                </Text>
              </View>
            </View>

            {(experienceTitle || amount != null) ? (
              <>
                <View style={styles.cardDivider} />
                <View style={styles.orderMetaCol}>
                  {experienceTitle ? (
                    <View style={styles.orderMetaRow}>
                      <Text style={styles.orderMetaLabel}>Reservation</Text>
                      <Text style={styles.orderMetaValue} numberOfLines={1}>
                        {experienceTitle}
                      </Text>
                    </View>
                  ) : null}
                  {amount != null ? (
                    <View style={styles.orderMetaRow}>
                      <Text style={styles.orderMetaLabel}>Amount to authorize</Text>
                      <Text style={styles.orderMetaAmount}>
                        KES {Number(amount).toLocaleString()}.00
                      </Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}

            <View style={styles.cardDivider} />

            {/* Supported Card Networks */}
            <View style={styles.networksSection}>
              <Text style={styles.networksLabel}>SUPPORTED NETWORKS</Text>
              <View style={styles.badgesRow}>
                <View style={styles.visaBadge}>
                  <Text style={styles.visaBadgeText}>VISA</Text>
                </View>

                <View style={styles.mcBadge}>
                  <View style={styles.mcRedCircle} />
                  <View style={styles.mcAmberCircle} />
                  <Text style={styles.mcBadgeText}>Mastercard</Text>
                </View>

                <View style={styles.verveBadge}>
                  <Text style={styles.verveBadgeText}>Verve</Text>
                </View>

                <View style={styles.threeDsBadge}>
                  <MaterialCommunityIcons name="shield-lock-outline" size={13} color="#059669" />
                  <Text style={styles.threeDsBadgeText}>3D Secure</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 2. HOW IT WORKS / SECURITY GUARANTEES */}
          <Text style={styles.sectionHeading}>How secure card payment works</Text>

          <View style={styles.stepsBox}>
            <View style={styles.stepRow}>
              <View style={styles.stepIconCircle}>
                <Feather name="external-link" size={16} color="#222222" />
              </View>
              <View style={styles.stepTextCol}>
                <Text style={styles.stepTitle}>Official Paystack checkout window</Text>
                <Text style={styles.stepDesc}>
                  When you tap Confirm and pay, a secure Paystack browser sheet opens so you enter your card directly with Paystack — ZuruSasa never sees or stores your card digits.
                </Text>
              </View>
            </View>

            <View style={styles.groupDivider} />

            <View style={styles.stepRow}>
              <View style={styles.stepIconCircle}>
                <Feather name="shield" size={16} color="#222222" />
              </View>
              <View style={styles.stepTextCol}>
                <Text style={styles.stepTitle}>3D-Secure bank verification</Text>
                <Text style={styles.stepDesc}>
                  Complete Visa Secure or Mastercard Identity Check OTP verification with your issuing bank, then return automatically to ZuruSasa.
                </Text>
              </View>
            </View>

            <View style={styles.groupDivider} />

            <View style={styles.stepRow}>
              <View style={[styles.stepIconCircle, styles.escrowIconCircle]}>
                <MaterialCommunityIcons name="shield-check" size={18} color="#059669" />
              </View>
              <View style={styles.stepTextCol}>
                <Text style={styles.stepTitle}>ZuruSasa Escrow Protection</Text>
                <Text style={styles.stepDesc}>
                  Your payment is held safely in escrow and is only released to the host after check-in.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* ── STICKY BOTTOM ACTION BAR ── */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={onClose} style={styles.cancelBtn} hitSlop={12}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>

          <Pressable onPress={handleConfirmMethod} style={styles.nextBtn}>
            <Text style={styles.nextBtnText}>Use card checkout</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  headerLeftSpacer: {
    width: 32,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  headerCloseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 18,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#FAFAFA',
    padding: 16,
    gap: 14,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lockIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryHeaderTextCol: {
    flex: 1,
    gap: 2,
  },
  summaryTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  summarySub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  orderMetaCol: {
    gap: 8,
  },
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  orderMetaLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },
  orderMetaValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#111827',
  },
  orderMetaAmount: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  networksSection: {
    gap: 8,
  },
  networksLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#6B7280',
    letterSpacing: 0.6,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  visaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  visaBadgeText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#1A1F71',
    letterSpacing: 0.5,
  },
  mcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    gap: 5,
  },
  mcRedCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EB001B',
  },
  mcAmberCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F79E1B',
    marginLeft: -9,
  },
  mcBadgeText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  verveBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  verveBadgeText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#00425F',
  },
  threeDsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  threeDsBadgeText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#059669',
  },
  sectionHeading: {
    fontSize: 17,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    marginTop: 4,
  },
  stepsBox: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
  stepIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  escrowIconCircle: {
    backgroundColor: '#ECFDF5',
  },
  stepTextCol: {
    flex: 1,
    gap: 3,
  },
  stepTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'DMSans_400Regular',
    color: '#4B5563',
  },
  groupDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    paddingHorizontal: 20,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    textDecorationLine: 'underline',
  },
  nextBtn: {
    backgroundColor: '#222222',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
