import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import type { BookingCheckoutState } from '@/hooks/useBookingCheckout';
import { DAYS, MONTHS_LONG, fmtRange, fmtShort } from './bookingHelpers';
import { bookingStyles as styles } from './bookingStyles';

interface BookingDatesStepProps {
  checkout: BookingCheckoutState;
}

export function BookingDatesStep({ checkout }: BookingDatesStepProps) {
  const {
    exp,
    from,
    to,
    nights,
    activeDateTab,
    setActiveDateTab,
    viewMonth,
    setViewMonth,
    today,
    maxDate,
    isDateBlocked,
    handleDayPress,
    guests,
    setGuests,
    totalGuests,
    maxCapacity,
  } = checkout;

  return (
    <View style={{ gap: 20 }}>
      {/* 1. Trip Duration Header */}
      <View style={styles.tripHeadingBlock}>
        <Text style={styles.tripH1}>
          {from && to
            ? `${nights} night${nights !== 1 ? 's' : ''} in ${exp?.location || 'Kenyan Coast'}`
            : 'Select dates'}
        </Text>
        <Text style={styles.tripSub}>
          {from && to
            ? fmtRange(from, to)
            : 'Add your travel dates for exact pricing'}
        </Text>
      </View>

      {/* 2. Segmented Date Tabs (Check-in / Checkout) */}
      <View style={styles.dateTabsWrap}>
        <Pressable
          onPress={() => setActiveDateTab('checkin')}
          style={[
            styles.dateTab,
            activeDateTab === 'checkin' && styles.dateTabActive,
          ]}
        >
          <Text style={styles.dateTabLabel}>CHECK-IN</Text>
          <Text style={styles.dateTabVal}>
            {from ? fmtShort(from) : 'Add date'}
          </Text>
        </Pressable>

        <View style={styles.dateTabDivider} />

        <Pressable
          onPress={() => setActiveDateTab('checkout')}
          style={[
            styles.dateTab,
            activeDateTab === 'checkout' && styles.dateTabActive,
          ]}
        >
          <Text style={styles.dateTabLabel}>CHECKOUT</Text>
          <Text style={styles.dateTabVal}>
            {to ? fmtShort(to) : 'Add date'}
          </Text>
        </Pressable>
      </View>

      {/* 3. Interactive Month-by-Month Calendar */}
      <View style={styles.calendarContainer}>
        {/* Calendar Month Header & Navigation */}
        <View style={styles.calendarMonthHeader}>
          <Text style={styles.monthHeaderTitle}>
            {MONTHS_LONG[viewMonth.getMonth()]} {viewMonth.getFullYear()}
          </Text>
          <View style={styles.monthNavRow}>
            <Pressable
              onPress={() =>
                setViewMonth(
                  new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
                )
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
                setViewMonth(
                  new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
                )
              }
              style={styles.monthNavBtn}
            >
              <Feather name="chevron-right" size={20} color="#111111" />
            </Pressable>
          </View>
        </View>

        {/* Day of Week Labels */}
        <View style={styles.weekDaysRow}>
          {DAYS.map((d) => (
            <Text key={d} style={styles.weekDayText}>
              {d}
            </Text>
          ))}
        </View>

        {/* Days Grid */}
        <View style={styles.daysGrid}>
          {Array.from({
            length: new Date(
              viewMonth.getFullYear(),
              viewMonth.getMonth(),
              1,
            ).getDay(),
          }).map((_, i) => (
            <View key={`empty-${i}`} style={styles.dayCellEmpty} />
          ))}

          {Array.from({
            length: new Date(
              viewMonth.getFullYear(),
              viewMonth.getMonth() + 1,
              0,
            ).getDate(),
          }).map((_, i) => {
            const dayNum = i + 1;
            const dayDate = new Date(
              viewMonth.getFullYear(),
              viewMonth.getMonth(),
              dayNum,
            );
            const isPast = dayDate < today;
            const isFutureMax = dayDate > maxDate;
            const blocked = isDateBlocked(dayDate);
            const disabled = isPast || isFutureMax || blocked;

            const isFrom = from && dayDate.getTime() === from.getTime();
            const isTo = to && dayDate.getTime() === to.getTime();
            const inRange = from && to && dayDate > from && dayDate < to;

            return (
              <Pressable
                key={`day-${dayNum}`}
                onPress={() => handleDayPress(dayDate)}
                disabled={disabled}
                style={[
                  styles.dayCell,
                  inRange && styles.dayCellInRange,
                  isFrom && styles.dayCellStart,
                  isTo && styles.dayCellEnd,
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

      {/* 4. Guest Steppers */}
      <View style={styles.guestsSection}>
        <Text style={styles.guestsSectionHeading}>Guests</Text>

        {/* Adults */}
        <View style={styles.guestRow}>
          <View>
            <Text style={styles.guestTypeTitle}>Adults</Text>
            <Text style={styles.guestTypeSub}>Age 13+</Text>
          </View>
          <View style={styles.guestCounter}>
            <Pressable
              onPress={() => setGuests((g) => ({ ...g, adults: Math.max(1, g.adults - 1) }))}
              disabled={guests.adults <= 1}
              style={[styles.counterBtn, guests.adults <= 1 && styles.counterBtnDisabled]}
            >
              <Feather name="minus" size={16} color={guests.adults <= 1 ? '#CCCCCC' : '#111111'} />
            </Pressable>
            <Text style={styles.counterNum}>{guests.adults}</Text>
            <Pressable
              onPress={() => {
                if (totalGuests < maxCapacity) {
                  setGuests((g) => ({ ...g, adults: g.adults + 1 }));
                }
              }}
              disabled={totalGuests >= maxCapacity}
              style={[styles.counterBtn, totalGuests >= maxCapacity && styles.counterBtnDisabled]}
            >
              <Feather name="plus" size={16} color={totalGuests >= maxCapacity ? '#CCCCCC' : '#111111'} />
            </Pressable>
          </View>
        </View>

        {/* Children */}
        <View style={styles.guestRow}>
          <View>
            <Text style={styles.guestTypeTitle}>Children</Text>
            <Text style={styles.guestTypeSub}>Ages 2–12</Text>
          </View>
          <View style={styles.guestCounter}>
            <Pressable
              onPress={() => setGuests((g) => ({ ...g, children: Math.max(0, g.children - 1) }))}
              disabled={guests.children <= 0}
              style={[styles.counterBtn, guests.children <= 0 && styles.counterBtnDisabled]}
            >
              <Feather name="minus" size={16} color={guests.children <= 0 ? '#CCCCCC' : '#111111'} />
            </Pressable>
            <Text style={styles.counterNum}>{guests.children}</Text>
            <Pressable
              onPress={() => {
                if (totalGuests < maxCapacity) {
                  setGuests((g) => ({ ...g, children: g.children + 1 }));
                }
              }}
              disabled={totalGuests >= maxCapacity}
              style={[styles.counterBtn, totalGuests >= maxCapacity && styles.counterBtnDisabled]}
            >
              <Feather name="plus" size={16} color={totalGuests >= maxCapacity ? '#CCCCCC' : '#111111'} />
            </Pressable>
          </View>
        </View>

        {/* Infants */}
        <View style={styles.guestRow}>
          <View>
            <Text style={styles.guestTypeTitle}>Infants</Text>
            <Text style={styles.guestTypeSub}>Under 2</Text>
          </View>
          <View style={styles.guestCounter}>
            <Pressable
              onPress={() => setGuests((g) => ({ ...g, infants: Math.max(0, g.infants - 1) }))}
              disabled={guests.infants <= 0}
              style={[styles.counterBtn, guests.infants <= 0 && styles.counterBtnDisabled]}
            >
              <Feather name="minus" size={16} color={guests.infants <= 0 ? '#CCCCCC' : '#111111'} />
            </Pressable>
            <Text style={styles.counterNum}>{guests.infants}</Text>
            <Pressable
              onPress={() => setGuests((g) => ({ ...g, infants: g.infants + 1 }))}
              style={styles.counterBtn}
            >
              <Feather name="plus" size={16} color="#111111" />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
