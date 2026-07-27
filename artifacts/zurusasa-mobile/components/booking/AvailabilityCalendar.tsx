import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';

const ORANGE = '#F26522';
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export interface BlockedRange {
  from: Date;
  to: Date;
}

interface AvailabilityCalendarProps {
  startDate?: Date;
  endDate?: Date;
  viewMonth: Date;
  blockedRanges?: BlockedRange[];
  minNights?: number;
  maxNights?: number;
  onDayPress: (day: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  canPrev: boolean;
  canNext: boolean;
}

export function AvailabilityCalendar({
  startDate,
  endDate,
  viewMonth,
  blockedRanges = [],
  minNights = 1,
  onDayPress,
  onPrevMonth,
  onNextMonth,
  canPrev,
  canNext,
}: AvailabilityCalendarProps) {
  const { width } = useWindowDimensions();
  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 365);
    return d;
  }, [today]);

  const cells = useMemo(() => {
    const y = viewMonth.getFullYear();
    const m = viewMonth.getMonth();
    const lead = new Date(y, m, 1).getDay();
    const count = new Date(y, m + 1, 0).getDate();
    const arr: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= count; d++) arr.push(new Date(y, m, d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [viewMonth]);

  const isBlocked = (day: Date): boolean => {
    const t = day.getTime();
    return blockedRanges.some(
      (r) => t >= startOfDay(r.from).getTime() && t <= startOfDay(r.to).getTime(),
    );
  };

  return (
    <View style={styles.container}>
      {/* Month Header */}
      <View style={styles.monthHeader}>
        <Pressable
          onPress={onPrevMonth}
          disabled={!canPrev}
          hitSlop={12}
          style={[styles.navBtn, !canPrev && { opacity: 0.3 }]}
        >
          <Feather name="chevron-left" size={20} color="#222222" />
        </Pressable>

        <View style={styles.monthTitleBlock}>
          <Text style={styles.monthTitle}>
            {MONTHS[viewMonth.getMonth()]}
          </Text>
          <Text style={styles.monthYear}>{viewMonth.getFullYear()}</Text>
        </View>

        <Pressable
          onPress={onNextMonth}
          disabled={!canNext}
          hitSlop={12}
          style={[styles.navBtn, !canNext && { opacity: 0.3 }]}
        >
          <Feather name="chevron-right" size={20} color="#222222" />
        </Pressable>
      </View>

      {/* Weekday Labels */}
      <View style={styles.weekRow}>
        {WEEKDAYS_SHORT.map((w) => (
          <Text key={w} style={styles.weekday}>{w}</Text>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={styles.cell} />;

          const t = day.getTime();
          const todayT = today.getTime();
          const isPast = t < todayT;
          const isBeyondMax = t > maxDate.getTime();
          const blocked = isBlocked(day);
          const disabled = isPast || isBeyondMax || blocked;

          const isToday = t === todayT;
          const isStart = startDate ? t === startOfDay(startDate).getTime() : false;
          const isEnd = endDate ? t === startOfDay(endDate).getTime() : false;
          const inRange =
            startDate && endDate
              ? t > startOfDay(startDate).getTime() && t < startOfDay(endDate).getTime()
              : false;

          // Range band edges
          const isRangeLeft = isStart && endDate;
          const isRangeRight = isEnd && startDate;

          return (
            <View key={i} style={styles.cell}>
              {/* Range fill band */}
              {inRange ? (
                <View style={styles.rangeFill} />
              ) : isRangeLeft ? (
                <View style={[styles.rangeFill, { left: '50%' }]} />
              ) : isRangeRight ? (
                <View style={[styles.rangeFill, { right: '50%' }]} />
              ) : null}

              <Pressable
                onPress={() => !disabled && onDayPress(day)}
                style={[
                  styles.dayBtn,
                  isStart || isEnd ? styles.daySelected : null,
                  isToday && !isStart && !isEnd ? styles.dayToday : null,
                ]}
              >
                {blocked && !isStart && !isEnd ? (
                  <View style={styles.blockedDot} />
                ) : null}
                <Text
                  style={[
                    styles.dayText,
                    disabled ? styles.dayDisabled : null,
                    isStart || isEnd ? styles.daySelectedText : null,
                    inRange ? styles.dayRangeText : null,
                    isToday && !isStart && !isEnd ? styles.dayTodayText : null,
                  ]}
                >
                  {day.getDate()}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: ORANGE }]} />
          <Text style={styles.legendText}>Selected</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' }]} />
          <Text style={styles.legendText}>Available</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.blockedLegendDot} />
          <Text style={styles.legendText}>Unavailable</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  monthTitleBlock: {
    alignItems: 'center',
    gap: 1,
  },
  monthTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  monthYear: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#9CA3AF',
    letterSpacing: 0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  rangeFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F26522' + '18',
    top: 6,
    bottom: 6,
    left: 0,
    right: 0,
  },
  dayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  daySelected: {
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  dayToday: {
    borderWidth: 1.5,
    borderColor: ORANGE,
  },
  dayText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  dayDisabled: {
    color: '#D1D5DB',
  },
  daySelectedText: {
    color: '#FFFFFF',
    fontFamily: 'DMSans_700Bold',
  },
  dayRangeText: {
    color: '#F26522',
    fontFamily: 'DMSans_600SemiBold',
  },
  dayTodayText: {
    color: ORANGE,
    fontFamily: 'DMSans_700Bold',
  },
  blockedDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EF4444',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F7F7F7',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  blockedLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  legendText: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
});
