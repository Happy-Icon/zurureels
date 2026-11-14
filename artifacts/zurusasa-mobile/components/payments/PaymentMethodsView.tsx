import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import type { PaymentMethodItem } from './paymentTypes';
import { paymentsStyles as styles } from './paymentsStyles';

export interface PaymentMethodsViewProps {
  paymentMethods: PaymentMethodItem[];
  onAddMethod: (method: PaymentMethodItem) => void;
  onBack: () => void;
  topPad: number;
  bottomPad: number;
}

export function PaymentMethodsView({
  paymentMethods,
  onAddMethod,
  onBack,
  topPad,
  bottomPad,
}: PaymentMethodsViewProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { showAlert } = useCustomAlert();

  const [paymentMethodSelectionModal, setPaymentMethodSelectionModal] = useState(false);
  const [chosenMethodType, setChosenMethodType] = useState<'card' | 'mpesa' | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [mpesaNumber, setMpesaNumber] = useState('');

  const handleDoneSelectingMethod = () => {
    if (!chosenMethodType) return;
    setPaymentMethodSelectionModal(false);
    setDetailsModalVisible(true);
  };

  const handleSavePaymentMethodDetails = () => {
    if (chosenMethodType === 'mpesa') {
      if (!mpesaNumber || mpesaNumber.length < 9) {
        showAlert({
          title: 'Invalid Number',
          message: 'Please enter a valid Safaricom phone number.',
          variant: 'warning',
        });
        return;
      }
      const newMethod: PaymentMethodItem = {
        id: `mpesa_${Date.now()}`,
        type: 'mpesa',
        title: 'M-Pesa',
        subtitle: mpesaNumber.startsWith('+') ? mpesaNumber : `+254 ${mpesaNumber}`,
      };
      onAddMethod(newMethod);
      setDetailsModalVisible(false);
      setMpesaNumber('');
      setChosenMethodType(null);
      showAlert({
        title: 'Payment Method Added',
        message: 'M-Pesa account linked successfully.',
        variant: 'success',
      });
    } else {
      const alreadyLinked = paymentMethods.some((m) => m.type === 'card');
      if (!alreadyLinked) {
        const newMethod: PaymentMethodItem = {
          id: `card_${Date.now()}`,
          type: 'card',
          title: 'Visa / Mastercard',
          subtitle: 'Paystack Secure 3D-Secure Checkout',
        };
        onAddMethod(newMethod);
      }
      setDetailsModalVisible(false);
      setChosenMethodType(null);
      showAlert({
        title: 'Card Checkout Enabled',
        message: 'For your security, card details are entered directly in Paystack’s encrypted 3D-Secure checkout window when you confirm a reservation.',
        variant: 'success',
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerRow, { paddingTop: topPad }]}>
        <Pressable
          onPress={onBack}
          style={styles.circleBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back to payments hub"
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      >
        <Text style={[styles.pageTitle, { color: colors.text }]}>Payment methods</Text>
        <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
          Add a payment method using our secure payment system, then start planning your next trip.
        </Text>

        {/* List of Linked Methods if any */}
        {paymentMethods.map((method) => (
          <View key={method.id} style={[styles.linkedMethodRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.methodIconBadge, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
              {method.type === 'mpesa' ? (
                <Text style={styles.mpesaBadgeText}>M</Text>
              ) : (
                <Feather name="credit-card" size={18} color={colors.text} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.methodRowTitle, { color: colors.text }]}>{method.title}</Text>
              <Text style={[styles.methodRowSubtitle, { color: colors.mutedForeground }]}>{method.subtitle}</Text>
            </View>
            {method.isDefault && (
              <View style={[styles.defaultPill, { backgroundColor: isDark ? '#27272A' : '#F1F5F9' }]}>
                <Text style={[styles.defaultPillText, { color: isDark ? '#CBD5E1' : '#475569' }]}>DEFAULT</Text>
              </View>
            )}
          </View>
        ))}

        {/* Add payment method button */}
        <Pressable
          testID="add-payment-method-btn"
          onPress={() => setPaymentMethodSelectionModal(true)}
          style={styles.blackActionBtn}
          accessibilityRole="button"
          accessibilityLabel="Add payment method"
        >
          <Text style={styles.blackActionBtnText}>Add payment method</Text>
        </Pressable>

        {/* Make all payments through ZuruSasa Protection Card */}
        <View style={[styles.protectionCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={[styles.protectionIconWrapper, { backgroundColor: isDark ? '#4C0519' : '#FFE4E6' }]}>
            <MaterialCommunityIcons name="credit-card-chip-outline" size={24} color="#E11D48" />
          </View>
          <Text style={[styles.protectionCardTitle, { color: colors.text }]}>Make all payments through ZuruSasa</Text>
          <Text style={[styles.protectionCardBody, { color: colors.mutedForeground }]}>
            Always pay and communicate through ZuruSasa to ensure you're protected under our Terms of Service, Payments Terms of Service, cancellation and other safeguards.
          </Text>
          <Pressable
            onPress={() =>
              showAlert({
                title: 'Payment Protection',
                message: 'ZuruSasa guarantees secure coastal transactions. Paying off-platform voids reservation dispute rights and insurance coverage.',
                variant: 'info',
                icon: 'shield',
              })
            }
            style={{ marginTop: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Learn more about payment protection"
          >
            <Text style={[styles.learnMoreBold, { color: colors.text }]}>Learn more</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── PAYMENT METHOD SELECTION BOTTOM SHEET ──────────── */}
      <Modal
        visible={paymentMethodSelectionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setPaymentMethodSelectionModal(false)}
      >
        <View style={[styles.bottomSheetOverlay, { backgroundColor: colors.overlay }]}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setPaymentMethodSelectionModal(false)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss payment method modal"
          />

          <View style={[styles.bottomSheetContainer, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
            {/* Header */}
            <View style={styles.bottomSheetHeader}>
              <Text style={[styles.bottomSheetTitle, { color: colors.text }]}>Payment method</Text>
              <Pressable
                onPress={() => setPaymentMethodSelectionModal(false)}
                style={styles.sheetCloseBtn}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Feather name="x" size={22} color={colors.text} />
              </Pressable>
            </View>

            {/* Option 1: Credit or debit card */}
            <Pressable
              onPress={() => setChosenMethodType('card')}
              style={[
                styles.methodCardOption,
                { borderColor: colors.border, backgroundColor: isDark ? '#27272A' : '#FAFAFA' },
                chosenMethodType === 'card' && [styles.methodCardOptionSelected, { borderColor: '#F26522' }],
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosenMethodType === 'card' }}
              accessibilityLabel="Credit or debit card"
            >
              <View style={styles.methodCardLeft}>
                <View style={{ marginRight: 14 }}>
                  <Feather name="credit-card" size={24} color={colors.text} />
                </View>
                <View>
                  <Text style={[styles.methodCardName, { color: colors.text }]}>Credit or debit card</Text>
                  <View style={styles.cardBadgesRow}>
                    <Text style={styles.visaBadge}>VISA</Text>
                    <View style={styles.mastercardCircleWrapper}>
                      <View style={[styles.mcCircle, { backgroundColor: '#EB001B' }]} />
                      <View style={[styles.mcCircle, { backgroundColor: '#F79E1B', marginLeft: -4 }]} />
                    </View>
                  </View>
                </View>
              </View>

              {/* Radio indicator */}
              <View
                style={[
                  styles.radioCircle,
                  { borderColor: colors.border },
                  chosenMethodType === 'card' && [styles.radioCircleActive, { borderColor: '#F26522' }],
                ]}
              >
                {chosenMethodType === 'card' && <View style={[styles.radioInnerDot, { backgroundColor: '#F26522' }]} />}
              </View>
            </Pressable>

            {/* Option 2: Safaricom M-Pesa */}
            <Pressable
              onPress={() => setChosenMethodType('mpesa')}
              style={[
                styles.methodCardOption,
                { borderColor: colors.border, backgroundColor: isDark ? '#27272A' : '#FAFAFA', marginTop: 12 },
                chosenMethodType === 'mpesa' && [styles.methodCardOptionSelected, { borderColor: '#F26522' }],
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosenMethodType === 'mpesa' }}
              accessibilityLabel="Safaricom M-Pesa"
            >
              <View style={styles.methodCardLeft}>
                <View style={styles.mpesaSmallBadge}>
                  <Text style={styles.mpesaSmallBadgeText}>M</Text>
                </View>
                <View>
                  <Text style={[styles.methodCardName, { color: colors.text }]}>Safaricom M-Pesa</Text>
                  <Text style={[styles.mpesaCardSubtitle, { color: colors.mutedForeground }]}>Instant STK Push for Kenya</Text>
                </View>
              </View>

              {/* Radio indicator */}
              <View
                style={[
                  styles.radioCircle,
                  { borderColor: colors.border },
                  chosenMethodType === 'mpesa' && [styles.radioCircleActive, { borderColor: '#F26522' }],
                ]}
              >
                {chosenMethodType === 'mpesa' && <View style={[styles.radioInnerDot, { backgroundColor: '#F26522' }]} />}
              </View>
            </Pressable>

            {/* Footer: Cancel & Done */}
            <View style={styles.sheetFooterRow}>
              <Pressable
                onPress={() => setPaymentMethodSelectionModal(false)}
                style={styles.sheetCancelBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Cancel selection"
              >
                <Text style={[styles.sheetCancelText, { color: colors.text }]}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleDoneSelectingMethod}
                disabled={!chosenMethodType}
                style={[
                  styles.sheetDoneBtn,
                  !chosenMethodType ? styles.sheetDoneBtnDisabled : styles.sheetDoneBtnActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Confirm selection"
              >
                <Text
                  style={[
                    styles.sheetDoneText,
                    !chosenMethodType ? styles.sheetDoneTextDisabled : styles.sheetDoneTextActive,
                  ]}
                >
                  Done
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── CARD / MPESA DETAILS INPUT MODAL ──────────────────────────────── */}
      <Modal
        visible={detailsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={[styles.currencyModalContainer, { backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          <View style={[styles.currencyModalHeader, { borderBottomColor: colors.border }]}>
            <Pressable
              onPress={() => setDetailsModalVisible(false)}
              style={styles.circleBtn}
              accessibilityRole="button"
              accessibilityLabel="Close details modal"
            >
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
            <Text style={[styles.currencyHeaderTitle, { color: colors.text }]}>
              {chosenMethodType === 'mpesa' ? 'Enter M-Pesa Number' : 'Secure Card Checkout'}
            </Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalBody}>
            {chosenMethodType === 'mpesa' ? (
              <View>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Safaricom Phone Number</Text>
                <TextInput
                  value={mpesaNumber}
                  onChangeText={setMpesaNumber}
                  placeholder="0712 345 678"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                  style={[styles.sheetInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  accessibilityLabel="Enter M-Pesa phone number"
                />
                <Text style={[styles.inputHint, { color: colors.mutedForeground }]}>
                  An M-Pesa STK PIN prompt will be sent directly to your phone whenever you confirm a reservation.
                </Text>
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 16,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Feather name="lock" size={18} color="#10B981" />
                  <Text style={[styles.inputLabel, { color: colors.text, marginBottom: 0 }]}>
                    Paystack PCI-DSS Level 1 Checkout
                  </Text>
                </View>
                <Text style={[styles.inputHint, { color: colors.mutedForeground, marginTop: 0 }]}>
                  ZuruSasa never collects or stores your card number or security code on-device. When you pay by Visa, Mastercard, or Verve, a secure 3D-Secure Paystack browser window opens automatically at checkout.
                </Text>
              </View>
            )}

            <Pressable
              onPress={handleSavePaymentMethodDetails}
              style={styles.modalPrimaryBtn}
              accessibilityRole="button"
              accessibilityLabel={chosenMethodType === 'mpesa' ? 'Save payment method' : 'Enable secure card checkout'}
            >
              <Text style={styles.modalPrimaryBtnText}>
                {chosenMethodType === 'mpesa' ? 'Save payment method' : 'Enable secure card checkout'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
