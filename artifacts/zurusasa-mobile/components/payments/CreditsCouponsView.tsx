import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { paymentsStyles as styles } from './paymentsStyles';

export interface CreditsCouponsViewProps {
  onBack: () => void;
  topPad: number;
  bottomPad: number;
}

export function CreditsCouponsView({
  onBack,
  topPad,
  bottomPad,
}: CreditsCouponsViewProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { showAlert } = useCustomAlert();

  const [giftCardModal, setGiftCardModal] = useState(false);
  const [giftCardCode, setGiftCardCode] = useState('');
  const [couponModal, setCouponModal] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponsCount, setCouponsCount] = useState(0);

  const handleApplyGiftCard = () => {
    if (!giftCardCode.trim()) {
      showAlert({
        title: 'Invalid Code',
        message: 'Please enter a valid gift card code.',
        variant: 'warning',
      });
      return;
    }
    showAlert({
      title: 'Gift Card Claimed',
      message: `Gift card code ${giftCardCode.toUpperCase()} applied to your balance.`,
      variant: 'success',
    });
    setGiftCardCode('');
    setGiftCardModal(false);
  };

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) {
      showAlert({
        title: 'Invalid Code',
        message: 'Please enter a valid coupon code.',
        variant: 'warning',
      });
      return;
    }
    setCouponsCount((prev) => prev + 1);
    showAlert({
      title: 'Coupon Added',
      message: `Coupon ${couponCode.toUpperCase()} added to your wallet.`,
      variant: 'success',
    });
    setCouponCode('');
    setCouponModal(false);
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
        <Text style={[styles.pageTitle, { color: colors.text }]}>Credits and coupons</Text>

        {/* Section: Gift credit */}
        <View style={{ marginTop: 20 }}>
          <Text style={[styles.sectionHeader, { color: colors.text }]}>Gift credit</Text>
          <Pressable
            testID="add-gift-card-btn"
            onPress={() => setGiftCardModal(true)}
            style={[styles.blackActionBtn, { marginTop: 16 }]}
            accessibilityRole="button"
            accessibilityLabel="Add gift card"
          >
            <Text style={styles.blackActionBtnText}>Add gift card</Text>
          </Pressable>
        </View>

        <View style={[styles.dividerLine, { marginVertical: 32, backgroundColor: colors.border }]} />

        {/* Section: Coupons */}
        <View>
          <Text style={[styles.sectionHeader, { color: colors.text }]}>Coupons</Text>
          <View style={styles.couponCountRow}>
            <Text style={[styles.couponCountLabel, { color: colors.text }]}>Your coupons</Text>
            <Text style={[styles.couponCountValue, { color: colors.text }]}>{couponsCount}</Text>
          </View>

          <Pressable
            testID="add-coupon-btn"
            onPress={() => setCouponModal(true)}
            style={[styles.blackActionBtn, { marginTop: 16 }]}
            accessibilityRole="button"
            accessibilityLabel="Add coupon"
          >
            <Text style={styles.blackActionBtnText}>Add coupon</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Gift Card Modal */}
      <Modal
        visible={giftCardModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setGiftCardModal(false)}
      >
        <View
          style={[
            styles.currencyModalContainer,
            { backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 },
          ]}
        >
          <View style={[styles.currencyModalHeader, { borderBottomColor: colors.border }]}>
            <Pressable
              onPress={() => setGiftCardModal(false)}
              style={styles.circleBtn}
              accessibilityRole="button"
              accessibilityLabel="Close gift card modal"
            >
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
            <Text style={[styles.currencyHeaderTitle, { color: colors.text }]}>Add gift card</Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.modalBody}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Gift Card PIN / Code</Text>
            <TextInput
              value={giftCardCode}
              onChangeText={setGiftCardCode}
              placeholder="XXXX-XXXX-XXXX"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              style={[
                styles.sheetInput,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
              ]}
              accessibilityLabel="Enter gift card code"
            />
            <Pressable
              onPress={handleApplyGiftCard}
              style={styles.modalPrimaryBtn}
              accessibilityRole="button"
              accessibilityLabel="Apply gift card to balance"
            >
              <Text style={styles.modalPrimaryBtnText}>Apply to balance</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Coupon Modal */}
      <Modal
        visible={couponModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCouponModal(false)}
      >
        <View
          style={[
            styles.currencyModalContainer,
            { backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 },
          ]}
        >
          <View style={[styles.currencyModalHeader, { borderBottomColor: colors.border }]}>
            <Pressable
              onPress={() => setCouponModal(false)}
              style={styles.circleBtn}
              accessibilityRole="button"
              accessibilityLabel="Close coupon modal"
            >
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
            <Text style={[styles.currencyHeaderTitle, { color: colors.text }]}>Add coupon</Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.modalBody}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Coupon Code</Text>
            <TextInput
              value={couponCode}
              onChangeText={setCouponCode}
              placeholder="COASTAL20"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              style={[
                styles.sheetInput,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
              ]}
              accessibilityLabel="Enter coupon code"
            />
            <Pressable
              onPress={handleApplyCoupon}
              style={styles.modalPrimaryBtn}
              accessibilityRole="button"
              accessibilityLabel="Add coupon to account"
            >
              <Text style={styles.modalPrimaryBtnText}>Add to account</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
