import React from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import type { BookingCheckoutState } from '@/hooks/useBookingCheckout';
import { formatEventScheduleBadge } from '@/constants/taxonomy';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { BRAND_ORANGE, fmtRange, fmtShort } from './bookingHelpers';
import { bookingStyles as styles } from './bookingStyles';

interface BookingPaymentStepProps {
  checkout: BookingCheckoutState;
}

export function BookingPaymentMethodStep({ checkout }: BookingPaymentStepProps) {
  const { showAlert } = useCustomAlert();
  const {
    paymentMethod,
    setPaymentMethod,
    mpesaPhone,
    setMpesaPhone,
    setCardModalVisible,
    cardMethodConfirmed,
    savedPaymentMethods,
    saveAsDefault,
    setSaveAsDefault,
    savingPaymentMethod,
    selectSavedPaymentMethod,
    removeSavedPaymentMethod,
    hasConfiguredDefaultMethod,
  } = checkout;

  const confirmRemoveSaved = (id: string, label: string, sub?: string | null) => {
    showAlert({
      title: 'Remove Payment Method',
      message: `Remove ${label}${sub ? ` (${sub})` : ''} from your saved methods?`,
      icon: 'trash-2',
      variant: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeSavedPaymentMethod(id).catch((err: any) => {
              showAlert({
                title: 'Remove Failed',
                message: err?.message || 'Could not remove saved payment method.',
                variant: 'error',
              });
            });
          },
        },
      ],
    });
  };

  return (
    <View style={{ gap: 20, paddingTop: 8 }}>
      <View style={{ gap: 4 }}>
        <Text style={styles.paymentMethodPageTitle}>
          {hasConfiguredDefaultMethod ? 'Choose or update payment method' : 'Add a payment method'}
        </Text>
        <Text style={{ fontSize: 13, fontFamily: 'DMSans_400Regular', color: '#6B7280', lineHeight: 18 }}>
          Your default payment method is remembered for future reservations and bookings.
        </Text>
      </View>

      {/* Saved Guest Payment Methods (if any) */}
      {savedPaymentMethods.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Text
            style={{
              fontSize: 11.5,
              fontFamily: 'DMSans_700Bold',
              color: '#6B7280',
              letterSpacing: 0.7,
            }}
          >
            SAVED METHODS
          </Text>
          {savedPaymentMethods.map((m) => {
            const isSelected =
              paymentMethod === m.method_type &&
              (m.method_type === 'card' ||
                mpesaPhone.replace(/[^0-9]/g, '') === (m.phone_number || '').replace(/[^0-9]/g, ''));
            return (
              <View
                key={m.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: isSelected ? 1.5 : 1,
                  borderColor: isSelected ? BRAND_ORANGE : '#E5E7EB',
                  backgroundColor: isSelected ? '#FFF7ED' : '#FFFFFF',
                  gap: 10,
                }}
              >
                <Pressable
                  disabled={savingPaymentMethod}
                  onPress={() => selectSavedPaymentMethod(m)}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                  <Feather
                    name={m.method_type === 'card' ? 'credit-card' : 'smartphone'}
                    size={20}
                    color={isSelected ? BRAND_ORANGE : '#111111'}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 14, fontFamily: 'DMSans_700Bold', color: '#111111' }}>
                        {m.label}
                      </Text>
                      {m.is_default ? (
                        <View
                          style={{
                            backgroundColor: '#FFEDD5',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ fontSize: 10, fontFamily: 'DMSans_700Bold', color: '#C2410C' }}>
                            DEFAULT
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 12.5, fontFamily: 'DMSans_400Regular', color: '#6B7280' }}>
                      {m.method_type === 'mpesa'
                        ? m.phone_number || 'Safaricom M-Pesa'
                        : 'Paystack 3D-Secure Checkout'}
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  disabled={savingPaymentMethod}
                  onPress={() => confirmRemoveSaved(m.id, m.label, m.phone_number)}
                  hitSlop={10}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: '#FEF2F2',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Feather name="trash-2" size={14} color="#DC2626" />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

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

      {/* Save as Default Toggle */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#E5E7EB',
          backgroundColor: '#FAFAFA',
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 13.5, fontFamily: 'DMSans_700Bold', color: '#111111' }}>
            Save as default payment method
          </Text>
          <Text style={{ fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#6B7280' }}>
            Use automatically on future bookings without re-entering
          </Text>
        </View>
        <Switch
          value={saveAsDefault || !hasConfiguredDefaultMethod}
          disabled={!hasConfiguredDefaultMethod}
          onValueChange={setSaveAsDefault}
          trackColor={{ false: '#D1D5DB', true: BRAND_ORANGE }}
          thumbColor="#FFFFFF"
        />
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
    flowConfig,
    eventDetails,
    selectedTimeSlot,
    selectedTier,
    from,
    to,
    guestSummary,
    paymentMethod,
    mpesaPhone,
    isUsingDefaultMethod,
    openPaymentMethodStep,
    units,
    priceUnit,
    price,
    totalAmount,
    isFreeBooking,
    setStep,
  } = checkout;

  const editStep =
    flowConfig.kind === 'event'
      ? 'event_tickets'
      : flowConfig.kind === 'offer'
      ? 'offer_claim'
      : 'dates';

  const scheduleText =
    flowConfig.kind === 'event'
      ? formatEventScheduleBadge(
          (eventDetails?.event_date as string | undefined) || from?.toISOString(),
          eventDetails?.start_time as string | undefined,
        )
      : flowConfig.isRangePicker
      ? from
        ? fmtRange(from, to)
        : 'Select dates'
      : `${from ? fmtShort(from) : 'Select date'}${selectedTimeSlot ? ` · ${selectedTimeSlot}` : ''}`;

  return (
    <View style={{ gap: 16 }}>
      {/* CARD 1: BOOKING SUMMARY */}
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
            <Text style={styles.sectionLabel}>{flowConfig.scheduleSectionLabel}</Text>
            <Text style={styles.sectionVal}>{scheduleText}</Text>
          </View>
          {flowConfig.kind !== 'event' ? (
            <Pressable onPress={() => setStep(editStep)} style={styles.changeBtn}>
              <Text style={styles.changeBtnText}>Change</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardSectionRow}>
          <View style={styles.cardSectionLeft}>
            <Text style={styles.sectionLabel}>{flowConfig.participantSectionLabel}</Text>
            <Text style={styles.sectionVal}>{guestSummary}</Text>
          </View>
          <Pressable onPress={() => setStep(editStep)} style={styles.changeBtn}>
            <Text style={styles.changeBtnText}>Change</Text>
          </Pressable>
        </View>
      </View>

      {/* CARD 2: PAYMENT METHOD SELECTED */}
      {!isFreeBooking ? (
        <View style={styles.cardContainer}>
          <View style={styles.cardSectionRow}>
            <View style={styles.cardSectionLeft}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sectionLabel}>Payment method</Text>
                {isUsingDefaultMethod ? (
                  <View
                    style={{
                      backgroundColor: '#FFEDD5',
                      paddingHorizontal: 6,
                      paddingVertical: 1.5,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ fontSize: 10, fontFamily: 'DMSans_700Bold', color: '#C2410C' }}>
                      DEFAULT
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.sectionVal}>
                {paymentMethod === 'mpesa'
                  ? `Safaricom M-Pesa (${mpesaPhone || 'Phone'})`
                  : 'Visa / Mastercard (Secure Paystack Checkout)'}
              </Text>
            </View>
            <Pressable onPress={openPaymentMethodStep} style={styles.changeBtn}>
              <Text style={styles.changeBtnText}>Change</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* CARD 3: PRICE DETAILS */}
      <View style={styles.cardContainer}>
        <Text style={styles.cardHeaderTitle}>Price details</Text>
        <View style={styles.cardItemRow}>
          <Text style={styles.cardItemLabel}>
            {isFreeBooking
              ? 'Complimentary reservation'
              : selectedTier && flowConfig.kind === 'event'
              ? `${units} x ${selectedTier.label}`
              : `${units} ${priceUnit}${units !== 1 ? 's' : ''} x KSh ${price.toLocaleString()}.00`}
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
          <Text style={styles.cardTotalVal}>
            {isFreeBooking ? 'FREE' : `KSh ${totalAmount.toLocaleString()}.00`}
          </Text>
        </View>

        <View style={styles.escrowTrustBanner}>
          <MaterialCommunityIcons name="shield-check" size={18} color="#10B981" />
          <Text style={styles.escrowTrustText}>{flowConfig.escrowText}</Text>
        </View>
      </View>
    </View>
  );
}
