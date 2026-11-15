import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { Skeleton } from '@/components/Skeleton';
import type { PaymentMethodItem } from './paymentTypes';
import { paymentsStyles as styles } from './paymentsStyles';

export interface PaymentMethodsViewProps {
  paymentMethods: PaymentMethodItem[];
  loading?: boolean;
  busy?: boolean;
  onAddMethod: (input: {
    type: 'mpesa' | 'card';
    phoneNumber?: string;
    setDefault: boolean;
  }) => Promise<void> | void;
  onSetDefaultMethod: (id: string) => Promise<void> | void;
  onRemoveMethod: (id: string) => Promise<void> | void;
  onBack: () => void;
  topPad: number;
  bottomPad: number;
}

export function PaymentMethodsView({
  paymentMethods,
  loading = false,
  busy = false,
  onAddMethod,
  onSetDefaultMethod,
  onRemoveMethod,
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
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleDoneSelectingMethod = () => {
    if (!chosenMethodType) return;
    setSetAsDefault(true);
    setPaymentMethodSelectionModal(false);
    setDetailsModalVisible(true);
  };

  const handleSavePaymentMethodDetails = async () => {
    if (!chosenMethodType || saving) return;

    if (chosenMethodType === 'mpesa') {
      const digits = mpesaNumber.replace(/[^0-9]/g, '');
      if (!digits || digits.length < 9) {
        showAlert({
          title: 'Invalid Number',
          message: 'Please enter a valid Safaricom phone number (e.g. 0712 345 678).',
          variant: 'warning',
        });
        return;
      }
      setSaving(true);
      try {
        await onAddMethod({
          type: 'mpesa',
          phoneNumber: mpesaNumber.trim(),
          setDefault: setAsDefault,
        });
        setDetailsModalVisible(false);
        setMpesaNumber('');
        setChosenMethodType(null);
        showAlert({
          title: 'Payment Method Saved',
          message: setAsDefault
            ? 'M-Pesa account saved and set as your default checkout method.'
            : 'M-Pesa account linked successfully.',
          variant: 'success',
        });
      } catch (err: any) {
        showAlert({
          title: 'Could Not Save Method',
          message: err?.message || 'Unable to save M-Pesa payment method.',
          variant: 'error',
        });
      } finally {
        setSaving(false);
      }
    } else {
      setSaving(true);
      try {
        await onAddMethod({
          type: 'card',
          setDefault: setAsDefault,
        });
        setDetailsModalVisible(false);
        setChosenMethodType(null);
        showAlert({
          title: 'Card Checkout Enabled',
          message: setAsDefault
            ? 'Visa / Mastercard checkout is saved as your default payment method. Card details are entered inside Paystack’s 3D-Secure checkout when you pay.'
            : 'Visa / Mastercard checkout has been added to your payment methods.',
          variant: 'success',
        });
      } catch (err: any) {
        showAlert({
          title: 'Could Not Save Method',
          message: err?.message || 'Unable to save card payment preference.',
          variant: 'error',
        });
      } finally {
        setSaving(false);
      }
    }
  };

  const confirmRemoveMethod = (method: PaymentMethodItem) => {
    showAlert({
      title: 'Remove Payment Method',
      message: `Remove ${method.title}${method.subtitle ? ` (${method.subtitle})` : ''} from your saved payment methods?`,
      icon: 'trash-2',
      variant: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            Promise.resolve(onRemoveMethod(method.id)).catch((err: any) => {
              showAlert({
                title: 'Remove Failed',
                message: err?.message || 'Could not remove payment method.',
                variant: 'error',
              });
            });
          },
        },
      ],
    });
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
          Add a default payment method so it is automatically applied every time you reserve or book.
        </Text>

        {loading ? (
          <View style={{ gap: 12, marginVertical: 14 }}>
            <Skeleton style={{ width: '100%', height: 68, borderRadius: 14 }} />
            <Skeleton style={{ width: '100%', height: 68, borderRadius: 14 }} />
          </View>
        ) : null}

        {/* List of Linked Methods */}
        {paymentMethods.map((method) => (
          <View
            key={method.id}
            style={[
              styles.linkedMethodRow,
              {
                backgroundColor: colors.card,
                borderColor: method.isDefault ? '#F26522' : colors.border,
              },
            ]}
          >
            <View style={[styles.methodIconBadge, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
              {method.type === 'mpesa' ? (
                <Text style={styles.mpesaBadgeText}>M</Text>
              ) : (
                <Feather name="credit-card" size={18} color={colors.text} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={[styles.methodRowTitle, { color: colors.text }]}>{method.title}</Text>
                {method.isDefault ? (
                  <View style={[styles.defaultPill, { backgroundColor: isDark ? '#431407' : '#FFF7ED' }]}>
                    <Text style={[styles.defaultPillText, { color: '#F26522' }]}>DEFAULT</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.methodRowSubtitle, { color: colors.mutedForeground }]}>{method.subtitle}</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 }}>
              {!method.isDefault ? (
                <Pressable
                  disabled={busy}
                  onPress={() =>
                    Promise.resolve(onSetDefaultMethod(method.id)).catch((err: any) => {
                      showAlert({
                        title: 'Update Failed',
                        message: err?.message || 'Could not update default payment method.',
                        variant: 'error',
                      });
                    })
                  }
                  hitSlop={8}
                  style={[
                    styles.defaultPill,
                    {
                      backgroundColor: isDark ? '#27272A' : '#F1F5F9',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                    },
                  ]}
                >
                  <Text style={[styles.defaultPillText, { color: colors.text, fontSize: 11 }]}>
                    Set default
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                disabled={busy}
                onPress={() => confirmRemoveMethod(method)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${method.title}`}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? '#27272A' : '#FEF2F2',
                }}
              >
                <Feather name="trash-2" size={16} color="#DC2626" />
              </Pressable>
            </View>
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

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 18,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.methodRowTitle, { color: colors.text }]}>
                  Set as default payment method
                </Text>
                <Text style={[styles.methodRowSubtitle, { color: colors.mutedForeground }]}>
                  Automatically use this when booking or reserving
                </Text>
              </View>
              <Switch
                value={setAsDefault}
                onValueChange={setSetAsDefault}
                trackColor={{ false: isDark ? '#3F3F46' : '#E5E7EB', true: '#F26522' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <Pressable
              onPress={handleSavePaymentMethodDetails}
              disabled={saving}
              style={[styles.modalPrimaryBtn, saving ? { opacity: 0.6 } : null]}
              accessibilityRole="button"
              accessibilityLabel={chosenMethodType === 'mpesa' ? 'Save payment method' : 'Enable secure card checkout'}
            >
              <Text style={styles.modalPrimaryBtnText}>
                {saving
                  ? 'Saving...'
                  : chosenMethodType === 'mpesa'
                  ? 'Save payment method'
                  : 'Enable secure card checkout'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
