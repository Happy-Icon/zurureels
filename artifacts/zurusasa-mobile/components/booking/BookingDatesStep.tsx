import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import type { BookingCheckoutState } from '@/hooks/useBookingCheckout';
import { formatEventScheduleBadge } from '@/constants/taxonomy';
import { BRAND_ORANGE, DAYS, MONTHS_LONG, fmtRange, fmtShort } from './bookingHelpers';
import { isFlatPriceUnit } from './categoryFlowConfig';
import { bookingStyles as styles } from './bookingStyles';

interface BookingStepProps {
  checkout: BookingCheckoutState;
}

function CalendarPicker({
  checkout,
  isRangePicker,
}: {
  checkout: BookingCheckoutState;
  isRangePicker: boolean;
}) {
  const {
    from,
    to,
    activeDateTab,
    setActiveDateTab,
    viewMonth,
    setViewMonth,
    today,
    maxSelectableDate,
    isDateBlocked,
    handleDayPress,
  } = checkout;

  return (
    <>
      {isRangePicker ? (
        <View style={styles.dateTabsWrap}>
          <Pressable
            onPress={() => setActiveDateTab('checkin')}
            style={[styles.dateTab, activeDateTab === 'checkin' && styles.dateTabActive]}
          >
            <Text style={styles.dateTabLabel}>CHECK-IN</Text>
            <Text style={styles.dateTabVal}>{from ? fmtShort(from) : 'Add date'}</Text>
          </Pressable>

          <View style={styles.dateTabDivider} />

          <Pressable
            onPress={() => setActiveDateTab('checkout')}
            style={[styles.dateTab, activeDateTab === 'checkout' && styles.dateTabActive]}
          >
            <Text style={styles.dateTabLabel}>CHECKOUT</Text>
            <Text style={styles.dateTabVal}>{to ? fmtShort(to) : 'Add date'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={localStyles.singleDateBanner}>
          <Ionicons name="calendar-outline" size={18} color={BRAND_ORANGE} />
          <View style={{ flex: 1 }}>
            <Text style={localStyles.singleDateLabel}>SELECTED DATE</Text>
            <Text style={localStyles.singleDateVal}>
              {from ? fmtShort(from) : 'Tap a day on the calendar'}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.calendarContainer}>
        <View style={styles.calendarMonthHeader}>
          <Text style={styles.monthHeaderTitle}>
            {MONTHS_LONG[viewMonth.getMonth()]} {viewMonth.getFullYear()}
          </Text>
          <View style={styles.monthNavRow}>
            <Pressable
              onPress={() =>
                setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
              }
              disabled={
                viewMonth.getFullYear() === today.getFullYear() &&
                viewMonth.getMonth() <= today.getMonth()
              }
              style={styles.monthNavBtn}
            >
              <Feather name="chevron-left" size={20} color="#111111" />
            </Pressable>
            <Pressable
              onPress={() =>
                setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
              }
              disabled={
                viewMonth.getFullYear() > maxSelectableDate.getFullYear() ||
                (viewMonth.getFullYear() === maxSelectableDate.getFullYear() &&
                  viewMonth.getMonth() >= maxSelectableDate.getMonth())
              }
              style={styles.monthNavBtn}
            >
              <Feather name="chevron-right" size={20} color="#111111" />
            </Pressable>
          </View>
        </View>

        <View style={styles.weekDaysRow}>
          {DAYS.map((d) => (
            <Text key={d} style={styles.weekDayText}>
              {d}
            </Text>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {Array.from({
            length: new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay(),
          }).map((_, i) => (
            <View key={`empty-${i}`} style={styles.dayCellEmpty} />
          ))}

          {Array.from({
            length: new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate(),
          }).map((_, i) => {
            const dayNum = i + 1;
            const dayDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), dayNum);
            const isPast = dayDate < today;
            const isFutureMax = dayDate > maxSelectableDate;
            const blocked = isDateBlocked(dayDate);
            const disabled = isPast || isFutureMax || blocked;

            const isFrom = Boolean(from && dayDate.getTime() === from.getTime());
            const isTo = Boolean(isRangePicker && to && dayDate.getTime() === to.getTime());
            const inRange = Boolean(
              isRangePicker && from && to && dayDate > from && dayDate < to,
            );

            return (
              <Pressable
                key={`day-${dayNum}`}
                onPress={() => handleDayPress(dayDate)}
                disabled={disabled}
                style={[
                  styles.dayCell,
                  inRange && styles.dayCellInRange,
                  isFrom && isRangePicker && styles.dayCellStart,
                  isTo && isRangePicker && styles.dayCellEnd,
                ]}
              >
                <View
                  style={[
                    styles.dayNumWrap,
                    (isFrom || isTo) && styles.dayNumWrapSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumText,
                      disabled && styles.dayNumTextDisabled,
                      inRange && styles.dayNumTextInRange,
                      (isFrom || isTo) && styles.dayNumTextSelected,
                    ]}
                  >
                    {dayNum}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );
}

function StepperRow({
  title,
  subtitle,
  value,
  min = 0,
  max,
  onDecrement,
  onIncrement,
}: {
  title: string;
  subtitle: string;
  value: number;
  min?: number;
  max?: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  const canDec = value > min;
  const canInc = max === undefined || value < max;

  return (
    <View style={styles.guestRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.guestTypeTitle}>{title}</Text>
        <Text style={styles.guestTypeSub}>{subtitle}</Text>
      </View>
      <View style={styles.guestCounter}>
        <Pressable
          onPress={onDecrement}
          disabled={!canDec}
          style={[styles.counterBtn, !canDec && styles.counterBtnDisabled]}
        >
          <Feather name="minus" size={16} color={canDec ? '#111111' : '#CCCCCC'} />
        </Pressable>
        <Text style={styles.counterNum}>{value}</Text>
        <Pressable
          onPress={onIncrement}
          disabled={!canInc}
          style={[styles.counterBtn, !canInc && styles.counterBtnDisabled]}
        >
          <Feather name="plus" size={16} color={canInc ? '#111111' : '#CCCCCC'} />
        </Pressable>
      </View>
    </View>
  );
}

function ChipSelector({
  heading,
  options,
  selected,
  onSelect,
  icon,
}: {
  heading: string;
  options: string[];
  selected: string;
  onSelect: (val: string) => void;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}) {
  if (options.length === 0) return null;

  return (
    <View style={styles.guestsSection}>
      <Text style={styles.guestsSectionHeading}>{heading}</Text>
      <View style={localStyles.chipWrap}>
        {options.map((opt) => {
          const active = selected === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onSelect(opt)}
              style={[localStyles.slotChip, active && localStyles.slotChipActive]}
            >
              <Ionicons
                name={icon}
                size={14}
                color={active ? '#FFFFFF' : '#4B5563'}
              />
              <Text style={[localStyles.slotChipText, active && localStyles.slotChipTextActive]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function BookingDatesStep({ checkout }: BookingStepProps) {
  const {
    exp,
    flowConfig,
    priceUnit,
    durationInfo,
    operatingHours,
    from,
    to,
    nights,
    selectedTimeSlot,
    setSelectedTimeSlot,
    seatingPreference,
    setSeatingPreference,
    specialRequests,
    setSpecialRequests,
    guests,
    setGuests,
    totalGuests,
    maxCapacity,
  } = checkout;

  const flatPricing = isFlatPriceUnit(priceUnit);

  return (
    <View style={{ gap: 20 }}>
      {/* Header */}
      <View style={styles.tripHeadingBlock}>
        {flowConfig.kind === 'stay' ? (
          <>
            <Text style={styles.tripH1}>
              {from && to
                ? `${nights} night${nights !== 1 ? 's' : ''} in ${exp?.location || 'Kenyan Coast'}`
                : 'Select dates'}
            </Text>
            <Text style={styles.tripSub}>
              {from && to ? fmtRange(from, to) : 'Add your travel dates for exact pricing'}
            </Text>
          </>
        ) : flowConfig.kind === 'dining' ? (
          <>
            <Text style={styles.tripH1}>Reserve your table</Text>
            <Text style={styles.tripSub}>
              {operatingHours
                ? `Open ${operatingHours} · ${exp?.location || 'Kenyan Coast'}`
                : `Pick a date, seating time & party size in ${exp?.location || 'Kenyan Coast'}`}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.tripH1}>Pick date & session</Text>
            <Text style={styles.tripSub}>
              {durationInfo ? `${durationInfo} · ` : ''}
              {from ? fmtShort(from) : 'Select a date'}
              {selectedTimeSlot ? ` · ${selectedTimeSlot}` : ''}
            </Text>
          </>
        )}
      </View>

      {/* Calendar */}
      <CalendarPicker checkout={checkout} isRangePicker={flowConfig.isRangePicker} />

      {/* Time Slot / Session Selector (Activities & Dining) */}
      {flowConfig.requiresTimeSlot ? (
        <ChipSelector
          heading={flowConfig.kind === 'dining' ? 'Seating time' : 'Departure / session time'}
          options={flowConfig.defaultTimeSlots}
          selected={selectedTimeSlot}
          onSelect={setSelectedTimeSlot}
          icon="time-outline"
        />
      ) : null}

      {/* Flat charter / group info callout */}
      {flatPricing && flowConfig.kind === 'activity' ? (
        <View style={localStyles.flatRateCallout}>
          <Ionicons name="boat-outline" size={17} color={BRAND_ORANGE} />
          <Text style={localStyles.flatRateCalloutText}>
            Private / flat rate per {priceUnit} — includes up to {maxCapacity} guests for one price.
          </Text>
        </View>
      ) : null}

      {/* Dining Seating Preference & Special Requests */}
      {flowConfig.kind === 'dining' ? (
        <>
          <ChipSelector
            heading="Seating preference"
            options={flowConfig.seatingOptions}
            selected={seatingPreference}
            onSelect={setSeatingPreference}
            icon="restaurant-outline"
          />

          <View style={styles.guestsSection}>
            <Text style={styles.guestsSectionHeading}>Party size</Text>
            <StepperRow
              title="Guests"
              subtitle={`Up to ${maxCapacity} diners per table`}
              value={guests.adults}
              min={1}
              max={maxCapacity}
              onDecrement={() => setGuests((g) => ({ ...g, adults: Math.max(1, g.adults - 1), children: 0 }))}
              onIncrement={() =>
                setGuests((g) => ({
                  ...g,
                  adults: Math.min(maxCapacity, g.adults + 1),
                  children: 0,
                }))
              }
            />
          </View>

          <View style={styles.guestsSection}>
            <Text style={styles.guestsSectionHeading}>Dietary or occasion notes (Optional)</Text>
            <TextInput
              value={specialRequests}
              onChangeText={setSpecialRequests}
              placeholder="e.g. Birthday table, wheelchair access, seafood allergy"
              placeholderTextColor="#9CA3AF"
              multiline
              style={localStyles.noteInput}
            />
          </View>
        </>
      ) : (
        /* Stay or Land/Water Participant Steppers */
        <View style={styles.guestsSection}>
          <Text style={styles.guestsSectionHeading}>{flowConfig.participantSectionLabel}</Text>

          <StepperRow
            title="Adults"
            subtitle="Age 13+"
            value={guests.adults}
            min={1}
            max={maxCapacity - guests.children}
            onDecrement={() => setGuests((g) => ({ ...g, adults: Math.max(1, g.adults - 1) }))}
            onIncrement={() => {
              if (totalGuests < maxCapacity) {
                setGuests((g) => ({ ...g, adults: g.adults + 1 }));
              }
            }}
          />

          <StepperRow
            title="Children"
            subtitle="Ages 2–12"
            value={guests.children}
            min={0}
            max={maxCapacity - guests.adults}
            onDecrement={() => setGuests((g) => ({ ...g, children: Math.max(0, g.children - 1) }))}
            onIncrement={() => {
              if (totalGuests < maxCapacity) {
                setGuests((g) => ({ ...g, children: g.children + 1 }));
              }
            }}
          />

          {flowConfig.isStay ? (
            <StepperRow
              title="Infants"
              subtitle="Under 2"
              value={guests.infants}
              min={0}
              onDecrement={() => setGuests((g) => ({ ...g, infants: Math.max(0, g.infants - 1) }))}
              onIncrement={() => setGuests((g) => ({ ...g, infants: g.infants + 1 }))}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

export function BookingEventTicketsStep({ checkout }: BookingStepProps) {
  const {
    thumbnail,
    title,
    exp,
    eventDetails,
    eventTiers,
    selectedTierId,
    setSelectedTierId,
    guests,
    setGuests,
    maxCapacity,
    from,
    eventLifecycle,
    eventSalesClosed,
  } = checkout;

  const evDateRaw = (eventDetails?.event_date as string | undefined) || from?.toISOString();
  const scheduleBadge = formatEventScheduleBadge(
    evDateRaw,
    eventDetails?.start_time as string | undefined,
  );
  const isEventLive = Boolean(eventLifecycle?.isLive);

  return (
    <View style={{ gap: 20 }}>
      {/* Locked Event Header Card */}
      <View style={styles.mainCard}>
        <View style={styles.listingSnippetRow}>
          <Image source={{ uri: thumbnail }} style={styles.listingThumb} contentFit="cover" />
          <View style={styles.listingSnippetMeta}>
            <Text style={styles.snippetTitle} numberOfLines={2}>
              {title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <Ionicons
                name={isEventLive ? 'radio' : 'calendar-outline'}
                size={13}
                color={isEventLive ? '#DC2626' : BRAND_ORANGE}
              />
              <Text
                style={{
                  fontSize: 12.5,
                  fontFamily: 'DMSans_700Bold',
                  color: isEventLive ? '#DC2626' : BRAND_ORANGE,
                }}
              >
                {isEventLive ? 'LIVE NOW · ' : ''}
                {eventLifecycle?.timeWindowLabel || scheduleBadge}
              </Text>
            </View>
            {eventLifecycle?.countdownLabel ? (
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'DMSans_700Bold',
                  color: isEventLive ? '#DC2626' : '#111111',
                }}
                numberOfLines={1}
              >
                {eventLifecycle.countdownLabel}
              </Text>
            ) : null}
            <Text style={{ fontSize: 12, fontFamily: 'DMSans_400Regular', color: '#6B7280' }} numberOfLines={1}>
              {eventDetails?.location || exp?.location || 'Kenyan Coast'}
            </Text>
          </View>
        </View>
      </View>

      {eventSalesClosed ? (
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#FECACA',
            backgroundColor: '#FEF2F2',
            padding: 13,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Ionicons name="lock-closed-outline" size={18} color="#DC2626" />
          <Text style={{ flex: 1, fontSize: 12.5, fontFamily: 'DMSans_500Medium', color: '#991B1B', lineHeight: 18 }}>
            {isEventLive
              ? 'This event is currently live. Advance ticket reservations are closed—enquire with the organizer for door entry.'
              : 'This event has ended and tickets are no longer available.'}
          </Text>
        </View>
      ) : null}

      {/* Ticket Tiers */}
      <View style={[styles.guestsSection, eventSalesClosed ? { opacity: 0.45 } : null]} pointerEvents={eventSalesClosed ? 'none' : 'auto'}>
        <Text style={styles.guestsSectionHeading}>
          {eventTiers.length > 1 ? 'Choose ticket tier' : 'Pass type'}
        </Text>
        <View style={{ gap: 10 }}>
          {eventTiers.map((tier) => {
            const active = tier.id === selectedTierId || (eventTiers.length === 1 && !selectedTierId);
            return (
              <Pressable
                key={tier.id}
                onPress={() => setSelectedTierId(tier.id)}
                style={[localStyles.tierCard, active && localStyles.tierCardActive]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={localStyles.tierLabel}>{tier.label}</Text>
                  {tier.description ? (
                    <Text style={localStyles.tierDesc}>{tier.description}</Text>
                  ) : null}
                </View>
                <Text style={localStyles.tierPrice}>
                  {tier.price === 0 ? 'FREE' : `KES ${tier.price.toLocaleString()}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Ticket Quantity */}
      <View style={[styles.guestsSection, eventSalesClosed ? { opacity: 0.45 } : null]} pointerEvents={eventSalesClosed ? 'none' : 'auto'}>
        <Text style={styles.guestsSectionHeading}>Quantity</Text>
        <StepperRow
          title="Tickets"
          subtitle={`Max ${maxCapacity} per order`}
          value={guests.adults}
          min={1}
          max={maxCapacity}
          onDecrement={() => setGuests((g) => ({ ...g, adults: Math.max(1, g.adults - 1), children: 0 }))}
          onIncrement={() =>
            setGuests((g) => ({
              ...g,
              adults: Math.min(maxCapacity, g.adults + 1),
              children: 0,
            }))
          }
        />
      </View>
    </View>
  );
}

export function BookingOfferClaimStep({ checkout }: BookingStepProps) {
  const {
    thumbnail,
    title,
    flowConfig,
    offerDetails,
    offerCountdown,
    price,
    originalOfferPrice,
    selectedTimeSlot,
    setSelectedTimeSlot,
    voucherQty,
    setVoucherQty,
    guests,
    setGuests,
    maxCapacity,
  } = checkout;

  const discountBadge = (offerDetails?.discount_label as string | undefined) || 'Limited Deal';
  const countdown = offerCountdown.countdownLabel;
  const savings =
    originalOfferPrice && originalOfferPrice > price ? originalOfferPrice - price : null;

  return (
    <View style={{ gap: 20 }}>
      {/* Offer Summary Banner */}
      <View style={styles.mainCard}>
        <View style={styles.listingSnippetRow}>
          <Image source={{ uri: thumbnail }} style={styles.listingThumb} contentFit="cover" />
          <View style={styles.listingSnippetMeta}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <View style={localStyles.offerBadge}>
                <Text style={localStyles.offerBadgeText}>{discountBadge}</Text>
              </View>
              <Text style={{ fontSize: 11.5, fontFamily: 'DMSans_600SemiBold', color: '#6B7280' }}>
                {countdown}
              </Text>
            </View>
            <Text style={styles.snippetTitle} numberOfLines={2}>
              {title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {originalOfferPrice ? (
                <Text style={localStyles.strikePrice}>KES {originalOfferPrice.toLocaleString()}</Text>
              ) : null}
              <Text style={{ fontSize: 14, fontFamily: 'DMSans_700Bold', color: '#111111' }}>
                {price === 0 ? 'Free Voucher Pass' : `KES ${price.toLocaleString()}`}
              </Text>
              {savings ? (
                <Text style={localStyles.saveTag}>Save KES {savings.toLocaleString()}</Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      {/* Redemption Date Picker */}
      <View style={styles.tripHeadingBlock}>
        <Text style={styles.tripH1}>{flowConfig.datesStepHeader}</Text>
        <Text style={styles.tripSub}>
          {flowConfig.isRangePicker
            ? 'Pick check-in & checkout dates before offer expiry'
            : 'Choose when you plan to redeem this offer'}
        </Text>
      </View>

      <CalendarPicker checkout={checkout} isRangePicker={flowConfig.isRangePicker} />

      {/* Optional Redemption Window */}
      {flowConfig.requiresTimeSlot ? (
        <ChipSelector
          heading="Preferred time window"
          options={flowConfig.defaultTimeSlots}
          selected={selectedTimeSlot}
          onSelect={setSelectedTimeSlot}
          icon="time-outline"
        />
      ) : null}

      {/* Voucher / Guest Count */}
      <View style={styles.guestsSection}>
        <Text style={styles.guestsSectionHeading}>
          {flowConfig.isRangePicker ? 'Guests' : 'Vouchers & guests'}
        </Text>
        {!flowConfig.isRangePicker ? (
          <StepperRow
            title="Vouchers / Deals"
            subtitle={price === 0 ? 'Digital passes to redeem on site' : 'Number of deal packages'}
            value={voucherQty}
            min={1}
            max={10}
            onDecrement={() => setVoucherQty((q) => Math.max(1, q - 1))}
            onIncrement={() => setVoucherQty((q) => Math.min(10, q + 1))}
          />
        ) : null}
        <StepperRow
          title="Guests attending"
          subtitle={`Max ${maxCapacity} guests`}
          value={guests.adults}
          min={1}
          max={maxCapacity}
          onDecrement={() => setGuests((g) => ({ ...g, adults: Math.max(1, g.adults - 1), children: 0 }))}
          onIncrement={() =>
            setGuests((g) => ({ ...g, adults: Math.min(maxCapacity, g.adults + 1), children: 0 }))
          }
        />
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  singleDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFF8F5',
  },
  singleDateLabel: {
    fontSize: 10.5,
    fontFamily: 'DMSans_700Bold',
    color: '#717171',
    letterSpacing: 0.5,
  },
  singleDateVal: {
    fontSize: 14.5,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
    marginTop: 1,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  slotChipActive: {
    backgroundColor: BRAND_ORANGE,
    borderColor: BRAND_ORANGE,
  },
  slotChipText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_600SemiBold',
    color: '#374151',
  },
  slotChipTextActive: {
    color: '#FFFFFF',
  },
  flatRateCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  flatRateCalloutText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: 'DMSans_500Medium',
    color: '#9A3412',
    lineHeight: 17,
  },
  noteInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#111111',
    backgroundColor: '#F9FAFB',
    textAlignVertical: 'top',
  },
  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  tierCardActive: {
    borderColor: BRAND_ORANGE,
    backgroundColor: '#FFF8F5',
  },
  tierLabel: {
    fontSize: 14.5,
    fontFamily: 'DMSans_700Bold',
    color: '#111111',
  },
  tierDesc: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },
  tierPrice: {
    fontSize: 14.5,
    fontFamily: 'DMSans_700Bold',
    color: BRAND_ORANGE,
  },
  offerBadge: {
    backgroundColor: BRAND_ORANGE,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  offerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontFamily: 'DMSans_700Bold',
  },
  strikePrice: {
    fontSize: 12.5,
    fontFamily: 'DMSans_400Regular',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  saveTag: {
    fontSize: 11.5,
    fontFamily: 'DMSans_700Bold',
    color: '#059669',
  },
});
