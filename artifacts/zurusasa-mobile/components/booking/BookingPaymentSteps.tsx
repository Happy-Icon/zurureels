import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import type { BookingCheckoutState } from '@/hooks/useBookingCheckout';
import { fmtRange } from './bookingHelpers';
import { bookingStyles as styles } from './bookingStyles';

interface BookingPaymentStepProps {
  checkout: BookingCheckoutState;
}

export function BookingPaymentMethodStep({ checkout }: BookingPaymentStepProps) {
  const {
    paymentMethod,
    setPaymentMethod,
    mpesaPhone,
    setMpesaPhone,
    setCardModalVisible,
    cardMethodConfirmed,
  } = checkout;

  return (
    <View style={{ gap: 24, paddingTop: 8 }}>
      {/* Page Title: "Add a payment method" */}
      <Text style={styles.paymentMethodPageTitle}>Add a payment method</Text>

      {/* Grouped Payment Box */}
      <View style={styles.paymentMethodsGroupedBox}>
        {/* Option 1: M-PESA */}
        <Pressable
          onPress={() => setPaymentMethod('mpesa')}
          style={[
            styles.paymentMethodItem,
            paymentMethod === 'mpesa' && styles.paymentMethodItemActive,
          ]}
        >
          <View style={styles.paymentMethodLeft}>
            <Image
              source={require('@/assets/images/mpesa_logo.png')}
              style={styles.mpesaLogoSquare}
              contentFit="contain"
            />
            <Text style={styles.paymentMethodItemText}>M-PESA</Text>
          </View>
          <View style={[styles.airbnbRadioOuter, paymentMethod === 'mpesa' && styles.airbnbRadioOuterSelected]}>
            {paymentMethod === 'mpesa' ? <View style={styles.airbnbRadioInner} /> : null}
          </View>
        </Pressable>

        {/* Inline M-Pesa Phone Input if M-Pesa is selected */}
        {paymentMethod === 'mpesa' ? (
          <View style={styles.mpesaPhoneFieldWrapper}>
            <Text style={styles.mpesaPhoneFieldLabel}>M-PESA PHONE NUMBER</Text>
            <TextInput
              value={mpesaPhone}
              onChangeText={setMpesaPhone}
              placeholder="e.g. 0712 345 678"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              style={styles.mpesaPhoneFieldInput}
            />
            <Text style={styles.mpesaPhoneFieldHint}>
              An STK PIN prompt will be sent to this number.
            </Text>
          </View>
        ) : null}

        <View style={styles.paymentMethodDivider} />

        {/* Option 2: Credit or debit card */}
        <Pressable
          onPress={() => {
            setPaymentMethod('card');
            setCardModalVisible(true);
          }}
          style={[
            styles.paymentMethodItem,
            paymentMethod === 'card' && styles.paymentMethodItemActive,
          ]}
        >
          <View style={styles.paymentMethodLeft}>
            <Feather name="credit-card" size={24} color="#111111" style={{ marginRight: 6 }} />
            <View style={{ gap: 4 }}>
              <Text style={styles.paymentMethodItemText}>Credit or debit card</Text>
              {/* Visa & Mastercard Logos */}
              <View style={styles.cardBrandsRow}>
                <Text style={styles.visaTextBadge}>VISA</Text>
                <View style={styles.mastercardCircles}>
                  <View style={styles.mcRedCircle} />
                  <View style={styles.mcAmberCircle} />
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.airbnbRadioOuter, paymentMethod === 'card' && styles.airbnbRadioOuterSelected]}>
            {paymentMethod === 'card' ? <View style={styles.airbnbRadioInner} /> : null}
          </View>
        </Pressable>

        {/* Hosted Card Checkout Status Pill */}
        {paymentMethod === 'card' ? (
          <Pressable
            onPress={() => setCardModalVisible(true)}
            style={styles.savedCardRowPill}
          >
            <View style={styles.savedCardRowLeft}>
              <Feather name="lock" size={15} color="#059669" />
              <Text style={styles.savedCardRowText}>
                {cardMethodConfirmed
                  ? 'Visa / Mastercard (Secure Paystack Checkout)'
                  : 'Pay securely via Paystack 3D-Secure Checkout'}
              </Text>
            </View>
            <Text style={styles.savedCardEditBtn}>Details</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function BookingConfirmPayStep({ checkout }: BookingPaymentStepProps) {
  const {
    thumbnail,
    title,
    reviewCount,
    ratingVal,
    from,
    to,
    guestSummary,
    paymentMethod,
    mpesaPhone,
    units,
    priceUnit,
    price,
    totalAmount,
    setStep,
  } = checkout;

  return (
    <View style={{ gap: 16 }}>
      {/* CARD 1: TRIP SUMMARY */}
      <View style={styles.mainCard}>
        <View style={styles.listingSnippetRow}>
          <Image source={{ uri: thumbnail }} style={styles.listingThumb} contentFit="cover" />
          <View style={styles.listingSnippetMeta}>
            <Text style={styles.snippetTitle} numberOfLines={2}>
              {title}
            </Text>
            <View style={styles.snippetRatingRow}>
              {reviewCount > 0 ? (
                <>
                  <MaterialCommunityIcons name="star" size={13} color="#111111" />
                  <Text style={styles.snippetRatingText}>
                    {ratingVal.toFixed(1)} ({reviewCount})
                  </Text>
                </>
              ) : (
                <Text style={styles.snippetRatingText}>★ New listing</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardSectionRow}>
          <View style={styles.cardSectionLeft}>
            <Text style={styles.sectionLabel}>Dates</Text>
            <Text style={styles.sectionVal}>{from ? fmtRange(from, to) : 'Select dates'}</Text>
          </View>
          <Pressable onPress={() => setStep('dates')} style={styles.changeBtn}>
            <Text style={styles.changeBtnText}>Change</Text>
          </Pressable>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardSectionRow}>
          <View style={styles.cardSectionLeft}>
            <Text style={styles.sectionLabel}>Guests</Text>
            <Text style={styles.sectionVal}>{guestSummary}</Text>
          </View>
          <Pressable onPress={() => setStep('dates')} style={styles.changeBtn}>
            <Text style={styles.changeBtnText}>Change</Text>
          </Pressable>
        </View>
      </View>

      {/* CARD 2: PAYMENT METHOD SELECTED */}
      <View style={styles.cardContainer}>
        <View style={styles.cardSectionRow}>
          <View style={styles.cardSectionLeft}>
            <Text style={styles.sectionLabel}>Payment method</Text>
            <Text style={styles.sectionVal}>
              {paymentMethod === 'mpesa'
                ? `Safaricom M-Pesa (${mpesaPhone || 'Phone'})`
                : 'Visa / Mastercard (Secure Paystack Checkout)'}
            </Text>
          </View>
          <Pressable onPress={() => setStep('payment_method')} style={styles.changeBtn}>
            <Text style={styles.changeBtnText}>Change</Text>
          </Pressable>
        </View>
      </View>

      {/* CARD 3: PRICE DETAILS */}
      <View style={styles.cardContainer}>
        <Text style={styles.cardHeaderTitle}>Price details</Text>
        <View style={styles.cardItemRow}>
          <Text style={styles.cardItemLabel}>
            {units} {priceUnit}{units !== 1 ? 's' : ''} x KSh {price.toLocaleString()}.00
          </Text>
          <Text style={styles.cardItemVal}>KSh {totalAmount.toLocaleString()}.00</Text>
        </View>
        <View style={styles.cardItemRow}>
          <Text style={styles.cardItemLabel}>Service fee</Text>
          <Text style={styles.cardItemVal}>KSh 0.00</Text>
        </View>
        <View style={styles.cardDivider} />
        <View style={styles.cardTotalRow}>
          <Text style={styles.cardTotalLabel}>Total KES</Text>
          <Text style={styles.cardTotalVal}>KSh {totalAmount.toLocaleString()}.00</Text>
        </View>

        <View style={styles.escrowTrustBanner}>
          <MaterialCommunityIcons name="shield-check" size={18} color="#10B981" />
          <Text style={styles.escrowTrustText}>
            Protected by ZuruSasa Secure Escrow. Payment is released to the host only after check-in.
          </Text>
        </View>
      </View>
    </View>
  );
}
