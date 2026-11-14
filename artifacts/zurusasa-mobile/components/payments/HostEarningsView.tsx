import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { paymentsStyles as styles } from './paymentsStyles';

export interface HostEarningsViewProps {
  onBack: () => void;
  topPad: number;
  bottomPad: number;
}

export function HostEarningsView({
  onBack,
  topPad,
  bottomPad,
}: HostEarningsViewProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { showAlert } = useCustomAlert();

  const [payoutModal, setPayoutModal] = useState(false);
  const [payoutPhone, setPayoutPhone] = useState('');
  const [payoutBankName, setPayoutBankName] = useState('');
  const [payoutAccountNumber, setPayoutAccountNumber] = useState('');
  const [payoutType, setPayoutType] = useState<'mpesa' | 'bank'>('mpesa');
  const [payoutsConfigured, setPayoutsConfigured] = useState(false);

  const handleSavePayoutSetup = () => {
    if (payoutType === 'mpesa') {
      if (!payoutPhone) {
        showAlert({
          title: 'Missing Phone',
          message: 'Please enter your M-Pesa phone number.',
          variant: 'warning',
        });
        return;
      }
    } else {
      if (!payoutAccountNumber || !payoutBankName) {
        showAlert({
          title: 'Missing Bank Details',
          message: 'Please fill in bank name and account number.',
          variant: 'warning',
        });
        return;
      }
    }
    setPayoutsConfigured(true);
    setPayoutModal(false);
    showAlert({
      title: 'Payout Method Saved',
      message: 'Your host earnings will be dispatched automatically.',
      variant: 'success',
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
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

        <Pressable
          onPress={() => setPayoutModal(true)}
          style={styles.circleBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Payout settings"
        >
          <Feather name="settings" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      >
        <Text style={[styles.pageTitle, { color: colors.text }]}>Earnings</Text>

        {/* Warning Banner: Payouts are paused */}
        {!payoutsConfigured && (
          <View style={[styles.warningBanner, { backgroundColor: isDark ? '#3D1515' : '#F8F8F8' }]}>
            <View style={styles.warningHeaderRow}>
              <Ionicons name="alert-circle" size={22} color="#DC2626" style={{ marginRight: 8 }} />
              <Text style={[styles.warningTitle, { color: colors.text }]}>Your payouts are paused</Text>
            </View>
            <Text style={[styles.warningSubtitle, { color: colors.mutedForeground }]}>
              Add a payout method so we can send you the money you're owed.
            </Text>

            <Pressable
              testID="setup-payouts-btn"
              onPress={() => setPayoutModal(true)}
              style={[styles.setupPayoutsPillBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Set up payouts"
            >
              <Text style={[styles.setupPayoutsBtnText, { color: colors.text }]}>Set up payouts</Text>
            </Pressable>
          </View>
        )}

        {/* Performance Card */}
        <View style={[styles.performanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.performanceHeader, { color: colors.text }]}>Performance</Text>
          <Text style={[styles.performanceAmount, { color: colors.text }]}>$0.00</Text>
          <Text style={[styles.performanceSub, { color: colors.mutedForeground }]}>Total for this month (USD)</Text>

          {/* Bar placeholder */}
          <View style={styles.barGraphRow}>
            <View style={[styles.barPillar, { backgroundColor: isDark ? '#27272A' : '#F3F4F6', height: 70 }]} />
            <View style={[styles.barPillar, { backgroundColor: isDark ? '#27272A' : '#F3F4F6', height: 50 }]} />
          </View>

          <Text style={[styles.performanceFooterText, { color: colors.mutedForeground }]}>
            Your overview will show up here once you get your first booking.
          </Text>
        </View>

        {/* Section: Upcoming */}
        <Text style={[styles.sectionHeader, { marginTop: 32, color: colors.text }]}>Upcoming</Text>
        <View style={[styles.illustrationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.illustrationBadge}>
            <Text style={{ fontSize: 32 }}>📅</Text>
          </View>
          <Text style={[styles.illustrationTitle, { color: colors.text }]}>No scheduled payouts</Text>
          <Text style={[styles.illustrationSub, { color: colors.mutedForeground }]}>
            Upcoming payouts will be shown here after your first booking.
          </Text>
        </View>

        {/* Section: Paid */}
        <Text style={[styles.sectionHeader, { marginTop: 32, color: colors.text }]}>Paid</Text>
        <View style={[styles.illustrationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.illustrationBadge}>
            <Text style={{ fontSize: 32 }}>🪙</Text>
          </View>
          <Text style={[styles.illustrationTitle, { color: colors.text }]}>No sent payouts</Text>
          <Pressable
            onPress={() =>
              showAlert({
                title: 'How Payouts Work',
                message: 'ZuruSasa automatically releases host earnings to your M-Pesa or Bank account 24 hours after guest check-in.',
                variant: 'info',
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Learn how payouts work"
          >
            <Text style={[styles.underlineLinkBold, { color: colors.text }]}>Learn how payouts work</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Set Up Payouts Modal */}
      <Modal
        visible={payoutModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPayoutModal(false)}
      >
        <View
          style={[
            styles.currencyModalContainer,
            { backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 },
          ]}
        >
          <View style={[styles.currencyModalHeader, { borderBottomColor: colors.border }]}>
            <Pressable
              onPress={() => setPayoutModal(false)}
              style={styles.circleBtn}
              accessibilityRole="button"
              accessibilityLabel="Close payout setup modal"
            >
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
            <Text style={[styles.currencyHeaderTitle, { color: colors.text }]}>Set up payout method</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalBody}>
            <View style={[styles.methodTypeSwitcher, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
              <Pressable
                onPress={() => setPayoutType('mpesa')}
                style={[
                  styles.typeBtn,
                  payoutType === 'mpesa' && [styles.typeBtnActive, { backgroundColor: colors.card }],
                ]}
                accessibilityRole="button"
                accessibilityLabel="Switch to M-Pesa Payout"
              >
                <Text
                  style={[
                    styles.typeBtnText,
                    { color: colors.mutedForeground },
                    payoutType === 'mpesa' && [styles.typeBtnTextActive, { color: colors.text }],
                  ]}
                >
                  M-Pesa Payout
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPayoutType('bank')}
                style={[
                  styles.typeBtn,
                  payoutType === 'bank' && [styles.typeBtnActive, { backgroundColor: colors.card }],
                ]}
                accessibilityRole="button"
                accessibilityLabel="Switch to Bank Account EFT"
              >
                <Text
                  style={[
                    styles.typeBtnText,
                    { color: colors.mutedForeground },
                    payoutType === 'bank' && [styles.typeBtnTextActive, { color: colors.text }],
                  ]}
                >
                  Bank Account (EFT)
                </Text>
              </Pressable>
            </View>

            {payoutType === 'mpesa' ? (
              <View>
                <Text style={[styles.inputLabel, { color: colors.text }]}>M-Pesa Phone Number</Text>
                <TextInput
                  value={payoutPhone}
                  onChangeText={setPayoutPhone}
                  placeholder="0712 345 678"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                  style={[
                    styles.sheetInput,
                    { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                  ]}
                  accessibilityLabel="Enter M-Pesa phone number for payouts"
                />
              </View>
            ) : (
              <View>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Bank Name</Text>
                <TextInput
                  value={payoutBankName}
                  onChangeText={setPayoutBankName}
                  placeholder="e.g. KCB, Equity Bank, NCBA"
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.sheetInput,
                    { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                  ]}
                  accessibilityLabel="Enter Bank name"
                />
                <Text style={[styles.inputLabel, { color: colors.text }]}>Account Number</Text>
                <TextInput
                  value={payoutAccountNumber}
                  onChangeText={setPayoutAccountNumber}
                  placeholder="1234567890"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                  style={[
                    styles.sheetInput,
                    { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                  ]}
                  accessibilityLabel="Enter Bank account number"
                />
              </View>
            )}

            <Pressable
              onPress={handleSavePayoutSetup}
              style={styles.modalPrimaryBtn}
              accessibilityRole="button"
              accessibilityLabel="Save payout method"
            >
              <Text style={styles.modalPrimaryBtnText}>Save payout method</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
